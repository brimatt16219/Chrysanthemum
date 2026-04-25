export interface FarmUpgrade {
  rows: number;
  cols: number;
  cost: number;
  label: string;
  description: string;
}

// ── ADD NEW TIERS HERE ─────────────────────────────────────────────────────
export const FARM_UPGRADES: FarmUpgrade[] = [
  { rows: 3, cols: 3, cost: 0,         label: "Starter Plot",    description: "3×3 — where every garden begins."          },
  { rows: 4, cols: 4, cost: 1_000,     label: "Small Farm",      description: "4×4 — room to experiment."                 },
  { rows: 5, cols: 5, cost: 5_000,     label: "Garden",          description: "5×5 — a proper garden."                    },
  { rows: 6, cols: 6, cost: 25_000,    label: "Grand Estate",    description: "6×6 — the pinnacle of horticulture."        },
  { rows: 7, cols: 6, cost: 75_000,    label: "Sprawling Estate",description: "7×6 — the garden grows downward."          },
  { rows: 8, cols: 6, cost: 150_000,   label: "Manor Garden",    description: "8×6 — a garden fit for a manor."           },
  { rows: 9, cols: 6, cost: 300_000,   label: "Grand Manor",     description: "9×6 — an empire of flowers."               },
];
// ──────────────────────────────────────────────────────────────────────────

export const getNextUpgrade = (rows: number, cols: number): FarmUpgrade | null =>
  FARM_UPGRADES.find((u) => u.rows > rows || (u.rows === rows && u.cols > cols)) ?? null;

export const getCurrentTier = (rows: number, cols: number): FarmUpgrade =>
  [...FARM_UPGRADES].reverse().find((u) => u.rows <= rows && u.cols <= cols) ?? FARM_UPGRADES[0];

// ── Shop slot upgrades ─────────────────────────────────────────────────────

export const DEFAULT_SHOP_SLOTS = 4;
export const MAX_SHOP_SLOTS     = 10;

export interface ShopSlotUpgrade {
  slots: number; // total slots after this upgrade
  cost:  number;
}

export const SHOP_SLOT_UPGRADES: ShopSlotUpgrade[] = [
  { slots: 5,  cost: 500     },
  { slots: 6,  cost: 2_000   },
  { slots: 7,  cost: 8_000   },
  { slots: 8,  cost: 20_000  },
  { slots: 9,  cost: 50_000  },
  { slots: 10, cost: 100_000 },
];

export const getNextShopSlotUpgrade = (currentSlots: number): ShopSlotUpgrade | null =>
  SHOP_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;

export type FertilizerType = "basic" | "advanced" | "premium" | "elite" | "miracle";

export interface Fertilizer {
  id: FertilizerType;
  name: string;
  description: string;
  emoji: string;
  speedMultiplier: number;
  shopPrice: number;
  color: string;
  shopWeight: number;
}

export const FERTILIZERS: Record<FertilizerType, Fertilizer> = {
  basic:   { id: "basic",   name: "Basic Fertilizer",   description: "Speeds growth by 1.2×.", emoji: "🦴", speedMultiplier: 1.2, shopPrice: 25,   color: "text-gray-400",  shopWeight: 40 },
  advanced:{ id: "advanced",name: "Advanced Fertilizer",description: "Speeds growth by 1.5×.", emoji: "🥣", speedMultiplier: 1.5, shopPrice: 100,  color: "text-green-400", shopWeight: 25 },
  premium: { id: "premium", name: "Premium Fertilizer", description: "Speeds growth by 2×.", emoji: "🧪", speedMultiplier: 2, shopPrice: 400,  color: "text-blue-400",  shopWeight: 15 },
  elite:   { id: "elite",   name: "Elite Fertilizer",   description: "Speeds growth by 3.5×.", emoji: "⚗️", speedMultiplier: 3.5, shopPrice: 2500, color: "text-yellow-400", shopWeight: 5 },
  miracle: { id: "miracle", name: "Miracle Fertilizer", description: "Speeds growth by 5×.", emoji: "💫", speedMultiplier: 5, shopPrice: 10000, color: "text-pink-400", shopWeight: 2 },
};
