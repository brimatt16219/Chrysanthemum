import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ── Mutation value multipliers (mirrors src/data/flowers.ts) ─────────────────
const MUTATION_MULTIPLIERS: Record<string, number> = {
  giant:      1.5,
  wet:        1.3,
  scorched:   1.4,
  frosted:    1.4,
  stellar:    2.0,
  prismatic:  3.0,
  gilded:     2.5,
  moonlit:    1.8,
  shocked:    1.6,
  windstruck: 1.5,
};

// ── Flower sell values (mirrors src/data/flowers.ts) ─────────────────────────
// Used to calculate mutation bonus coins on harvest.
// Keep in sync with flowers.ts whenever sell values change.
const FLOWER_SELL_VALUES: Record<string, number> = {
  // Common
  daisy:          10,
  sunflower:      13,
  marigold:       16,
  lavender:       18,
  petunia:        20,
  // Uncommon
  pearlwort:      42,
  snapdragon:     52,
  foxglove:       63,
  cosmos:         73,
  carnation:      84,
  tulip:          84,
  // Rare
  iris:          250,
  orchid:        310,
  peony:         370,
  water_lily:    430,
  bird_of_paradise: 500,
  // Legendary
  lotus:        3600,
  moonflower:   4500,
  dragonfruit_blossom: 5400,
  fire_lily:    6300,
  black_rose:   7200,
  // Mythic
  nebula_drift:    50000,
  aurora_bloom:    62500,
  void_orchid:     75000,
  celestial_rose:  87500,
  chrysanthemum:  100000,
  // Exalted
  starweave:      250000,
  eclipse_lily:   312500,
  solarburst:     375000,
  duskpetal:      437500,
  aether_bloom:   500000,
  // Prismatic
  rainbow_daisy:      1000000,
  prism_lotus:        1200000,
  kaleidoscope_rose:  1400000,
  aurora_orchid:      1600000,
  cosmic_sunflower:   1800000,
  princess_blossom:   2000000,
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a client scoped to the requesting user (respects RLS)
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Create a service-role client for writes (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse input ─────────────────────────────────────────────────────────
    const { row, col } = await req.json() as { row: number; col: number };
    if (typeof row !== "number" || typeof col !== "number") {
      return new Response(JSON.stringify({ error: "Invalid input: row and col required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load save ────────────────────────────────────────────────────────────
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

    // ── Validate plot ────────────────────────────────────────────────────────
    const grid = save.grid as { id: string; plant: Record<string, unknown> | null }[][];
    const plot = grid[row]?.[col];

    if (!plot) {
      return new Response(JSON.stringify({ error: "Plot does not exist" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!plot.plant) {
      return new Response(JSON.stringify({ error: "No plant in this plot" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plant = plot.plant as {
      speciesId: string;
      bloomedAt?: number;
      mutation?: string | null;
    };

    // A plant is harvestable if bloomedAt is stamped and in the past
    if (!plant.bloomedAt || plant.bloomedAt > Date.now()) {
      return new Response(JSON.stringify({ error: "Plant is not ready to harvest" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Compute changes ──────────────────────────────────────────────────────
    const { speciesId } = plant;
    const mutation = (plant.mutation as string | null | undefined) ?? undefined;
    const sellValue = FLOWER_SELL_VALUES[speciesId] ?? 0;

    // Mutation bonus coins paid immediately on harvest (mirrors gameStore.ts)
    const mutMultiplier = mutation ? (MUTATION_MULTIPLIERS[mutation] ?? 1) : 1;
    const bonusCoins = mutation
      ? Math.floor(sellValue * (mutMultiplier - 1))
      : 0;

    // Clear the plot
    const newGrid = grid.map((r, ri) =>
      r.map((p, ci) => {
        if (ri === row && ci === col) return { ...p, plant: null };
        return p;
      })
    );

    // Add bloom to inventory
    const inventory = (save.inventory ?? []) as {
      speciesId: string;
      quantity: number;
      mutation?: string;
      isSeed?: boolean;
    }[];

    const existingIdx = inventory.findIndex(
      (i) => i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
    );

    const newInventory = existingIdx >= 0
      ? inventory.map((i, idx) =>
          idx === existingIdx ? { ...i, quantity: i.quantity + 1 } : i
        )
      : [...inventory, { speciesId, quantity: 1, mutation, isSeed: false }];

    // Update discovered (codex)
    const discovered = (save.discovered ?? []) as string[];
    const newDiscovered = [...discovered];

    const baseKey = speciesId;
    if (!newDiscovered.includes(baseKey)) newDiscovered.push(baseKey);
    if (mutation) {
      const mutKey = `${speciesId}:${mutation}`;
      if (!newDiscovered.includes(mutKey)) newDiscovered.push(mutKey);
    }

    const newCoins = (save.coins as number) + bonusCoins;

    // ── Write to DB ──────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({
        coins:      newCoins,
        grid:       newGrid,
        inventory:  newInventory,
        discovered: newDiscovered,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Log action ───────────────────────────────────────────────────────────
    await supabaseAdmin.from("action_log").insert({
      user_id: user.id,
      action:  "harvest",
      payload: { row, col, speciesId, mutation },
      result:  { bonusCoins, newCoins },
    });

    // ── Return updated state delta ────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        ok: true,
        coins:      newCoins,
        grid:       newGrid,
        inventory:  newInventory,
        discovered: newDiscovered,
        mutation,
        bonusCoins,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("harvest error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
