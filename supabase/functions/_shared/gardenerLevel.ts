// Shared by all edge functions that grant gardener XP.
// Keep in sync with src/data/gardenerLevel.ts.

export const MAX_GARDENER_LEVEL      = 30;
export const XP_BASE                 = 100;
export const XP_GROWTH               = 1.5;
export const SELL_XP_PERCENT         = 0.10;
export const MUTATION_DISCOVERY_BONUS = 0.25;

export const DISCOVERY_XP_BY_RARITY: Record<string, number> = {
  common:    25,
  uncommon:  50,
  rare:      100,
  legendary: 250,
  mythic:    500,
  exalted:   1000,
  prismatic: 2500,
};

export function xpForLevel(level: number): number {
  if (level >= MAX_GARDENER_LEVEL) return 0;
  return Math.floor(XP_BASE * XP_GROWTH ** (level - 1));
}

export function cumulativeXpForLevel(level: number): number {
  let sum = 0;
  for (let i = 1; i < level; i++) {
    sum += xpForLevel(i);
  }
  return sum;
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (level < MAX_GARDENER_LEVEL && totalXp >= cumulativeXpForLevel(level + 1)) {
    level++;
  }
  return level;
}

export function awardXp(
  currentLevel: number,
  currentXp: number,
  amount: number,
): { level: number; xp: number; leveledUp: boolean; levelsGained: number } {
  const cap      = cumulativeXpForLevel(MAX_GARDENER_LEVEL);
  const newXp    = Math.min(currentXp + amount, cap);
  const newLevel = levelFromXp(newXp);
  return {
    xp:           newXp,
    level:        newLevel,
    leveledUp:    newLevel > currentLevel,
    levelsGained: newLevel - currentLevel,
  };
}
