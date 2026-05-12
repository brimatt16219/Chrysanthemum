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
  { rows: 6, cols: 6, cost: 30_000,    label: "Grand Estate",    description: "6×6 — the pinnacle of horticulture."        },
  { rows: 7, cols: 6, cost: 100_000,    label: "Sprawling Estate",description: "7×6 — the garden grows downward."          },
  { rows: 8, cols: 6, cost: 350_000,   label: "Manor Garden",    description: "8×6 — a garden fit for a manor."           },
  { rows: 9, cols: 6, cost: 750_000,   label: "Grand Manor",     description: "9×6 — an empire of flowers."               },
];
// ──────────────────────────────────────────────────────────────────────────

export const getNextUpgrade = (rows: number, cols: number): FarmUpgrade | null =>
  FARM_UPGRADES.find((u) => u.rows > rows || (u.rows === rows && u.cols > cols)) ?? null;

export const getCurrentTier = (rows: number, cols: number): FarmUpgrade =>
  [...FARM_UPGRADES].reverse().find((u) => u.rows <= rows && u.cols <= cols) ?? FARM_UPGRADES[0];

// ── Shop slot upgrades ─────────────────────────────────────────────────────

export const DEFAULT_SHOP_SLOTS = 4;
export const MAX_SHOP_SLOTS     = 12;

export interface ShopSlotUpgrade {
  slots: number; // total slots after this upgrade
  cost:  number;
}

export const SHOP_SLOT_UPGRADES: ShopSlotUpgrade[] = [
  { slots: 5,  cost: 500     },
  { slots: 6,  cost: 3_000   },
  { slots: 7,  cost: 8_000   },
  { slots: 8,  cost: 25_000  },
  { slots: 9,  cost: 75_000  },
  { slots: 10, cost: 200_000 },
  { slots: 11, cost: 450_000 },
  { slots: 12, cost: 750_000 },
];

export const getNextShopSlotUpgrade = (currentSlots: number): ShopSlotUpgrade | null =>
  SHOP_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;

export type FertilizerType = "basic" | "advanced" | "premium" | "elite" | "miracle";

export interface Fertilizer {
  id: FertilizerType;
  name: string;
  description: string;
  emoji: string;
  sprite?: string;
  speedMultiplier: number;
  shopPrice: number;
  /** Mirrors the supply pool tier this fertilizer drops in.
   *  basic=common, advanced=uncommon, premium=rare, elite=legendary, miracle=mythic. */
  rarity: import("./flowers").Rarity;
  color: string;
  /** Tailwind border + shadow class applied to the shop card border, e.g. "border-green-400/40 shadow-[0_0_12px_rgba(74,222,128,0.15)]" */
  cardBorder: string;
  shopWeight: number;
}

// ── Supply shop slot upgrades ─────────────────────────────────────────────

export const DEFAULT_SUPPLY_SLOTS = 2;
export const MAX_SUPPLY_SLOTS     = 8;

export interface SupplySlotUpgrade {
  slots: number; // total slots after this upgrade
  cost:  number;
}

export const SUPPLY_SLOT_UPGRADES: SupplySlotUpgrade[] = [
  { slots: 3, cost: 15_000  }, // unlocks Legendary tier
  { slots: 4, cost: 50_000  }, // unlocks Mythic tier
  { slots: 5, cost: 150_000 }, // unlocks Exalted tier
  { slots: 6, cost: 350_000 }, // unlocks Prismatic tier
  { slots: 7, cost: 800_000 },
  { slots: 8, cost: 2_000_000 },
];

export const getNextSupplySlotUpgrade = (currentSlots: number): SupplySlotUpgrade | null =>
  SUPPLY_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;

// ── Marketplace slot upgrades ──────────────────────────────────────────────

export const MAX_MARKETPLACE_SLOTS = 5;

export interface MarketplaceSlotUpgrade {
  slots: number; // total slots after this upgrade
  cost:  number;
}

export const MARKETPLACE_SLOT_UPGRADES: MarketplaceSlotUpgrade[] = [
  { slots: 1, cost: 10_000  },
  { slots: 2, cost: 50_000  },
  { slots: 3, cost: 150_000 },
  { slots: 4, cost: 350_000 },
  { slots: 5, cost: 650_000 },
];

export const getNextMarketplaceSlotUpgrade = (currentSlots: number): MarketplaceSlotUpgrade | null =>
  MARKETPLACE_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;

// ── Fertilizers ───────────────────────────────────────────────────────────

export const FERTILIZERS: Record<FertilizerType, Fertilizer> = {
  basic:   { id: "basic",   name: "Basic Fertilizer",   description: "Speeds growth by 1.1×.", emoji: "🦴", sprite: "/sprites/fertilizers/basic.png",    speedMultiplier: 1.1,  shopPrice: 30,     rarity: "common",    color: "text-gray-400",   cardBorder: "border-gray-400/30",   shopWeight: 40 },
  advanced:{ id: "advanced",name: "Advanced Fertilizer",description: "Speeds growth by 1.25×.",emoji: "🥣", sprite: "/sprites/fertilizers/advanced.png", speedMultiplier: 1.25, shopPrice: 500,    rarity: "uncommon",  color: "text-green-400",  cardBorder: "border-green-400/40",  shopWeight: 25 },
  premium: { id: "premium", name: "Premium Fertilizer", description: "Speeds growth by 1.5×.", emoji: "🧪", sprite: "/sprites/fertilizers/premium.png",  speedMultiplier: 1.5,  shopPrice: 800,    rarity: "rare",      color: "text-blue-400",   cardBorder: "border-blue-400/40",   shopWeight: 15 },
  elite:   { id: "elite",   name: "Elite Fertilizer",   description: "Speeds growth by 1.75×.",emoji: "⚗️", sprite: "/sprites/fertilizers/elite.png",    speedMultiplier: 1.75, shopPrice: 10_000, rarity: "legendary", color: "text-yellow-400", cardBorder: "border-yellow-400/40", shopWeight: 5  },
  miracle: { id: "miracle", name: "Miracle Fertilizer", description: "Speeds growth by 2×.",   emoji: "💫", sprite: "/sprites/fertilizers/miracle.png",  speedMultiplier: 2,    shopPrice: 85_000, rarity: "mythic",    color: "text-pink-400",   cardBorder: "border-pink-400/40",   shopWeight: 2  },
};
