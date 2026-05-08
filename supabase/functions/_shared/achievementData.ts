// Deno-compatible achievement catalogue.
// Keep in sync with src/data/achievements.ts — same IDs, targets, and rewards.
// No src/ imports; safe for all edge functions to import.

export type AchievementCheck =
  | { kind: "stat";    statKey: string }
  | { kind: "species_discovered" }
  | { kind: "friends_count" }
  | { kind: "recipe_completed";    recipeId: string }
  | { kind: "all_recipes_completed" };

export interface AchievementDef {
  check:  AchievementCheck;
  target: number;
  xp:     number;
  gems:   number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function reward(gems: number) { return { xp: gems * 10, gems }; }

const data: Record<string, AchievementDef> = {};

function add(id: string, check: AchievementCheck, target: number, gems: number) {
  data[id] = { check, target, ...reward(gems) };
}

// ── Lookup tables (must match achievements.ts exactly) ─────────────────────────

const FLOWER_TYPES = [
  "blaze", "frost", "lunar", "solar",  "tide",  "storm",
  "grove", "shadow","arcane","stellar","fairy",  "zephyr",
] as const;

// [statKeySuffix, tiers (null = single-tier)]
const CONSUMABLE_FAMILIES: [string, number | null][] = [
  ["bloom_burst",      5], ["heirloom_charm",   5], ["purity_vial",      5],
  ["giant_vial",       5], ["frost_vial",        5], ["ember_vial",       5],
  ["storm_vial",       5], ["moon_vial",         5], ["golden_vial",      5],
  ["rainbow_vial",     5], ["eclipse_tonic",     5], ["verdant_rush",     5],
  ["forge_haste",      5], ["resonance_draft",   5],
  ["wind_shear",    null], ["slot_lock",       null], ["magnifying_glass",null],
  ["garden_pin",    null], ["ruler",           null], ["shovel",          null],
];

// [gearType] — 39 entries, same order as achievements.ts
const CRAFTABLE_GEAR: string[] = [
  "sprinkler_rare",          "sprinkler_legendary",     "sprinkler_mythic",
  "sprinkler_exalted",       "sprinkler_prismatic",
  "sprinkler_flame",         "sprinkler_frost",         "sprinkler_lightning",
  "sprinkler_lunar",         "sprinkler_midas",         "sprinkler_prism",
  "grow_lamp_uncommon",      "grow_lamp_rare",
  "scarecrow_rare",          "scarecrow_legendary",     "scarecrow_mythic",
  "composter_uncommon",      "composter_rare",          "composter_legendary",
  "fan_uncommon",            "fan_rare",                "fan_legendary",
  "harvest_bell_uncommon",   "harvest_bell_rare",       "harvest_bell_legendary",
  "lawnmower_uncommon",      "lawnmower_rare",          "lawnmower_legendary",
  "aegis_uncommon",          "aegis_rare",              "aegis_legendary",
  "aqueduct_uncommon",       "aqueduct_rare",           "aqueduct_legendary",
  "balance_scale_legendary", "balance_scale_mythic",    "balance_scale_exalted",
  "cropsticks",              "auto_planter_prismatic",
];

const GEAR_PLACED_GROUPS: string[] = [
  "sprinkler",    "heater",       "cooler",      "generator",   "crystal_ball",
  "golden_veil",  "kaleidoscope", "grow_lamp",   "scarecrow",   "composter",
  "fan",          "harvest_bell", "lawnmower",   "aegis",       "aqueduct",
  "balance_scale","cropsticks",   "auto_planter",
];

// All cross-breeding recipe IDs — used for per-recipe and all-recipes checks.
// "arcane+stellar_exalted" is the T4 "The First Bloom" (disambiguated from T1 Cosmosbloom).
export const CROSSBREED_RECIPE_IDS: string[] = [
  "blaze+frost",    "lunar+solar",    "tide+storm",    "grove+shadow",
  "arcane+stellar", "fairy+zephyr",   "blaze+solar",   "lunar+tide",
  "grove+zephyr",   "frost+arcane",   "arcane+shadow", "stellar+zephyr",
  "arcane+stellar_exalted",
];

// ── Achievement generation ─────────────────────────────────────────────────────

// 🌸 Total harvests
for (const [target, gems] of [
  [10, 5], [50, 5], [100, 10], [500, 10], [1_000, 15], [2_500, 15], [5_000, 25],
] as [number, number][]) {
  add(`harvest_total_${target}`, { kind: "stat", statKey: "total_harvests" }, target, gems);
}

// 🌸 Harvest by type
for (const type of FLOWER_TYPES) {
  for (const [target, gems] of [
    [2, 5], [5, 5], [10, 5], [25, 10], [50, 10], [100, 10], [250, 15], [500, 15],
  ] as [number, number][]) {
    add(`harvest_${type}_${target}`, { kind: "stat", statKey: `harvest_${type}` }, target, gems);
  }
}

// 🌸 Harvest by rarity
for (const [rarity, tiers] of [
  ["legendary", [[10, 5], [25, 10], [50, 10], [100, 15]]],
  ["mythic",    [[5,  5], [10, 10], [25, 10], [50,  15]]],
  ["prismatic", [[1,  5], [5,  10], [10, 15], [25,  25]]],
] as [string, [number, number][]][]) {
  for (const [target, gems] of tiers) {
    add(`harvest_${rarity}_${target}`, { kind: "stat", statKey: `harvest_${rarity}` }, target, gems);
  }
}

// 🌱 Seeds planted
for (const [target, gems] of [
  [10, 5], [50, 5], [100, 10], [500, 10], [1_000, 15], [5_000, 25],
] as [number, number][]) {
  add(`seeds_planted_${target}`, { kind: "stat", statKey: "seeds_planted" }, target, gems);
}

// ⚗️ Total sacrifices
for (const [target, gems] of [
  [1, 5], [10, 5], [50, 10], [100, 10], [500, 15], [1_000, 25],
] as [number, number][]) {
  add(`sacrifice_total_${target}`, { kind: "stat", statKey: "total_sacrifices" }, target, gems);
}

// ⚗️ Sacrifice by type
for (const type of FLOWER_TYPES) {
  for (const [target, gems] of [
    [1, 5], [5, 5], [10, 5], [25, 10], [50, 10], [100, 15],
  ] as [number, number][]) {
    add(`sacrifice_${type}_${target}`, { kind: "stat", statKey: `sacrifice_${type}` }, target, gems);
  }
}

// 🛒 Plants bought + blooms sold + marketplace sales
for (const [target, gems] of [
  [1, 5], [5, 5], [10, 10], [25, 10], [100, 15],
] as [number, number][]) {
  add(`plants_bought_${target}`,     { kind: "stat", statKey: "plants_bought" },     target, gems);
  add(`blooms_sold_${target}`,       { kind: "stat", statKey: "blooms_sold" },        target, gems);
  add(`marketplace_sales_${target}`, { kind: "stat", statKey: "marketplace_sales" }, target, gems);
}

// 🔨 Consumable crafting — tiered families (2 milestones × 5 tiers each)
for (const [key, tiers] of CONSUMABLE_FAMILIES.filter(([, t]) => t !== null)) {
  for (let t = 1; t <= (tiers as number); t++) {
    for (const [target, gems] of [[1, 5], [5, 10]] as [number, number][]) {
      add(`crafted_${key}_${t}_${target}`, { kind: "stat", statKey: `crafted_${key}_${t}` }, target, gems);
    }
  }
}

// 🔨 Consumable crafting — single-tier items
for (const [key] of CONSUMABLE_FAMILIES.filter(([, t]) => t === null)) {
  for (const [target, gems] of [[1, 5], [5, 10]] as [number, number][]) {
    add(`crafted_${key}_${target}`, { kind: "stat", statKey: `crafted_${key}` }, target, gems);
  }
}

// 🔨 Consumable crafting — infusers (tiers 1–5)
for (let t = 1; t <= 5; t++) {
  for (const [target, gems] of [[1, 5], [5, 10]] as [number, number][]) {
    add(`crafted_infuser_${t}_${target}`, { kind: "stat", statKey: `crafted_infuser_${t}` }, target, gems);
  }
}

// 🔨 Consumable crafting — fertilizers
for (const fertKey of ["basic", "advanced", "premium", "elite", "miracle"]) {
  for (const [target, gems] of [[1, 5], [5, 10]] as [number, number][]) {
    add(`crafted_fertilizer_${fertKey}_${target}`, { kind: "stat", statKey: `crafted_fertilizer_${fertKey}` }, target, gems);
  }
}

// 🔨 Consumable crafting — seed pouches (tiers 1–5, 1 milestone each)
for (let t = 1; t <= 5; t++) {
  add(`crafted_seed_pouch_${t}`, { kind: "stat", statKey: `crafted_seed_pouch_${t}` }, 1, 5);
}

// 🔧 Gear crafting — one achievement per gear type, reward scales with rarity
for (const gearType of CRAFTABLE_GEAR) {
  const gems = (
    gearType.includes("prismatic") || gearType.includes("exalted") ? 15 :
    gearType.includes("mythic")    || gearType.includes("legendary") ? 10 :
    5
  );
  add(`crafted_gear_${gearType}`, { kind: "stat", statKey: `crafted_gear_${gearType}` }, 1, gems);
}

// 🎁 Seed pouches opened
for (const [target, gems] of [
  [1, 5], [5, 5], [10, 10], [25, 10], [50, 15], [100, 25],
] as [number, number][]) {
  add(`pouches_opened_${target}`, { kind: "stat", statKey: "pouches_opened" }, target, gems);
}

// 🪴 Gear placed
for (const key of GEAR_PLACED_GROUPS) {
  for (const [target, gems] of [[1, 5], [5, 10], [25, 15]] as [number, number][]) {
    add(`placed_${key}_${target}`, { kind: "stat", statKey: `placed_${key}` }, target, gems);
  }
}

// 🧪 Consumables used (by family — any tier counts toward the same key)
for (const [key] of CONSUMABLE_FAMILIES) {
  for (const [target, gems] of [[1, 5], [5, 10], [25, 15]] as [number, number][]) {
    add(`used_${key}_${target}`, { kind: "stat", statKey: `used_${key}` }, target, gems);
  }
}

// 🌾 Fertilizers applied
for (const [target, gems] of [
  [5, 5], [25, 10], [100, 10], [500, 15],
] as [number, number][]) {
  add(`fertilizers_applied_${target}`, { kind: "stat", statKey: "fertilizers_applied" }, target, gems);
}

// 📅 Daily task sets completed
for (const [target, gems] of [
  [1, 5], [7, 10], [30, 10], [60, 15], [100, 25],
] as [number, number][]) {
  add(`daily_sets_${target}`, { kind: "stat", statKey: "daily_sets_completed" }, target, gems);
}

// 📖 Species discovered
for (const [target, gems] of [
  [10, 5], [25, 10], [50, 15], [999, 25],
] as [number, number][]) {
  add(`species_discovered_${target}`, { kind: "species_discovered" }, target, gems);
}

// 🥢 Cross-breeding — per recipe
for (const recipeId of CROSSBREED_RECIPE_IDS) {
  add(
    `crossbred_${recipeId.replace(/[+]/g, "_")}`,
    { kind: "recipe_completed", recipeId },
    1, 15,
  );
}

// 🥢 Cross-breeding — all recipes
add("crossbred_all", { kind: "all_recipes_completed" }, CROSSBREED_RECIPE_IDS.length, 50);

// 🌍 Gifts sent
for (const [target, gems] of [[1, 5], [5, 10], [25, 15]] as [number, number][]) {
  add(`gifts_sent_${target}`, { kind: "stat", statKey: "gifts_sent" }, target, gems);
}

// 🌍 Friends
for (const [target, gems] of [[1, 5], [5, 10], [10, 15]] as [number, number][]) {
  add(`friends_${target}`, { kind: "friends_count" }, target, gems);
}

// ✨ Attunements completed
for (const [target, gems] of [[1, 5], [10, 10], [50, 15]] as [number, number][]) {
  add(`attunements_${target}`, { kind: "stat", statKey: "attunements_completed" }, target, gems);
}

// ── Export ─────────────────────────────────────────────────────────────────────

export const ACHIEVEMENT_DATA: Record<string, AchievementDef> = data;
