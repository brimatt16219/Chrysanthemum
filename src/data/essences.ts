import type { FlowerType } from "./flowers";
import type { Rarity } from "./flowers";

// ── Types ──────────────────────────────────────────────────────────────────

/** All 12 elemental types plus the crafted Universal Essence. */
export type EssenceType = FlowerType | "universal";

export interface EssenceItem {
  type: EssenceType;
  amount: number;
}

// ── Universal Essence ──────────────────────────────────────────────────────

export const UNIVERSAL_ESSENCE_TYPE = "universal" as const;

/** Ordered list of all 12 flower type essences (same as FLOWER_TYPES key order). */
export const ALL_FLOWER_TYPES: FlowerType[] = [
  "blaze", "tide", "grove", "frost", "storm", "lunar",
  "solar", "fairy", "shadow", "arcane", "stellar", "zephyr",
];

/** Cost in each flower-type essence per Universal Essence crafted. */
export const UNIVERSAL_ESSENCE_COST_PER_TYPE = 1;

/** Display config for Universal Essence — used wherever FLOWER_TYPES[type] would be used. */
export const UNIVERSAL_ESSENCE_DISPLAY = {
  emoji:       "✦",
  sprite:      "/sprites/types/universal.png",
  name:        "Universal",
  color:       "text-slate-200",
  bgColor:     "bg-slate-200/10",
  borderColor: "border-slate-200/25",
};

/**
 * How many Universal Essences the player can currently craft.
 * Equal to the minimum (have / cost) across all 12 elemental types.
 */
export function universalEssenceCraftable(essences: EssenceItem[]): number {
  const perType = ALL_FLOWER_TYPES.map((type) => {
    const have = essences.find((e) => e.type === type)?.amount ?? 0;
    return Math.floor(have / UNIVERSAL_ESSENCE_COST_PER_TYPE);
  });
  return perType.length === 0 ? 0 : Math.min(...perType);
}

// ── Yield table ────────────────────────────────────────────────────────────

/**
 * How many essence units a single flower of each rarity produces when sacrificed.
 * Units are then distributed among the flower's type(s) via independent rolls.
 */
export const ESSENCE_YIELD: Record<Rarity, number> = {
  common:    2,
  uncommon:  4,
  rare:      8,
  legendary: 16,
  mythic:    32,
  exalted:   64,
  prismatic: 128,
};

// ── Yield calculation (deterministic even-split for UI preview) ────────────

/**
 * Returns the expected essence yield for a batch sacrifice.
 * Uses a deterministic even split across the flower's types so the UI preview
 * is stable.  The edge function uses the same even-split for simplicity/fairness
 * (no hidden randomness on essence distribution).
 *
 * @param types   - The flower's type list (1–N items)
 * @param rarity  - The flower's rarity tier
 * @param quantity - Number of flowers being sacrificed
 */
export function calculateEssenceYield(
  types: EssenceType[],
  rarity: Rarity,
  quantity: number,
): EssenceItem[] {
  if (types.length === 0 || quantity === 0) return [];

  const yieldPer = ESSENCE_YIELD[rarity];
  const total    = yieldPer * quantity;

  // Even-split: spread total units across types as evenly as possible.
  // Remainder units go to the first N types.
  const perType   = Math.floor(total / types.length);
  const remainder = total % types.length;

  return types
    .map((type, i) => ({ type, amount: perType + (i < remainder ? 1 : 0) }))
    .filter((e) => e.amount > 0);
}

/**
 * Merges a list of new essence yields into an existing essences array.
 * Used both client-side (optimistic) and in utility tests.
 */
export function mergeEssences(
  current: EssenceItem[],
  additions: EssenceItem[],
): EssenceItem[] {
  const map = new Map<EssenceType, number>(
    current.map((e) => [e.type, e.amount])
  );
  for (const { type, amount } of additions) {
    map.set(type, (map.get(type) ?? 0) + amount);
  }
  return Array.from(map.entries())
    .map(([type, amount]) => ({ type, amount }))
    .filter((e) => e.amount > 0);
}
