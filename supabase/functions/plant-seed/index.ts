import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ── Local JWT verification — no network round trip ────────────────────────────
async function verifyJWT(token: string): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(Deno.env.get("SUPABASE_JWT_SECRET")!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sig = Uint8Array.from(
      atob(b64url(sigB64)),
      (c) => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      "HMAC", key, sig,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(b64url(payloadB64)));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload.sub as string;
  } catch {
    return null;
  }
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Decode token without verification to get userId for parallel DB load
    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Parse input ───────────────────────────────────────────────────────────
    const { row, col, speciesId } = await req.json() as {
      row: number; col: number; speciesId: string;
    };

    if (typeof row !== "number" || typeof col !== "number" || typeof speciesId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid input: row, col, speciesId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [verifiedId, saveResult] = await Promise.all([
      verifyJWT(token),
      supabaseAdmin.from("game_saves").select("grid, inventory, discovered").eq("user_id", userId).single(),
    ]);

    if (!verifiedId || verifiedId !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (saveResult.error || !saveResult.data) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const save = saveResult.data;

    // ── Validate plot ─────────────────────────────────────────────────────────
    const grid = save.grid as { id: string; plant: unknown }[][];
    const plot = grid[row]?.[col];

    if (!plot) {
      return new Response(JSON.stringify({ error: "Plot does not exist" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (plot.plant) {
      return new Response(JSON.stringify({ error: "Plot already occupied" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate seed ownership ───────────────────────────────────────────────
    const inventory = (save.inventory ?? []) as {
      speciesId: string; quantity: number; mutation?: string; isSeed?: boolean;
    }[];

    const seedItem = inventory.find((i) => i.speciesId === speciesId && i.isSeed);
    if (!seedItem || seedItem.quantity < 1) {
      return new Response(JSON.stringify({ error: "No seeds of this species in inventory" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Compute changes ───────────────────────────────────────────────────────
    const discovered = (save.discovered ?? []) as string[];
    const mastered   = isSpeciesMastered(discovered, speciesId);

    const newPlant = {
      speciesId,
      timePlanted: Date.now(),
      fertilizer:  null,
      ...(mastered ? { masteredBonus: 1.25 } : {}),
    };

    const newGrid = grid.map((r, ri) =>
      r.map((p, ci) => ri === row && ci === col ? { ...p, plant: newPlant } : p)
    );

    const newInventory = inventory
      .map((i) => i.speciesId === speciesId && i.isSeed ? { ...i, quantity: i.quantity - 1 } : i)
      .filter((i) => i.quantity > 0);

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({ grid: newGrid, inventory: newInventory, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "plant_seed",
      payload: { row, col, speciesId },
      result:  { mastered, timePlanted: newPlant.timePlanted },
    });

    return new Response(
      JSON.stringify({ ok: true, grid: newGrid, inventory: newInventory }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("plant-seed error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
