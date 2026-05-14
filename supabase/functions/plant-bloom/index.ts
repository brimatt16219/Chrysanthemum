import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// base64url → base64 with proper padding for Deno's strict atob()
function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

// All 9 mutation types (mirrors src/data/flowers.ts)
const ALL_MUTATIONS = [
  "golden", "rainbow", "giant", "moonlit", "frozen",
  "scorched", "wet", "windstruck", "shocked",
];

function isSpeciesMastered(discovered: string[], speciesId: string): boolean {
  const total = 1 + ALL_MUTATIONS.length;
  let found = 0;
  if (discovered.includes(speciesId)) found++;
  for (const mut of ALL_MUTATIONS) {
    if (discovered.includes(`${speciesId}:${mut}`)) found++;
  }
  return found === total;
}

Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const err = (msg: string, status = 400) => json({ error: msg }, status);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return err("Unauthorized", 401);
    }

    // ── Parse input ───────────────────────────────────────────────────────────
    const { row, col, speciesId, mutation } = await req.json() as {
      row: number; col: number; speciesId: string; mutation?: string;
    };

    if (typeof row !== "number" || typeof col !== "number" || typeof speciesId !== "string") {
      return err("Invalid input: row, col, speciesId required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin
        .from("game_saves")
        .select("grid, inventory, discovered, updated_at")
        .eq("user_id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return err("Unauthorized", 401);
    }
    if (saveResult.error || !saveResult.data) {
      return err("Save not found", 404);
    }

    const save          = saveResult.data;
    const priorUpdatedAt = save.updated_at as string;

    // ── Validate plot ─────────────────────────────────────────────────────────
    const grid = save.grid as { id: string; plant: unknown; gear: unknown }[][];
    const plot = grid[row]?.[col];
    if (!plot)        return err("Plot does not exist");
    if (plot.plant)   return err("Plot already occupied");
    if (plot.gear)    return err("Plot has gear — remove it first");

    // ── Validate bloom ownership ──────────────────────────────────────────────
    const inventory = (save.inventory ?? []) as {
      speciesId: string; quantity: number; mutation?: string; isSeed?: boolean;
    }[];

    // Match a non-seed bloom with matching speciesId and mutation (undefined ≡ no mutation)
    const bloomItem = inventory.find(
      (i) =>
        i.speciesId === speciesId &&
        !i.isSeed &&
        (i.mutation ?? null) === (mutation ?? null)
    );
    if (!bloomItem || bloomItem.quantity < 1) {
      return err("No bloom of this species in inventory");
    }

    // ── Build the new plant ───────────────────────────────────────────────────
    // timePlanted = 0 (Unix epoch) ensures the plant is always considered bloomed
    // on both server and client — any elapsed-time check will exceed the bloom threshold.
    const discovered = (save.discovered ?? []) as string[];
    const mastered   = isSpeciesMastered(discovered, speciesId);

    const now = Date.now();
    const newPlant = {
      speciesId,
      timePlanted: 0,          // epoch → always past bloom threshold
      bloomedAt:   now,        // placed blooms are immediately at bloom stage
      fertilizer:  null,
      ...(mutation ? { mutation } : {}),
      ...(mastered ? { masteredBonus: 1.25 } : {}),
    };

    const newGrid = grid.map((r, ri) =>
      r.map((p, ci) => ri === row && ci === col ? { ...p, plant: newPlant } : p)
    );

    const newInventory = inventory
      .map((i) =>
        i.speciesId === speciesId && !i.isSeed && (i.mutation ?? null) === (mutation ?? null)
          ? { ...i, quantity: i.quantity - 1 }
          : i
      )
      .filter((i) => i.quantity > 0);

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({ grid: newGrid, inventory: newInventory, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (updateError || !updateData) {
      return err("Save was modified by another action", 409);
    }

    // plant_timings: set to epoch so harvest always considers this plot bloomed.
    // Awaited (not void) — harvest reads this immediately after the client gets
    // the success response; a fire-and-forget race would cause "not ready to harvest".
    await supabaseAdmin.from("plant_timings").upsert({
      user_id:    userId,
      row,
      col,
      planted_at: "1970-01-01T00:00:00.000Z",
    }, { onConflict: "user_id,row,col" });

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "plant_bloom",
      payload: { row, col, speciesId, mutation: mutation ?? null },
    });

    return new Response(
      JSON.stringify({ ok: true, grid: newGrid, inventory: newInventory, serverUpdatedAt: updateData.updated_at }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("plant-bloom error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
