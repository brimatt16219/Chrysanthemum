export interface FarmUpgrade {
  size: number;   // grid is size × size
  cost: number;   // coins to unlock
  label: string;
  description: string;
}

// ── ADD NEW TIERS HERE ─────────────────────────────────────────────────────
export const FARM_UPGRADES: FarmUpgrade[] = [
  { size: 3, cost: 0,      label: "Starter Plot",  description: "3×3 — where every garden begins." },
  { size: 4, cost: 150,    label: "Small Farm",    description: "4×4 — room to experiment." },
  { size: 5, cost: 600,    label: "Garden",        description: "5×5 — a proper garden." },
  { size: 6, cost: 2_500,  label: "Large Garden",  description: "6×6 — serious growing space." },
  { size: 7, cost: 10_000, label: "Grand Estate",  description: "7×7 — the pinnacle of horticulture." },
];
// ──────────────────────────────────────────────────────────────────────────

// Returns the upgrade the player can buy next, or null if maxed out
export const getNextUpgrade = (currentSize: number): FarmUpgrade | null =>
  FARM_UPGRADES.find((u) => u.size > currentSize) ?? null;

// Returns the current tier object for a given size
export const getCurrentTier = (currentSize: number): FarmUpgrade =>
  [...FARM_UPGRADES].reverse().find((u) => u.size <= currentSize) ?? FARM_UPGRADES[0];