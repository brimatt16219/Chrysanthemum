import { useCallback } from "react";
import { useGame } from "../store/GameContext";
import type { DailyTaskType } from "../lib/dailySeed";

/**
 * Returns `trackProgress(taskType, count?)` — call it after any action that
 * maps to a daily task. Increments progress locally only. The user must click
 * "Claim" in DailyTasksPanel to submit the completion to the server and
 * receive the reward.
 */
export function useDailyProgress() {
  const { update, getState } = useGame();

  const trackProgress = useCallback((taskType: DailyTaskType, count = 1) => {
    const dailyTasks = getState().dailyTasks;
    if (!dailyTasks) return;

    const taskIdx = dailyTasks.tasks.findIndex((t) => t.type === taskType);
    if (taskIdx < 0) return;

    const task = dailyTasks.tasks[taskIdx];
    if (task.completed) return; // already claimed

    const newProgress = Math.min(task.target, task.progress + count);
    if (newProgress === task.progress) return; // no change

    const newTasks    = [...dailyTasks.tasks];
    newTasks[taskIdx] = { ...task, progress: newProgress };
    update({ ...getState(), dailyTasks: { ...dailyTasks, tasks: newTasks } });
  }, [getState, update]);

  return { trackProgress };
}
