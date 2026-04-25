import type { Rarity } from "./flowers";

// ── How many completed flowers of each rarity are required for a conversion ─
// Edit these values to balance the system
export const BOTANY_REQUIREMENTS: Partial<Record<Rarity, number>> = {
  common:    5,
  uncommon:  5,
  rare:      5,
  legendary: 5,
  mythic:    5,
};

// Conversion chain — exalted is terminal (cannot be converted)
export const BOTANY_RARITY_ORDER: Rarity[] = [
  "common", "uncommon", "rare", "legendary", "mythic",
];

export const NEXT_RARITY: Partial<Record<Rarity, Rarity>> = {
  common:    "uncommon",
  uncommon:  "rare",
  rare:      "legendary",
  legendary: "mythic",
  mythic:    "exalted",
};
