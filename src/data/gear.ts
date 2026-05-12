import type { Rarity, FlowerType, MutationType } from "./flowers";
import type { FertilizerType } from "./upgrades";

// ── Gear type identifiers ──────────────────────────────────────────────────

export type SprinklerGearType =
  | "sprinkler_rare"
  | "sprinkler_legendary"
  | "sprinkler_mythic"
  | "sprinkler_exalted"
  | "sprinkler_prismatic"
  | "sprinkler_flame"
  | "sprinkler_frost"
  | "sprinkler_lightning"
  | "sprinkler_lunar"
  | "sprinkler_midas"
  | "sprinkler_prism";

export type PassiveGearType =
  | "grow_lamp_uncommon"
  | "grow_lamp_rare"
  | "scarecrow_rare"
  | "scarecrow_legendary"
  | "scarecrow_mythic"
  | "composter_uncommon"
  | "composter_rare"
  | "composter_legendary"
  | "fan_uncommon"
  | "fan_rare"
  | "fan_legendary"
  | "harvest_bell_uncommon"
  | "harvest_bell_rare"
  | "harvest_bell_legendary"
  | "aegis_uncommon"
  | "aegis_rare"
  | "aegis_legendary"
  | "lawnmower_uncommon"
  | "lawnmower_rare"
  | "lawnmower_legendary"
  | "aqueduct_uncommon"
  | "aqueduct_rare"
  | "aqueduct_legendary"
  | "balance_scale_legendary"
  | "balance_scale_mythic"
  | "balance_scale_exalted"
  | "auto_planter_prismatic"
  | "cropsticks";

export type GearType = SprinklerGearType | PassiveGearType;

export type GearCategory  = "sprinkler_regular" | "sprinkler_mutation" | "passive";
export type PassiveSubtype = "grow_lamp" | "scarecrow" | "composter" | "fan" | "harvest_bell" | "auto_planter" | "cropsticks" | "aegis" | "lawnmower" | "balance_scale" | "aqueduct";

/** Which way a Fan or Aegis is pointing — set at placement time */
export type FanDirection = "up" | "down" | "left" | "right";

// ── Placed gear (what lives in a grid cell) ────────────────────────────────

export interface PlacedGear {
  gearType: GearType;
  placedAt: number; // wall-clock timestamp
  /** Fertilizers waiting to be collected — composter only, max 10 */
  storedFertilizers?: FertilizerType[];
  /** Which direction the fan / aegis is blowing — fan and aegis gear only */
  direction?: FanDirection;
  /** Cropsticks only — wall-clock ms when the current cross-breed cycle began.
   *  Set when the cropsticks first sees a valid recipe pair of infused
   *  neighbors; cleared on completion or when the pair becomes invalid.
   *  Drives a deterministic progress bar instead of the old hourly RNG roll. */
  crossbreedStartedAt?: number;
  /** Cropsticks only — grid coordinates of the two source plants that started
   *  the current cycle. Stored when the cycle begins so the infused flag can
   *  be cleared immediately from source plants (they no longer visually show
   *  "waiting") while the tick can still find them by position at completion. */
  crossbreedSourceA?: { r: number; c: number };
  crossbreedSourceB?: { r: number; c: number };
}

/** How long a cropsticks cross-breed takes. Mirrored in the
 *  tick-offline-gardens cron. */
export const CROPSTICKS_BREED_DURATION_MS = 60 * 60 * 1_000; // 1 hour

// ── Cropsticks cross-breed recipes ─────────────────────────────────────────
// Mirrors the RECIPES array in apply-infuser and tick-offline-gardens edge functions.
// Used client-side to immediately show the progress bar after infusing a plant.

export type CrossbreedRecipe = {
  id:        string;
  tier:      number;
  typeA:     FlowerType;
  typeB:     FlowerType;
  minRarity: Rarity;
};

const RARITY_TIER_IDX: Record<Rarity, number> = {
  common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4, exalted: 5, prismatic: 6,
};

export const CROPSTICKS_RECIPES: CrossbreedRecipe[] = [
  // Tier 1 (rare minimum)
  { id: "blaze+frost",    tier: 1, typeA: "blaze",   typeB: "frost",   minRarity: "rare"      },
  { id: "lunar+solar",    tier: 1, typeA: "lunar",   typeB: "solar",   minRarity: "rare"      },
  { id: "tide+storm",     tier: 1, typeA: "tide",    typeB: "storm",   minRarity: "rare"      },
  { id: "grove+shadow",   tier: 1, typeA: "grove",   typeB: "shadow",  minRarity: "rare"      },
  { id: "arcane+stellar", tier: 1, typeA: "arcane",  typeB: "stellar", minRarity: "rare"      },
  { id: "fairy+zephyr",   tier: 1, typeA: "fairy",   typeB: "zephyr",  minRarity: "rare"      },
  // Tier 2 (legendary minimum)
  { id: "blaze+solar",    tier: 2, typeA: "blaze",   typeB: "solar",   minRarity: "legendary" },
  { id: "lunar+tide",     tier: 2, typeA: "lunar",   typeB: "tide",    minRarity: "legendary" },
  { id: "grove+zephyr",   tier: 2, typeA: "grove",   typeB: "zephyr",  minRarity: "legendary" },
  { id: "frost+arcane",   tier: 2, typeA: "frost",   typeB: "arcane",  minRarity: "legendary" },
  // Tier 3 (mythic minimum)
  { id: "arcane+shadow",  tier: 3, typeA: "arcane",  typeB: "shadow",  minRarity: "mythic"    },
  { id: "stellar+zephyr", tier: 3, typeA: "stellar", typeB: "zephyr",  minRarity: "mythic"    },
  // Tier 4 (exalted minimum)
  { id: "arcane+stellar", tier: 4, typeA: "arcane",  typeB: "stellar", minRarity: "exalted"   },
];

/** Returns the highest-tier matching recipe for two flower type/rarity combos,
 *  or null if no valid recipe exists. Mirrors findBestRecipe in the edge functions. */
export function findCrossbreedRecipe(
  typesA: FlowerType[], rarityA: Rarity,
  typesB: FlowerType[], rarityB: Rarity,
): CrossbreedRecipe | null {
  let best: CrossbreedRecipe | null = null;
  for (const r of CROPSTICKS_RECIPES) {
    if ((RARITY_TIER_IDX[rarityA] ?? -1) < RARITY_TIER_IDX[r.minRarity]) continue;
    if ((RARITY_TIER_IDX[rarityB] ?? -1) < RARITY_TIER_IDX[r.minRarity]) continue;
    const fwd = typesA.includes(r.typeA) && typesB.includes(r.typeB);
    const rev = typesA.includes(r.typeB) && typesB.includes(r.typeA);
    if (!fwd && !rev) continue;
    if (!best || r.tier > best.tier) best = r;
  }
  return best;
}

// ── Player's gear supply inventory ────────────────────────────────────────

export interface GearInventoryItem {
  gearType: GearType;
  quantity: number;
}

// ── Catalog entry ──────────────────────────────────────────────────────────

export interface GearDefinition {
  id:          GearType;
  name:        string;
  description: string;
  emoji:       string;
  sprite?:     string;
  rarity:      Rarity;
  shopPrice:   number;
  category:    GearCategory;

  // ── Sprinkler fields ─────────────────────────────────────────────────────
  /** Duration in milliseconds; undefined = never expires (passive gear) */
  durationMs?:     number;
  /** [rowOffset, colOffset] pairs from the sprinkler's cell */
  radiusOffsets?:  [number, number][];
  /** Regular sprinkler: growth speed multiplier applied to affected plants */
  growthMultiplier?: number;
  /** Regular sprinkler: per-tick chance of applying "wet" mutation (accumulates to 35% over full duration) */
  wetChancePerTick?: number;
  /** Mutation sprinkler: which mutation it can apply */
  mutationType?:     MutationType;
  /** Mutation sprinkler: per-tick chance (accumulates to 50% over 2-hr duration) */
  mutationChancePerTick?: number;

  // ── Passive fields ────────────────────────────────────────────────────────
  passiveSubtype?: PassiveSubtype;
  /** Grow lamp: growth multiplier applied during night periods (dusk/night/midnight) */
  nightMultiplier?: number;
  /** Composter: max fertilizers that can be stored before collection is needed */
  maxStorage?: number;
  /** Fan / Aegis: how many cells it reaches in the chosen direction */
  fanRange?: number;
  /** Fan: per-tick probability to strip mutation (or apply windstruck if none) */
  fanStripChancePerTick?: number;
  fanWindstruckChancePerTick?: number;
  /** Scarecrow: per-tick probability to strip an existing mutation from a covered plant */
  mutationStripChancePerTick?: number;
  /** Balance scale: growth multiplier applied to the boosted side */
  scaleBoostMult?: number;
  /** Balance scale: growth multiplier applied to the slowed side */
  scaleSlowMult?: number;
}

// ── Radius pattern helpers ─────────────────────────────────────────────────

/** 3×3 square — all 8 neighbours (used by Legendary sprinkler, mutation sprinklers, passive gear) */
const OFFSETS_3X3: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];

/** Cross — up / down / left / right only (Rare sprinkler) */
const OFFSETS_CROSS: [number, number][] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

/**
 * Diamond — 5×5 shape (Mythic sprinkler)
 * [0,0,1,0,0]
 * [0,1,1,1,0]
 * [1,1,S,1,1]
 * [0,1,1,1,0]
 * [0,0,1,0,0]
 */
const OFFSETS_DIAMOND: [number, number][] = [
  [-2, 0],
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -2], [ 0, -1], [ 0, 1], [ 0, 2],
  [ 1, -1], [ 1, 0], [ 1, 1],
  [ 2, 0],
];

/** Full 5×5 square — all 24 surrounding cells (Exalted sprinkler) */
const OFFSETS_5X5: [number, number][] = [
  [-2,-2],[-2,-1],[-2, 0],[-2, 1],[-2, 2],
  [-1,-2],[-1,-1],[-1, 0],[-1, 1],[-1, 2],
  [ 0,-2],[ 0,-1],         [ 0, 1],[ 0, 2],
  [ 1,-2],[ 1,-1],[ 1, 0],[ 1, 1],[ 1, 2],
  [ 2,-2],[ 2,-1],[ 2, 0],[ 2, 1],[ 2, 2],
];

/** 5×5 square + four star-tip cells — 28 cells total (Prismatic sprinkler) */
const OFFSETS_GRAND_STAR: [number, number][] = [
  ...OFFSETS_5X5,
  [-3, 0], [0, -3], [0, 3], [3, 0],
];


// ── Per-tick chance helpers ────────────────────────────────────────────────

/** p = 1 − (1 − targetTotal)^(1/ticks). Gives the per-tick rate that
 *  accumulates to `targetTotal` probability over the full duration. */
function perTickChance(targetTotal: number, durationMs: number): number {
  const ticks = durationMs / 1_000; // 1-second ticks
  return 1 - Math.pow(1 - targetTotal, 1 / ticks);
}

const WET_CHANCE_PER_HOUR = 0.35; // 35% chance per hour (compounds across duration)
/** Cumulative wet chance over `hours` hours at 35%/hr */
function wetOverHours(hours: number): number {
  return 1 - Math.pow(1 - WET_CHANCE_PER_HOUR, hours);
}
const MUT_CHANCE_TARGET  = 0.50; // 50% over full duration

const DURATION_1H  =  1 * 60 * 60 * 1_000;
const DURATION_2H  =  2 * 60 * 60 * 1_000;
const DURATION_4H  =  4 * 60 * 60 * 1_000;
const DURATION_8H  =  8 * 60 * 60 * 1_000;
const DURATION_12H = 12 * 60 * 60 * 1_000;

// ── Gear catalog ───────────────────────────────────────────────────────────

export const GEAR: Record<GearType, GearDefinition> = {

  // ── Regular sprinklers ───────────────────────────────────────────────────

  sprinkler_rare: {
    id:               "sprinkler_rare",
    name:             "Sprinkler I",
    description:      "Speeds up adjacent plants by 1.5×. May get them wet. Lasts 1 hour.",
    emoji:            "🚿",
    sprite:           "/sprites/gear/sprinkler.png",
    rarity:           "rare",
    shopPrice:        800,
    category:         "sprinkler_regular",
    durationMs:       DURATION_1H,
    radiusOffsets:    OFFSETS_CROSS,
    growthMultiplier: 1.5,
    wetChancePerTick: perTickChance(wetOverHours(1), DURATION_1H),
  },

  sprinkler_legendary: {
    id:               "sprinkler_legendary",
    name:             "Sprinkler II",
    description:      "Speeds up surrounding plants by 1.75×. May get them wet. Lasts 2 hours.",
    emoji:            "🚿",
    sprite:           "/sprites/gear/sprinkler.png",
    rarity:           "legendary",
    shopPrice:        8_000,
    category:         "sprinkler_regular",
    durationMs:       DURATION_2H,
    radiusOffsets:    OFFSETS_3X3,
    growthMultiplier: 1.75,
    wetChancePerTick: perTickChance(wetOverHours(2), DURATION_2H),
  },

  sprinkler_mythic: {
    id:               "sprinkler_mythic",
    name:             "Sprinkler III",
    description:      "Speeds up all nearby plants by 2×. May get them wet. Lasts 4 hours.",
    emoji:            "🚿",
    sprite:           "/sprites/gear/sprinkler.png",
    rarity:           "mythic",
    shopPrice:        75_000,
    category:         "sprinkler_regular",
    durationMs:       DURATION_4H,
    radiusOffsets:    OFFSETS_DIAMOND,
    growthMultiplier: 2.0,
    wetChancePerTick: perTickChance(wetOverHours(4), DURATION_4H),
  },

  sprinkler_exalted: {
    id:               "sprinkler_exalted",
    name:             "Sprinkler IV",
    description:      "Speeds up plants in a wide area by 2.5×. May get them wet. Lasts 8 hours.",
    emoji:            "🚿",
    sprite:           "/sprites/gear/sprinkler.png",
    rarity:           "exalted",
    shopPrice:        300_000,
    category:         "sprinkler_regular",
    durationMs:       DURATION_8H,
    radiusOffsets:    OFFSETS_5X5,
    growthMultiplier: 2.5,
    wetChancePerTick: perTickChance(wetOverHours(8), DURATION_8H),
  },

  sprinkler_prismatic: {
    id:               "sprinkler_prismatic",
    name:             "Sprinkler V",
    description:      "Speeds up plants in a massive star-shaped area by 3×. May get them wet. Lasts 12 hours.",
    emoji:            "🚿",
    sprite:           "/sprites/gear/sprinkler.png",
    rarity:           "prismatic",
    shopPrice:        1_500_000,
    category:         "sprinkler_regular",
    durationMs:       DURATION_12H,
    radiusOffsets:    OFFSETS_GRAND_STAR,
    growthMultiplier: 3.0,
    wetChancePerTick: perTickChance(wetOverHours(12), DURATION_12H),
  },

  // ── Mutation sprinklers ──────────────────────────────────────────────────

  sprinkler_flame: {
    id:                    "sprinkler_flame",
    name:                  "Heater",
    description:           "50% chance per hour to apply Scorched to nearby blooms. Lasts 2 hours.",
    emoji:                 "♨️",
    sprite:           "/sprites/gear/sprinkler_flame.png",
    rarity:                "legendary",
    shopPrice:             12_000,
    category:              "sprinkler_mutation",
    durationMs:            DURATION_2H,
    radiusOffsets:         OFFSETS_3X3,
    mutationType:          "scorched",
    mutationChancePerTick: perTickChance(MUT_CHANCE_TARGET, DURATION_1H),
  },

  sprinkler_frost: {
    id:                    "sprinkler_frost",
    name:                  "Cooler",
    description:           "50% chance per hour to apply Frozen to nearby blooms. Lasts 2 hours.",
    emoji:                 "🧊",
    sprite:           "/sprites/gear/sprinkler_frost.png",
    rarity:                "legendary",
    shopPrice:             12_000,
    category:              "sprinkler_mutation",
    durationMs:            DURATION_2H,
    radiusOffsets:         OFFSETS_3X3,
    mutationType:          "frozen",
    mutationChancePerTick: perTickChance(MUT_CHANCE_TARGET, DURATION_1H),
  },

  sprinkler_lightning: {
    id:                    "sprinkler_lightning",
    name:                  "Generator",
    description:           "50% chance per hour to apply Shocked to nearby wet blooms. Pair with a Sprinkler to wet them first. Lasts 2 hours.",
    emoji:                 "🔋",
    sprite:           "/sprites/gear/sprinkler_lightning.png",
    rarity:                "mythic",
    shopPrice:             100_000,
    category:              "sprinkler_mutation",
    durationMs:            DURATION_2H,
    radiusOffsets:         OFFSETS_3X3,
    mutationType:          "shocked",
    mutationChancePerTick: perTickChance(MUT_CHANCE_TARGET, DURATION_1H),
  },

  sprinkler_lunar: {
    id:                    "sprinkler_lunar",
    name:                  "Crystal Ball",
    description:           "50% chance per hour to apply Moonlit to nearby blooms. Lasts 2 hours.",
    emoji:                 "🔮",
    sprite:           "/sprites/gear/sprinkler_lunar.png",
    rarity:                "mythic",
    shopPrice:             100_000,
    category:              "sprinkler_mutation",
    durationMs:            DURATION_2H,
    radiusOffsets:         OFFSETS_3X3,
    mutationType:          "moonlit",
    mutationChancePerTick: perTickChance(MUT_CHANCE_TARGET, DURATION_1H),
  },

  sprinkler_midas: {
    id:                    "sprinkler_midas",
    name:                  "Golden Veil",
    description:           "50% chance per hour to apply Gilded to nearby blooms. Lasts 2 hours.",
    emoji:                 "💰",
    sprite:           "/sprites/gear/sprinkler_midas.png",
    rarity:                "exalted",
    shopPrice:             400_000,
    category:              "sprinkler_mutation",
    durationMs:            DURATION_2H,
    radiusOffsets:         OFFSETS_3X3,
    mutationType:          "golden",
    mutationChancePerTick: perTickChance(MUT_CHANCE_TARGET, DURATION_1H),
  },

  sprinkler_prism: {
    id:                    "sprinkler_prism",
    name:                  "Kaleidoscope",
    description:           "50% chance per hour to apply Rainbow to nearby blooms. Lasts 2 hours.",
    emoji:                 "🔭",
    sprite:           "/sprites/gear/sprinkler_prism.png",
    rarity:                "prismatic",
    shopPrice:             1_600_000,
    category:              "sprinkler_mutation",
    durationMs:            DURATION_2H,
    radiusOffsets:         OFFSETS_3X3,
    mutationType:          "rainbow",
    mutationChancePerTick: perTickChance(MUT_CHANCE_TARGET, DURATION_1H),
  },

  // ── Passive gear ─────────────────────────────────────────────────────────

  grow_lamp_uncommon: {
    id:              "grow_lamp_uncommon",
    name:            "Grow Lamp I",
    description:     "Adds a 1.2× night boost that stacks with sprinklers. Lasts 4 hours.",
    emoji:           "💡",
    sprite:           "/sprites/gear/grow_lamp.png",
    rarity:          "uncommon",
    shopPrice:       600,
    category:        "passive",
    passiveSubtype:  "grow_lamp",
    radiusOffsets:   OFFSETS_3X3,
    durationMs:      4 * 60 * 60 * 1_000,
    nightMultiplier: 1.2,
  },

  grow_lamp_rare: {
    id:              "grow_lamp_rare",
    name:            "Grow Lamp II",
    description:     "Adds a 1.5× night boost that stacks with sprinklers. Lasts 8 hours.",
    emoji:           "💡",
    sprite:           "/sprites/gear/grow_lamp.png",
    rarity:          "rare",
    shopPrice:       1200,
    category:        "passive",
    passiveSubtype:  "grow_lamp",
    radiusOffsets:   OFFSETS_3X3,
    durationMs:      8 * 60 * 60 * 1_000,
    nightMultiplier: 1.5,
  },

  scarecrow_rare: {
    id:             "scarecrow_rare",
    name:           "Scarecrow I",
    description:    "Blocks all mutations on nearby plants. Has a 15% chance per hour to strip an existing mutation. Lasts 4 hours.",
    emoji:          "🧹",
    sprite:           "/sprites/gear/scarecrow.png",
    rarity:         "rare",
    shopPrice:      1400,
    category:       "passive",
    passiveSubtype: "scarecrow",
    radiusOffsets:  OFFSETS_3X3,
    durationMs:     4 * 60 * 60 * 1_000,
    mutationStripChancePerTick: perTickChance(0.15, DURATION_1H),
  },

  scarecrow_legendary: {
    id:             "scarecrow_legendary",
    name:           "Scarecrow II",
    description:    "Blocks all mutations on nearby plants. Has a 25% chance per hour to strip an existing mutation. Lasts 8 hours.",
    emoji:          "🧹",
    sprite:           "/sprites/gear/scarecrow.png",
    rarity:         "legendary",
    shopPrice:      15_000,
    category:       "passive",
    passiveSubtype: "scarecrow",
    radiusOffsets:  OFFSETS_3X3,
    durationMs:     8 * 60 * 60 * 1_000,
    mutationStripChancePerTick: perTickChance(0.25, DURATION_1H),
  },

  scarecrow_mythic: {
    id:             "scarecrow_mythic",
    name:           "Scarecrow III",
    description:    "Blocks all mutations on nearby plants in a wide area. Has a 40% chance per hour to strip an existing mutation. Lasts 12 hours.",
    emoji:          "🧹",
    sprite:           "/sprites/gear/scarecrow.png",
    rarity:         "mythic",
    shopPrice:      100_000,
    category:       "passive",
    passiveSubtype: "scarecrow",
    radiusOffsets:  OFFSETS_DIAMOND,
    durationMs:     DURATION_12H,
    mutationStripChancePerTick: perTickChance(0.40, DURATION_1H),
  },

  composter_uncommon: {
    id:             "composter_uncommon",
    name:           "Composter I",
    description:    "Generates a fertilizer each time a nearby plant blooms. Stores up to 10. Lasts 4 hours.",
    emoji:          "🧺",
    sprite:           "/sprites/gear/composter.png",
    rarity:         "uncommon",
    shopPrice:      600,
    category:       "passive",
    passiveSubtype: "composter",
    radiusOffsets:  OFFSETS_3X3,
    durationMs:     4 * 60 * 60 * 1_000,
    maxStorage:     10,
  },

  composter_rare: {
    id:             "composter_rare",
    name:           "Composter II",
    description:    "Generates a fertilizer each time a nearby plant blooms. Stores up to 20. Lasts 8 hours.",
    emoji:          "🧺",
    sprite:           "/sprites/gear/composter.png",
    rarity:         "rare",
    shopPrice:      1600,
    category:       "passive",
    passiveSubtype: "composter",
    radiusOffsets:  OFFSETS_3X3,
    durationMs:     DURATION_8H,
    maxStorage:     20,
  },

  composter_legendary: {
    id:             "composter_legendary",
    name:           "Composter III",
    description:    "Generates a fertilizer each time a nearby plant blooms. Stores up to 30. Lasts 12 hours.",
    emoji:          "🧺",
    sprite:           "/sprites/gear/composter.png",
    rarity:         "legendary",
    shopPrice:      10_000,
    category:       "passive",
    passiveSubtype: "composter",
    radiusOffsets:  OFFSETS_3X3,
    durationMs:     DURATION_12H,
    maxStorage:     30,
  },

  // ── Fan ──────────────────────────────────────────────────────────────────
  // Blows in a player-chosen direction. Each tick: strips mutation from
  // a bloomed plant in range, OR applies Windstruck if the plant has none.

  fan_uncommon: {
    id:                    "fan_uncommon",
    name:                  "Fan I",
    description:           "Blows in one direction across 2 plants. Low chance to strip Wet from blooms each hour. Very low chance to apply Windstruck to unmutated blooms. Lasts 2 hours.",
    emoji:                 "💨",
    sprite:           "/sprites/gear/fan.png",
    rarity:                "uncommon",
    shopPrice:             600,
    category:              "passive",
    passiveSubtype:        "fan",
    durationMs:            DURATION_2H,
    fanRange:              2,
    fanStripChancePerTick:       perTickChance(0.50, DURATION_2H),
    fanWindstruckChancePerTick:  perTickChance(0.15, DURATION_2H),
  },

  fan_rare: {
    id:                    "fan_rare",
    name:                  "Fan II",
    description:           "Blows in one direction across 3 plants. Moderate chance to strip Wet from blooms each hour. Very low chance to apply Windstruck to unmutated blooms. Lasts 4 hours.",
    emoji:                 "💨",
    sprite:           "/sprites/gear/fan.png",
    rarity:                "rare",
    shopPrice:             2400,
    category:              "passive",
    passiveSubtype:        "fan",
    durationMs:            DURATION_4H,
    fanRange:              3,
    fanStripChancePerTick:       perTickChance(0.70, DURATION_4H),
    fanWindstruckChancePerTick:  perTickChance(0.15, DURATION_4H),
  },

  fan_legendary: {
    id:                    "fan_legendary",
    name:                  "Fan III",
    description:           "Blows in one direction across 4 plants. High chance to strip Wet from blooms each hour. Very low chance to apply Windstruck to unmutated blooms. Lasts 8 hours.",
    emoji:                 "💨",
    sprite:           "/sprites/gear/fan.png",
    rarity:                "legendary",
    shopPrice:             16_000,
    category:              "passive",
    passiveSubtype:        "fan",
    durationMs:            DURATION_8H,
    fanRange:              4,
    fanStripChancePerTick:       perTickChance(0.80, DURATION_8H),
    fanWindstruckChancePerTick:  perTickChance(0.15, DURATION_8H),
  },

  // ── Harvest Bell ─────────────────────────────────────────────────────────
  // Automatically harvests bloomed plants in range, even while offline.

  harvest_bell_uncommon: {
    id:             "harvest_bell_uncommon",
    name:           "Harvest Bell I",
    description:    "Automatically harvests bloomed plants on adjacent cells, even while offline. Lasts 2 hours.",
    emoji:          "🔔",
    sprite:           "/sprites/gear/harvest_bell.png",
    rarity:         "uncommon",
    shopPrice:      800,
    category:       "passive",
    passiveSubtype: "harvest_bell",
    radiusOffsets:  OFFSETS_CROSS,
    durationMs:     DURATION_2H,
  },

  harvest_bell_rare: {
    id:             "harvest_bell_rare",
    name:           "Harvest Bell II",
    description:    "Automatically harvests bloomed plants on adjacent cells, even while offline. Lasts 4 hours.",
    emoji:          "🔔",
    sprite:           "/sprites/gear/harvest_bell.png",
    rarity:         "rare",
    shopPrice:      5000,
    category:       "passive",
    passiveSubtype: "harvest_bell",
    radiusOffsets:  OFFSETS_CROSS,
    durationMs:     DURATION_4H,
  },

  harvest_bell_legendary: {
    id:             "harvest_bell_legendary",
    name:           "Harvest Bell III",
    description:    "Automatically harvests bloomed plants in surrounding cells, even while offline. Lasts 8 hours.",
    emoji:          "🔔",
    sprite:           "/sprites/gear/harvest_bell.png",
    rarity:         "legendary",
    shopPrice:      36_000,
    category:       "passive",
    passiveSubtype: "harvest_bell",
    radiusOffsets:  OFFSETS_3X3,
    durationMs:     DURATION_8H,
  },

  // ── Aegis ─────────────────────────────────────────────────────────────────
  // Points in a player-chosen direction. Blocks weather mutations on all
  // plants in the line ahead. Does NOT strip existing mutations.

  aegis_uncommon: {
    id:             "aegis_uncommon",
    name:           "Aegis I",
    description:    "Blocks weather mutations on 2 plants in a chosen direction. Lasts 2 hours.",
    emoji:          "🛡️",
    sprite:           "/sprites/gear/aegis.png",
    rarity:         "uncommon",
    shopPrice:      1_500,
    category:       "passive",
    passiveSubtype: "aegis",
    durationMs:     DURATION_2H,
    fanRange:       2,
  },

  aegis_rare: {
    id:             "aegis_rare",
    name:           "Aegis II",
    description:    "Blocks weather mutations on 3 plants in a chosen direction. Lasts 4 hours.",
    emoji:          "🛡️",
    sprite:           "/sprites/gear/aegis.png",
    rarity:         "rare",
    shopPrice:      3000,
    category:       "passive",
    passiveSubtype: "aegis",
    durationMs:     DURATION_4H,
    fanRange:       3,
  },

  aegis_legendary: {
    id:             "aegis_legendary",
    name:           "Aegis III",
    description:    "Blocks weather mutations on 4 plants in a chosen direction. Lasts 8 hours.",
    emoji:          "🛡️",
    sprite:           "/sprites/gear/aegis.png",
    rarity:         "legendary",
    shopPrice:      20_000,
    category:       "passive",
    passiveSubtype: "aegis",
    durationMs:     DURATION_8H,
    fanRange:       4,
  },

  // ── Lawnmower ────────────────────────────────────────────────────────────
  // Points in a player-chosen direction. Automatically harvests bloomed plants
  // in the line ahead — works even while offline.

  lawnmower_uncommon: {
    id:             "lawnmower_uncommon",
    name:           "Lawnmower I",
    description:    "Harvests bloomed plants in a line of 2 in a chosen direction, even while offline. Lasts 2 hours.",
    emoji:          "🦼",
    sprite:           "/sprites/gear/lawnmower.png",
    rarity:         "uncommon",
    shopPrice:      800,
    category:       "passive",
    passiveSubtype: "lawnmower",
    durationMs:     DURATION_2H,
    fanRange:       2,
  },

  lawnmower_rare: {
    id:             "lawnmower_rare",
    name:           "Lawnmower II",
    description:    "Harvests bloomed plants in a line of 3 in a chosen direction, even while offline. Lasts 4 hours.",
    emoji:          "🦼",
    sprite:           "/sprites/gear/lawnmower.png",
    rarity:         "rare",
    shopPrice:      5_000,
    category:       "passive",
    passiveSubtype: "lawnmower",
    durationMs:     DURATION_4H,
    fanRange:       3,
  },

  lawnmower_legendary: {
    id:             "lawnmower_legendary",
    name:           "Lawnmower III",
    description:    "Harvests bloomed plants in a line of 4 in a chosen direction, even while offline. Lasts 8 hours.",
    emoji:          "🦼",
    sprite:           "/sprites/gear/lawnmower.png",
    rarity:         "legendary",
    shopPrice:      36_000,
    category:       "passive",
    passiveSubtype: "lawnmower",
    durationMs:     DURATION_8H,
    fanRange:       4,
  },

  // ── Aqueduct ──────────────────────────────────────────────────────────────
  // Directional growth sprinkler that shoots in a line both in front of and
  // behind itself along the chosen axis. Direction picker sets the axis.

  aqueduct_uncommon: {
    id:             "aqueduct_uncommon",
    name:           "Aqueduct I",
    description:    "Boosts growth 1.5× in a line — 1 cell in front and 1 behind along the chosen axis. Lasts 2 hours.",
    emoji:          "⛲",
    sprite:           "/sprites/gear/aqueduct.png",
    rarity:         "uncommon",
    shopPrice:      300,
    category:       "passive",
    passiveSubtype: "aqueduct",
    durationMs:     DURATION_2H,
    fanRange:       1,
    growthMultiplier: 1.5,
  },

  aqueduct_rare: {
    id:             "aqueduct_rare",
    name:           "Aqueduct II",
    description:    "Boosts growth 1.75× in a line — 2 cells in front and 2 behind along the chosen axis. Lasts 4 hours.",
    emoji:          "⛲",
    sprite:           "/sprites/gear/aqueduct.png",
    rarity:         "rare",
    shopPrice:      2_000,
    category:       "passive",
    passiveSubtype: "aqueduct",
    durationMs:     DURATION_4H,
    fanRange:       2,
    growthMultiplier: 1.75,
  },

  aqueduct_legendary: {
    id:             "aqueduct_legendary",
    name:           "Aqueduct III",
    description:    "Boosts growth 2× in a line — 3 cells in front and 3 behind along the chosen axis. Lasts 8 hours.",
    emoji:          "⛲",
    sprite:           "/sprites/gear/aqueduct.png",
    rarity:         "legendary",
    shopPrice:      9_000,
    category:       "passive",
    passiveSubtype: "aqueduct",
    durationMs:     DURATION_8H,
    fanRange:       3,
    growthMultiplier: 2.0,
  },

  // ── Balance Scale ─────────────────────────────────────────────────────────
  // Points in a player-chosen direction. The chosen arm gives a 3× growth boost;
  // the opposite arm gives a 0.5× penalty. The active side FLIPS every hour.
  // Client-side only — not applied during offline tick.

  balance_scale_legendary: {
    id:             "balance_scale_legendary",
    name:           "Balance Scale I",
    description:    "Alternates every hour: the left cell grows 4× faster while the right cell grows 0.5× slower — then swaps. Lasts 8 hours.",
    emoji:          "⚖️",
    sprite:           "/sprites/gear/balance_scale.png",
    rarity:         "legendary",
    shopPrice:      15_000,
    category:       "passive",
    passiveSubtype: "balance_scale",
    durationMs:     DURATION_8H,
    fanRange:       1,
    scaleBoostMult: 4.0,
    scaleSlowMult:  0.5,
  },

  balance_scale_mythic: {
    id:             "balance_scale_mythic",
    name:           "Balance Scale II",
    description:    "Alternates every hour: the left cell grows 6× faster while the right cell grows 0.33× slower — then swaps. Lasts 10 hours.",
    emoji:          "⚖️",
    sprite:           "/sprites/gear/balance_scale.png",
    rarity:         "mythic",
    shopPrice:      100_000,
    category:       "passive",
    passiveSubtype: "balance_scale",
    durationMs:     10 * 60 * 60 * 1_000,
    fanRange:       1,
    scaleBoostMult: 6.0,
    scaleSlowMult:  0.33,
  },

  balance_scale_exalted: {
    id:             "balance_scale_exalted",
    name:           "Balance Scale III",
    description:    "Alternates every hour: the left cell grows 8× faster while the right cell grows 0.25× slower — then swaps. Lasts 12 hours.",
    emoji:          "⚖️",
    sprite:           "/sprites/gear/balance_scale.png",
    rarity:         "exalted",
    shopPrice:      600_000,
    category:       "passive",
    passiveSubtype: "balance_scale",
    durationMs:     DURATION_12H,
    fanRange:       1,
    scaleBoostMult: 8.0,
    scaleSlowMult:  0.25,
  },

  // ── Auto-Planter ─────────────────────────────────────────────────────────
  // Automatically plants seeds from the player's inventory into empty cells
  // within a 5×5 area — works even while offline.

  auto_planter_prismatic: {
    id:             "auto_planter_prismatic",
    name:           "Auto-Planter",
    description:    "Automatically plants seeds from your inventory into empty cells in a diamond area, even while offline. Lasts 12 hours.",
    emoji:          "🌾",
    sprite:           "/sprites/gear/auto_planter.png",
    rarity:         "prismatic",
    shopPrice:      1_000_000,
    category:       "passive",
    passiveSubtype: "auto_planter",
    radiusOffsets:  OFFSETS_DIAMOND,
    durationMs:     DURATION_12H,
  },

  // ── Cropsticks ───────────────────────────────────────────────────────────
  // Placed in an empty cell. Each server tick, scans the 4 adjacent cells for
  // bloomed flowers marked as attuned. If 2+ attuned neighbors match a
  // cross-breed recipe, there's a chance (~0.58%/tick → ~50% over an hour)
  // to produce a hybrid seed. Permanent — no expiry.

  cropsticks: {
    id:             "cropsticks",
    name:           "Cropsticks",
    description:    "Passively cross-breeds adjacent flowers marked with Attunement. Place next to two attuned blooms of compatible types and wait for a hybrid seed to appear. Permanent.",
    emoji:          "🥢",
    sprite:           "/sprites/gear/cropsticks.png",
    rarity:         "legendary",
    shopPrice:      24_000,
    category:       "passive",
    passiveSubtype: "cropsticks",
    radiusOffsets:  OFFSETS_CROSS, // highlights the 4 cells it monitors in the UI
  },
};

// ── Utility: check if gear has expired ────────────────────────────────────

export function isGearExpired(gear: PlacedGear, now: number): boolean {
  const def = GEAR[gear.gearType];
  if (!def.durationMs) return false; // permanent gear never expires
  return now >= gear.placedAt + def.durationMs;
}

// ── Utility: get cells affected by a piece of gear ────────────────────────

/**
 * Returns all [row, col] pairs that a piece of gear at (gearRow, gearCol)
 * affects, clamped to the grid dimensions.
 * For fans and aegis, `direction` must be supplied to compute the line of cells.
 */
export function getAffectedCells(
  gearType:  GearType,
  gearRow:   number,
  gearCol:   number,
  gridRows:  number,
  gridCols:  number,
  direction?: FanDirection
): [number, number][] {
  const def = GEAR[gearType];

  // Balance Scale: always covers cells to the LEFT and RIGHT.
  // Phase 0 = left arm boosted; phase 1 = right arm boosted. No direction picker.
  if (def.passiveSubtype === "balance_scale" && def.fanRange) {
    const range = def.fanRange;
    const offsets: [number, number][] = [];
    for (let i = 1; i <= range; i++) {
      offsets.push([0, -i]); // left arm
      offsets.push([0,  i]); // right arm
    }
    return offsets
      .map(([dr, dc]): [number, number] => [gearRow + dr, gearCol + dc])
      .filter(([r, c]) => r >= 0 && r < gridRows && c >= 0 && c < gridCols);
  }

  // Aqueduct: bidirectional line — shoots in the chosen direction AND its opposite.
  // Choosing "right" or "left" covers the full horizontal axis; "up" or "down" covers vertical.
  if (def.passiveSubtype === "aqueduct" && def.fanRange) {
    if (!direction) return []; // direction required
    const range = def.fanRange;
    const offsets: [number, number][] = [];
    const isHoriz = direction === "left" || direction === "right";
    for (let i = 1; i <= range; i++) {
      if (isHoriz) { offsets.push([0,  i]); offsets.push([0, -i]); }
      else          { offsets.push([-i, 0]); offsets.push([ i, 0]); }
    }
    return offsets
      .map(([dr, dc]): [number, number] => [gearRow + dr, gearCol + dc])
      .filter(([r, c]) => r >= 0 && r < gridRows && c >= 0 && c < gridCols);
  }

  // Fan / Aegis / Lawnmower: compute a line of cells in the chosen direction
  if ((def.passiveSubtype === "fan" || def.passiveSubtype === "aegis" || def.passiveSubtype === "lawnmower") && def.fanRange) {
    if (!direction) return []; // direction required
    const range = def.fanRange;
    const offsets: [number, number][] = [];
    for (let i = 1; i <= range; i++) {
      if (direction === "up")    offsets.push([-i,  0]);
      if (direction === "down")  offsets.push([ i,  0]);
      if (direction === "left")  offsets.push([ 0, -i]);
      if (direction === "right") offsets.push([ 0,  i]);
    }
    return offsets
      .map(([dr, dc]): [number, number] => [gearRow + dr, gearCol + dc])
      .filter(([r, c]) => r >= 0 && r < gridRows && c >= 0 && c < gridCols);
  }

  if (!def.radiusOffsets) return [];
  return def.radiusOffsets
    .map(([dr, dc]): [number, number] => [gearRow + dr, gearCol + dc])
    .filter(([r, c]) => r >= 0 && r < gridRows && c >= 0 && c < gridCols);
}

// ── Utility: find active gear of a category affecting a cell ─────────────

export interface ActiveGearSource {
  gearType:  GearType;
  def:       GearDefinition;
  sourceRow: number;
  sourceCol: number;
  placedGear: PlacedGear;
}

/**
 * Scans the entire grid and returns every non-expired gear item whose
 * radius covers (targetRow, targetCol), optionally filtered by category.
 */
export function getGearAffectingCell<G extends GearDefinition = GearDefinition>(
  grid: { gear: PlacedGear | null }[][],
  targetRow: number,
  targetCol: number,
  now: number,
  filter?: (def: GearDefinition) => def is G
): ActiveGearSource[] {
  const results: ActiveGearSource[] = [];
  const gridRows = grid.length;
  const gridCols = grid[0]?.length ?? 0;

  for (let sr = 0; sr < gridRows; sr++) {
    for (let sc = 0; sc < gridCols; sc++) {
      const placedGear = grid[sr][sc]?.gear;
      if (!placedGear) continue;
      if (isGearExpired(placedGear, now)) continue;

      const def = GEAR[placedGear.gearType];
      if (filter && !filter(def)) continue;

      const affected = getAffectedCells(placedGear.gearType, sr, sc, gridRows, gridCols, placedGear.direction);
      if (affected.some(([r, c]) => r === targetRow && c === targetCol)) {
        results.push({ gearType: placedGear.gearType, def, sourceRow: sr, sourceCol: sc, placedGear });
      }
    }
  }

  return results;
}

// ── Convenience predicates ─────────────────────────────────────────────────

export function isRegularSprinkler(def: GearDefinition): boolean {
  return def.category === "sprinkler_regular";
}

export function isMutationSprinkler(def: GearDefinition): boolean {
  return def.category === "sprinkler_mutation";
}

export function isScarecrow(def: GearDefinition): boolean {
  return def.passiveSubtype === "scarecrow";
}

export function isGrowLamp(def: GearDefinition): boolean {
  return def.passiveSubtype === "grow_lamp";
}

export function isComposter(def: GearDefinition): boolean {
  return def.passiveSubtype === "composter";
}

export function isFan(def: GearDefinition): boolean {
  return def.passiveSubtype === "fan";
}

export function isAegis(def: GearDefinition): boolean {
  return def.passiveSubtype === "aegis";
}

export function isLawnmower(def: GearDefinition): boolean {
  return def.passiveSubtype === "lawnmower";
}

export function isBalanceScale(def: GearDefinition): boolean {
  return def.passiveSubtype === "balance_scale";
}

export function isAqueduct(def: GearDefinition): boolean {
  return def.passiveSubtype === "aqueduct";
}

export function isHarvestBell(def: GearDefinition): boolean {
  return def.passiveSubtype === "harvest_bell";
}

export function isAutoPlanter(def: GearDefinition): boolean {
  return def.passiveSubtype === "auto_planter";
}

export function isCropsticks(def: GearDefinition): boolean {
  return def.passiveSubtype === "cropsticks";
}

// ── Supply shop pools ──────────────────────────────────────────────────────

export type SupplyItem =
  | { kind: "fertilizer"; fertilizerType: FertilizerType }
  | { kind: "gear";       gearType: GearType }
  | { kind: "consumable"; consumableId: string };

/** Items available at each rarity tier in the Supply Shop.
 *  Crafting is generally cheaper than buying — supply prices are 2× the
 *  reference shopPrice on each gear, so the shop is a convenience option
 *  for players who don't have the essences/ingredients on hand. */
export const SUPPLY_POOLS: Partial<Record<Rarity, SupplyItem[]>> = {
  common: [
    { kind: "fertilizer", fertilizerType: "basic" },
    { kind: "consumable", consumableId: "magnifying_glass" },
    { kind: "consumable", consumableId: "shovel" },
  ],
  uncommon: [
    { kind: "fertilizer", fertilizerType: "advanced" },
    { kind: "gear", gearType: "grow_lamp_uncommon" },
    { kind: "gear", gearType: "composter_uncommon" },
    { kind: "gear", gearType: "fan_uncommon" },
    { kind: "gear", gearType: "harvest_bell_uncommon" },
    { kind: "gear", gearType: "lawnmower_uncommon" },
    { kind: "gear", gearType: "aegis_uncommon" },
    { kind: "gear", gearType: "aqueduct_uncommon" },
    { kind: "consumable", consumableId: "ruler" },
  ],
  rare: [
    { kind: "fertilizer", fertilizerType: "premium" },
    { kind: "gear", gearType: "sprinkler_rare" },
    { kind: "gear", gearType: "grow_lamp_rare" },
    { kind: "gear", gearType: "scarecrow_rare" },
    { kind: "gear", gearType: "composter_rare" },
    { kind: "gear", gearType: "fan_rare" },
    { kind: "gear", gearType: "harvest_bell_rare" },
    { kind: "gear", gearType: "lawnmower_rare" },
    { kind: "gear", gearType: "aegis_rare" },
    { kind: "gear", gearType: "aqueduct_rare" },
    { kind: "consumable", consumableId: "bloom_burst_1" },
    { kind: "consumable", consumableId: "heirloom_charm_1" },
    { kind: "consumable", consumableId: "purity_vial_1" },
    { kind: "consumable", consumableId: "giant_vial_1" },
    { kind: "consumable", consumableId: "frost_vial_1" },
    { kind: "consumable", consumableId: "ember_vial_1" },
    { kind: "consumable", consumableId: "storm_vial_1" },
    { kind: "consumable", consumableId: "moon_vial_1" },
    { kind: "consumable", consumableId: "garden_pin" },
    { kind: "consumable", consumableId: "slot_lock" },
    { kind: "consumable", consumableId: "golden_vial_1" },
    { kind: "consumable", consumableId: "rainbow_vial_1" },
    { kind: "consumable", consumableId: "eclipse_tonic_1" },
    { kind: "consumable", consumableId: "verdant_rush_1" },
    { kind: "consumable", consumableId: "forge_haste_1" },
    { kind: "consumable", consumableId: "resonance_draft_1" },
  ],
  legendary: [
    { kind: "fertilizer", fertilizerType: "elite" },
    { kind: "gear", gearType: "sprinkler_legendary" },
    { kind: "gear", gearType: "sprinkler_flame" },
    { kind: "gear", gearType: "sprinkler_frost" },
    { kind: "gear", gearType: "scarecrow_legendary" },
    { kind: "gear", gearType: "composter_legendary" },
    { kind: "gear", gearType: "fan_legendary" },
    { kind: "gear", gearType: "harvest_bell_legendary" },
    { kind: "gear", gearType: "lawnmower_legendary" },
    { kind: "gear", gearType: "aegis_legendary" },
    { kind: "gear", gearType: "aqueduct_legendary" },
    { kind: "gear", gearType: "balance_scale_legendary" },
    { kind: "gear", gearType: "cropsticks" },
    { kind: "consumable", consumableId: "bloom_burst_2" },
    { kind: "consumable", consumableId: "heirloom_charm_2" },
    { kind: "consumable", consumableId: "purity_vial_2" },
    { kind: "consumable", consumableId: "giant_vial_2" },
    { kind: "consumable", consumableId: "frost_vial_2" },
    { kind: "consumable", consumableId: "ember_vial_2" },
    { kind: "consumable", consumableId: "storm_vial_2" },
    { kind: "consumable", consumableId: "moon_vial_2" },
    { kind: "consumable", consumableId: "golden_vial_2" },
    { kind: "consumable", consumableId: "rainbow_vial_2" },
    { kind: "consumable", consumableId: "eclipse_tonic_2" },
    { kind: "consumable", consumableId: "verdant_rush_2" },
    { kind: "consumable", consumableId: "forge_haste_2" },
    { kind: "consumable", consumableId: "resonance_draft_2" },
  ],
  mythic: [
    { kind: "fertilizer", fertilizerType: "miracle" },
    { kind: "gear", gearType: "sprinkler_mythic" },
    { kind: "gear", gearType: "sprinkler_lightning" },
    { kind: "gear", gearType: "sprinkler_lunar" },
    { kind: "gear", gearType: "scarecrow_mythic" },
    { kind: "gear", gearType: "balance_scale_mythic" },
    { kind: "consumable", consumableId: "bloom_burst_3" },
    { kind: "consumable", consumableId: "heirloom_charm_3" },
    { kind: "consumable", consumableId: "purity_vial_3" },
    { kind: "consumable", consumableId: "giant_vial_3" },
    { kind: "consumable", consumableId: "frost_vial_3" },
    { kind: "consumable", consumableId: "ember_vial_3" },
    { kind: "consumable", consumableId: "storm_vial_3" },
    { kind: "consumable", consumableId: "moon_vial_3" },
    { kind: "consumable", consumableId: "golden_vial_3" },
    { kind: "consumable", consumableId: "rainbow_vial_3" },
    { kind: "consumable", consumableId: "wind_shear" },
    { kind: "consumable", consumableId: "eclipse_tonic_3" },
    { kind: "consumable", consumableId: "verdant_rush_3" },
    { kind: "consumable", consumableId: "forge_haste_3" },
    { kind: "consumable", consumableId: "resonance_draft_3" },
  ],
  exalted: [
    { kind: "gear", gearType: "sprinkler_exalted" },
    { kind: "gear", gearType: "sprinkler_midas" },
    { kind: "gear", gearType: "balance_scale_exalted" },
    { kind: "consumable", consumableId: "bloom_burst_4" },
    { kind: "consumable", consumableId: "heirloom_charm_4" },
    { kind: "consumable", consumableId: "purity_vial_4" },
    { kind: "consumable", consumableId: "giant_vial_4" },
    { kind: "consumable", consumableId: "frost_vial_4" },
    { kind: "consumable", consumableId: "ember_vial_4" },
    { kind: "consumable", consumableId: "storm_vial_4" },
    { kind: "consumable", consumableId: "moon_vial_4" },
    { kind: "consumable", consumableId: "golden_vial_4" },
    { kind: "consumable", consumableId: "rainbow_vial_4" },
    { kind: "consumable", consumableId: "eclipse_tonic_4" },
    { kind: "consumable", consumableId: "verdant_rush_4" },
    { kind: "consumable", consumableId: "forge_haste_4" },
    { kind: "consumable", consumableId: "resonance_draft_4" },
  ],
  prismatic: [
    { kind: "gear", gearType: "sprinkler_prismatic" },
    { kind: "gear", gearType: "sprinkler_prism" },
    { kind: "gear", gearType: "auto_planter_prismatic" },
    { kind: "consumable", consumableId: "bloom_burst_5" },
    { kind: "consumable", consumableId: "heirloom_charm_5" },
    { kind: "consumable", consumableId: "purity_vial_5" },
    { kind: "consumable", consumableId: "giant_vial_5" },
    { kind: "consumable", consumableId: "frost_vial_5" },
    { kind: "consumable", consumableId: "ember_vial_5" },
    { kind: "consumable", consumableId: "storm_vial_5" },
    { kind: "consumable", consumableId: "moon_vial_5" },
    { kind: "consumable", consumableId: "golden_vial_5" },
    { kind: "consumable", consumableId: "rainbow_vial_5" },
    { kind: "consumable", consumableId: "eclipse_tonic_5" },
    { kind: "consumable", consumableId: "verdant_rush_5" },
    { kind: "consumable", consumableId: "forge_haste_5" },
    { kind: "consumable", consumableId: "resonance_draft_5" },
  ],
};

/** Rarity weights for supply shop generation */
export const SUPPLY_RARITY_WEIGHTS: Partial<Record<Rarity, number>> = {
  common:    40,
  uncommon:  30,
  rare:      20,
  legendary: 6,
  mythic:    3,
  exalted:   1,
  prismatic: 0.5,
};

const RARITY_RANK: Record<Rarity, number> = {
  common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4, exalted: 5, prismatic: 6,
};

/** Returns the highest rarity tier available in the supply shop for a given slot count */
export function getMaxSupplyRarity(supplySlots: number): Rarity {
  if (supplySlots >= 6) return "prismatic";
  if (supplySlots >= 5) return "exalted";
  if (supplySlots >= 4) return "mythic";
  if (supplySlots >= 3) return "legendary";
  return "rare"; // default (1–2 slots)
}

/** True if `rarity` is available in the supply shop given the current slot count */
export function isRarityUnlocked(rarity: Rarity, supplySlots: number): boolean {
  return RARITY_RANK[rarity] <= RARITY_RANK[getMaxSupplyRarity(supplySlots)];
}

// ── Composter fertilizer roll ──────────────────────────────────────────────

/**
 * Rolls a fertilizer type for a composter when a nearby plant blooms.
 * Higher-rarity flowers produce better fertilizers more often.
 */
export function rollComposterFertilizer(flowerRarity: Rarity): FertilizerType {
  const table: Record<Rarity, Record<FertilizerType, number>> = {
    common:    { basic: 50, advanced: 30, premium: 15, elite: 4,  miracle: 1  },
    uncommon:  { basic: 35, advanced: 35, premium: 20, elite: 8,  miracle: 2  },
    rare:      { basic: 20, advanced: 30, premium: 30, elite: 15, miracle: 5  },
    legendary: { basic: 10, advanced: 20, premium: 30, elite: 25, miracle: 15 },
    mythic:    { basic: 5,  advanced: 15, premium: 25, elite: 30, miracle: 25 },
    exalted:   { basic: 3,  advanced: 10, premium: 20, elite: 30, miracle: 37 },
    prismatic: { basic: 2,  advanced: 8,  premium: 15, elite: 25, miracle: 50 },
  };

  const weights = table[flowerRarity];
  const total   = Object.values(weights).reduce((s, w) => s + w, 0);
  let roll      = Math.random() * total;

  for (const [type, weight] of Object.entries(weights) as [FertilizerType, number][]) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return "basic";
}
