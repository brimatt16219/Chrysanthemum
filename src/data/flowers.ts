export type Rarity = "common" | "uncommon" | "rare" | "legendary" | "mythic";

export type GrowthStage = "seed" | "sprout" | "bloom";

export type MutationType =
  | "golden"
  | "rainbow"
  | "giant"
  | "moonlit"
  | "frozen"
  | "scorched";

export interface Mutation {
  id: MutationType;
  name: string;
  emoji: string;
  description: string;
  valueMultiplier: number;
  chance: number;
  color: string;
}

export const MUTATIONS: Record<MutationType, Mutation> = {
  golden:   { id: "golden",   name: "Golden",   emoji: "✨", description: "Shimmers with golden light.",       valueMultiplier: 3.0, chance: 0.05, color: "text-yellow-400" },
  rainbow:  { id: "rainbow",  name: "Rainbow",  emoji: "🌈", description: "Every color at once.",              valueMultiplier: 2.5, chance: 0.06, color: "text-pink-400"   },
  giant:    { id: "giant",    name: "Giant",    emoji: "⬆️", description: "Twice the size of a normal bloom.", valueMultiplier: 2.0, chance: 0.08, color: "text-green-400"  },
  moonlit:  { id: "moonlit",  name: "Moonlit",  emoji: "🌙", description: "Glows faintly in the dark.",        valueMultiplier: 2.0, chance: 0.07, color: "text-blue-300"   },
  frozen:   { id: "frozen",   name: "Frozen",   emoji: "❄️", description: "Crystallized mid-bloom.",           valueMultiplier: 1.5, chance: 0.10, color: "text-cyan-400"   },
  scorched: { id: "scorched", name: "Scorched", emoji: "🔥", description: "Survived extreme heat.",            valueMultiplier: 1.5, chance: 0.10, color: "text-orange-400" },
};

export interface FlowerSpecies {
  id: string;
  name: string;
  description: string;
  emoji: Record<GrowthStage, string>;
  rarity: Rarity;
  growthTime: {
    seed: number;
    sprout: number;
  };
  sellValue: number;
  shopWeight: number;
  possibleMutations: MutationType[];
}

// ── ADD NEW FLOWERS HERE ───────────────────────────────────────────────────
export const FLOWERS: FlowerSpecies[] = [

  // ── COMMON ──────────────────────────────────────────────────────────────
  {
    id: "daisy",
    name: "Daisy",
    description: "A cheerful little flower. Great for beginners.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌼" },
    rarity: "common",
    growthTime: { seed: 60_000, sprout: 120_000 },
    sellValue: 15,
    shopWeight: 60,
    possibleMutations: ["giant", "frozen", "scorched"],
  },
  {
    id: "sunflower",
    name: "Sunflower",
    description: "Tall and bright. Turns toward the sun.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌻" },
    rarity: "common",
    growthTime: { seed: 90_000, sprout: 180_000 },
    sellValue: 25,
    shopWeight: 50,
    possibleMutations: ["golden", "giant", "scorched"],
  },
  {
    id: "poppy",
    name: "Poppy",
    description: "Vivid red petals that catch every breeze.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌺" },
    rarity: "common",
    growthTime: { seed: 75_000, sprout: 150_000 },
    sellValue: 18,
    shopWeight: 55,
    possibleMutations: ["scorched", "giant"],
  },
  {
    id: "dandelion",
    name: "Dandelion",
    description: "Grows anywhere. Makes a wish when it blooms.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌾" },
    rarity: "common",
    growthTime: { seed: 45_000, sprout: 90_000 },
    sellValue: 10,
    shopWeight: 65,
    possibleMutations: ["giant", "frozen"],
  },
  {
    id: "marigold",
    name: "Marigold",
    description: "Bright orange blooms that ward off pests.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🏵️" },
    rarity: "common",
    growthTime: { seed: 80_000, sprout: 160_000 },
    sellValue: 20,
    shopWeight: 52,
    possibleMutations: ["golden", "scorched"],
  },
  {
    id: "buttercup",
    name: "Buttercup",
    description: "Tiny golden cups that dot meadows in spring.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "💛" },
    rarity: "common",
    growthTime: { seed: 70_000, sprout: 140_000 },
    sellValue: 16,
    shopWeight: 54,
    possibleMutations: ["golden", "giant"],
  },
  {
    id: "clover",
    name: "Clover",
    description: "Three leaves bring luck. Four bring fortune.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🍀" },
    rarity: "common",
    growthTime: { seed: 55_000, sprout: 110_000 },
    sellValue: 12,
    shopWeight: 58,
    possibleMutations: ["giant", "frozen"],
  },

  // ── UNCOMMON ────────────────────────────────────────────────────────────
  {
    id: "tulip",
    name: "Tulip",
    description: "Elegant and colorful. A garden classic.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌷" },
    rarity: "uncommon",
    growthTime: { seed: 180_000, sprout: 360_000 },
    sellValue: 60,
    shopWeight: 30,
    possibleMutations: ["rainbow", "frozen", "giant"],
  },
  {
    id: "rose",
    name: "Rose",
    description: "Timeless beauty, but takes patience.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌹" },
    rarity: "uncommon",
    growthTime: { seed: 240_000, sprout: 480_000 },
    sellValue: 90,
    shopWeight: 25,
    possibleMutations: ["golden", "rainbow", "moonlit"],
  },
  {
    id: "eggplant",
    name: "Eggplant",
    description: "A quirky vegetable flower. Edible when harvested.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🍆" },
    rarity: "uncommon",
    growthTime: { seed: 200_000, sprout: 400_000 },
    sellValue: 70,
    shopWeight: 28,
    possibleMutations: ["moonlit", "rainbow"],
  },
  {
    id: "carnation",
    name: "Carnation",
    description: "Ruffled petals in shades of pink and white.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "💐" },
    rarity: "uncommon",
    growthTime: { seed: 210_000, sprout: 420_000 },
    sellValue: 75,
    shopWeight: 27,
    possibleMutations: ["rainbow", "frozen"],
  },
  {
    id: "hibiscus",
    name: "Hibiscus",
    description: "Tropical blooms as wide as your hand.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🍁" },
    rarity: "uncommon",
    growthTime: { seed: 220_000, sprout: 440_000 },
    sellValue: 80,
    shopWeight: 26,
    possibleMutations: ["scorched", "rainbow"],
  },
  {
    id: "snapdragon",
    name: "Snapdragon",
    description: "Opens and closes like a tiny dragon's mouth.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🐉" },
    rarity: "uncommon",
    growthTime: { seed: 190_000, sprout: 380_000 },
    sellValue: 65,
    shopWeight: 29,
    possibleMutations: ["scorched", "golden"],
  },
  {
    id: "bluebell",
    name: "Bluebell",
    description: "Carpets forest floors in spring blue.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🔔" },
    rarity: "uncommon",
    growthTime: { seed: 230_000, sprout: 460_000 },
    sellValue: 85,
    shopWeight: 24,
    possibleMutations: ["frozen", "moonlit"],
  },

  // ── RARE ────────────────────────────────────────────────────────────────
  {
    id: "lavender",
    name: "Lavender",
    description: "Calming scent. Rare and sought after.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "💜" },
    rarity: "rare",
    growthTime: { seed: 600_000, sprout: 1_200_000 },
    sellValue: 300,
    shopWeight: 10,
    possibleMutations: ["moonlit", "frozen", "rainbow"],
  },
  {
    id: "orchid",
    name: "Orchid",
    description: "Exotic and delicate. Very hard to find.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌸" },
    rarity: "rare",
    growthTime: { seed: 900_000, sprout: 1_800_000 },
    sellValue: 500,
    shopWeight: 6,
    possibleMutations: ["golden", "moonlit", "rainbow"],
  },
  {
    id: "peony",
    name: "Peony",
    description: "Lush, layered blooms that take years to perfect.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "💮" },
    rarity: "rare",
    growthTime: { seed: 720_000, sprout: 1_440_000 },
    sellValue: 380,
    shopWeight: 8,
    possibleMutations: ["rainbow", "golden"],
  },
  {
    id: "bird_of_paradise",
    name: "Bird of Paradise",
    description: "Resembles a tropical bird mid-flight.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🦜" },
    rarity: "rare",
    growthTime: { seed: 840_000, sprout: 1_680_000 },
    sellValue: 450,
    shopWeight: 7,
    possibleMutations: ["golden", "scorched"],
  },
  {
    id: "wisteria",
    name: "Wisteria",
    description: "Cascading purple clusters that perfume the air.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🍇" },
    rarity: "rare",
    growthTime: { seed: 780_000, sprout: 1_560_000 },
    sellValue: 420,
    shopWeight: 7,
    possibleMutations: ["moonlit", "rainbow"],
  },
  {
    id: "foxglove",
    name: "Foxglove",
    description: "Tall spires of spotted bells. Hauntingly beautiful.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🥀" },
    rarity: "rare",
    growthTime: { seed: 660_000, sprout: 1_320_000 },
    sellValue: 340,
    shopWeight: 9,
    possibleMutations: ["moonlit", "frozen"],
  },
  {
    id: "passionflower",
    name: "Passionflower",
    description: "Intricate alien geometry disguised as a bloom.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌀" },
    rarity: "rare",
    growthTime: { seed: 960_000, sprout: 1_920_000 },
    sellValue: 550,
    shopWeight: 5,
    possibleMutations: ["rainbow", "moonlit", "golden"],
  },

  // ── LEGENDARY ───────────────────────────────────────────────────────────
  {
    id: "lotus",
    name: "Lotus",
    description: "Ancient and mystical. Blooms only for the devoted.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🏵️" },
    rarity: "legendary",
    growthTime: { seed: 3_600_000, sprout: 7_200_000 },
    sellValue: 3_000,
    shopWeight: 3,
    possibleMutations: ["golden", "rainbow", "moonlit"],
  },
  {
    id: "black_rose",
    name: "Black Rose",
    description: "A rose so deep red it appears black. Coveted by collectors.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🖤" },
    rarity: "legendary",
    growthTime: { seed: 4_200_000, sprout: 8_400_000 },
    sellValue: 4_000,
    shopWeight: 3,
    possibleMutations: ["moonlit", "golden"],
  },
  {
    id: "ghost_orchid",
    name: "Ghost Orchid",
    description: "Floats rootless in the dark. Rarely seen by human eyes.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "👻" },
    rarity: "legendary",
    growthTime: { seed: 3_900_000, sprout: 7_800_000 },
    sellValue: 3_500,
    shopWeight: 2,
    possibleMutations: ["frozen", "moonlit", "rainbow"],
  },
  {
    id: "fire_lily",
    name: "Fire Lily",
    description: "Blooms erupt from the soil like small flames.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🔥" },
    rarity: "legendary",
    growthTime: { seed: 4_500_000, sprout: 9_000_000 },
    sellValue: 5_000,
    shopWeight: 2,
    possibleMutations: ["scorched", "golden"],
  },
  {
    id: "ice_crown",
    name: "Ice Crown",
    description: "Crystalline petals that never melt. Found only in the coldest gardens.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "❄️" },
    rarity: "legendary",
    growthTime: { seed: 4_800_000, sprout: 9_600_000 },
    sellValue: 6_000,
    shopWeight: 2,
    possibleMutations: ["frozen", "moonlit"],
  },

  // ── MYTHIC ──────────────────────────────────────────────────────────────
  {
    id: "moonflower",
    name: "Moonflower",
    description: "Blooms only under moonlight. Almost no one has seen one.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🎑" },
    rarity: "mythic",
    growthTime: { seed: 14_400_000, sprout: 28_800_000 },
    sellValue: 15_000,
    shopWeight: 1,
    possibleMutations: ["golden", "rainbow", "moonlit", "frozen"],
  },
  {
    id: "celestial_bloom",
    name: "Celestial Bloom",
    description: "Said to have fallen from the night sky. Hums faintly.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "⭐" },
    rarity: "mythic",
    growthTime: { seed: 18_000_000, sprout: 36_000_000 },
    sellValue: 25_000,
    shopWeight: 1,
    possibleMutations: ["golden", "moonlit", "rainbow"],
  },
  {
    id: "void_blossom",
    name: "Void Blossom",
    description: "Absorbs light around it. Its origin is unknown.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌑" },
    rarity: "mythic",
    growthTime: { seed: 21_600_000, sprout: 43_200_000 },
    sellValue: 40_000,
    shopWeight: 1,
    possibleMutations: ["moonlit", "frozen", "golden"],
  },
  {
    id: "solar_rose",
    name: "Solar Rose",
    description: "Burns so bright you need to look away. Worth the wait.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "☀️" },
    rarity: "mythic",
    growthTime: { seed: 28_800_000, sprout: 57_600_000 },
    sellValue: 75_000,
    shopWeight: 1,
    possibleMutations: ["golden", "scorched", "rainbow"],
  },
];
// ──────────────────────────────────────────────────────────────────────────

export const getFlower = (id: string): FlowerSpecies | undefined =>
  FLOWERS.find((f) => f.id === id);

export const RARITY_CONFIG: Record<Rarity, { label: string; color: string; glow: string }> = {
  common:    { label: "Common",    color: "text-gray-400",   glow: "" },
  uncommon:  { label: "Uncommon",  color: "text-green-400",  glow: "shadow-[0_0_8px_rgba(74,222,128,0.4)]"  },
  rare:      { label: "Rare",      color: "text-blue-400",   glow: "shadow-[0_0_8px_rgba(96,165,250,0.5)]"  },
  legendary: { label: "Legendary", color: "text-yellow-400", glow: "shadow-[0_0_12px_rgba(250,204,21,0.6)]" },
  mythic:    { label: "Mythic",    color: "text-pink-400",   glow: "shadow-[0_0_16px_rgba(244,114,182,0.7)]"},
};
