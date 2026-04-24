export interface FarmUpgrade {
  size: number;
  cost: number;
  label: string;
  description: string;
  shopSlots: number; // number of flower slots in the shop at this tier
}

// ── ADD NEW TIERS HERE ─────────────────────────────────────────────────────
export const FARM_UPGRADES: FarmUpgrade[] = [
  { size: 3, cost: 0,       label: "Starter Plot",  description: "3×3 — where every garden begins.",      shopSlots: 4 },
  { size: 4, cost: 1000,     label: "Small Farm",    description: "4×4 — room to experiment.",             shopSlots: 6 },
  { size: 5, cost: 5_000,   label: "Garden",        description: "5×5 — a proper garden.",                shopSlots: 7 },
  { size: 6, cost: 25_000,  label: "Grand Estate",  description: "6×6 — the pinnacle of horticulture.",   shopSlots: 8 },
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
  basic:   { id: "basic",   name: "Basic Fertilizer",   description: "Speeds growth by 2×.",  emoji: "🌿", speedMultiplier: 2.0,  shopPrice: 50,  color: "text-green-400"  },
  premium: { id: "premium", name: "Premium Fertilizer", description: "Speeds growth by 5×.",  emoji: "⚗️", speedMultiplier: 5.0,  shopPrice: 250, color: "text-blue-400"   },
  miracle: { id: "miracle", name: "Miracle Fertilizer", description: "Speeds growth by 10×.", emoji: "💫", speedMultiplier: 10.0, shopPrice: 1000, color: "text-yellow-400" },
};
