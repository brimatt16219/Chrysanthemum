import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { SPECIES_RARITY } from "../_shared/alchemyAttuneData.ts";
import { awardXp, DISCOVERY_XP_BY_RARITY, MUTATION_DISCOVERY_BONUS } from "../_shared/gardenerLevel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// base64url → base64 with proper padding for Deno's strict atob()
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
  // Cropsticks recipe outputs — Tier 1 (legendary)
  phoenix_lily:    { seed: 36_000_000,  sprout: 72_000_000    },
  eclipse_bloom:   { seed: 43_200_000,  sprout: 86_400_000    },
  tempest_orchid:  { seed: 50_400_000,  sprout: 100_800_000   },
  blightmantle:    { seed: 57_600_000,  sprout: 115_200_000   },
  cosmosbloom:     { seed: 64_800_000,  sprout: 129_600_000   },
  dreamgust:       { seed: 72_000_000,  sprout: 144_000_000   },
  // Tier 2 (mythic)
  solarburst:      { seed: 86_400_000,  sprout: 172_800_000   },
  tidalune:        { seed: 108_000_000, sprout: 216_000_000   },
  whisperleaf:     { seed: 129_600_000, sprout: 259_200_000   },
  crystalmind:     { seed: 151_200_000, sprout: 302_400_000   },
  // Tier 3 (exalted)
  void_chrysalis:  { seed: 302_400_000, sprout: 604_800_000   },
  starloom:        { seed: 345_600_000, sprout: 691_200_000   },
  // Tier 4 (prismatic)
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
  // v2.3.1 flowers
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

// Maximum combined speed multiplier used as a harvest-readiness grace factor.
// Gear (balance scale, sprinkler stacks, etc.) + weather (thunderstorm 2×) can
// push the effective multiplier well above 2×; 10× gives headroom for all
// legitimate stacks while still blocking impossibly fast harvest attempts.
const MAX_WEATHER_MULTIPLIER = 10.0;

Deno.serve(async (req: Request) => {
  initSentry();
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

    // Decode without verification to get userId for parallel DB load
    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { row, col } = await req.json() as { row: number; col: number };
    if (typeof row !== "number" || typeof col !== "number") {
      return new Response(JSON.stringify({ error: "Invalid input: row and col required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Verify JWT + load save + load authoritative planting time in parallel ──
    const [authResult, saveResult, timingResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves").select("coins, grid, inventory, discovered, gardener_level, gardener_xp, updated_at").eq("user_id", userId).single(),
      // plant_timings has no client write policy — planted_at cannot be forged
      supabaseAdmin.from("plant_timings").select("planted_at").eq("user_id", userId).eq("row", row).eq("col", col).maybeSingle(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
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
    const priorUpdatedAt = save.updated_at as string;

    // ── Validate plot ─────────────────────────────────────────────────────────
    const grid = save.grid as { id: string; plant: Record<string, unknown> | null }[][];
    const plot = grid[row]?.[col];

    if (!plot) {
      return new Response(JSON.stringify({ error: "Plot does not exist" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!plot.plant) {
      // Already harvested — return idempotent success so the client doesn't
      // roll back its optimistic state. A rolled-back "plant re-appears" causes
      // the same harvest to get re-queued, creating an infinite error cascade.
      return new Response(
        JSON.stringify({
          ok: true,
          inventory: save.inventory ?? [],
          discovered: save.discovered ?? [],
          mutation: undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plant = plot.plant as {
      speciesId: string; timePlanted: number;
      fertilizer?: string | null; masteredBonus?: number; mutation?: string | null;
      // Consumable flags — applied by use-consumable edge function
      heirloomActive?:  boolean;
      mutationBlocked?: boolean;
      forcedMutation?:  string;
    };

    // ── Cross-breed lock check ────────────────────────────────────────────────
    // Prevent harvesting a plant that is actively serving as a cross-breed source
    // for Cropsticks. Two detection paths:
    //  A) crossbreedSourceA/B stored on a cropsticks cell points at this [row,col]
    //     (the normal case — infused flag is cleared from the plant at cycle start)
    //  B) plant.infused is still true AND an adjacent cropsticks cycle is active
    //     (legacy/fallback: infused flag not yet cleared)
    const isActiveCrossbreedSource = (() => {
      type GearCell = { gear?: { gearType?: string; crossbreedStartedAt?: number; crossbreedSourceA?: { r: number; c: number }; crossbreedSourceB?: { r: number; c: number } } | null };
      for (let ri = 0; ri < grid.length; ri++) {
        for (let ci = 0; ci < grid[ri].length; ci++) {
          const cellGear = (grid[ri][ci] as GearCell).gear;
          if (!cellGear || cellGear.gearType !== "cropsticks" || cellGear.crossbreedStartedAt == null) continue;
          if (
            (cellGear.crossbreedSourceA?.r === row && cellGear.crossbreedSourceA?.c === col) ||
            (cellGear.crossbreedSourceB?.r === row && cellGear.crossbreedSourceB?.c === col)
          ) return true;
        }
      }
      // Legacy path: infused flag still on plant
      if ((plant as { infused?: boolean }).infused) {
        const OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of OFFSETS) {
          const adjGear = (grid[row + dr]?.[col + dc] as GearCell | undefined)?.gear;
          if (adjGear?.gearType === "cropsticks" && adjGear.crossbreedStartedAt != null) return true;
        }
      }
      return false;
    })();
    if (isActiveCrossbreedSource) {
      return new Response(JSON.stringify({ error: "Plant is currently cross-breeding" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Server-side bloom check ───────────────────────────────────────────────
    const growthTimes = FLOWER_GROWTH_TIMES[plant.speciesId];
    if (!growthTimes) {
      return new Response(JSON.stringify({ error: "Unknown species" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalGrowthMs  = growthTimes.seed + growthTimes.sprout;
    const fertMultiplier = plant.fertilizer ? (FERTILIZER_MULTIPLIERS[plant.fertilizer] ?? 1.0) : 1.0;
    // Clamp masteredBonus — client-stored value must not exceed the legitimate
    // max of 1.25, preventing a tampered DB row from making growth instant.
    const masteredBonus  = Math.min(plant.masteredBonus ?? 1.0, 1.25);

    // Use server-authoritative planted_at from plant_timings.
    // If no entry exists (plant predates the fix), backfill now() and silently
    // clear the plot — returning 400 here causes a rollback-retry infinite loop
    // because the client re-presents the bloomed plant after each rollback.
    // Instead we return the idempotent 200 (no coins, no inventory change in DB)
    // so the client keeps its optimistic grid removal and stops retrying.
    // Approach credit: @cirillojon (PR #134).
    if (!timingResult?.data) {
      const clearedGrid = grid.map((r, ri) =>
        r.map((p, ci) => ri === row && ci === col ? { ...p, plant: null } : p)
      );
      void Promise.all([
        supabaseAdmin.from("plant_timings").upsert({
          user_id:    userId,
          row,
          col,
          planted_at: new Date().toISOString(),
        }),
        supabaseAdmin.from("game_saves")
          .update({ grid: clearedGrid, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("updated_at", priorUpdatedAt),
      ]);
      return new Response(
        JSON.stringify({
          ok:         true,
          inventory:  save.inventory ?? [],
          discovered: save.discovered ?? [],
          mutation:   undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authoritativePlantedAt = new Date(timingResult.data.planted_at).getTime();

    // Bloom-placed plants use timePlanted = 0 as a sentinel (set by plant-bloom).
    // If plant_timings still has a stale entry (e.g. from a previously removed plant),
    // auto-correct it to epoch so harvest works. We check plant.timePlanted from the
    // grid — it's client-stored, but forging it only skips the wait time (low-risk).
    const isBloomPlaced = plant.timePlanted === 0;
    if (isBloomPlaced && authoritativePlantedAt !== 0) {
      void supabaseAdmin.from("plant_timings").upsert(
        { user_id: userId, row, col, planted_at: "1970-01-01T00:00:00.000Z" },
        { onConflict: "user_id,row,col" }
      );
      // Fall through — epoch planted_at always passes the bloom check below
    }

    if (!isBloomPlaced) {
      const minBloomTime = authoritativePlantedAt + totalGrowthMs / (fertMultiplier * masteredBonus * MAX_WEATHER_MULTIPLIER);
      if (Date.now() < minBloomTime) {
        return new Response(JSON.stringify({ error: "Plant is not ready to harvest" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Compute changes ───────────────────────────────────────────────────────
    const { speciesId } = plant;

    // ── Consumable flag: Purity Vial (mutationBlocked) ────────────────────────
    // Shields this harvest from any mutation. Overrides forcedMutation too.
    //
    // ── Consumable flag: Giant Vial (forcedMutation) ──────────────────────────
    // Forces a Giant mutation on this harvest, overriding any weather mutation.
    //
    // Server-trusted mutation only — never accept client-supplied mutation IDs.
    // Both the client tick (cloud-saved grid) and the server tick-offline-gardens
    // function write to plant.mutation in the DB.
    let mutation: string | undefined;
    if (plant.mutationBlocked) {
      mutation = undefined; // Purity Vial — no mutation
    } else if (plant.forcedMutation === "giant") {
      mutation = "giant";   // Giant Vial — force Giant
    } else {
      mutation = (plant.mutation as string | null | undefined) ?? undefined;
    }

    // Clear only the harvested plot — do NOT return the full grid to the client.
    // Mutations on other plants live only in client state; overwriting with the
    // DB grid would erase all of them.
    const newGrid = grid.map((r, ri) =>
      r.map((p, ci) => ri === row && ci === col ? { ...p, plant: null } : p)
    );

    const inventory = (save.inventory ?? []) as {
      speciesId: string; quantity: number; mutation?: string; isSeed?: boolean;
    }[];

    // Normalise mutation to null so null/undefined mismatches never create
    // duplicate inventory entries for the same species (root cause of #250).
    const normMutation = mutation ?? null;
    const existingIdx = inventory.findIndex(
      (i) => i.speciesId === speciesId && (i.mutation ?? null) === normMutation && !i.isSeed
    );
    let newInventory = existingIdx >= 0
      ? inventory.map((i, idx) => idx === existingIdx ? { ...i, quantity: i.quantity + 1 } : i)
      : [...inventory, { speciesId, quantity: 1, mutation: normMutation, isSeed: false }];

    // ── Consumable flag: Heirloom Charm (heirloomActive) ─────────────────────
    // Return the seed to inventory in addition to the normal bloom harvest.
    if (plant.heirloomActive) {
      const seedIdx = newInventory.findIndex(
        (i) => i.speciesId === speciesId && i.isSeed && !i.mutation
      );
      newInventory = seedIdx >= 0
        ? newInventory.map((i, idx) => idx === seedIdx ? { ...i, quantity: i.quantity + 1 } : i)
        : [...newInventory, { speciesId, quantity: 1, isSeed: true }];
    }

    const discovered    = (save.discovered        as string[]) ?? [];
    const gardenerLevel = (save.gardener_level    as number)   ?? 1;
    const gardenerXp    = (save.gardener_xp       as number)   ?? 0;
    const newDiscovered = [...discovered];
    if (!newDiscovered.includes(speciesId)) newDiscovered.push(speciesId);
    if (mutation) {
      const mutKey = `${speciesId}:${mutation}`;
      if (!newDiscovered.includes(mutKey)) newDiscovered.push(mutKey);
    }

    let xpGained = 0;
    const speciesRarity = SPECIES_RARITY[speciesId];
    if (speciesRarity) {
      const baseXp = DISCOVERY_XP_BY_RARITY[speciesRarity] ?? 0;
      if (!discovered.includes(speciesId)) xpGained += baseXp;
      if (mutation && !discovered.includes(`${speciesId}:${mutation}`)) {
        xpGained += Math.floor(baseXp * MUTATION_DISCOVERY_BONUS);
      }
    }
    const { level: newLevel, xp: newXp, leveledUp, levelsGained } = awardXp(gardenerLevel, gardenerXp, xpGained);

    // ── Write to DB ───────────────────────────────────────────────────────────
    // Coins are NOT updated on harvest — they only change when blooms are sold.
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({
        grid:           newGrid,
        inventory:      newInventory,
        discovered:     newDiscovered,
        gardener_level: newLevel,
        gardener_xp:    newXp,
        updated_at:     new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (updateError || !updateData) {
      return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Remove the plant_timings entry now that the plot is clear
    void supabaseAdmin.from("plant_timings").delete().eq("user_id", userId).eq("row", row).eq("col", col);

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "harvest",
      payload: { row, col, speciesId, mutation },
      result:  { ok: true },
    });

    // Return inventory/discovered only — NOT coins or grid.
    // Coins never change on harvest (only on sell), so there is nothing to sync back.
    return new Response(
      JSON.stringify({
        ok:              true,
        inventory:       newInventory,
        discovered:      newDiscovered,
        mutation,
        xpGained,
        gardenerLevel:   newLevel,
        gardenerXp:      newXp,
        leveledUp,
        levelsGained,
        serverUpdatedAt: updateData.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("harvest error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
