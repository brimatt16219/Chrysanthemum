import type { FlowerType } from "./flowers";
import type { GearType } from "./gear";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AchievementCategory =
  | "harvest"
  | "seeds"
  | "sacrifice"
  | "shopping"
  | "crafting_consumable"
  | "crafting_gear"
  | "pouches"
  | "gear_placed"
  | "consumables_used"
  | "fertilizers"
  | "daily"
  | "crossbreeding"
  | "social"
  | "attunement"
  | "leveling";

/** How progress is measured at check/claim time. */
export type AchievementCheck =
  | { kind: "stat";    statKey: string }
  | { kind: "species_discovered" }
  | { kind: "friends_count" }
  | { kind: "recipe_completed"; recipeId: string }
  | { kind: "level_reached" };

export interface Achievement {
  id:          string;
  name:        string;
  description: string;
  emoji:       string;
  category:    AchievementCategory;
  check:       AchievementCheck;
  target:      number;
  xp:          number;
  gems:        number;
}

export type AchievementStats = Record<string, number>;

// ── Category display metadata ──────────────────────────────────────────────────

export const ACHIEVEMENT_CATEGORY_META: Record<AchievementCategory, { label: string; emoji: string; sprite: string }> = {
  harvest:             { label: "Discover",        emoji: "🔍", sprite: "/sprites/ui/ach_discover.png"     },
  seeds:               { label: "Planting",        emoji: "🌱", sprite: "/sprites/ui/ach_planting.png"     },
  sacrifice:           { label: "Alchemy",         emoji: "⚗️", sprite: "/sprites/ui/ach_alchemy.png"      },
  shopping:            { label: "Shopping",        emoji: "🛒", sprite: "/sprites/ui/ach_shopping.png"     },
  crafting_consumable: { label: "Crafting",        emoji: "🔨", sprite: "/sprites/ui/ach_crafting.png"     },
  crafting_gear:       { label: "Gear Crafting",   emoji: "🔧", sprite: "/sprites/ui/ach_gear_craft.png"   },
  pouches:             { label: "Seed Pouches",    emoji: "🎁", sprite: "/sprites/ui/ach_pouches.png"      },
  gear_placed:         { label: "Gear Placed",     emoji: "🚿", sprite: "/sprites/ui/ach_gear_placed.png"  },
  consumables_used:    { label: "Consumables",     emoji: "🧪", sprite: "/sprites/ui/ach_consumables.png"  },
  fertilizers:         { label: "Fertilizers",     emoji: "🌾", sprite: "/sprites/ui/ach_fertilizers.png"  },
  daily:               { label: "Daily Tasks",     emoji: "📅", sprite: "/sprites/ui/ach_daily.png"        },
  crossbreeding:       { label: "Cross-Breeding",  emoji: "🥢", sprite: "/sprites/ui/ach_crossbreed.png"   },
  social:              { label: "Social",          emoji: "🌍", sprite: "/sprites/ui/ach_social.png"       },
  attunement:          { label: "Attunement",      emoji: "✨", sprite: "/sprites/ui/ach_attunement.png"   },
  leveling:            { label: "Leveling",        emoji: "⭐", sprite: "/sprites/ui/ach_leveling.png"     },
};

// ── Lookup tables ──────────────────────────────────────────────────────────────

const FLOWER_TYPES: FlowerType[] = [
  "blaze", "frost", "lunar", "solar", "tide", "storm",
  "grove", "shadow", "arcane", "stellar", "fairy", "zephyr",
];

const TYPE_LABEL: Record<FlowerType, string> = {
  blaze: "Blaze", frost: "Frost", lunar: "Lunar",  solar: "Solar",
  tide:  "Tide",  storm: "Storm", grove: "Grove",  shadow: "Shadow",
  arcane:"Arcane",stellar:"Stellar",fairy:"Fairy", zephyr:"Zephyr",
};

const TYPE_EMOJI: Record<FlowerType, string> = {
  blaze: "🔥", frost: "❄️",  lunar: "🌙", solar: "☀️",
  tide:  "🌊", storm: "⛈️",  grove: "🌿", shadow: "🌑",
  arcane:"✨", stellar:"⭐", fairy: "🧚", zephyr:"💨",
};

// Consumable families: [statKeySuffix, label, emoji, tiers (null = single-tier)]
const CONSUMABLE_FAMILIES: [string, string, string, number | null][] = [
  ["bloom_burst",      "Bloom Burst",       "🌱", 5],
  ["heirloom_charm",   "Heirloom Charm",    "🔮", 5],
  ["purity_vial",      "Purity Vial",       "🧼", 5],
  ["giant_vial",       "Giant Vial",        "🧬", 5],
  ["frost_vial",       "Frost Vial",        "🧊", 5],
  ["ember_vial",       "Ember Vial",        "🔥", 5],
  ["storm_vial",       "Storm Vial",        "⚡", 5],
  ["moon_vial",        "Moon Vial",         "🌙", 5],
  ["golden_vial",      "Golden Vial",       "✨", 5],
  ["rainbow_vial",     "Rainbow Vial",      "🌈", 5],
  ["eclipse_tonic",    "Eclipse Tonic",     "🌒", 5],
  ["verdant_rush",     "Verdant Rush",      "🌿", 5],
  ["forge_haste",      "Forge Haste",       "⚒️", 5],
  ["resonance_draft",  "Resonance Draft",   "🌀", 5],
  ["wind_shear",       "Wind Shear",        "🌪️", null],
  ["slot_lock",        "Slot Lock",         "🔒", null],
  ["magnifying_glass", "Magnifying Glass",  "🔍", null],
  ["garden_pin",       "Garden Pin",        "📌", null],
  ["ruler",            "Ruler",             "📏", null],
  ["shovel",           "Shovel",            "🥄", null],
];

// Gear types eligible for "craft 1" achievements: [gearType, name, emoji]
const CRAFTABLE_GEAR: [GearType, string, string][] = [
  ["sprinkler_rare",           "Sprinkler I",      "🚿"],
  ["sprinkler_legendary",      "Sprinkler II",     "🚿"],
  ["sprinkler_mythic",         "Sprinkler III",    "🚿"],
  ["sprinkler_exalted",        "Sprinkler IV",     "🚿"],
  ["sprinkler_prismatic",      "Sprinkler V",      "🚿"],
  ["sprinkler_flame",          "Heater",           "♨️"],
  ["sprinkler_frost",          "Cooler",           "🧊"],
  ["sprinkler_lightning",      "Generator",        "🔋"],
  ["sprinkler_lunar",          "Crystal Ball",     "🔮"],
  ["sprinkler_midas",          "Golden Veil",      "💰"],
  ["sprinkler_prism",          "Kaleidoscope",     "🔭"],
  ["grow_lamp_uncommon",       "Grow Lamp I",      "💡"],
  ["grow_lamp_rare",           "Grow Lamp II",     "💡"],
  ["scarecrow_rare",           "Scarecrow I",      "🧹"],
  ["scarecrow_legendary",      "Scarecrow II",     "🧹"],
  ["scarecrow_mythic",         "Scarecrow III",    "🧹"],
  ["composter_uncommon",       "Composter I",      "🧺"],
  ["composter_rare",           "Composter II",     "🧺"],
  ["composter_legendary",      "Composter III",    "🧺"],
  ["fan_uncommon",             "Fan I",            "💨"],
  ["fan_rare",                 "Fan II",           "💨"],
  ["fan_legendary",            "Fan III",          "💨"],
  ["harvest_bell_uncommon",    "Harvest Bell I",   "🔔"],
  ["harvest_bell_rare",        "Harvest Bell II",  "🔔"],
  ["harvest_bell_legendary",   "Harvest Bell III", "🔔"],
  ["lawnmower_uncommon",       "Lawnmower I",      "🦼"],
  ["lawnmower_rare",           "Lawnmower II",     "🦼"],
  ["lawnmower_legendary",      "Lawnmower III",    "🦼"],
  ["aegis_uncommon",           "Aegis I",          "🛡️"],
  ["aegis_rare",               "Aegis II",         "🛡️"],
  ["aegis_legendary",          "Aegis III",        "🛡️"],
  ["aqueduct_uncommon",        "Aqueduct I",       "⛲"],
  ["aqueduct_rare",            "Aqueduct II",      "⛲"],
  ["aqueduct_legendary",       "Aqueduct III",     "⛲"],
  ["balance_scale_legendary",  "Balance Scale I",  "⚖️"],
  ["balance_scale_mythic",     "Balance Scale II", "⚖️"],
  ["balance_scale_exalted",    "Balance Scale III","⚖️"],
  ["cropsticks",               "Cropsticks",       "🥢"],
  ["auto_planter_prismatic",   "Auto-Planter",     "🌾"],
];

// Gear groups for "placed" achievements:
// [statKeySuffix, label, emoji, passiveSubtype or mutation name]
const GEAR_PLACED_GROUPS: [string, string, string][] = [
  ["sprinkler",     "Sprinkler (Regular)",  "🚿"],
  ["heater",        "Heater",               "♨️"],
  ["cooler",        "Cooler",               "🧊"],
  ["generator",     "Generator",            "🔋"],
  ["crystal_ball",  "Crystal Ball",         "🔮"],
  ["golden_veil",   "Golden Veil",          "💰"],
  ["kaleidoscope",  "Kaleidoscope",         "🔭"],
  ["grow_lamp",     "Grow Lamp",            "💡"],
  ["scarecrow",     "Scarecrow",            "🧹"],
  ["composter",     "Composter",            "🧺"],
  ["fan",           "Fan",                  "💨"],
  ["harvest_bell",  "Harvest Bell",         "🔔"],
  ["lawnmower",     "Lawnmower",            "🦼"],
  ["aegis",         "Aegis",                "🛡️"],
  ["aqueduct",      "Aqueduct",             "⛲"],
  ["balance_scale", "Balance Scale",        "⚖️"],
  ["cropsticks",    "Cropsticks",           "🥢"],
  ["auto_planter",  "Auto-Planter",         "🌾"],
];

// Cross-breeding recipes: [recipeId, outputName, emoji]
// recipeId matches what tick-offline-gardens stores in discoveredRecipes
const CROSSBREED_RECIPES: [string, string, string][] = [
  ["blaze+frost",    "Phoenix Lily",    "🌺"],
  ["lunar+solar",    "Eclipse Bloom",   "🌓"],
  ["tide+storm",     "Tempest Orchid",  "🌊"],
  ["grove+shadow",   "Blightmantle",    "🌑"],
  ["arcane+stellar", "Cosmosbloom",     "✨"],
  ["fairy+zephyr",   "Dreamgust",       "🧚"],
  ["blaze+solar",    "Solarburst",      "🔥"],
  ["lunar+tide",     "Tidalune",        "🌙"],
  ["grove+zephyr",   "Whisperleaf",     "🌿"],
  ["frost+arcane",   "Crystalmind",     "❄️"],
  ["arcane+shadow",  "Void Chrysalis",  "🌀"],
  ["stellar+zephyr", "Starloom",        "⭐"],
  // Tier 4 uses a distinct key so it doesn't collide with the Tier 1 Cosmosbloom
  ["arcane+stellar_exalted", "The First Bloom", "🌸"],
];

// Roman numerals for tiers
const ROMAN = ["I", "II", "III", "IV", "V"] as const;

// Gem → XP mapping (5💎 = 50 XP, 10💎 = 100 XP, 15💎 = 150 XP, 25💎 = 250 XP)
function reward(gems: number): { xp: number; gems: number } {
  return { xp: gems * 10, gems };
}

// ── Builder helper ─────────────────────────────────────────────────────────────

function ach(
  id:          string,
  name:        string,
  description: string,
  emoji:       string,
  category:    AchievementCategory,
  check:       AchievementCheck,
  target:      number,
  gems:        number,
): Achievement {
  return { id, name, description, emoji, category, check, target, ...reward(gems) };
}

// ── Achievement generation ─────────────────────────────────────────────────────

const achievements: Achievement[] = [];

// ── 🔍 Flower Discovery ────────────────────────────────────────────────────────

const DISCOVER_TIERS: [number, number, string][] = [
  [1,   5,  "Curious Mind"],
  [5,   5,  "First Steps"],
  [10,  5,  "Budding Botanist"],
  [20,  10, "Field Notes"],
  [30,  10, "Nature Walk"],
  [40,  10, "Avid Collector"],
  [50,  15, "Species Hunter"],
  [75,  15, "Living Encyclopedia"],
  [100, 20, "Naturalist"],
  [125, 20, "Senior Naturalist"],
  [150, 25, "Codex Scholar"],
  [190, 35, "Grand Collector"],
];
for (const [target, gems, name] of DISCOVER_TIERS) {
  achievements.push(ach(
    `species_discovered_${target}`,
    name,
    `Discover ${target} unique flower species.`,
    "🔍",
    "harvest",
    { kind: "species_discovered" },
    target, gems,
  ));
}

// ── 🌱 Seeds Planted ───────────────────────────────────────────────────────────

const SEEDS_PLANTED_TIERS: [number, number][] = [
  [10, 5], [50, 5], [100, 10], [500, 10], [1_000, 15], [5_000, 25],
];
const SEEDS_PLANTED_NAMES = [
  "Green Thumb", "Eager Planter", "Dedicated Sower",
  "Seasoned Sower", "Field Hand", "Grand Planter",
];
for (let i = 0; i < SEEDS_PLANTED_TIERS.length; i++) {
  const [target, gems] = SEEDS_PLANTED_TIERS[i];
  achievements.push(ach(
    `seeds_planted_${target}`,
    SEEDS_PLANTED_NAMES[i],
    `Plant ${target.toLocaleString()} seeds.`,
    "🌱",
    "seeds",
    { kind: "stat", statKey: "seeds_planted" },
    target, gems,
  ));
}

// ── ⚗️ Total Sacrifices ────────────────────────────────────────────────────────

const TOTAL_SACRIFICE_TIERS: [number, number][] = [
  [1, 5], [10, 5], [50, 10], [100, 10], [500, 15], [1_000, 25],
];
const TOTAL_SACRIFICE_NAMES = [
  "First Offering", "Apprentice Alchemist", "Seasoned Alchemist",
  "Expert Alchemist", "Master Alchemist", "Grand Alchemist",
];
for (let i = 0; i < TOTAL_SACRIFICE_TIERS.length; i++) {
  const [target, gems] = TOTAL_SACRIFICE_TIERS[i];
  achievements.push(ach(
    `sacrifice_total_${target}`,
    TOTAL_SACRIFICE_NAMES[i],
    `Sacrifice ${target.toLocaleString()} flowers in Alchemy.`,
    "⚗️",
    "sacrifice",
    { kind: "stat", statKey: "total_sacrifices" },
    target, gems,
  ));
}

// ── ⚗️ Sacrifice by Type ───────────────────────────────────────────────────────

const TYPE_SACRIFICE_MILESTONES: [number, number][] = [
  [1, 5], [5, 5], [10, 5], [25, 10], [50, 10], [100, 15],
];
const TYPE_SACRIFICE_TIER_NAMES = [
  "Initiate", "Acolyte", "Practitioner", "Adept", "Devotee", "Master",
];
for (const type of FLOWER_TYPES) {
  const label = TYPE_LABEL[type];
  const emoji = TYPE_EMOJI[type];
  for (let i = 0; i < TYPE_SACRIFICE_MILESTONES.length; i++) {
    const [target, gems] = TYPE_SACRIFICE_MILESTONES[i];
    achievements.push(ach(
      `sacrifice_${type}_${target}`,
      `${label} ${TYPE_SACRIFICE_TIER_NAMES[i]}`,
      `Sacrifice ${target} ${label} flower${target === 1 ? "" : "s"} in Alchemy.`,
      emoji,
      "sacrifice",
      { kind: "stat", statKey: `sacrifice_${type}` },
      target, gems,
    ));
  }
}

// ── 🛒 Plants Bought ───────────────────────────────────────────────────────────

const SHOPPING_MILESTONES: [number, number][] = [
  [1, 5], [5, 5], [10, 10], [25, 10], [100, 15],
];
const BOUGHT_NAMES = [
  "First Purchase", "Eager Shopper", "Regular Customer",
  "Loyal Patron", "Shop Devotee",
];
const SOLD_NAMES = [
  "First Sale", "Budding Merchant", "Regular Seller",
  "Seasoned Trader", "Market Veteran",
];
for (let i = 0; i < SHOPPING_MILESTONES.length; i++) {
  const [target, gems] = SHOPPING_MILESTONES[i];
  achievements.push(ach(
    `plants_bought_${target}`,
    BOUGHT_NAMES[i],
    `Buy ${target} plant${target === 1 ? "" : "s"} from the shop.`,
    "🛒",
    "shopping",
    { kind: "stat", statKey: "plants_bought" },
    target, gems,
  ));
  achievements.push(ach(
    `blooms_sold_${target}`,
    SOLD_NAMES[i],
    `Sell ${target} bloom${target === 1 ? "" : "s"} to the shop.`,
    "💰",
    "shopping",
    { kind: "stat", statKey: "blooms_sold" },
    target, gems,
  ));
}

// ── 🏪 Marketplace Sales ────────────────────────────────────────────────────────

const MARKET_MILESTONES: [number, number][] = [
  [1, 5], [5, 5], [10, 10], [25, 10], [100, 15],
];
const MARKET_NAMES = [
  "Open for Business", "Active Seller", "Market Regular",
  "Market Veteran", "Trade Baron",
];
for (let i = 0; i < MARKET_MILESTONES.length; i++) {
  const [target, gems] = MARKET_MILESTONES[i];
  achievements.push(ach(
    `marketplace_sales_${target}`,
    MARKET_NAMES[i],
    `Complete ${target} marketplace sale${target === 1 ? "" : "s"}.`,
    "🏪",
    "shopping",
    { kind: "stat", statKey: "marketplace_sales" },
    target, gems,
  ));
}

// ── 🔨 Consumable Crafting — tiered families ────────────────────────────────────

const TIERED_FAMILIES = CONSUMABLE_FAMILIES.filter(([, , , tiers]) => tiers !== null);
const SINGLE_FAMILIES = CONSUMABLE_FAMILIES.filter(([, , , tiers]) => tiers === null);

for (const [key, label, emoji, tiers] of TIERED_FAMILIES) {
  const tierCount = tiers as number;
  for (let t = 1; t <= tierCount; t++) {
    const itemId  = `${key}_${t}`;
    const tierStr = ROMAN[t - 1];
    for (const [target, gems] of [[1, 5], [5, 10]] as [number, number][]) {
      achievements.push(ach(
        `crafted_${itemId}_${target}`,
        target === 1 ? `Craft a ${label} ${tierStr}` : `Craft ${target} ${label} ${tierStr}`,
        `Craft ${target} ${label} ${tierStr}${target === 1 ? "" : "s"}.`,
        emoji,
        "crafting_consumable",
        { kind: "stat", statKey: `crafted_${itemId}` },
        target, gems,
      ));
    }
  }
}

// ── 🔨 Consumable Crafting — single-tier items ──────────────────────────────────

for (const [key, label, emoji] of SINGLE_FAMILIES) {
  for (const [target, gems] of [[1, 5], [5, 10]] as [number, number][]) {
    achievements.push(ach(
      `crafted_${key}_${target}`,
      target === 1 ? `Craft a ${label}` : `Craft ${target} ${label}s`,
      `Craft ${target} ${label}${target === 1 ? "" : "s"}.`,
      emoji,
      "crafting_consumable",
      { kind: "stat", statKey: `crafted_${key}` },
      target, gems,
    ));
  }
}

// ── 🔨 Consumable Crafting — infusers ─────────────────────────────────────────

for (let t = 1; t <= 5; t++) {
  const tierStr = ROMAN[t - 1];
  for (const [target, gems] of [[1, 5], [5, 10]] as [number, number][]) {
    achievements.push(ach(
      `crafted_infuser_${t}_${target}`,
      target === 1 ? `Craft an Infuser ${tierStr}` : `Craft ${target} Infuser ${tierStr}s`,
      `Craft ${target} Infuser ${tierStr}${target === 1 ? "" : "s"}.`,
      "🌿",
      "crafting_consumable",
      { kind: "stat", statKey: `crafted_infuser_${t}` },
      target, gems,
    ));
  }
}

// ── 🔨 Consumable Crafting — fertilizers ──────────────────────────────────────

const FERTILIZER_TIERS: [string, string, string][] = [
  ["basic",    "Basic Fertilizer",    "🦴"],
  ["advanced", "Advanced Fertilizer", "🥣"],
  ["premium",  "Premium Fertilizer",  "🧪"],
  ["elite",    "Elite Fertilizer",    "⚗️"],
  ["miracle",  "Miracle Fertilizer",  "💫"],
];
for (const [fertKey, fertLabel, fertEmoji] of FERTILIZER_TIERS) {
  for (const [target, gems] of [[1, 5], [5, 10]] as [number, number][]) {
    achievements.push(ach(
      `crafted_fertilizer_${fertKey}_${target}`,
      target === 1 ? `Craft a ${fertLabel}` : `Craft ${target} ${fertLabel}s`,
      `Craft ${target} ${fertLabel}${target === 1 ? "" : "s"}.`,
      fertEmoji,
      "crafting_consumable",
      { kind: "stat", statKey: `crafted_fertilizer_${fertKey}` },
      target, gems,
    ));
  }
}

// ── 🔨 Consumable Crafting — general seed pouches ──────────────────────────────

for (let t = 1; t <= 5; t++) {
  const tierStr = ROMAN[t - 1];
  achievements.push(ach(
    `crafted_seed_pouch_${t}`,
    `Craft a Seed Pouch ${tierStr}`,
    `Craft a Seed Pouch ${tierStr}.`,
    "🎁",
    "crafting_consumable",
    { kind: "stat", statKey: `crafted_seed_pouch_${t}` },
    1, 5,
  ));
}

// ── 🔧 Gear Crafting — one achievement per gear type ──────────────────────────

for (const [gearType, gearName, gearEmoji] of CRAFTABLE_GEAR) {
  // Reward scales: uncommon=5, rare=5, legendary=10, mythic=10, exalted=15, prismatic=15
  const gemsForGear = (
    gearType.includes("prismatic") ? 15 :
    gearType.includes("exalted")   ? 15 :
    gearType.includes("mythic")    ? 10 :
    gearType.includes("legendary") ? 10 :
    5
  );
  achievements.push(ach(
    `crafted_gear_${gearType}`,
    `Craft a ${gearName}`,
    `Craft a ${gearName}.`,
    gearEmoji,
    "crafting_gear",
    { kind: "stat", statKey: `crafted_gear_${gearType}` },
    1, gemsForGear,
  ));
}

// ── 🎁 Seed Pouches Opened ────────────────────────────────────────────────────

const POUCH_MILESTONES: [number, number][] = [
  [1, 5], [5, 5], [10, 10], [25, 10], [50, 15], [100, 25],
];
const POUCH_NAMES = [
  "Lucky Dip", "Pouch Opener", "Pouch Regular",
  "Pouch Enthusiast", "Pouch Veteran", "Pouch Master",
];
for (let i = 0; i < POUCH_MILESTONES.length; i++) {
  const [target, gems] = POUCH_MILESTONES[i];
  achievements.push(ach(
    `pouches_opened_${target}`,
    POUCH_NAMES[i],
    `Open ${target} seed pouch${target === 1 ? "" : "es"}.`,
    "🎁",
    "pouches",
    { kind: "stat", statKey: "pouches_opened" },
    target, gems,
  ));
}

// ── 🪴 Gear Placed ────────────────────────────────────────────────────────────

const GEAR_PLACED_MILESTONES: [number, number][] = [[1, 5], [5, 10], [25, 15]];
const GEAR_PLACED_SUFFIX = ["", " Regular", " Enthusiast"];

for (const [key, label, emoji] of GEAR_PLACED_GROUPS) {
  for (let i = 0; i < GEAR_PLACED_MILESTONES.length; i++) {
    const [target, gems] = GEAR_PLACED_MILESTONES[i];
    achievements.push(ach(
      `placed_${key}_${target}`,
      target === 1 ? `Place a ${label}` : `Place ${target} ${label}${GEAR_PLACED_SUFFIX[i]}`,
      `Place ${target} ${label}${target === 1 ? "" : "s"}.`,
      emoji,
      "gear_placed",
      { kind: "stat", statKey: `placed_${key}` },
      target, gems,
    ));
  }
}

// ── 🧪 Consumables Used ───────────────────────────────────────────────────────

// Used by family (any tier counts toward the same family key)
const CONSUMABLE_USED_MILESTONES: [number, number][] = [[1, 5], [5, 10], [25, 15]];

for (const [key, label, emoji] of CONSUMABLE_FAMILIES) {
  for (const [target, gems] of CONSUMABLE_USED_MILESTONES) {
    achievements.push(ach(
      `used_${key}_${target}`,
      target === 1 ? `Use a ${label}` : `Use ${target} ${label}s`,
      `Use ${target} ${label}${target === 1 ? "" : "s"}.`,
      emoji,
      "consumables_used",
      { kind: "stat", statKey: `used_${key}` },
      target, gems,
    ));
  }
}

// ── 🌾 Fertilizers Applied ────────────────────────────────────────────────────

const FERT_APPLIED_MILESTONES: [number, number][] = [
  [5, 5], [25, 10], [100, 10], [500, 15],
];
const FERT_APPLIED_NAMES = [
  "Soil Feeder", "Keen Cultivator", "Expert Cultivator", "Master Cultivator",
];
for (let i = 0; i < FERT_APPLIED_MILESTONES.length; i++) {
  const [target, gems] = FERT_APPLIED_MILESTONES[i];
  achievements.push(ach(
    `fertilizers_applied_${target}`,
    FERT_APPLIED_NAMES[i],
    `Apply ${target} fertilizers.`,
    "🌾",
    "fertilizers",
    { kind: "stat", statKey: "fertilizers_applied" },
    target, gems,
  ));
}

// ── 📅 Daily Tasks ────────────────────────────────────────────────────────────

const DAILY_MILESTONES: [number, number][] = [
  [1, 5], [7, 10], [30, 10], [60, 15], [100, 25],
];
const DAILY_NAMES = [
  "Daily Habit", "Weekly Devotee", "Monthly Regular",
  "Streak Keeper", "Daily Legend",
];
for (let i = 0; i < DAILY_MILESTONES.length; i++) {
  const [target, gems] = DAILY_MILESTONES[i];
  achievements.push(ach(
    `daily_sets_${target}`,
    DAILY_NAMES[i],
    `Complete ${target} full daily task set${target === 1 ? "" : "s"}.`,
    "📅",
    "daily",
    { kind: "stat", statKey: "daily_sets_completed" },
    target, gems,
  ));
}


// ── 🥢 Cross-Breeding — per recipe ────────────────────────────────────────────

for (const [recipeId, outputName, emoji] of CROSSBREED_RECIPES) {
  achievements.push(ach(
    `crossbred_${recipeId.replace(/[+]/g, "_")}`,
    `Discover ${outputName}`,
    `Successfully cross-breed a ${outputName}.`,
    emoji,
    "crossbreeding",
    { kind: "recipe_completed", recipeId },
    1, 15,
  ));
}

// ── 🥢 Cross-Breeding — complete all recipes ───────────────────────────────────


// ── 🌍 Social — Gifts Sent ────────────────────────────────────────────────────

const GIFT_MILESTONES: [number, number, string][] = [
  [1,  5,  "Generous Gardener"],
  [5,  10, "Gifting Regular"],
  [25, 15, "Gifting Guru"],
];
for (const [target, gems, name] of GIFT_MILESTONES) {
  achievements.push(ach(
    `gifts_sent_${target}`,
    name,
    `Send ${target} gift${target === 1 ? "" : "s"} to other gardeners.`,
    "🎁",
    "social",
    { kind: "stat", statKey: "gifts_sent" },
    target, gems,
  ));
}

// ── 🌍 Social — Friends ───────────────────────────────────────────────────────

const FRIENDS_MILESTONES: [number, number, string][] = [
  [1,  5,  "Making Friends"],
  [5,  10, "Social Gardener"],
  [10, 15, "Community Pillar"],
];
for (const [target, gems, name] of FRIENDS_MILESTONES) {
  achievements.push(ach(
    `friends_${target}`,
    name,
    `Have ${target} friend${target === 1 ? "" : "s"} in your friends list.`,
    "🤝",
    "social",
    { kind: "friends_count" },
    target, gems,
  ));
}

// ── ✨ Attunements Completed ──────────────────────────────────────────────────

const ATTUNEMENT_MILESTONES: [number, number, string][] = [
  [1,  5,  "First Attunement"],
  [10, 10, "Attuned"],
  [50, 15, "Attunement Master"],
];
for (const [target, gems, name] of ATTUNEMENT_MILESTONES) {
  achievements.push(ach(
    `attunements_${target}`,
    name,
    `Complete ${target} attunement${target === 1 ? "" : "s"}.`,
    "✨",
    "attunement",
    { kind: "stat", statKey: "attunements_completed" },
    target, gems,
  ));
}

// ── ⭐ Leveling ────────────────────────────────────────────────────────────────

const LEVEL_NAMES: Record<number, string> = {
  2:  "Seedling",
  3:  "Sprout",
  4:  "Tendril",
  5:  "Budding Gardener",
  6:  "Leaf & Stem",
  7:  "Flower Keeper",
  8:  "Petal Gatherer",
  9:  "Soil Sage",
  10: "Journeyman Gardener",
  11: "Root & Branch",
  12: "Fertile Grounds",
  13: "Green Hand",
  14: "Bloom Seeker",
  15: "Seasoned Gardener",
  16: "Garden Adept",
  17: "Verdant Scholar",
  18: "Petal Sage",
  19: "Garden Veteran",
  20: "Expert Gardener",
  21: "Nature's Devotee",
  22: "Bloom Artisan",
  23: "Garden Champion",
  24: "Flora Master",
  25: "Elite Gardener",
  26: "Garden Legend",
  27: "Transcendent Bloom",
  28: "Grand Botanist",
  29: "Exalted Gardener",
  30: "Grand Master Gardener",
};

for (let level = 2; level <= 30; level++) {
  const isMilestone = level % 5 === 0;
  const gems        = isMilestone ? 50 : 20;
  const emoji       = isMilestone ? "🌟" : "⭐";
  achievements.push(ach(
    `level_reached_${level}`,
    LEVEL_NAMES[level],
    `Reach gardener level ${level}.`,
    emoji,
    "leveling",
    { kind: "level_reached" },
    level,
    gems,
  ));
}

// ── Exports ────────────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = achievements;

export const ACHIEVEMENT_MAP: Record<string, Achievement> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** All stat keys that the achievement system tracks (for type safety at increment sites). */
export type AchievementStatKey =
  | "total_harvests"
  | `harvest_${FlowerType}`
  | "harvest_legendary" | "harvest_mythic" | "harvest_prismatic"
  | "seeds_planted"
  | "total_sacrifices"
  | `sacrifice_${FlowerType}`
  | "plants_bought"
  | "blooms_sold"
  | "marketplace_sales"
  | `crafted_${string}`
  | `placed_${string}`
  | `used_${string}`
  | "fertilizers_applied"
  | "pouches_opened"
  | "daily_sets_completed"
  | "gifts_sent"
  | "attunements_completed";
