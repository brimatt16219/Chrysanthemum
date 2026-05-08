import { useCallback } from "react";
import { useGame } from "../store/GameContext";
import type { AchievementStatKey } from "../data/achievements";

/**
 * Returns `incrementStat(key, count?)` — call it after any action that maps
 * to an achievement stat. Increments the counter locally; the updated
 * `achievementStats` object is persisted on the next `saveToCloud` cycle.
 * `count` defaults to 1; pass a higher value for bulk actions.
 */
export function useAchievementStats() {
  const { update, getState } = useGame();

  const incrementStat = useCallback((key: AchievementStatKey, count = 1) => {
    const cur  = getState();
    const prev = cur.achievementStats[key] ?? 0;
    update({ ...cur, achievementStats: { ...cur.achievementStats, [key]: prev + count } });
  }, [update, getState]);

  return { incrementStat };
}
