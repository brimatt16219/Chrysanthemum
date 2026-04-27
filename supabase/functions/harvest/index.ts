import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inline CORS headers — _shared/ is not bundled when deploying individual functions on Windows
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Fertilizer speed multipliers (mirrors src/data/upgrades.ts) ──────────────
const FERTILIZER_MULTIPLIERS: Record<string, number> = {
  basic:    1.2,
  advanced: 1.5,
  premium:  2.0,
  elite:    3.0,
  miracle:  4.0,
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

// ── Flower growth times in ms (mirrors src/data/flowers.ts) ──────────────────
const FLOWER_GROWTH_TIMES: Record<string, { seed: number; sprout: number }> = {
  // Common
  quickgrass:       { seed: 40_000,       sprout: 80_000       },
  dustweed:         { seed: 45_000,       sprout: 90_000       },
  sprig:            { seed: 60_000,       sprout: 120_000      },
  dewdrop:          { seed: 65_000,       sprout: 130_000      },
  pebblebloom:      { seed: 68_000,       sprout: 136_000      },
  ember_moss:       { seed: 70_000,       sprout: 140_000      },
  dandelion:        { seed: 75_000,       sprout: 150_000      },
  clover:           { seed: 80_000,       sprout: 160_000      },
  violet:           { seed: 85_000,       sprout: 170_000      },
  lemongrass:       { seed: 88_000,       sprout: 176_000      },
  daisy:            { seed: 90_000,       sprout: 180_000      },
  honeywort:        { seed: 92_000,       sprout: 184_000      },
  buttercup:        { seed: 95_000,       sprout: 190_000      },
  dawnpetal:        { seed: 97_000,       sprout: 194_000      },
  poppy:            { seed: 100_000,      sprout: 200_000      },
  chamomile:        { seed: 105_000,      sprout: 210_000      },
  marigold:         { seed: 110_000,      sprout: 220_000      },
  sunflower:        { seed: 120_000,      sprout: 240_000      },
  coppercup:        { seed: 125_000,      sprout: 250_000      },
  ivybell:          { seed: 130_000,      sprout: 260_000      },
  thornberry:       { seed: 140_000,      sprout: 280_000      },
  saltmoss:         { seed: 148_000,      sprout: 296_000      },
  ashpetal:         { seed: 155_000,      sprout: 310_000      },
  snowdrift:        { seed: 163_000,      sprout: 326_000      },
  // Uncommon
  swiftbloom:       { seed: 240_000,      sprout: 480_000      },
  shortcress:       { seed: 255_000,      sprout: 510_000      },
  thornwhistle:     { seed: 280_000,      sprout: 560_000      },
  starwort:         { seed: 290_000,      sprout: 580_000      },
  mintleaf:         { seed: 295_000,      sprout: 590_000      },
  tulip:            { seed: 300_000,      sprout: 600_000      },
  inkbloom:         { seed: 310_000,      sprout: 620_000      },
  hyacinth:         { seed: 320_000,      sprout: 640_000      },
  snapdragon:       { seed: 330_000,      sprout: 660_000      },
  beebalm:          { seed: 345_000,      sprout: 690_000      },
  candleflower:     { seed: 350_000,      sprout: 700_000      },
  carnation:        { seed: 360_000,      sprout: 720_000      },
  ribbonweed:       { seed: 370_000,      sprout: 740_000      },
  hibiscus:         { seed: 380_000,      sprout: 760_000      },
  wildberry:        { seed: 395_000,      sprout: 790_000      },
  frostbell:        { seed: 390_000,      sprout: 780_000      },
  bluebell:         { seed: 400_000,      sprout: 800_000      },
  cherry_blossom:   { seed: 410_000,      sprout: 820_000      },
  rose:             { seed: 420_000,      sprout: 840_000      },
  peacockflower:    { seed: 430_000,      sprout: 860_000      },
  bamboo_bloom:     { seed: 440_000,      sprout: 880_000      },
  hummingbloom:     { seed: 440_000,      sprout: 880_000      },
  water_lily:       { seed: 450_000,      sprout: 900_000      },
  lanternflower:    { seed: 460_000,      sprout: 920_000      },
  dovebloom:        { seed: 480_000,      sprout: 960_000      },
  coral_bells:      { seed: 500_000,      sprout: 1_000_000    },
  sundew:           { seed: 520_000,      sprout: 1_040_000    },
  bubblebloom:      { seed: 540_000,      sprout: 1_080_000    },
  // Rare
  flashpetal:       { seed: 900_000,      sprout: 1_800_000    },
  rushwillow:       { seed: 960_000,      sprout: 1_920_000    },
  sweetheart_lily:  { seed: 1_080_000,    sprout: 2_160_000    },
  glassbell:        { seed: 1_100_000,    sprout: 2_200_000    },
  stormcaller:      { seed: 1_140_000,    sprout: 2_280_000    },
  lavender:         { seed: 1_200_000,    sprout: 2_400_000    },
  amber_crown:      { seed: 1_200_000,    sprout: 2_400_000    },
  peach_blossom:    { seed: 1_200_000,    sprout: 2_400_000    },
  foxglove:         { seed: 1_320_000,    sprout: 2_640_000    },
  butterbloom:      { seed: 1_380_000,    sprout: 2_760_000    },
  peony:            { seed: 1_440_000,    sprout: 2_880_000    },
  tidebloom:        { seed: 1_500_000,    sprout: 3_000_000    },
  starweave:        { seed: 1_500_000,    sprout: 3_000_000    },
  wisteria:         { seed: 1_560_000,    sprout: 3_120_000    },
  dreamcup:         { seed: 1_560_000,    sprout: 3_120_000    },
  coralbell:        { seed: 1_620_000,    sprout: 3_240_000    },
  foxfire:          { seed: 1_650_000,    sprout: 3_300_000    },
  bird_of_paradise: { seed: 1_680_000,    sprout: 3_360_000    },
  solarbell:        { seed: 1_680_000,    sprout: 3_360_000    },
  moonpetal:        { seed: 1_740_000,    sprout: 3_480_000    },
  orchid:           { seed: 1_800_000,    sprout: 3_600_000    },
  duskrose:         { seed: 1_860_000,    sprout: 3_720_000    },
  passionflower:    { seed: 1_920_000,    sprout: 3_840_000    },
  glasswing:        { seed: 2_000_000,    sprout: 4_000_000    },
  mirror_orchid:    { seed: 2_100_000,    sprout: 4_200_000    },
  stargazer_lily:   { seed: 2_160_000,    sprout: 4_320_000    },
  prism_lily:       { seed: 2_280_000,    sprout: 4_560_000    },
  dusk_orchid:      { seed: 2_400_000,    sprout: 4_800_000    },
  // Legendary
  firstbloom:       { seed: 5_400_000,    sprout: 10_800_000   },
  haste_lily:       { seed: 5_800_000,    sprout: 11_600_000   },
  verdant_crown:    { seed: 6_600_000,    sprout: 13_200_000   },
  ironwood_bloom:   { seed: 6_800_000,    sprout: 13_600_000   },
  sundial:          { seed: 7_000_000,    sprout: 14_000_000   },
  lotus:            { seed: 7_200_000,    sprout: 14_400_000   },
  candy_blossom:    { seed: 7_500_000,    sprout: 15_000_000   },
  prismbark:        { seed: 7_500_000,    sprout: 15_000_000   },
  dolphinia:        { seed: 7_800_000,    sprout: 15_600_000   },
  ghost_orchid:     { seed: 7_800_000,    sprout: 15_600_000   },
  nestbloom:        { seed: 8_100_000,    sprout: 16_200_000   },
  black_rose:       { seed: 8_400_000,    sprout: 16_800_000   },
  pumpkin_blossom:  { seed: 8_400_000,    sprout: 16_800_000   },
  starburst_lily:   { seed: 8_400_000,    sprout: 16_800_000   },
  sporebloom:       { seed: 8_700_000,    sprout: 17_400_000   },
  fire_lily:        { seed: 9_000_000,    sprout: 18_000_000   },
  stargazer:        { seed: 9_300_000,    sprout: 18_600_000   },
  fullmoon_bloom:   { seed: 9_600_000,    sprout: 19_200_000   },
  ice_crown:        { seed: 9_600_000,    sprout: 19_200_000   },
  diamond_bloom:    { seed: 10_200_000,   sprout: 20_400_000   },
  oracle_eye:       { seed: 10_800_000,   sprout: 21_600_000   },
  halfmoon_bloom:   { seed: 11_400_000,   sprout: 22_800_000   },
  aurora_bloom:     { seed: 11_500_000,   sprout: 23_000_000   },
  mirrorpetal:      { seed: 12_000_000,   sprout: 24_000_000   },
  emberspark:       { seed: 12_600_000,   sprout: 25_200_000   },
  // Mythic
  blink_rose:       { seed: 18_000_000,   sprout: 36_000_000   },
  dawnfire:         { seed: 21_600_000,   sprout: 43_200_000   },
  moonflower:       { seed: 28_800_000,   sprout: 57_600_000   },
  jellybloom:       { seed: 30_000_000,   sprout: 60_000_000   },
  celestial_bloom:  { seed: 36_000_000,   sprout: 72_000_000   },
  void_blossom:     { seed: 43_200_000,   sprout: 86_400_000   },
  seraph_wing:      { seed: 54_000_000,   sprout: 108_000_000  },
  solar_rose:       { seed: 57_600_000,   sprout: 115_200_000  },
  nebula_drift:     { seed: 64_800_000,   sprout: 129_600_000  },
  superbloom:       { seed: 72_000_000,   sprout: 144_000_000  },
  wanderbloom:      { seed: 72_000_000,   sprout: 144_000_000  },
  chrysanthemum:    { seed: 86_400_000,   sprout: 172_800_000  },
  // Exalted
  umbral_bloom:     { seed: 108_000_000,  sprout: 216_000_000  },
  obsidian_rose:    { seed: 129_600_000,  sprout: 259_200_000  },
  duskmantle:       { seed: 144_000_000,  sprout: 288_000_000  },
  graveweb:         { seed: 172_800_000,  sprout: 345_600_000  },
  nightwing:        { seed: 216_000_000,  sprout: 432_000_000  },
  ashenveil:        { seed: 237_600_000,  sprout: 475_200_000  },
  voidfire:         { seed: 259_200_000,  sprout: 518_400_000  },
  // Prismatic
  dreambloom:       { seed: 300_000_000,  sprout: 600_000_000  },
  fairy_blossom:    { seed: 324_000_000,  sprout: 648_000_000  },
  lovebind:         { seed: 345_600_000,  sprout: 691_200_000  },
  eternal_heart:    { seed: 374_400_000,  sprout: 748_800_000  },
  nova_bloom:       { seed: 403_200_000,  sprout: 806_400_000  },
  princess_blossom: { seed: 432_000_000,  sprout: 864_000_000  },
};

// ── Flower sell values (mirrors src/data/flowers.ts) ─────────────────────────
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

// Max weather multiplier (thunderstorm = 2×). Used as a grace factor so
// weather-boosted plants are never incorrectly rejected by the server.
const MAX_WEATHER_MULTIPLIER = 2.0;

Deno.serve(async (req: Request) => {
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
      speciesId:      string;
      timePlanted:    number;
      fertilizer?:    string | null;
      masteredBonus?: number;
      mutation?:      string | null;
    };

    // ── Server-side bloom check ──────────────────────────────────────────────
    // bloomedAt is only ever set client-side and never reaches the DB.
    // Instead, compute whether the plant could have bloomed by now using
    // timePlanted + species growth times + fertilizer + mastery.
    // MAX_WEATHER_MULTIPLIER accounts for thunderstorm (2×) so that
    // weather-boosted plants are never incorrectly rejected.
    const growthTimes = FLOWER_GROWTH_TIMES[plant.speciesId];
    if (!growthTimes) {
      return new Response(JSON.stringify({ error: "Unknown species" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalGrowthMs  = growthTimes.seed + growthTimes.sprout;
    const fertMultiplier = plant.fertilizer
      ? (FERTILIZER_MULTIPLIERS[plant.fertilizer] ?? 1.0)
      : 1.0;
    const masteredBonus  = plant.masteredBonus ?? 1.0;
    const effectiveSpeed = fertMultiplier * masteredBonus * MAX_WEATHER_MULTIPLIER;
    const minBloomTime   = plant.timePlanted + totalGrowthMs / effectiveSpeed;

    if (Date.now() < minBloomTime) {
      return new Response(JSON.stringify({ error: "Plant is not ready to harvest" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Compute changes ──────────────────────────────────────────────────────
    const { speciesId } = plant;
    const mutation      = (plant.mutation as string | null | undefined) ?? undefined;
    const sellValue     = FLOWER_SELL_VALUES[speciesId] ?? 0;
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
      quantity:  number;
      mutation?: string;
      isSeed?:   boolean;
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
