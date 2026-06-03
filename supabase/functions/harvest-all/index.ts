import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

// ── Fertilizer speed multipliers (mirrors src/data/upgrades.ts) ──────────────
const FERTILIZER_MULTIPLIERS: Record<string, number> = {
  basic: 1.1, advanced: 1.25, premium: 1.5, elite: 1.75, miracle: 2.0,
};

// ── Flower growth times in ms (mirrors src/data/flowers.ts) ──────────────────
const FLOWER_GROWTH_TIMES: Record<string, { seed: number; sprout: number }> = {
  quickgrass: { seed: 40_000, sprout: 80_000 }, dustweed: { seed: 45_000, sprout: 90_000 },
  sprig: { seed: 60_000, sprout: 120_000 }, dewdrop: { seed: 65_000, sprout: 130_000 },
  pebblebloom: { seed: 68_000, sprout: 136_000 }, ember_moss: { seed: 70_000, sprout: 140_000 },
  dandelion: { seed: 75_000, sprout: 150_000 }, clover: { seed: 80_000, sprout: 160_000 },
  violet: { seed: 85_000, sprout: 170_000 }, stormcap: { seed: 87_000, sprout: 174_000 }, lemongrass: { seed: 88_000, sprout: 176_000 },
  daisy: { seed: 90_000, sprout: 180_000 }, honeywort: { seed: 92_000, sprout: 184_000 },
  buttercup: { seed: 95_000, sprout: 190_000 }, dawnpetal: { seed: 97_000, sprout: 194_000 },
  poppy: { seed: 100_000, sprout: 200_000 }, chamomile: { seed: 105_000, sprout: 210_000 },
  marigold: { seed: 110_000, sprout: 220_000 }, stardust: { seed: 115_000, sprout: 230_000 }, sunflower: { seed: 120_000, sprout: 240_000 },
  coppercup: { seed: 125_000, sprout: 250_000 }, ivybell: { seed: 130_000, sprout: 260_000 },
  thornberry: { seed: 140_000, sprout: 280_000 }, saltmoss: { seed: 148_000, sprout: 296_000 },
  ashpetal: { seed: 155_000, sprout: 310_000 }, snowdrift: { seed: 163_000, sprout: 326_000 },
  swiftbloom: { seed: 240_000, sprout: 480_000 }, shortcress: { seed: 255_000, sprout: 510_000 },
  thornwhistle: { seed: 280_000, sprout: 560_000 }, starwort: { seed: 290_000, sprout: 580_000 },
  mintleaf: { seed: 295_000, sprout: 590_000 }, tulip: { seed: 300_000, sprout: 600_000 },
  inkbloom: { seed: 310_000, sprout: 620_000 }, hyacinth: { seed: 320_000, sprout: 640_000 },
  snapdragon: { seed: 330_000, sprout: 660_000 }, beebalm: { seed: 345_000, sprout: 690_000 },
  moonstrike: { seed: 340_000, sprout: 680_000 }, candleflower: { seed: 350_000, sprout: 700_000 }, carnation: { seed: 360_000, sprout: 720_000 },
  ribbonweed: { seed: 370_000, sprout: 740_000 }, hibiscus: { seed: 380_000, sprout: 760_000 },
  wildberry: { seed: 395_000, sprout: 790_000 }, frostbell: { seed: 390_000, sprout: 780_000 },
  bluebell: { seed: 400_000, sprout: 800_000 }, cherry_blossom: { seed: 410_000, sprout: 820_000 },
  rose: { seed: 420_000, sprout: 840_000 }, peacockflower: { seed: 430_000, sprout: 860_000 },
  bamboo_bloom: { seed: 440_000, sprout: 880_000 }, hummingbloom: { seed: 440_000, sprout: 880_000 },
  water_lily: { seed: 450_000, sprout: 900_000 }, lanternflower: { seed: 460_000, sprout: 920_000 },
  dovebloom: { seed: 480_000, sprout: 960_000 }, coral_bells: { seed: 500_000, sprout: 1_000_000 },
  sundew: { seed: 520_000, sprout: 1_040_000 }, bubblebloom: { seed: 540_000, sprout: 1_080_000 },
  flashpetal: { seed: 900_000, sprout: 1_800_000 }, rushwillow: { seed: 960_000, sprout: 1_920_000 },
  sweetheart_lily: { seed: 1_080_000, sprout: 2_160_000 }, glassbell: { seed: 1_100_000, sprout: 2_200_000 },
  stormcaller: { seed: 1_140_000, sprout: 2_280_000 }, lavender: { seed: 1_200_000, sprout: 2_400_000 },
  amber_crown: { seed: 1_200_000, sprout: 2_400_000 }, peach_blossom: { seed: 1_200_000, sprout: 2_400_000 },
  foxglove: { seed: 1_320_000, sprout: 2_640_000 }, winterwood: { seed: 1_350_000, sprout: 2_700_000 }, butterbloom: { seed: 1_380_000, sprout: 2_760_000 },
  peony: { seed: 1_440_000, sprout: 2_880_000 }, tidebloom: { seed: 1_500_000, sprout: 3_000_000 },
  starweave: { seed: 1_500_000, sprout: 3_000_000 }, wisteria: { seed: 1_560_000, sprout: 3_120_000 },
  dreamcup: { seed: 1_560_000, sprout: 3_120_000 }, coralbell: { seed: 1_620_000, sprout: 3_240_000 },
  foxfire: { seed: 1_650_000, sprout: 3_300_000 }, bird_of_paradise: { seed: 1_680_000, sprout: 3_360_000 },
  solarbell: { seed: 1_680_000, sprout: 3_360_000 }, moonpetal: { seed: 1_740_000, sprout: 3_480_000 },
  orchid: { seed: 1_800_000, sprout: 3_600_000 }, duskrose: { seed: 1_860_000, sprout: 3_720_000 },
  passionflower: { seed: 1_920_000, sprout: 3_840_000 }, glasswing: { seed: 2_000_000, sprout: 4_000_000 },
  mirror_orchid: { seed: 2_100_000, sprout: 4_200_000 }, stargazer_lily: { seed: 2_160_000, sprout: 4_320_000 },
  prism_lily: { seed: 2_280_000, sprout: 4_560_000 }, dusk_orchid: { seed: 2_400_000, sprout: 4_800_000 },
  firstbloom: { seed: 5_400_000, sprout: 10_800_000 }, haste_lily: { seed: 5_800_000, sprout: 11_600_000 },
  verdant_crown: { seed: 6_600_000, sprout: 13_200_000 }, ironwood_bloom: { seed: 6_800_000, sprout: 13_600_000 },
  sundial: { seed: 7_000_000, sprout: 14_000_000 }, lotus: { seed: 7_200_000, sprout: 14_400_000 },
  candy_blossom: { seed: 7_500_000, sprout: 15_000_000 }, prismbark: { seed: 7_500_000, sprout: 15_000_000 },
  dolphinia: { seed: 7_800_000, sprout: 15_600_000 }, ghost_orchid: { seed: 7_800_000, sprout: 15_600_000 },
  nestbloom: { seed: 8_100_000, sprout: 16_200_000 }, black_rose: { seed: 8_400_000, sprout: 16_800_000 },
  pumpkin_blossom: { seed: 8_400_000, sprout: 16_800_000 }, starburst_lily: { seed: 8_400_000, sprout: 16_800_000 },
  sporebloom: { seed: 8_700_000, sprout: 17_400_000 }, fire_lily: { seed: 9_000_000, sprout: 18_000_000 },
  stargazer: { seed: 9_300_000, sprout: 18_600_000 }, fullmoon_bloom: { seed: 9_600_000, sprout: 19_200_000 },
  ice_crown: { seed: 9_600_000, sprout: 19_200_000 }, diamond_bloom: { seed: 10_200_000, sprout: 20_400_000 },
  oracle_eye: { seed: 10_800_000, sprout: 21_600_000 }, halfmoon_bloom: { seed: 11_400_000, sprout: 22_800_000 },
  aurora_bloom: { seed: 11_500_000, sprout: 23_000_000 }, mirrorpetal: { seed: 12_000_000, sprout: 24_000_000 },
  emberspark: { seed: 12_600_000, sprout: 25_200_000 },
  phoenix_lily:    { seed: 36_000_000,  sprout: 72_000_000    },
  eclipse_bloom:   { seed: 43_200_000,  sprout: 86_400_000    },
  tempest_orchid:  { seed: 50_400_000,  sprout: 100_800_000   },
  blightmantle:    { seed: 57_600_000,  sprout: 115_200_000   },
  cosmosbloom:     { seed: 64_800_000,  sprout: 129_600_000   },
  dreamgust:       { seed: 72_000_000,  sprout: 144_000_000   },
  solarburst:      { seed: 86_400_000,  sprout: 172_800_000   },
  tidalune:        { seed: 108_000_000, sprout: 216_000_000   },
  whisperleaf:     { seed: 129_600_000, sprout: 259_200_000   },
  crystalmind:     { seed: 151_200_000, sprout: 302_400_000   },
  void_chrysalis:  { seed: 302_400_000, sprout: 604_800_000   },
  starloom:        { seed: 345_600_000, sprout: 691_200_000   },
  the_first_bloom: { seed: 604_800_000, sprout: 1_209_600_000 },
  blink_rose: { seed: 18_000_000, sprout: 36_000_000 }, dawnfire: { seed: 21_600_000, sprout: 43_200_000 },
  moonflower: { seed: 28_800_000, sprout: 57_600_000 }, jellybloom: { seed: 30_000_000, sprout: 60_000_000 },
  celestial_bloom: { seed: 36_000_000, sprout: 72_000_000 }, void_blossom: { seed: 43_200_000, sprout: 86_400_000 },
  seraph_wing: { seed: 54_000_000, sprout: 108_000_000 }, solar_rose: { seed: 57_600_000, sprout: 115_200_000 },
  nebula_drift: { seed: 64_800_000, sprout: 129_600_000 }, superbloom: { seed: 72_000_000, sprout: 144_000_000 },
  wanderbloom: { seed: 72_000_000, sprout: 144_000_000 }, chrysanthemum: { seed: 86_400_000, sprout: 172_800_000 },
  umbral_bloom: { seed: 108_000_000, sprout: 216_000_000 }, obsidian_rose: { seed: 129_600_000, sprout: 259_200_000 },
  duskmantle: { seed: 144_000_000, sprout: 288_000_000 }, deeproot: { seed: 150_000_000, sprout: 300_000_000 },
  graveweb: { seed: 172_800_000, sprout: 345_600_000 }, rimestorm: { seed: 180_000_000, sprout: 360_000_000 },
  nightwing: { seed: 216_000_000, sprout: 432_000_000 }, solglow: { seed: 225_000_000, sprout: 450_000_000 },
  ashenveil: { seed: 237_600_000, sprout: 475_200_000 }, voidfire: { seed: 259_200_000, sprout: 518_400_000 },
  dreambloom: { seed: 300_000_000, sprout: 600_000_000 }, fairy_blossom: { seed: 324_000_000, sprout: 648_000_000 },
  lovebind: { seed: 345_600_000, sprout: 691_200_000 }, islebloom: { seed: 355_000_000, sprout: 710_000_000 },
  eternal_heart: { seed: 374_400_000, sprout: 748_800_000 }, moonrime: { seed: 385_000_000, sprout: 770_000_000 },
  nova_bloom: { seed: 403_200_000, sprout: 806_400_000 }, shadowgale: { seed: 415_000_000, sprout: 830_000_000 },
  princess_blossom: { seed: 432_000_000, sprout: 864_000_000 },
  // Event-exclusive
  sakura_blossom: { seed: 259_200_000, sprout: 518_400_000 },
  cloudveil: { seed: 83_000, sprout: 166_000 }, pepperbloom: { seed: 86_000, sprout: 172_000 },
  showerbloom: { seed: 102_000, sprout: 204_000 }, creamcap: { seed: 108_000, sprout: 216_000 },
  duskling: { seed: 112_000, sprout: 224_000 }, moongrass: { seed: 117_000, sprout: 234_000 },
  owlsage: { seed: 122_000, sprout: 244_000 }, hexblossom: { seed: 135_000, sprout: 270_000 },
  starfleck: { seed: 145_000, sprout: 290_000 }, cometail: { seed: 158_000, sprout: 316_000 },
  flurrysprig: { seed: 93_000, sprout: 186_000 }, cloudgrass: { seed: 286_000, sprout: 572_000 },
  glacierbud: { seed: 268_000, sprout: 536_000 }, brewleaf: { seed: 128_000, sprout: 256_000 },
  chimebloom: { seed: 308_000, sprout: 616_000 }, evenfall: { seed: 328_000, sprout: 656_000 },
  sundrift: { seed: 358_000, sprout: 716_000 }, moonspan: { seed: 378_000, sprout: 756_000 },
  tanglewort: { seed: 418_000, sprout: 836_000 }, medalwort: { seed: 472_000, sprout: 944_000 },
  topazbloom: { seed: 512_000, sprout: 1_024_000 }, blazecrown: { seed: 978_000, sprout: 1_956_000 },
  terracotta: { seed: 1_050_000, sprout: 2_100_000 }, frostmark: { seed: 1_260_000, sprout: 2_520_000 },
  coldsnap: { seed: 1_440_000, sprout: 2_880_000 }, voidpetal: { seed: 1_980_000, sprout: 3_960_000 },
  galebloom: { seed: 6_200_000, sprout: 12_400_000 }, infernopetal: { seed: 19_800_000, sprout: 39_600_000 },
  anchorweed: { seed: 25_200_000, sprout: 50_400_000 }, worldroot: { seed: 32_400_000, sprout: 64_800_000 },
  clearingbloom: { seed: 39_600_000, sprout: 79_200_000 }, permafrost: { seed: 46_800_000, sprout: 93_600_000 },
  frostspine: { seed: 50_400_000, sprout: 100_800_000 }, tempest_eye: { seed: 57_600_000, sprout: 115_200_000 },
  thundercrown: { seed: 61_200_000, sprout: 122_400_000 }, moonsmile: { seed: 64_800_000, sprout: 129_600_000 },
  dreamshade: { seed: 68_400_000, sprout: 136_800_000 }, gravewilt: { seed: 75_600_000, sprout: 151_200_000 },
};

const MAX_WEATHER_MULTIPLIER = 2.0;

type PlantCell = {
  speciesId: string; timePlanted: number;
  fertilizer?: string | null; masteredBonus?: number; mutation?: string | null;
  heirloomActive?: boolean; mutationBlocked?: boolean; forcedMutation?: string;
  infused?: boolean;
};
type GearCell = { gear?: { gearType?: string; crossbreedStartedAt?: number; crossbreedSourceA?: { r: number; c: number }; crossbreedSourceB?: { r: number; c: number } } | null };
type GridCell = { id: string; plant: PlantCell | null } & GearCell;

function isActiveCrossbreedSource(grid: GridCell[][], row: number, col: number, plant: PlantCell): boolean {
  for (let ri = 0; ri < grid.length; ri++) {
    for (let ci = 0; ci < grid[ri].length; ci++) {
      const cellGear = grid[ri][ci].gear;
      if (!cellGear || cellGear.gearType !== "cropsticks" || cellGear.crossbreedStartedAt == null) continue;
      if (
        (cellGear.crossbreedSourceA?.r === row && cellGear.crossbreedSourceA?.c === col) ||
        (cellGear.crossbreedSourceB?.r === row && cellGear.crossbreedSourceB?.c === col)
      ) return true;
    }
  }
  if (plant.infused) {
    const OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of OFFSETS) {
      const adjGear = grid[row + dr]?.[col + dc]?.gear;
      if (adjGear?.gearType === "cropsticks" && adjGear.crossbreedStartedAt != null) return true;
    }
  }
  return false;
}

Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plots } = await req.json() as { plots: { row: number; col: number }[] };
    if (!Array.isArray(plots) || plots.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid input: plots array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Verify JWT once, then retry read→process→write on 409 conflict ──────────
    const authResult = await supabaseAdmin.auth.getUser(token);
    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // ── Load save + plant_timings fresh each attempt ──────────────────────
      const [saveResult, timingsResult] = await Promise.all([
        supabaseAdmin.from("game_saves").select("coins, grid, inventory, discovered, updated_at").eq("user_id", userId).single(),
        supabaseAdmin.from("plant_timings").select("row, col, planted_at").eq("user_id", userId),
      ]);

      if (saveResult.error || !saveResult.data) {
        return new Response(JSON.stringify({ error: "Save not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (timingsResult.error) {
        return new Response(JSON.stringify({ error: "Failed to load plant timings" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const save = saveResult.data;
      const priorUpdatedAt = save.updated_at as string;

      // Build timing lookup: timingMap[row][col] = planted_at ms
      const timingMap: Record<number, Record<number, number>> = {};
      for (const t of timingsResult.data) {
        if (!timingMap[t.row]) timingMap[t.row] = {};
        timingMap[t.row][t.col] = new Date(t.planted_at).getTime();
      }

      const grid = save.grid as GridCell[][];
      // Deduplicate inventory — normalize null/undefined mutations and merge
      // quantities for logically identical slots. Pre-existing corruption (two
      // rows for the same species+mutation due to old null-vs-undefined mismatch)
      // would otherwise inflate counts and cause items to be "lost" after harvest.
      type InvItem = { speciesId: string; quantity: number; mutation?: string | null; isSeed?: boolean };
      const rawInventory = (save.inventory ?? []) as InvItem[];
      const invMap = new Map<string, InvItem>();
      for (const item of rawInventory) {
        const key = `${item.speciesId}|${item.mutation ?? null}|${item.isSeed ? "1" : "0"}`;
        const existing = invMap.get(key);
        if (existing) {
          invMap.set(key, { ...existing, quantity: existing.quantity + item.quantity });
        } else {
          invMap.set(key, { ...item, mutation: item.mutation ?? null });
        }
      }
      let inventory = Array.from(invMap.values());
      const discovered = [...((save.discovered ?? []) as string[])];

      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      const harvestedPlots: { row: number; col: number }[] = [];
      const backfillTimings: { row: number; col: number }[] = [];

      // ── Process each plot ───────────────────────────────────────────────────
      for (const { row, col } of plots) {
        const plot = grid[row]?.[col];
        if (!plot) continue;

        // Already harvested — skip idempotently
        if (!plot.plant) continue;

        const plant = plot.plant;

        if (isActiveCrossbreedSource(grid, row, col, plant)) continue;

        const growthTimes = FLOWER_GROWTH_TIMES[plant.speciesId];
        if (!growthTimes) continue;

        const isBloomPlaced = plant.timePlanted === 0;
        const authoritativePlantedAt = timingMap[row]?.[col] ?? null;

        if (!isBloomPlaced && authoritativePlantedAt != null) {
          const totalGrowthMs  = growthTimes.seed + growthTimes.sprout;
          const fertMultiplier = plant.fertilizer ? (FERTILIZER_MULTIPLIERS[plant.fertilizer] ?? 1.0) : 1.0;
          const masteredBonus  = Math.min(plant.masteredBonus ?? 1.0, 1.25);
          const minBloomTime   = authoritativePlantedAt + totalGrowthMs / (fertMultiplier * masteredBonus * MAX_WEATHER_MULTIPLIER);
          if (now < minBloomTime) continue;
        }

        let mutation: string | undefined;
        if (plant.mutationBlocked) {
          mutation = undefined;
        } else if (plant.forcedMutation === "giant") {
          mutation = "giant";
        } else {
          mutation = (plant.mutation as string | null | undefined) ?? undefined;
        }

        const { speciesId } = plant;

        const normMut = mutation ?? null;
        const existingIdx = inventory.findIndex(
          (i) => i.speciesId === speciesId && (i.mutation ?? null) === normMut && !i.isSeed
        );
        inventory = existingIdx >= 0
          ? inventory.map((i, idx) => idx === existingIdx ? { ...i, quantity: i.quantity + 1 } : i)
          : [...inventory, { speciesId, quantity: 1, mutation, isSeed: false }];

        if (plant.heirloomActive) {
          const seedIdx = inventory.findIndex((i) => i.speciesId === speciesId && i.isSeed && !i.mutation);
          inventory = seedIdx >= 0
            ? inventory.map((i, idx) => idx === seedIdx ? { ...i, quantity: i.quantity + 1 } : i)
            : [...inventory, { speciesId, quantity: 1, isSeed: true }];
        }

        if (!discovered.includes(speciesId)) discovered.push(speciesId);
        if (mutation) {
          const mutKey = `${speciesId}:${mutation}`;
          if (!discovered.includes(mutKey)) discovered.push(mutKey);
        }

        if (authoritativePlantedAt == null) backfillTimings.push({ row, col });
        grid[row][col] = { ...plot, plant: null };
        harvestedPlots.push({ row, col });
      }

      if (harvestedPlots.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, inventory, discovered, serverUpdatedAt: priorUpdatedAt }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── DB write ────────────────────────────────────────────────────────────
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from("game_saves")
        .update({ grid, inventory, discovered, updated_at: nowIso })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (updateError || !updateData) {
        // 409 conflict — another action modified the save; retry with fresh data
        if (attempt < MAX_ATTEMPTS - 1) continue;
        return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Cleanup plant_timings ──────────────────────────────────────────────
      void (async () => {
        const deletes = harvestedPlots
          .filter((p) => !backfillTimings.some((b) => b.row === p.row && b.col === p.col))
          .map((p) =>
            supabaseAdmin.from("plant_timings").delete().eq("user_id", userId).eq("row", p.row).eq("col", p.col)
          );
        const upserts = backfillTimings.map((p) =>
          supabaseAdmin.from("plant_timings").upsert({ user_id: userId, row: p.row, col: p.col, planted_at: nowIso })
        );
        await Promise.all([...deletes, ...upserts]);
      })();

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "harvest_all",
        payload: { plots: harvestedPlots },
        result:  { count: harvestedPlots.length },
      });

      return new Response(
        JSON.stringify({ ok: true, inventory, discovered, serverUpdatedAt: updateData.updated_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exhausted retries (should be unreachable — loop always returns)
    return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("harvest-all error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
