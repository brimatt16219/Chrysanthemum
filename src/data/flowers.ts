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
  {
    id: "daisy",
    name: "Daisy",
    description: "A cheerful little flower. Great for beginners.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌼" },
    rarity: "common",
    growthTime: { seed: 60_000, sprout: 120_000 },
    sellValue: 5,
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
    sellValue: 8,
    shopWeight: 50,
    possibleMutations: ["golden", "giant", "scorched"],
  },
  {
    id: "tulip",
    name: "Tulip",
    description: "Elegant and colorful. A garden classic.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌷" },
    rarity: "uncommon",
    growthTime: { seed: 180_000, sprout: 360_000 },
    sellValue: 20,
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
    sellValue: 30,
    shopWeight: 25,
    possibleMutations: ["golden", "rainbow", "moonlit"],
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Calming scent. Rare and sought after.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "💜" },
    rarity: "rare",
    growthTime: { seed: 600_000, sprout: 1_200_000 },
    sellValue: 100,
    shopWeight: 10,
    possibleMutations: ["moonlit", "frozen", "rainbow"],
  },
  {
    id: "orchid",
    name: "Orchid",
    description: "Exotic and delicate. Very hard to find.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🪷" },
    rarity: "rare",
    growthTime: { seed: 900_000, sprout: 1_800_000 },
    sellValue: 175,
    shopWeight: 6,
    possibleMutations: ["golden", "moonlit", "rainbow"],
  },
  {
    id: "lotus",
    name: "Lotus",
    description: "Ancient and mystical. Blooms only for the devoted.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🏵️" },
    rarity: "legendary",
    growthTime: { seed: 3_600_000, sprout: 7_200_000 },
    sellValue: 1000,
    shopWeight: 1,
    possibleMutations: ["golden", "rainbow", "moonlit"],
  },
  {
    id: "moonflower",
    name: "Moonflower",
    description: "Blooms only under moonlight. Almost no one has seen one.",
    emoji: { seed: "🌱", sprout: "🌿", bloom: "🌸" },
    rarity: "mythic",
    growthTime: { seed: 14_400_000, sprout: 28_800_000 },
    sellValue: 5000,
    shopWeight: 0,
    possibleMutations: ["golden", "rainbow", "moonlit", "frozen"],
  },
];
// ──────────────────────────────────────────────────────────────────────────

export const getFlower = (id: string): FlowerSpecies | undefined =>
  FLOWERS.find((f) => f.id === id);

export const RARITY_CONFIG: Record<Rarity, { label: string; color: string; glow: string }> = {
  common:    { label: "Common",    color: "text-gray-400",   glow: "" },
  uncommon:  { label: "Uncommon",  color: "text-green-400",  glow: "shadow-[0_0_8px_rgba(74,222,128,0.4)]" },
  rare:      { label: "Rare",      color: "text-blue-400",   glow: "shadow-[0_0_8px_rgba(96,165,250,0.5)]" },
  legendary: { label: "Legendary", color: "text-yellow-400", glow: "shadow-[0_0_12px_rgba(250,204,21,0.6)]" },
  mythic:    { label: "Mythic",    color: "text-pink-400",   glow: "shadow-[0_0_16px_rgba(244,114,182,0.7)]" },
};
