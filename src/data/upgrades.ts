export interface FarmUpgrade {
  size: number;
  cost: number;
  label: string;
  description: string;
}

// ── ADD NEW TIERS HERE ─────────────────────────────────────────────────────
export const FARM_UPGRADES: FarmUpgrade[] = [
  { size: 3, cost: 0,      label: "Starter Plot",  description: "3×3 — where every garden begins."       },
  { size: 4, cost: 150,    label: "Small Farm",    description: "4×4 — room to experiment."              },
  { size: 5, cost: 600,    label: "Garden",        description: "5×5 — a proper garden."                 },
  { size: 6, cost: 2_500,  label: "Large Garden",  description: "6×6 — serious growing space."           },
  { size: 7, cost: 10_000, label: "Grand Estate",  description: "7×7 — the pinnacle of horticulture."    },
];
// ──────────────────────────────────────────────────────────────────────────

export const getNextUpgrade = (currentSize: number): FarmUpgrade | null =>
  FARM_UPGRADES.find((u) => u.size > currentSize) ?? null;

export const getCurrentTier = (currentSize: number): FarmUpgrade =>
  [...FARM_UPGRADES].reverse().find((u) => u.size <= currentSize) ?? FARM_UPGRADES[0];

export type FertilizerType = "basic" | "premium" | "miracle";

export interface Fertilizer {
  id: FertilizerType;
  name: string;
  description: string;
  emoji: string;
  speedMultiplier: number;
  shopPrice: number;
  color: string;
}

export const FERTILIZERS: Record<FertilizerType, Fertilizer> = {
  basic:   { id: "basic",   name: "Basic Fertilizer",   description: "Speeds growth by 2×.",  emoji: "🌿", speedMultiplier: 2.0,  shopPrice: 25,  color: "text-green-400"  },
  premium: { id: "premium", name: "Premium Fertilizer", description: "Speeds growth by 5×.",  emoji: "⚗️", speedMultiplier: 5.0,  shopPrice: 100, color: "text-blue-400"   },
  miracle: { id: "miracle", name: "Miracle Fertilizer", description: "Speeds growth by 10×.", emoji: "💫", speedMultiplier: 10.0, shopPrice: 400, color: "text-yellow-400" },
};
