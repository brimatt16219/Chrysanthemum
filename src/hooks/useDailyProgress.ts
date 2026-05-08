import { useCallback } from "react";
import { useGame } from "../store/GameContext";
import { edgeDailyComplete } from "../lib/edgeFunctions";
import type { DailyTaskType } from "../lib/dailySeed";

/**
 * Returns `trackProgress(taskType, count?)` — call it after any action that
 * maps to a daily task. Increments progress locally, and if the task reaches
 * its target, calls the server to mark it complete and deliver the reward.
 * `count` defaults to 1; pass a higher value for bulk actions (e.g. harvest-all).
 */
export function useDailyProgress() {
  const { update, getState, pushGenericToast } = useGame();

  const trackProgress = useCallback(async (taskType: DailyTaskType, count = 1) => {
    const dailyTasks = getState().dailyTasks;
    if (!dailyTasks) return;

    const taskIdx = dailyTasks.tasks.findIndex((t) => t.type === taskType);
    if (taskIdx < 0) return;

    const task = dailyTasks.tasks[taskIdx];
    if (task.completed) return;

    const newProgress = Math.min(task.target, task.progress + count);
    const nowComplete = newProgress >= task.target;

    // ── Optimistic progress update ────────────────────────────────────────
    const newTasks    = [...dailyTasks.tasks];
    newTasks[taskIdx] = { ...task, progress: newProgress, completed: nowComplete };
    update({ ...getState(), dailyTasks: { ...dailyTasks, tasks: newTasks } });

    if (!nowComplete) return;

    // ── Task complete — tell the server, claim reward ─────────────────────
    try {
      const result = await edgeDailyComplete(taskType);
      const cur    = getState();
      update({
        ...cur,
        dailyTasks:      result.dailyTasks,
        consumables:     result.consumables     ?? cur.consumables,
        gardenerLevel:   result.gardenerLevel   ?? cur.gardenerLevel,
        gardenerXp:      result.gardenerXp      ?? cur.gardenerXp,
        serverUpdatedAt: result.serverUpdatedAt,
      });

      if (result.rewardPouch) {
        const tier = result.dailyTasks.rewardsCollected.filter(Boolean).length;
        pushGenericToast(
          `daily_reward_${tier}`,
          "🎁",
          `Daily reward! +${result.xpGained} XP`,
          undefined,
          "gain",
        );
      }
    } catch {
      // Server rejected — roll back the optimistic completion
      const cur    = getState();
      const rolled = [...cur.dailyTasks!.tasks];
      rolled[taskIdx] = { ...rolled[taskIdx], progress: task.progress, completed: false };
      update({ ...cur, dailyTasks: { ...cur.dailyTasks!, tasks: rolled } });
    }
  }, [getState, update, pushGenericToast]);

  return { trackProgress };
}
