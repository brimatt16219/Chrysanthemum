import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inline CORS headers — _shared/ is not bundled when deploying individual functions on Windows
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Mutation value multipliers (mirrors src/data/flowers.ts) ─────────────────
const MUTATION_MULTIPLIERS: Record<string, number> = {
  golden:     4.0,
  rainbow:    3.0,
  giant:      2.0,
  moonlit:    2.5,
  frozen:     2.0,
  scorched:   2.0,
  wet:        1.5,
  windstruck: 1.1,
  shocked:    2.5,
};

// ── Flower sell values (mirrors src/data/flowers.ts) ─────────────────────────
// Used to calculate mutation bonus coins on harvest.
// Keep in sync with flowers.ts whenever sell values change.
const FLOWER_SELL_VALUES: Record<string, number> = {
  // Common
  quickgrass:       10,
  dustweed:         10,
  sprig:            12,
  dewdrop:          12,
  pebblebloom:      12,
  ember_moss:       12,
  dandelion:        13,
  clover:           13,
  violet:           14,
  lemongrass:       14,
  daisy:            14,
  honeywort:        14,
  buttercup:        14,
  dawnpetal:        15,
  poppy:            15,
  chamomile:        15,
  marigold:         16,
  sunflower:        17,
  coppercup:        17,
  ivybell:          17,
  thornberry:       18,
  saltmoss:         19,
  ashpetal:         19,
  snowdrift:        20,
  // Uncommon
  swiftbloom:       42,
  shortcress:       44,
  thornwhistle:     48,
  starwort:         50,
  mintleaf:         50,
  tulip:            50,
  inkbloom:         52,
  hyacinth:         53,
  snapdragon:       55,
  beebalm:          57,
  candleflower:     57,
  carnation:        59,
  ribbonweed:       60,
  hibiscus:         62,
  wildberry:        64,
  frostbell:        63,
  bluebell:         64,
  cherry_blossom:   66,
  rose:             67,
  peacockflower:    69,
  bamboo_bloom:     70,
  hummingbloom:     70,
  water_lily:       71,
  lanternflower:    73,
  dovebloom:        76,
  coral_bells:      78,
  sundew:           81,
  bubblebloom:      84,
  // Rare
  flashpetal:       250,
  rushwillow:       260,
  sweetheart_lily:  280,
  glassbell:        285,
  stormcaller:      290,
  lavender:         300,
  amber_crown:      300,
  peach_blossom:    300,
  foxglove:         320,
  butterbloom:      330,
  peony:            340,
  tidebloom:        350,
  starweave:        350,
  wisteria:         360,
  dreamcup:         360,
  coralbell:        370,
  foxfire:          375,
  bird_of_paradise: 380,
  solarbell:        380,
  moonpetal:        390,
  orchid:           400,
  duskrose:         410,
  passionflower:    420,
  glasswing:        435,
  mirror_orchid:    450,
  stargazer_lily:   460,
  prism_lily:       480,
  dusk_orchid:      500,
  // Legendary
  firstbloom:       3_600,
  haste_lily:       3_800,
  verdant_crown:    4_200,
  ironwood_bloom:   4_300,
  sundial:          4_400,
  lotus:            4_500,
  candy_blossom:    4_700,
  prismbark:        4_700,
  dolphinia:        4_800,
  ghost_orchid:     4_800,
  nestbloom:        5_000,
  black_rose:       5_100,
  pumpkin_blossom:  5_100,
  starburst_lily:   5_100,
  sporebloom:       5_300,
  fire_lily:        5_400,
  stargazer:        5_600,
  fullmoon_bloom:   5_700,
  ice_crown:        5_700,
  diamond_bloom:    6_000,
  oracle_eye:       6_300,
  halfmoon_bloom:   6_600,
  aurora_bloom:     6_700,
  mirrorpetal:      6_900,
  emberspark:       7_200,
  // Mythic
  blink_rose:       50_000,
  dawnfire:         53_000,
  moonflower:       58_000,
  jellybloom:       59_000,
  celestial_bloom:  63_000,
  void_blossom:     69_000,
  seraph_wing:      77_000,
  solar_rose:       79_000,
  nebula_drift:     84_000,
  superbloom:       90_000,
  wanderbloom:      90_000,
  chrysanthemum:   100_000,
  // Exalted
  umbral_bloom:    250_000,
  obsidian_rose:   285_000,
  duskmantle:      310_000,
  graveweb:        355_000,
  nightwing:       430_000,
  ashenveil:       465_000,
  voidfire:        500_000,
  // Prismatic
  dreambloom:    1_000_000,
  fairy_blossom: 1_200_000,
  lovebind:      1_350_000,
  eternal_heart: 1_550_000,
  nova_bloom:    1_800_000,
  princess_blossom: 2_000_000,
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

    // Client scoped to the requesting user (respects RLS for reads)
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Service-role client for writes (bypasses RLS)
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

    // Mutation bonus coins paid on harvest (mirrors gameStore.ts logic)
    const mutMultiplier = mutation ? (MUTATION_MULTIPLIERS[mutation] ?? 1) : 1;
    const bonusCoins    = mutation ? Math.floor(sellValue * (mutMultiplier - 1)) : 0;

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
    const discovered    = (save.discovered ?? []) as string[];
    const newDiscovered = [...discovered];

    if (!newDiscovered.includes(speciesId)) newDiscovered.push(speciesId);
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
        ok:         true,
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
