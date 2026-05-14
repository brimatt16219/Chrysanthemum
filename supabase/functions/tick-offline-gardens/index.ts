import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  WEATHER_MUT_CHANCE_PER_TICK,
  THUNDERSTORM_WET_CHANCE_PER_TICK,
  THUNDERSTORM_SHOCKED_CHANCE_PER_TICK,
  MOONLIT_NIGHT_CHANCE_PER_TICK,
  perMinChance,
} from "../_shared/weatherMutationRates.ts";
import { initSentry, Sentry } from "../_shared/sentry.ts";

// ── Called by a Supabase cron schedule every minute ────────────────────────
// Simulates offline gear auto-actions (harvest bell, auto-planter) for every
// player who has active gear in their garden but isn't currently online.
// Auth: requires any Authorization header (the Supabase pg_cron job sends the service role JWT)

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Flower total bloom thresholds in ms (seed + sprout) ───────────────────
// Mirrors src/data/flowers.ts FLOWER_GROWTH_TIMES (same copy in harvest/index.ts)
const FLOWER_BLOOM_MS: Record<string, number> = {
  quickgrass: 120_000, dustweed: 135_000, sprig: 180_000, dewdrop: 195_000,
  pebblebloom: 204_000, ember_moss: 210_000, dandelion: 225_000, clover: 240_000,
  violet: 255_000, stormcap: 261_000, lemongrass: 264_000, daisy: 270_000, honeywort: 276_000,
  buttercup: 285_000, dawnpetal: 291_000, poppy: 300_000, chamomile: 315_000,
  marigold: 330_000, stardust: 345_000, sunflower: 360_000, coppercup: 375_000, ivybell: 390_000,
  thornberry: 420_000, saltmoss: 444_000, ashpetal: 465_000, snowdrift: 489_000,
  swiftbloom: 720_000, shortcress: 765_000, thornwhistle: 840_000, starwort: 870_000,
  mintleaf: 885_000, tulip: 900_000, inkbloom: 930_000, hyacinth: 960_000,
  snapdragon: 990_000, moonstrike: 1_020_000, beebalm: 1_035_000, candleflower: 1_050_000, carnation: 1_080_000,
  ribbonweed: 1_110_000, hibiscus: 1_140_000, wildberry: 1_185_000, frostbell: 1_170_000,
  bluebell: 1_200_000, cherry_blossom: 1_230_000, rose: 1_260_000, peacockflower: 1_290_000,
  bamboo_bloom: 1_320_000, hummingbloom: 1_320_000, water_lily: 1_350_000, lanternflower: 1_380_000,
  dovebloom: 1_440_000, coral_bells: 1_500_000, sundew: 1_560_000, bubblebloom: 1_620_000,
  flashpetal: 2_700_000, rushwillow: 2_880_000, sweetheart_lily: 3_240_000, glassbell: 3_300_000,
  stormcaller: 3_420_000, lavender: 3_600_000, amber_crown: 3_600_000, peach_blossom: 3_600_000,
  foxglove: 3_960_000, winterwood: 4_050_000, butterbloom: 4_140_000, peony: 4_320_000, tidebloom: 4_500_000,
  starweave: 4_500_000, wisteria: 4_680_000, dreamcup: 4_680_000, coralbell: 4_860_000,
  foxfire: 4_950_000, bird_of_paradise: 5_040_000, solarbell: 5_040_000, moonpetal: 5_220_000,
  orchid: 5_400_000, duskrose: 5_580_000, passionflower: 5_760_000, glasswing: 6_000_000,
  mirror_orchid: 6_300_000, stargazer_lily: 6_480_000, prism_lily: 6_840_000, dusk_orchid: 7_200_000,
  firstbloom: 16_200_000, haste_lily: 17_400_000, verdant_crown: 19_800_000, ironwood_bloom: 20_400_000,
  sundial: 21_000_000, lotus: 21_600_000, candy_blossom: 22_500_000, prismbark: 22_500_000,
  dolphinia: 23_400_000, ghost_orchid: 23_400_000, nestbloom: 24_300_000, black_rose: 25_200_000,
  pumpkin_blossom: 25_200_000, starburst_lily: 25_200_000, sporebloom: 26_100_000, fire_lily: 27_000_000,
  stargazer: 27_900_000, fullmoon_bloom: 28_800_000, ice_crown: 28_800_000, diamond_bloom: 30_600_000,
  oracle_eye: 32_400_000, halfmoon_bloom: 34_200_000, aurora_bloom: 34_500_000, mirrorpetal: 36_000_000,
  emberspark: 37_800_000,
  blink_rose: 54_000_000, dawnfire: 64_800_000, moonflower: 86_400_000, jellybloom: 90_000_000,
  celestial_bloom: 108_000_000, void_blossom: 129_600_000, seraph_wing: 162_000_000,
  solar_rose: 172_800_000, nebula_drift: 194_400_000, superbloom: 216_000_000,
  wanderbloom: 216_000_000, chrysanthemum: 259_200_000,
  umbral_bloom: 324_000_000, obsidian_rose: 388_800_000, duskmantle: 432_000_000,
  deeproot: 450_000_000, graveweb: 518_400_000, rimestorm: 540_000_000,
  nightwing: 648_000_000, solglow: 675_000_000, ashenveil: 712_800_000, voidfire: 777_600_000,
  dreambloom: 900_000_000, fairy_blossom: 972_000_000, lovebind: 1_036_800_000,
  islebloom: 1_065_000_000, eternal_heart: 1_123_200_000, moonrime: 1_155_000_000,
  nova_bloom: 1_209_600_000, shadowgale: 1_245_000_000, princess_blossom: 1_296_000_000,
  // Event-exclusive
  sakura_blossom: 777_600_000,
};

// ── Fertilizer speed multipliers (mirrors src/data/upgrades.ts) ───────────
const FERT_MULT: Record<string, number> = {
  basic: 1.1, advanced: 1.25, premium: 1.5, elite: 1.75, miracle: 2.0,
};

// ── Weather growth multipliers (mirrors src/data/weather.ts) ──────────────
// Only rain and thunderstorm differ from 1.0
const WEATHER_MULT: Record<string, number> = {
  rain: 1.5, thunderstorm: 1.5,
};

// ── Weather mutation types (mirrors src/store/gameStore.ts) ───────────────
const WEATHER_MUTATION_TYPE: Record<string, string> = {
  rain:            "wet",
  heatwave:        "scorched",
  cold_front:      "frozen",
  star_shower:     "moonlit",
  prismatic_skies: "rainbow",
  golden_hour:     "golden",
  tornado:         "windstruck",
  // thunderstorm omitted — handled via two-step chain (wet→shocked) below
};

// Per-minute equivalents derived from the shared per-tick source of truth.
// Formula: 1 - (1 - perTickChance)^60
const WEATHER_MUTATION_CHANCE_PER_MIN: Record<string, number> = Object.fromEntries(
  Object.entries(WEATHER_MUT_CHANCE_PER_TICK).map(([k, v]) => [k, perMinChance(v)])
);
const THUNDERSTORM_WET_CHANCE_PER_MIN     = perMinChance(THUNDERSTORM_WET_CHANCE_PER_TICK);
const THUNDERSTORM_SHOCKED_CHANCE_PER_MIN = perMinChance(THUNDERSTORM_SHOCKED_CHANCE_PER_TICK);
const MOONLIT_NIGHT_CHANCE_PER_MIN        = perMinChance(MOONLIT_NIGHT_CHANCE_PER_TICK);

function isNightUTC(now: number): boolean {
  const h = new Date(now).getUTCHours();
  return h >= 20 || h < 6;
}

// ── Gear range offsets ─────────────────────────────────────────────────────
const OFFSETS_CROSS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const OFFSETS_3X3: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];
const OFFSETS_DIAMOND: [number, number][] = [
  [-2, 0],
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -2], [ 0, -1], [ 0, 1], [ 0, 2],
  [ 1, -1], [ 1, 0], [ 1, 1],
  [ 2, 0],
];

// ── Gear definitions ───────────────────────────────────────────────────────
interface GearDef {
  subtype: "harvest_bell" | "auto_planter" | "scarecrow" | "aegis" | "lawnmower" | "fan" | "sprinkler_regular" | "sprinkler_mutation" | "composter";
  /** Composter only — max fertilizers that can be stored before collection. */
  maxStorage?: number;
  /** Radius offsets for radial gear (harvest bell, auto-planter, scarecrow, sprinklers). */
  offsets?: [number, number][];
  /** Line-of-sight cell count for directional gear (fan, aegis, lawnmower). */
  fanRange?: number;
  durationMs: number;
  /** Scarecrow only — cumulative strip chance over a 1-hour window. */
  scarecrowStripPerHour?: number;
  /** Fan only — cumulative Wet-strip chance per hour. */
  fanStripPerHour?: number;
  /** Fan only — cumulative Windstruck-apply chance per hour. */
  fanWindstruckPerHour?: number;
  /** Regular sprinkler only — cumulative Wet chance per hour. */
  wetPerHour?: number;
  /** Mutation sprinkler only — which mutation to apply. */
  mutationType?: string;
  /** Mutation sprinkler only — cumulative mutation chance per hour. */
  mutationPerHour?: number;
}
const GEAR_DEFS: Record<string, GearDef> = {
  harvest_bell_rare:      { subtype: "harvest_bell", offsets: OFFSETS_CROSS,   durationMs:  4 * 60 * 60 * 1_000 },
  harvest_bell_legendary: { subtype: "harvest_bell", offsets: OFFSETS_3X3,     durationMs:  8 * 60 * 60 * 1_000 },
  auto_planter_prismatic: { subtype: "auto_planter", offsets: OFFSETS_DIAMOND, durationMs: 12 * 60 * 60 * 1_000 },
  // Composter — generates a fertilizer each time a nearby plant blooms
  composter_uncommon:  { subtype: "composter", offsets: OFFSETS_3X3,     durationMs:  4 * 60 * 60 * 1_000, maxStorage: 10 },
  composter_rare:      { subtype: "composter", offsets: OFFSETS_3X3,     durationMs:  8 * 60 * 60 * 1_000, maxStorage: 20 },
  composter_legendary: { subtype: "composter", offsets: OFFSETS_DIAMOND, durationMs: 12 * 60 * 60 * 1_000, maxStorage: 30 },
  // Scarecrow — blocks weather AND gear mutations within radius, plus strip chance
  scarecrow_rare:         { subtype: "scarecrow", offsets: OFFSETS_3X3,     durationMs:  4 * 60 * 60 * 1_000, scarecrowStripPerHour: 0.15 },
  scarecrow_legendary:    { subtype: "scarecrow", offsets: OFFSETS_3X3,     durationMs:  8 * 60 * 60 * 1_000, scarecrowStripPerHour: 0.25 },
  scarecrow_mythic:       { subtype: "scarecrow", offsets: OFFSETS_DIAMOND, durationMs: 12 * 60 * 60 * 1_000, scarecrowStripPerHour: 0.40 },
  // Aegis — directional, blocks weather mutations only (gear mutations still apply)
  aegis_uncommon:         { subtype: "aegis", fanRange: 2, durationMs: 2 * 60 * 60 * 1_000 },
  aegis_rare:             { subtype: "aegis", fanRange: 3, durationMs: 4 * 60 * 60 * 1_000 },
  aegis_legendary:        { subtype: "aegis", fanRange: 4, durationMs: 8 * 60 * 60 * 1_000 },
  // Lawnmower — directional harvest bell
  lawnmower_uncommon:     { subtype: "lawnmower", fanRange: 2, durationMs: 2 * 60 * 60 * 1_000 },
  lawnmower_rare:         { subtype: "lawnmower", fanRange: 3, durationMs: 4 * 60 * 60 * 1_000 },
  lawnmower_legendary:    { subtype: "lawnmower", fanRange: 4, durationMs: 8 * 60 * 60 * 1_000 },
  // Fan — directional; strips Wet mutation or applies Windstruck to unmutated blooms
  fan_uncommon:           { subtype: "fan", fanRange: 2, durationMs: 2 * 60 * 60 * 1_000, fanStripPerHour: 0.50, fanWindstruckPerHour: 0.15 },
  fan_rare:               { subtype: "fan", fanRange: 3, durationMs: 4 * 60 * 60 * 1_000, fanStripPerHour: 0.70, fanWindstruckPerHour: 0.15 },
  // Regular sprinklers — apply Wet to unmutated blooms
  sprinkler_rare:         { subtype: "sprinkler_regular", offsets: OFFSETS_CROSS,   durationMs: 1 * 60 * 60 * 1_000, wetPerHour: 0.35 },
  sprinkler_legendary:    { subtype: "sprinkler_regular", offsets: OFFSETS_3X3,     durationMs: 2 * 60 * 60 * 1_000, wetPerHour: 0.35 },
  sprinkler_mythic:       { subtype: "sprinkler_regular", offsets: OFFSETS_DIAMOND, durationMs: 4 * 60 * 60 * 1_000, wetPerHour: 0.35 },
  // Mutation sprinklers — 50% per hour to apply their mutation; Generator (shocked) requires Wet first
  sprinkler_flame:     { subtype: "sprinkler_mutation", offsets: OFFSETS_3X3, durationMs: 2 * 60 * 60 * 1_000, mutationType: "scorched", mutationPerHour: 0.50 },
  sprinkler_frost:     { subtype: "sprinkler_mutation", offsets: OFFSETS_3X3, durationMs: 2 * 60 * 60 * 1_000, mutationType: "frozen",   mutationPerHour: 0.50 },
  sprinkler_lightning: { subtype: "sprinkler_mutation", offsets: OFFSETS_3X3, durationMs: 2 * 60 * 60 * 1_000, mutationType: "shocked",  mutationPerHour: 0.50 },
  sprinkler_lunar:     { subtype: "sprinkler_mutation", offsets: OFFSETS_3X3, durationMs: 2 * 60 * 60 * 1_000, mutationType: "moonlit",  mutationPerHour: 0.50 },
  sprinkler_midas:     { subtype: "sprinkler_mutation", offsets: OFFSETS_3X3, durationMs: 2 * 60 * 60 * 1_000, mutationType: "golden",   mutationPerHour: 0.50 },
  sprinkler_prism:     { subtype: "sprinkler_mutation", offsets: OFFSETS_3X3, durationMs: 2 * 60 * 60 * 1_000, mutationType: "rainbow",  mutationPerHour: 0.50 },
};

// ── Types ──────────────────────────────────────────────────────────────────
interface Plant {
  speciesId: string;
  timePlanted: number;
  growthMs?: number;
  lastTickAt?: number;
  bloomedAt?: number;
  sproutedAt?: number;
  fertilizer?: string;
  masteredBonus?: number;
  mutation?: string | null;
  infused?: boolean;
  // Consumable flags — set by use-consumable, consumed at harvest
  mutationBlocked?: boolean;
  mutationBoost?:   { mutation: string; multiplier: number };
  // Magnifying Glass — once true, this plant's mutation state is locked and
  // no further weather/sprinkler/fan rolls should change it.
  revealed?:        boolean;
  // Garden Pin — when bloomed, plant is shielded from auto-harvest (Harvest
  // Bell, Auto-Planter). Manual harvest still works.
  pinned?:          boolean;
}
interface Gear { gearType: string; placedAt: number; direction?: "up" | "down" | "left" | "right"; }
interface Plot { id: string; plant?: Plant | null; gear?: Gear | null; }
interface InvItem { speciesId: string; quantity: number; isSeed: boolean; mutation?: string | null; }
interface Save {
  user_id: string;
  updated_at: string;
  grid: Plot[][];
  inventory: InvItem[];
  discovered: string[];
  discoveredRecipes: string[];
}

// ── Growth helpers ─────────────────────────────────────────────────────────
function computeGrowthMs(plant: Plant, now: number, weatherMult: number): number {
  if (plant.bloomedAt) return Infinity;
  const fert = FERT_MULT[plant.fertilizer ?? ""] ?? 1.0;
  const mast = plant.masteredBonus ?? 1.0;
  const mult = fert * mast * weatherMult;
  if (plant.growthMs !== undefined && plant.lastTickAt !== undefined) {
    return plant.growthMs + Math.max(0, now - plant.lastTickAt) * mult;
  }
  if (plant.sproutedAt !== undefined) {
    const seedMs = (FLOWER_BLOOM_MS[plant.speciesId] ?? 300_000) / 3;
    return seedMs + Math.max(0, now - plant.sproutedAt) * mult;
  }
  return Math.max(0, now - plant.timePlanted) * mult;
}

function hasBloom(plant: Plant, now: number, weatherMult: number): boolean {
  if (plant.bloomedAt && now >= plant.bloomedAt) return true;
  const gMs   = computeGrowthMs(plant, now, weatherMult);
  const total = FLOWER_BLOOM_MS[plant.speciesId];
  return total !== undefined && gMs >= total;
}

function isExpired(gear: Gear, now: number): boolean {
  const def = GEAR_DEFS[gear.gearType];
  return !def || now >= gear.placedAt + def.durationMs;
}

function affectedCells(
  gearType: string,
  ri: number,
  ci: number,
  rows: number,
  cols: number,
  direction?: "up" | "down" | "left" | "right",
): [number, number][] {
  const def = GEAR_DEFS[gearType];
  if (!def) return [];

  // Directional gear (Aegis): line of cells in chosen direction
  if (def.fanRange && direction) {
    const offsets: [number, number][] = [];
    for (let i = 1; i <= def.fanRange; i++) {
      if (direction === "up")    offsets.push([-i,  0]);
      if (direction === "down")  offsets.push([ i,  0]);
      if (direction === "left")  offsets.push([ 0, -i]);
      if (direction === "right") offsets.push([ 0,  i]);
    }
    return offsets
      .map(([dr, dc]): [number, number] => [ri + dr, ci + dc])
      .filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols);
  }

  // Radial gear (harvest bell, auto-planter, scarecrow)
  if (!def.offsets) return [];
  return def.offsets
    .map(([dr, dc]): [number, number] => [ri + dr, ci + dc])
    .filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols);
}

// ── Mutation shield coverage ────────────────────────────────────────────────
// Builds a per-cell map of mutation-shield coverage in one pass so the weather
// + strip pass can do O(1) lookups instead of re-scanning gear per cell.
//   - hasShield: true if any unexpired Scarecrow OR Aegis covers this cell
//   - stripPerHour: max scarecrowStripPerHour from any covering Scarecrow
interface CoverageEntry {
  hasShield: boolean;    // Scarecrow OR Aegis — blocks weather mutations
  hasScarecrow: boolean; // Scarecrow only — blocks gear mutations (sprinklers) too
  stripPerHour: number;
}
function buildShieldCoverage(grid: Plot[][], now: number): Map<string, CoverageEntry> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const map  = new Map<string, CoverageEntry>();

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const gear = grid[ri][ci]?.gear;
      if (!gear) continue;
      const def = GEAR_DEFS[gear.gearType];
      if (!def || isExpired(gear, now)) continue;
      if (def.subtype !== "scarecrow" && def.subtype !== "aegis") continue;

      for (const [ar, ac] of affectedCells(gear.gearType, ri, ci, rows, cols, gear.direction)) {
        const key = `${ar},${ac}`;
        const cur = map.get(key) ?? { hasShield: false, hasScarecrow: false, stripPerHour: 0 };
        cur.hasShield = true;
        if (def.subtype === "scarecrow") {
          cur.hasScarecrow = true;
          if ((def.scarecrowStripPerHour ?? 0) > cur.stripPerHour) {
            cur.stripPerHour = def.scarecrowStripPerHour ?? 0;
          }
        }
        map.set(key, cur);
      }
    }
  }
  return map;
}

// ── Scarecrow strip ────────────────────────────────────────────────────────
// Per cron run, for each bloomed plant under a Scarecrow with an existing
// string mutation, rolls the converted-to-per-minute strip chance. On hit
// sets `mutation = null` (matches client convention; Giant-tried marker).
function rollScarecrowStrip(grid: Plot[][], coverage: Map<string, CoverageEntry>, _now: number): { grid: Plot[][]; changed: boolean } {
  let changed = false;
  const next = grid.map((row, ri) => row.map((plot, ci) => {
    if (!plot.plant || !plot.plant.bloomedAt) return plot;
    if (plot.plant.revealed) return plot;
    if (typeof plot.plant.mutation !== "string") return plot;

    const cov = coverage.get(`${ri},${ci}`);
    if (!cov || cov.stripPerHour <= 0) return plot;

    // Per-cron-run probability: cumulative perHour distributed evenly across 60 minutes.
    // Cron runs ~per minute, so apply 1 minute's worth of strip chance per run.
    const perMin = 1 - Math.pow(1 - cov.stripPerHour, 1 / 60);
    if (Math.random() < perMin) {
      changed = true;
      return { ...plot, plant: { ...plot.plant, mutation: null } };
    }
    return plot;
  }));
  return { grid: changed ? next : grid, changed };
}

// ── Fan strip / windstruck ─────────────────────────────────────────────────
// Strips Wet mutation from blooms in the fan's path, or applies Windstruck
// to unmutated blooms. Skips revealed plants and plants with other mutations.
function rollFan(grid: Plot[][], now: number): { grid: Plot[][]; changed: boolean } {
  let changed = false;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next = grid.map(row => [...row.map(p => ({ ...p }))]);

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const gear = grid[ri][ci]?.gear;
      if (!gear) continue;
      const def = GEAR_DEFS[gear.gearType];
      if (!def || def.subtype !== "fan" || !def.fanStripPerHour) continue;
      if (isExpired(gear, now)) continue;
      if (!gear.direction) continue;

      const stripPerMin      = 1 - Math.pow(1 - (def.fanStripPerHour      ?? 0), 1 / 60);
      const windstruckPerMin = 1 - Math.pow(1 - (def.fanWindstruckPerHour ?? 0), 1 / 60);

      for (const [ar, ac] of affectedCells(gear.gearType, ri, ci, rows, cols, gear.direction)) {
        const plot = next[ar][ac];
        if (!plot.plant || !plot.plant.bloomedAt) continue;
        if (plot.plant.revealed) continue;

        const mut = plot.plant.mutation;
        if (mut === "wet" && Math.random() < stripPerMin) {
          next[ar][ac] = { ...plot, plant: { ...plot.plant, mutation: null } };
          changed = true;
        } else if (!mut && !plot.plant.mutationBlocked && Math.random() < windstruckPerMin) {
          next[ar][ac] = { ...plot, plant: { ...plot.plant, mutation: "windstruck" } };
          changed = true;
        }
        // Any other mutation or already Windstruck — fan does nothing
      }
    }
  }

  return { grid: changed ? next : grid, changed };
}

// ── Sprinklers (regular + mutation) ───────────────────────────────────────
// Mirrors the client-side sprinkler tick in gameStore.ts.
// Regular sprinklers apply Wet to unmutated blooms.
// Mutation sprinklers apply their mutation to unmutated blooms, except
// Generator (shocked) which upgrades Wet → Shocked.
// Scarecrow blocks all sprinkler mutations.
function rollSprinklers(grid: Plot[][], shieldCoverage: Map<string, CoverageEntry>, now: number): { grid: Plot[][]; changed: boolean } {
  let changed = false;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next = grid.map(row => [...row.map(p => ({ ...p }))]);

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const gear = grid[ri][ci]?.gear;
      if (!gear) continue;
      const def = GEAR_DEFS[gear.gearType];
      if (!def) continue;
      if (def.subtype !== "sprinkler_regular" && def.subtype !== "sprinkler_mutation") continue;
      if (isExpired(gear, now)) continue;
      if (!def.offsets) continue;

      const wetPerMin      = def.wetPerHour      ? 1 - Math.pow(1 - def.wetPerHour,      1 / 60) : 0;
      const mutPerMin      = def.mutationPerHour  ? 1 - Math.pow(1 - def.mutationPerHour, 1 / 60) : 0;
      const isGenerator    = def.mutationType === "shocked";

      for (const [ar, ac] of affectedCells(gear.gearType, ri, ci, rows, cols)) {
        const plot = next[ar][ac];
        if (!plot.plant || !plot.plant.bloomedAt) continue;
        if (plot.plant.revealed) continue;
        if (plot.plant.mutationBlocked) continue;

        // Scarecrow blocks all gear mutations; Aegis does NOT block sprinklers
        const cov = shieldCoverage.get(`${ar},${ac}`);
        if (cov?.hasScarecrow) continue;

        const mut = plot.plant.mutation;

        if (def.subtype === "sprinkler_mutation") {
          if (isGenerator) {
            // Generator: Wet → Shocked only
            if (mut === "wet" && Math.random() < mutPerMin) {
              next[ar][ac] = { ...plot, plant: { ...plot.plant, mutation: "shocked" } };
              changed = true;
            }
          } else {
            // Other mutation sprinklers: unmutated blooms only
            if (!mut && Math.random() < mutPerMin) {
              next[ar][ac] = { ...plot, plant: { ...plot.plant, mutation: def.mutationType! } };
              changed = true;
            }
          }
        } else {
          // Regular sprinkler: apply Wet to unmutated blooms
          if (!mut && Math.random() < wetPerMin) {
            next[ar][ac] = { ...plot, plant: { ...plot.plant, mutation: "wet" } };
            changed = true;
          }
        }
      }
    }
  }

  return { grid: changed ? next : grid, changed };
}

// ── Composter ─────────────────────────────────────────────────────────────
function rollComposterFertilizer(rarity: string): string {
  const table: Record<string, Record<string, number>> = {
    common:    { basic: 50, advanced: 30, premium: 15, elite: 4,  miracle: 1  },
    uncommon:  { basic: 35, advanced: 35, premium: 20, elite: 8,  miracle: 2  },
    rare:      { basic: 20, advanced: 30, premium: 30, elite: 15, miracle: 5  },
    legendary: { basic: 10, advanced: 20, premium: 30, elite: 25, miracle: 15 },
    mythic:    { basic: 5,  advanced: 15, premium: 25, elite: 30, miracle: 25 },
    exalted:   { basic: 3,  advanced: 10, premium: 20, elite: 30, miracle: 37 },
    prismatic: { basic: 2,  advanced: 8,  premium: 15, elite: 25, miracle: 50 },
  };
  const weights = table[rarity] ?? table.common;
  const total   = Object.values(weights).reduce((s, w) => s + w, 0);
  let roll      = Math.random() * total;
  for (const [type, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return "basic";
}

function runComposters(originalGrid: Plot[][], stampedGrid: Plot[][], now: number): Plot[][] {
  const rows = stampedGrid.length;
  const cols = stampedGrid[0]?.length ?? 0;
  let grid = stampedGrid;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wasBloom = !!(originalGrid[r]?.[c]?.plant?.bloomedAt);
      const nowBloom = !!(stampedGrid[r]?.[c]?.plant?.bloomedAt);
      if (wasBloom || !nowBloom) continue; // only newly bloomed this tick

      const speciesId = stampedGrid[r][c].plant!.speciesId;
      const rarity    = SPECIES_DATA[speciesId]?.r ?? "common";

      for (const [dr, dc] of OFFSETS_3X3) {
        const cr = r + dr;
        const cc = c + dc;
        if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
        const plot = grid[cr][cc];
        if (!plot.gear) continue;
        const def = GEAR_DEFS[plot.gear.gearType];
        if (!def || def.subtype !== "composter") continue;
        if (isExpired(plot.gear, now)) continue;
        const stored   = (plot.gear.storedFertilizers ?? []) as string[];
        const maxStore = def.maxStorage ?? 10;
        if (stored.length >= maxStore) continue;

        const fertType  = rollComposterFertilizer(rarity);
        const newGear   = { ...plot.gear, storedFertilizers: [...stored, fertType] };
        grid = grid.map((row, ri) =>
          ri !== cr ? row : row.map((p, ci) => ci !== cc ? p : { ...p, gear: newGear })
        );
      }
    }
  }
  return grid;
}

// ── Stamp bloomedAt ────────────────────────────────────────────────────────
function stampBloomed(grid: Plot[][], now: number, weatherMult: number): { grid: Plot[][]; changed: boolean } {
  let changed = false;
  const next = grid.map(row => row.map(plot => {
    if (!plot.plant || plot.plant.bloomedAt) return plot;
    if (!hasBloom(plot.plant, now, weatherMult)) return plot;
    changed = true;
    return { ...plot, plant: { ...plot.plant, bloomedAt: now } };
  }));
  return { grid: changed ? next : grid, changed };
}

// ── Harvest bell ───────────────────────────────────────────────────────────
function runHarvestBells(save: Save, now: number): Save {
  let cur = save;
  const rows = save.grid.length;
  const cols = save.grid[0]?.length ?? 0;

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const gear = cur.grid[ri][ci].gear;
      if (!gear) continue;
      const def = GEAR_DEFS[gear.gearType];
      if (!def || (def.subtype !== "harvest_bell" && def.subtype !== "lawnmower")) continue;
      if (isExpired(gear, now)) continue;

      for (const [ar, ac] of affectedCells(gear.gearType, ri, ci, rows, cols, gear.direction)) {
        const targetPlot = cur.grid[ar]?.[ac];
        if (!targetPlot?.plant) continue;
        // Only harvest plants with bloomedAt stamped AND past the 5-second grace
        if (!targetPlot.plant.bloomedAt || now - targetPlot.plant.bloomedAt < 5_000) continue;
        // Skip infused plants — they are reserved for Cropsticks cross-breeding
        if (targetPlot.plant.infused) continue;
        // Garden Pin shields plants from auto-harvest (manual harvest still works)
        if (targetPlot.plant.pinned) continue;

        const { speciesId, mutation } = targetPlot.plant;
        const mut = mutation ?? null;

        // Remove plant from grid
        const newGrid = cur.grid.map((row, rr) =>
          row.map((p, cc) => rr === ar && cc === ac ? { ...p, plant: null } : p)
        );

        // Add bloom to inventory
        const existIdx = cur.inventory.findIndex(
          i => !i.isSeed && i.speciesId === speciesId && (i.mutation ?? null) === mut
        );
        const newInv: InvItem[] = existIdx >= 0
          ? cur.inventory.map((i, idx) => idx === existIdx ? { ...i, quantity: i.quantity + 1 } : i)
          : [...cur.inventory, { speciesId, quantity: 1, isSeed: false, mutation: mut }];

        // Update discovered
        const newDiscovered = [...cur.discovered];
        if (!newDiscovered.includes(speciesId)) newDiscovered.push(speciesId);
        if (mut) {
          const key = `${speciesId}:${mut}`;
          if (!newDiscovered.includes(key)) newDiscovered.push(key);
        }

        cur = { ...cur, grid: newGrid, inventory: newInv, discovered: newDiscovered };
      }
    }
  }

  return cur;
}

// ── Auto-planter ───────────────────────────────────────────────────────────
function pickBestSeed(inventory: InvItem[]): string | null {
  const seeds = inventory.filter(i => i.isSeed && i.quantity > 0);
  if (!seeds.length) return null;
  return seeds.reduce((a, b) => b.quantity > a.quantity ? b : a).speciesId;
}

function runAutoPlanter(save: Save, now: number): Save {
  let cur = save;
  const rows = save.grid.length;
  const cols = save.grid[0]?.length ?? 0;

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const gear = cur.grid[ri][ci].gear;
      if (!gear) continue;
      const def = GEAR_DEFS[gear.gearType];
      if (!def || def.subtype !== "auto_planter") continue;
      if (isExpired(gear, now)) continue;

      for (const [ar, ac] of affectedCells(gear.gearType, ri, ci, rows, cols)) {
        const targetPlot = cur.grid[ar]?.[ac];
        if (!targetPlot || targetPlot.plant || targetPlot.gear) continue;

        const speciesId = pickBestSeed(cur.inventory);
        if (!speciesId) return cur; // no seeds left

        // Deduct seed
        const newInv = cur.inventory
          .map(i => i.isSeed && i.speciesId === speciesId ? { ...i, quantity: i.quantity - 1 } : i)
          .filter(i => i.quantity > 0);

        // Plant seed
        const newGrid = cur.grid.map((row, rr) =>
          row.map((p, cc) =>
            rr === ar && cc === ac
              ? { ...p, plant: { speciesId, timePlanted: now, growthMs: 0, lastTickAt: now } }
              : p
          )
        );

        cur = { ...cur, grid: newGrid, inventory: newInv };
      }
    }
  }

  return cur;
}

// ── Weather mutations ──────────────────────────────────────────────────────
// Rolls weather-based mutations on all bloomed plants (same logic as
// tickWeatherMutations in gameStore.ts, but scaled to per-minute probability).
// Plants under a Scarecrow OR Aegis are skipped (both block weather mutations).
function rollWeatherMutations(
  grid: Plot[][],
  weatherType: string,
  now: number,
  coverage: Map<string, CoverageEntry>,
): { grid: Plot[][]; changed: boolean } {
  if (!weatherType || weatherType === "clear") return { grid, changed: false };

  const mutType   = WEATHER_MUTATION_TYPE[weatherType];
  const mutChance = WEATHER_MUTATION_CHANCE_PER_MIN[weatherType] ?? 0;
  const night     = isNightUTC(now);
  let changed     = false;

  const next = grid.map((row, ri) => row.map((plot, ci) => {
    if (!plot.plant || !plot.plant.bloomedAt) return plot;

    // ── Magnifying Glass guard ───────────────────────────────────────────────
    // Once revealed, the plant's mutation state is locked across reloads.
    if (plot.plant.revealed) return plot;

    // ── Purity Vial guard ────────────────────────────────────────────────────
    // mutationBlocked plants are shielded from all weather mutations.
    // The flag is consumed at harvest time, not here.
    if (plot.plant.mutationBlocked) return plot;

    // ── Scarecrow / Aegis shield ─────────────────────────────────────────────
    if (coverage.get(`${ri},${ci}`)?.hasShield) return plot;

    // Helper: look up any active mutation boost for a given mutation type.
    const boostFor = (mt: string): number =>
      plot.plant!.mutationBoost?.mutation === mt
        ? (plot.plant!.mutationBoost!.multiplier ?? 1)
        : 1;

    // Thunderstorm combo: wet → shocked
    if (weatherType === "thunderstorm" && plot.plant.mutation === "wet") {
      const chance = Math.min(1.0, THUNDERSTORM_SHOCKED_CHANCE_PER_MIN * boostFor("shocked"));
      if (Math.random() < chance) {
        changed = true;
        return { ...plot, plant: { ...plot.plant, mutation: "shocked" } };
      }
      return plot;
    }

    // Skip already-mutated plants (string = assigned; null = Giant-tried, weather can still apply)
    if (typeof plot.plant.mutation === "string") return plot;

    // Thunderstorm: null/undefined → wet
    if (weatherType === "thunderstorm" && plot.plant.mutation == null) {
      const chance = Math.min(1.0, THUNDERSTORM_WET_CHANCE_PER_MIN * boostFor("wet"));
      if (Math.random() < chance) {
        changed = true;
        return { ...plot, plant: { ...plot.plant, mutation: "wet" } };
      }
      return plot;
    }

    // Standard weather mutation roll — apply boost if the vial matches this weather's mutation
    if (mutType && mutChance > 0) {
      const chance = Math.min(1.0, mutChance * boostFor(mutType));
      if (Math.random() < chance) {
        changed = true;
        return { ...plot, plant: { ...plot.plant, mutation: mutType } };
      }
    }

    // Moonlit at night (outside star_shower)
    if (night && weatherType !== "star_shower" && plot.plant.mutation === undefined) {
      const chance = Math.min(1.0, MOONLIT_NIGHT_CHANCE_PER_MIN * boostFor("moonlit"));
      if (Math.random() < chance) {
        changed = true;
        return { ...plot, plant: { ...plot.plant, mutation: "moonlit" } };
      }
    }

    return plot;
  }));

  return { grid: changed ? next : grid, changed };
}

// ── Cropsticks cross-breeding ──────────────────────────────────────────────
//
// v2.3: deterministic progress timer — once a cropsticks finds a valid recipe
// pair of infused neighbors, it stamps `crossbreedStartedAt` and produces a
// seed exactly 1 hour later. Replaces the old per-tick RNG roll so the UI
// can render a progress bar with predictable arrival time.

const CROPSTICKS_BREED_DURATION_MS = 60 * 60 * 1_000; // 1 hour

const RARITY_IDX: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4, exalted: 5, prismatic: 6,
};

// Mirrors CROSS_BREED_RECIPES in src/data/recipes.ts
interface Recipe {
  id:              string;
  tier:            1 | 2 | 3 | 4;
  typeA:           string;
  typeB:           string;
  minRarity:       string;
  outputSpeciesId: string;
}

const RECIPES: Recipe[] = [
  // Tier 1 — Rare+ inputs → Legendary output
  { id: "blaze+frost",       tier: 1, typeA: "blaze",   typeB: "frost",   minRarity: "rare",      outputSpeciesId: "phoenix_lily"   },
  { id: "lunar+solar",       tier: 1, typeA: "lunar",   typeB: "solar",   minRarity: "rare",      outputSpeciesId: "eclipse_bloom"  },
  { id: "tide+storm",        tier: 1, typeA: "tide",    typeB: "storm",   minRarity: "rare",      outputSpeciesId: "tempest_orchid" },
  { id: "grove+shadow",      tier: 1, typeA: "grove",   typeB: "shadow",  minRarity: "rare",      outputSpeciesId: "blightmantle"   },
  { id: "arcane+stellar",    tier: 1, typeA: "arcane",  typeB: "stellar", minRarity: "rare",      outputSpeciesId: "cosmosbloom"    },
  { id: "fairy+zephyr",      tier: 1, typeA: "fairy",   typeB: "zephyr",  minRarity: "rare",      outputSpeciesId: "dreamgust"      },
  // Tier 2 — Legendary+ inputs → Mythic output
  { id: "blaze+solar",       tier: 2, typeA: "blaze",   typeB: "solar",   minRarity: "legendary", outputSpeciesId: "solarburst"     },
  { id: "lunar+tide",        tier: 2, typeA: "lunar",   typeB: "tide",    minRarity: "legendary", outputSpeciesId: "tidalune"       },
  { id: "grove+zephyr",      tier: 2, typeA: "grove",   typeB: "zephyr",  minRarity: "legendary", outputSpeciesId: "whisperleaf"    },
  { id: "frost+arcane",      tier: 2, typeA: "frost",   typeB: "arcane",  minRarity: "legendary", outputSpeciesId: "crystalmind"    },
  // Tier 3 — Mythic+ inputs → Exalted output
  { id: "arcane+shadow-t3",  tier: 3, typeA: "arcane",  typeB: "shadow",  minRarity: "mythic",    outputSpeciesId: "void_chrysalis" },
  { id: "stellar+zephyr-t3", tier: 3, typeA: "stellar", typeB: "zephyr",  minRarity: "mythic",    outputSpeciesId: "starloom"       },
  // Tier 4 — Exalted+ inputs → Prismatic output
  { id: "arcane+stellar-t4", tier: 4, typeA: "arcane",  typeB: "stellar", minRarity: "exalted",   outputSpeciesId: "the_first_bloom" },
];

function findBestRecipe(
  typesA: string[], rarityA: string,
  typesB: string[], rarityB: string,
): Recipe | null {
  let best: Recipe | null = null;
  for (const recipe of RECIPES) {
    if (RARITY_IDX[rarityA] < RARITY_IDX[recipe.minRarity]) continue;
    if (RARITY_IDX[rarityB] < RARITY_IDX[recipe.minRarity]) continue;
    const fwd = typesA.includes(recipe.typeA) && typesB.includes(recipe.typeB);
    const rev = typesA.includes(recipe.typeB) && typesB.includes(recipe.typeA);
    if (!fwd && !rev) continue;
    if (!best || recipe.tier > best.tier) best = recipe;
  }
  return best;
}

// Species → { types, rarity } — mirrors ALL_FLOWERS in src/data/flowers.ts
const SPECIES_DATA: Record<string, { t: string[]; r: string }> = {
  // Common
  quickgrass:    { t: ["grove"],           r: "common" },
  dustweed:      { t: ["zephyr","shadow"], r: "common" },
  sprig:         { t: ["grove"],           r: "common" },
  dewdrop:       { t: ["tide"],            r: "common" },
  pebblebloom:   { t: ["grove"],           r: "common" },
  ember_moss:    { t: ["blaze","grove"],   r: "common" },
  dandelion:     { t: ["grove","zephyr"],  r: "common" },
  clover:        { t: ["grove","fairy"],   r: "common" },
  violet:        { t: ["fairy","arcane"],  r: "common" },
  lemongrass:    { t: ["grove","solar"],   r: "common" },
  daisy:         { t: ["grove","fairy"],   r: "common" },
  honeywort:     { t: ["grove","solar"],   r: "common" },
  buttercup:     { t: ["fairy","solar"],   r: "common" },
  dawnpetal:     { t: ["lunar","solar"],   r: "common" },
  poppy:         { t: ["blaze","grove"],   r: "common" },
  chamomile:     { t: ["grove","solar"],   r: "common" },
  marigold:      { t: ["solar","grove"],   r: "common" },
  sunflower:     { t: ["solar"],           r: "common" },
  coppercup:     { t: ["grove"],           r: "common" },
  ivybell:       { t: ["grove","tide"],    r: "common" },
  thornberry:    { t: ["grove"],           r: "common" },
  saltmoss:      { t: ["tide"],            r: "common" },
  ashpetal:      { t: ["shadow","zephyr"], r: "common" },
  snowdrift:     { t: ["frost"],           r: "common" },
  // Uncommon
  swiftbloom:    { t: ["zephyr"],          r: "uncommon" },
  shortcress:    { t: ["grove"],           r: "uncommon" },
  thornwhistle:  { t: ["grove","blaze"],   r: "uncommon" },
  starwort:      { t: ["stellar"],         r: "uncommon" },
  mintleaf:      { t: ["grove","frost"],   r: "uncommon" },
  tulip:         { t: ["fairy","grove"],   r: "uncommon" },
  inkbloom:      { t: ["arcane","shadow"], r: "uncommon" },
  hyacinth:      { t: ["blaze","fairy"],   r: "uncommon" },
  snapdragon:    { t: ["blaze","arcane"],  r: "uncommon" },
  beebalm:       { t: ["grove","solar"],   r: "uncommon" },
  candleflower:  { t: ["blaze","arcane"],  r: "uncommon" },
  carnation:     { t: ["fairy"],           r: "uncommon" },
  ribbonweed:    { t: ["fairy"],           r: "uncommon" },
  hibiscus:      { t: ["solar","blaze"],   r: "uncommon" },
  wildberry:     { t: ["grove"],           r: "uncommon" },
  frostbell:     { t: ["frost"],           r: "uncommon" },
  bluebell:      { t: ["fairy","tide"],    r: "uncommon" },
  cherry_blossom:{ t: ["fairy","grove"],   r: "uncommon" },
  rose:          { t: ["fairy"],           r: "uncommon" },
  peacockflower: { t: ["arcane","zephyr"], r: "uncommon" },
  bamboo_bloom:  { t: ["grove","zephyr"],  r: "uncommon" },
  hummingbloom:  { t: ["zephyr","fairy"],  r: "uncommon" },
  water_lily:    { t: ["tide"],            r: "uncommon" },
  lanternflower: { t: ["blaze","arcane"],  r: "uncommon" },
  dovebloom:     { t: ["zephyr","fairy"],  r: "uncommon" },
  coral_bells:   { t: ["tide","fairy"],    r: "uncommon" },
  sundew:        { t: ["grove","shadow"],  r: "uncommon" },
  bubblebloom:   { t: ["tide","fairy"],    r: "uncommon" },
  // Rare
  flashpetal:      { t: ["storm"],           r: "rare" },
  rushwillow:      { t: ["zephyr","tide"],   r: "rare" },
  sweetheart_lily: { t: ["fairy"],           r: "rare" },
  glassbell:       { t: ["arcane","stellar"],r: "rare" },
  stormcaller:     { t: ["storm"],           r: "rare" },
  lavender:        { t: ["fairy","arcane"],  r: "rare" },
  amber_crown:     { t: ["solar","blaze"],   r: "rare" },
  peach_blossom:   { t: ["grove","fairy"],   r: "rare" },
  foxglove:        { t: ["shadow","arcane"], r: "rare" },
  butterbloom:     { t: ["fairy","zephyr"],  r: "rare" },
  peony:           { t: ["fairy"],           r: "rare" },
  tidebloom:       { t: ["tide"],            r: "rare" },
  starweave:       { t: ["stellar","arcane"],r: "rare" },
  wisteria:        { t: ["fairy","arcane"],  r: "rare" },
  dreamcup:        { t: ["fairy","arcane"],  r: "rare" },
  coralbell:       { t: ["tide"],            r: "rare" },
  foxfire:         { t: ["blaze","arcane"],  r: "rare" },
  bird_of_paradise:{ t: ["zephyr","solar"],  r: "rare" },
  solarbell:       { t: ["solar"],           r: "rare" },
  moonpetal:       { t: ["lunar"],           r: "rare" },
  orchid:          { t: ["fairy","arcane"],  r: "rare" },
  duskrose:        { t: ["lunar","shadow"],  r: "rare" },
  passionflower:   { t: ["arcane","storm"],  r: "rare" },
  glasswing:       { t: ["arcane"],          r: "rare" },
  mirror_orchid:   { t: ["arcane","stellar"],r: "rare" },
  stargazer_lily:  { t: ["stellar"],         r: "rare" },
  prism_lily:      { t: ["arcane","stellar"],r: "rare" },
  dusk_orchid:     { t: ["lunar","solar"],   r: "rare" },
  // Legendary
  firstbloom:      { t: ["solar","fairy"],    r: "legendary" },
  haste_lily:      { t: ["zephyr","storm"],   r: "legendary" },
  verdant_crown:   { t: ["grove","fairy"],    r: "legendary" },
  ironwood_bloom:  { t: ["grove"],            r: "legendary" },
  sundial:         { t: ["solar","arcane"],   r: "legendary" },
  lotus:           { t: ["tide","arcane"],    r: "legendary" },
  candy_blossom:   { t: ["fairy"],            r: "legendary" },
  prismbark:       { t: ["grove","arcane"],   r: "legendary" },
  dolphinia:       { t: ["tide"],             r: "legendary" },
  ghost_orchid:    { t: ["shadow","arcane"],  r: "legendary" },
  nestbloom:       { t: ["grove","fairy"],    r: "legendary" },
  black_rose:      { t: ["shadow"],           r: "legendary" },
  pumpkin_blossom: { t: ["shadow","grove"],   r: "legendary" },
  starburst_lily:  { t: ["stellar","storm"],  r: "legendary" },
  sporebloom:      { t: ["grove","shadow"],   r: "legendary" },
  fire_lily:       { t: ["blaze"],            r: "legendary" },
  stargazer:       { t: ["stellar"],          r: "legendary" },
  fullmoon_bloom:  { t: ["lunar"],            r: "legendary" },
  ice_crown:       { t: ["frost"],            r: "legendary" },
  diamond_bloom:   { t: ["frost","arcane"],   r: "legendary" },
  oracle_eye:      { t: ["arcane","shadow"],  r: "legendary" },
  halfmoon_bloom:  { t: ["lunar"],            r: "legendary" },
  aurora_bloom:    { t: ["stellar","arcane"], r: "legendary" },
  mirrorpetal:     { t: ["arcane","stellar"], r: "legendary" },
  emberspark:      { t: ["blaze","storm"],    r: "legendary" },
  // Legendary recipe-only (Tier 1 outputs — can themselves be inputs for Tier 2)
  phoenix_lily:    { t: ["blaze","frost"],    r: "legendary" },
  eclipse_bloom:   { t: ["lunar","solar"],    r: "legendary" },
  tempest_orchid:  { t: ["tide","storm"],     r: "legendary" },
  blightmantle:    { t: ["grove","shadow"],   r: "legendary" },
  cosmosbloom:     { t: ["arcane","stellar"], r: "legendary" },
  dreamgust:       { t: ["fairy","zephyr"],   r: "legendary" },
  // Mythic
  blink_rose:      { t: ["arcane","shadow"],  r: "mythic" },
  dawnfire:        { t: ["solar","blaze"],    r: "mythic" },
  moonflower:      { t: ["lunar"],            r: "mythic" },
  jellybloom:      { t: ["tide","arcane"],    r: "mythic" },
  celestial_bloom: { t: ["stellar"],          r: "mythic" },
  void_blossom:    { t: ["shadow","arcane"],  r: "mythic" },
  seraph_wing:     { t: ["zephyr","fairy"],   r: "mythic" },
  solar_rose:      { t: ["solar"],            r: "mythic" },
  nebula_drift:    { t: ["stellar","arcane"], r: "mythic" },
  superbloom:      { t: ["storm","stellar"],  r: "mythic" },
  wanderbloom:     { t: ["zephyr","arcane"],  r: "mythic" },
  chrysanthemum:   { t: ["arcane","stellar","fairy"], r: "mythic" },
  // Mythic recipe-only (Tier 2 outputs — can be inputs for Tier 3)
  solarburst:      { t: ["blaze","solar"],    r: "mythic" },
  tidalune:        { t: ["lunar","tide"],     r: "mythic" },
  whisperleaf:     { t: ["grove","zephyr"],   r: "mythic" },
  crystalmind:     { t: ["frost","arcane"],   r: "mythic" },
  // Exalted
  umbral_bloom:    { t: ["shadow","lunar"],   r: "exalted" },
  obsidian_rose:   { t: ["shadow"],           r: "exalted" },
  duskmantle:      { t: ["shadow","lunar"],   r: "exalted" },
  graveweb:        { t: ["shadow"],           r: "exalted" },
  nightwing:       { t: ["shadow","zephyr"],  r: "exalted" },
  ashenveil:       { t: ["shadow","blaze"],   r: "exalted" },
  voidfire:        { t: ["shadow","blaze"],   r: "exalted" },
  // Exalted recipe-only (Tier 3 outputs — inputs for Tier 4)
  void_chrysalis:  { t: ["arcane"],           r: "exalted" },
  starloom:        { t: ["stellar"],          r: "exalted" },
  // Prismatic
  dreambloom:      { t: ["fairy","arcane"],   r: "prismatic" },
  fairy_blossom:   { t: ["fairy"],            r: "prismatic" },
  lovebind:        { t: ["fairy","arcane"],   r: "prismatic" },
  eternal_heart:   { t: ["fairy","solar"],    r: "prismatic" },
  nova_bloom:      { t: ["stellar","storm","blaze"], r: "prismatic" },
  princess_blossom:{ t: ["fairy","arcane"],   r: "prismatic" },
  the_first_bloom: { t: ["arcane","stellar"], r: "prismatic" },
  // Event-exclusive
  sakura_blossom:  { t: ["fairy","zephyr"],   r: "prismatic" },
};

function runCropsticks(save: Save, now: number): Save {
  let cur = save;
  const rows = cur.grid.length;
  const cols = cur.grid[0]?.length ?? 0;

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const rawGear = cur.grid[ri][ci].gear;
      if (!rawGear || rawGear.gearType !== "cropsticks") continue;

      const gear      = rawGear as PlacedGearWithProgress;
      const startedAt = gear.crossbreedStartedAt;
      const storedA   = gear.crossbreedSourceA;
      const storedB   = gear.crossbreedSourceB;

      // ── In-progress cycle with stored source coordinates (v2.4+ path) ───
      // Infused flag was already cleared when the cycle started; locate the
      // source plants purely by stored grid coordinates.
      if (startedAt != null && storedA && storedB) {
        const plantA = cur.grid[storedA.r]?.[storedA.c]?.plant;
        const plantB = cur.grid[storedB.r]?.[storedB.c]?.plant;

        // Source plants must still exist and be bloomed (bloomedAt set, or timePlanted===0 for placed blooms).
        const aIsBloomed = plantA && (plantA.bloomedAt || plantA.timePlanted === 0);
        const bIsBloomed = plantB && (plantB.bloomedAt || plantB.timePlanted === 0);
        if (!aIsBloomed || !bIsBloomed) {
          const newGrid = cur.grid.map((row, r) =>
            row.map((plot, c) =>
              r === ri && c === ci && plot.gear
                ? { ...plot, gear: clearStartedAt(plot.gear as PlacedGearWithProgress) }
                : plot
            )
          );
          cur = { ...cur, grid: newGrid };
          continue;
        }

        // Not done yet — wait
        if (now - startedAt < CROPSTICKS_BREED_DURATION_MS) continue;

        // ── Complete ──────────────────────────────────────────────────────
        const da = SPECIES_DATA[plantA.speciesId];
        const db = SPECIES_DATA[plantB.speciesId];
        const bestRecipe = da && db ? findBestRecipe(da.t, da.r, db.t, db.r) : null;

        let outputSpeciesId: string;
        let newDiscovered: string[];
        let newDiscoveredRecipes: string[];

        if (bestRecipe) {
          // Recipe match → always produce the recipe output.
          outputSpeciesId = bestRecipe.outputSpeciesId;
          newDiscovered = cur.discovered.includes(outputSpeciesId)
            ? cur.discovered
            : [...cur.discovered, outputSpeciesId];
          newDiscoveredRecipes = cur.discoveredRecipes.includes(bestRecipe.id)
            ? cur.discoveredRecipes
            : [...cur.discoveredRecipes, bestRecipe.id];
        } else {
          // No recipe match → lower-rarity parent; random when tied.
          const tierA = da ? (RARITY_IDX[da.r] ?? 0) : 0;
          const tierB = db ? (RARITY_IDX[db.r] ?? 0) : 0;
          if (tierA < tierB)      outputSpeciesId = plantA.speciesId;
          else if (tierB < tierA) outputSpeciesId = plantB.speciesId;
          else                    outputSpeciesId = Math.random() < 0.5 ? plantA.speciesId : plantB.speciesId;
          newDiscovered      = cur.discovered;
          newDiscoveredRecipes = cur.discoveredRecipes;
        }

        // Replace cropsticks cell with the seed; source plants' infused was
        // already cleared when the cycle started — nothing to change on them.
        const newGrid = cur.grid.map((row, r) =>
          row.map((plot, c) => {
            if (r === ri && c === ci) {
              return { ...plot, gear: null, plant: { speciesId: outputSpeciesId, timePlanted: now } };
            }
            return plot;
          })
        );
        cur = { ...cur, grid: newGrid, discovered: newDiscovered, discoveredRecipes: newDiscoveredRecipes };
        continue;
      }

      // ── Scan for infused neighbors (new-cycle start OR legacy in-progress) ─
      type Neighbor = { r: number; c: number; plant: Plant };
      const infusedNeighbors: Neighbor[] = [];
      for (const [dr, dc] of OFFSETS_CROSS) {
        const nr = ri + dr;
        const nc = ci + dc;
        const plot = cur.grid[nr]?.[nc];
        if (!plot?.plant || (!plot.plant.bloomedAt && plot.plant.timePlanted !== 0) || !plot.plant.infused) continue;
        infusedNeighbors.push({ r: nr, c: nc, plant: plot.plant });
      }

      // Need at least 2 infused neighbours to crossbreed
      if (infusedNeighbors.length < 2) {
        if (startedAt != null) {
          const newGrid = cur.grid.map((row, r) =>
            row.map((plot, c) =>
              r === ri && c === ci && plot.gear
                ? { ...plot, gear: clearStartedAt(plot.gear as PlacedGearWithProgress) }
                : plot
            )
          );
          cur = { ...cur, grid: newGrid };
        }
        continue;
      }

      // Pick highest-tier recipe pair; fall back to first available pair when
      // no recipe matches (lower-rarity parent is produced at completion).
      let bestRecipe: Recipe | null = null;
      let bestA: Neighbor = infusedNeighbors[0];
      let bestB: Neighbor = infusedNeighbors[1];

      for (let i = 0; i < infusedNeighbors.length; i++) {
        for (let j = i + 1; j < infusedNeighbors.length; j++) {
          const a = infusedNeighbors[i];
          const b = infusedNeighbors[j];
          const da = SPECIES_DATA[a.plant.speciesId];
          const db = SPECIES_DATA[b.plant.speciesId];
          if (!da || !db) continue;
          const recipe = findBestRecipe(da.t, da.r, db.t, db.r);
          if (recipe && (!bestRecipe || recipe.tier > bestRecipe.tier)) {
            bestRecipe = recipe;
            bestA = a;
            bestB = b;
          }
        }
      }

      // ── Valid pair, no cycle yet → start one with stored source coords ────
      if (startedAt == null) {
        const aR = bestA.r, aC = bestA.c;
        const bR = bestB.r, bC = bestB.c;
        const newGrid = cur.grid.map((row, r) =>
          row.map((plot, c) => {
            if (r === ri && c === ci && plot.gear) {
              return {
                ...plot,
                gear: {
                  ...plot.gear,
                  crossbreedStartedAt: now,
                  crossbreedSourceA: { r: aR, c: aC },
                  crossbreedSourceB: { r: bR, c: bC },
                },
              };
            }
            // Clear infused immediately on the source plants
            if ((r === aR && c === aC) || (r === bR && c === bC)) {
              if (plot.plant) return { ...plot, plant: { ...plot.plant, infused: false } };
            }
            return plot;
          })
        );
        cur = { ...cur, grid: newGrid };
        continue;
      }

      // ── Legacy: cycle in progress (no stored coords) + pair still valid ──
      // This handles saves created before v2.4. Complete if time has elapsed.
      if (now - startedAt < CROPSTICKS_BREED_DURATION_MS) continue;

      const aR = bestA.r, aC = bestA.c;
      const bR = bestB.r, bC = bestB.c;
      const daLeg = SPECIES_DATA[bestA.plant.speciesId];
      const dbLeg = SPECIES_DATA[bestB.plant.speciesId];

      let outputSpeciesId: string;
      let newDiscovered: string[];
      let newDiscoveredRecipes: string[];

      if (bestRecipe) {
        // Recipe match → always produce the recipe output.
        outputSpeciesId = bestRecipe.outputSpeciesId;
        newDiscovered = cur.discovered.includes(outputSpeciesId)
          ? cur.discovered
          : [...cur.discovered, outputSpeciesId];
        newDiscoveredRecipes = cur.discoveredRecipes.includes(bestRecipe.id)
          ? cur.discoveredRecipes
          : [...cur.discoveredRecipes, bestRecipe.id];
      } else {
        // No recipe → lower-rarity parent; random when tied.
        const tierA = daLeg ? (RARITY_IDX[daLeg.r] ?? 0) : 0;
        const tierB = dbLeg ? (RARITY_IDX[dbLeg.r] ?? 0) : 0;
        if (tierA < tierB)      outputSpeciesId = bestA.plant.speciesId;
        else if (tierB < tierA) outputSpeciesId = bestB.plant.speciesId;
        else                    outputSpeciesId = Math.random() < 0.5 ? bestA.plant.speciesId : bestB.plant.speciesId;
        newDiscovered      = cur.discovered;
        newDiscoveredRecipes = cur.discoveredRecipes;
      }

      // Clear infused from source plants + replace cropsticks cell with the seed
      const newGrid = cur.grid.map((row, r) =>
        row.map((plot, c) => {
          if ((r === aR && c === aC) || (r === bR && c === bC)) {
            if (!plot.plant) return plot;
            return { ...plot, plant: { ...plot.plant, infused: false } };
          }
          if (r === ri && c === ci) {
            return { ...plot, gear: null, plant: { speciesId: outputSpeciesId, timePlanted: now } };
          }
          return plot;
        })
      );

      cur = { ...cur, grid: newGrid, discovered: newDiscovered, discoveredRecipes: newDiscoveredRecipes };
    }
  }

  return cur;
}

// Type-helper: PlacedGear may carry crossbreed fields on cropsticks.
type PlacedGearWithProgress = {
  gearType: string;
  crossbreedStartedAt?: number;
  crossbreedSourceA?: { r: number; c: number };
  crossbreedSourceB?: { r: number; c: number };
};
function clearStartedAt(gear: PlacedGearWithProgress) {
  const next = { ...gear };
  delete next.crossbreedStartedAt;
  delete next.crossbreedSourceA;
  delete next.crossbreedSourceB;
  return next;
}

// ── Main ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require any Authorization header — the Supabase pg_cron job always sends the service role JWT.
  // We can't compare against SUPABASE_SERVICE_ROLE_KEY here because Supabase injects a different
  // representation of the key at runtime than what is stored in the cron job definition.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();

    // ── Fetch active weather for growth multiplier + mutation type ───────────
    let weatherMult = 1.0;
    let weatherType = "clear";
    try {
      const { data: wRow } = await supabase
        .from("weather")
        .select("type, started_at, ends_at")
        .eq("id", 1)
        .single();
      if (wRow && (wRow.started_at as number) <= now && (wRow.ends_at as number) >= now) {
        weatherType = wRow.type as string;
        weatherMult = WEATHER_MULT[weatherType] ?? 1.0;
      }
    } catch { /* non-critical — fall back to clear */ }

    // ── Fetch saves updated in the last 25 hours (max gear duration = 24 h) ──
    const cutoff = new Date(now - 25 * 60 * 60 * 1_000).toISOString();
    const { data: saves, error: fetchErr } = await supabase
      .from("game_saves")
      .select("user_id, updated_at, grid, inventory, discovered, discovered_recipes")
      .gt("updated_at", cutoff);

    if (fetchErr || !saves) {
      return new Response(JSON.stringify({ error: fetchErr?.message ?? "fetch failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let scanned = 0, changed = 0;

    for (const raw of saves as Save[]) {
      scanned++;
      const grid = raw.grid as Plot[][];
      if (!grid?.length) continue;

      // Fast-path: skip saves that have nothing to do.
      // Process if: active harvest_bell/auto_planter gear, OR weather mutation possible,
      // OR cropsticks + infused bloomed plant both present.
      const flatGrid = grid.flat();
      const hasActiveGear = flatGrid.some(plot => {
        if (!plot.gear) return false;
        const def = GEAR_DEFS[plot.gear.gearType];
        return !!def && !isExpired(plot.gear, now);
      });
      const hasBloomedForMutation = weatherType !== "clear" &&
        flatGrid.some(plot => plot.plant && hasBloom(plot.plant, now, weatherMult));
      const hasCropsticks = flatGrid.some(plot => plot.gear?.gearType === "cropsticks");
      const hasInfusedBloomed = flatGrid.some(plot => plot.plant?.infused && plot.plant?.bloomedAt);
      // Also process saves where a cropsticks cycle is already in progress
      // (stored coords path — source plants are no longer marked infused).
      const hasCropsticksCycleActive = flatGrid.some(plot =>
        plot.gear?.gearType === "cropsticks" &&
        (plot.gear as PlacedGearWithProgress).crossbreedStartedAt != null
      );
      if (!hasActiveGear && !hasBloomedForMutation && !(hasCropsticks && hasInfusedBloomed) && !hasCropsticksCycleActive) continue;

      const original: Save = {
        user_id:           raw.user_id,
        updated_at:        raw.updated_at,
        grid,
        inventory:         (raw.inventory          ?? []) as InvItem[],
        discovered:        (raw.discovered         ?? []) as string[],
        discoveredRecipes: (raw.discovered_recipes ?? []) as string[],
      };

      // 1. Stamp bloomedAt so harvest bell + mutations can find ready plants
      const { grid: stamped, changed: stampChanged } = stampBloomed(original.grid, now, weatherMult);
      let sim = stampChanged ? { ...original, grid: stamped } : original;

      // 1b. Feed composters from plants that just bloomed this tick
      if (stampChanged) {
        const compGrid = runComposters(original.grid, stamped, now);
        if (compGrid !== stamped) sim = { ...sim, grid: compGrid };
      }

      // 2a. Build mutation-shield coverage once per garden (Scarecrow + Aegis)
      const shieldCoverage = buildShieldCoverage(sim.grid, now);

      // 2b. Roll weather mutations on bloomed plants (skipping shielded cells)
      const { grid: mutGrid, changed: mutChanged } = rollWeatherMutations(sim.grid, weatherType, now, shieldCoverage);
      if (mutChanged) sim = { ...sim, grid: mutGrid };

      // 2c. Scarecrow strip — chance to remove existing mutations from covered plants
      const { grid: stripGrid, changed: stripChanged } = rollScarecrowStrip(sim.grid, shieldCoverage, now);
      if (stripChanged) sim = { ...sim, grid: stripGrid };

      // 2d. Fan — strip Wet mutation or apply Windstruck to unmutated blooms
      const { grid: fanGrid, changed: fanChanged } = rollFan(sim.grid, now);
      if (fanChanged) sim = { ...sim, grid: fanGrid };

      // 2e. Sprinklers — Wet (regular) and gear mutations (mutation sprinklers)
      const { grid: sprinklerGrid, changed: sprinklerChanged } = rollSprinklers(sim.grid, shieldCoverage, now);
      if (sprinklerChanged) sim = { ...sim, grid: sprinklerGrid };

      // 3. Harvest bell
      sim = runHarvestBells(sim, now);

      // 4. Auto-planter
      sim = runAutoPlanter(sim, now);

      // 5. Cropsticks cross-breeding
      sim = runCropsticks(sim, now);

      // Skip if nothing actually changed
      if (sim.grid === original.grid &&
          sim.inventory === original.inventory &&
          sim.discovered === original.discovered &&
          sim.discoveredRecipes === original.discoveredRecipes) continue;

      // Write back — optimistic lock on updated_at to avoid stomping concurrent client saves
      const { error: writeErr } = await supabase
        .from("game_saves")
        .update({
          grid:              sim.grid,
          inventory:         sim.inventory,
          discovered:        sim.discovered,
          discovered_recipes: sim.discoveredRecipes,
          updated_at:        new Date(now).toISOString(),
        })
        .eq("user_id", sim.user_id)
        .eq("updated_at", original.updated_at); // only update if row hasn't changed

      if (!writeErr) {
        changed++;

        // Write plant_timings for any seeds the auto-planter just planted.
        // Without this, harvest finds no timing entry → silently clears the plot
        // and gives the player nothing (the "gets nothing from harvest" bug).
        const newlyPlanted: Array<{ row: number; col: number; planted_at: string }> = [];
        for (let ri = 0; ri < sim.grid.length; ri++) {
          for (let ci = 0; ci < (sim.grid[ri]?.length ?? 0); ci++) {
            if (!original.grid[ri]?.[ci]?.plant && sim.grid[ri]?.[ci]?.plant) {
              const tp = sim.grid[ri][ci].plant!.timePlanted;
              newlyPlanted.push({ row: ri, col: ci, planted_at: new Date(tp).toISOString() });
            }
          }
        }
        if (newlyPlanted.length > 0) {
          void supabase.from("plant_timings").upsert(
            newlyPlanted.map((p) => ({ user_id: sim.user_id, row: p.row, col: p.col, planted_at: p.planted_at })),
            { onConflict: "user_id,row,col" }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, scanned, changed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("tick-offline-gardens error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
