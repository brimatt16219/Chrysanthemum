import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// All 9 mutation types (mirrors src/data/flowers.ts)
const ALL_MUTATIONS = [
  "giant", "wet", "scorched", "frosted", "stellar",
  "prismatic", "gilded", "moonlit", "shocked", "windstruck",
];

// Mirrors isSpeciesMastered() in gameStore.ts
// A species is mastered when base + all 9 mutations are in discovered
function isSpeciesMastered(discovered: string[], speciesId: string): boolean {
  const total = 1 + ALL_MUTATIONS.length; // 10
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
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse input ───────────────────────────────────────────────────────────
    const { row, col, speciesId } = await req.json() as {
      row: number;
      col: number;
      speciesId: string;
    };

    if (typeof row !== "number" || typeof col !== "number" || typeof speciesId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid input: row, col, speciesId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load save ─────────────────────────────────────────────────────────────
    const { data: save, error: saveError } = await supabaseAdmin
      .from("game_saves")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (saveError || !save) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate plot ─────────────────────────────────────────────────────────
    const grid = save.grid as { id: string; plant: unknown }[][];
    const plot = grid[row]?.[col];

    if (!plot) {
      return new Response(JSON.stringify({ error: "Plot does not exist" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (plot.plant) {
      return new Response(JSON.stringify({ error: "Plot already occupied" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate seed ownership ───────────────────────────────────────────────
    const inventory = (save.inventory ?? []) as {
      speciesId: string;
      quantity: number;
      mutation?: string;
      isSeed?: boolean;
    }[];

    const seedItem = inventory.find((i) => i.speciesId === speciesId && i.isSeed);
    if (!seedItem || seedItem.quantity < 1) {
      return new Response(JSON.stringify({ error: "No seeds of this species in inventory" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      r.map((p, ci) => {
        if (ri === row && ci === col) return { ...p, plant: newPlant };
        return p;
      })
    );

    const newInventory = inventory
      .map((i) =>
        i.speciesId === speciesId && i.isSeed
          ? { ...i, quantity: i.quantity - 1 }
          : i
      )
      .filter((i) => i.quantity > 0);

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({
        grid:       newGrid,
        inventory:  newInventory,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Log action ────────────────────────────────────────────────────────────
    await supabaseAdmin.from("action_log").insert({
      user_id: user.id,
      action:  "plant_seed",
      payload: { row, col, speciesId },
      result:  { mastered, timePlanted: newPlant.timePlanted },
    });

    // ── Return delta ──────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        ok:        true,
        grid:      newGrid,
        inventory: newInventory,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("plant-seed error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
