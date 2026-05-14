import { useState } from "react";
import { useGame } from "../store/GameContext";
import { TASKS_REQUIRED, type DailyTaskType } from "../lib/dailySeed";
import { edgeDailyComplete } from "../lib/edgeFunctions";
import { useAchievementStats } from "../hooks/useAchievementStats";
import { ItemSprite } from "./ItemSprite";

// ── Task display metadata ─────────────────────────────────────────────────────

const TASK_EMOJI: Record<DailyTaskType, string> = {
  harvest:           "🌸",
  marketplace_buy:   "🛒",
  marketplace_list:  "🏷️",
  send_gift:         "🎁",
  shop_buy:          "🌱",
  apply_fertilizer:  "💧",
  alchemy_sacrifice: "⚗️",
};

const TASK_SPRITE: Record<DailyTaskType, string> = {
  harvest:           "/sprites/ui/task_harvest.png",
  marketplace_buy:   "/sprites/ui/task_buy.png",
  marketplace_list:  "/sprites/ui/task_list.png",
  send_gift:         "/sprites/ui/task_gift.png",
  shop_buy:          "/sprites/ui/task_shop.png",
  apply_fertilizer:  "/sprites/ui/task_fertilizer.png",
  alchemy_sacrifice: "/sprites/ui/task_sacrifice.png",
};

function taskLabel(type: DailyTaskType, target: number): string {
  switch (type) {
    case "harvest":           return `Harvest ${target} flower${target === 1 ? "" : "s"}`;
    case "marketplace_buy":   return "Buy from the marketplace";
    case "marketplace_list":  return "List an item on the marketplace";
    case "send_gift":         return "Send a gift to a friend";
    case "shop_buy":          return "Buy a seed from the shop";
    case "apply_fertilizer":  return "Apply a fertilizer";
    case "alchemy_sacrifice": return "Sacrifice a flower in alchemy";
  }
}

// ── Reward tier definitions ───────────────────────────────────────────────────

export const DAILY_REWARDS = [
  { xp:  50, label: "Seed Pouch I",   gems: 10 },
  { xp:  75, label: "Seed Pouch I",   gems: 15 },
  { xp: 100, label: "Seed Pouch II",  gems: 20 },
  { xp: 200, label: "Seed Pouch III", gems: 35 },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function DailyTasksPanel() {
  const { state, getState, update, pushGenericToast } = useGame();
  const { incrementStat } = useAchievementStats();
  const [claiming, setClaiming] = useState<DailyTaskType | null>(null);

  const dailyTasks = state.dailyTasks;
  if (!dailyTasks) return null;

  const { tasks, rewardsCollected } = dailyTasks;
  const completedCount = tasks.filter((t) => t.completed).length;
  const collectedCount = rewardsCollected.filter(Boolean).length;

  async function handleClaim(taskType: DailyTaskType) {
    if (claiming) return;
    setClaiming(taskType);
    try {
      const result = await edgeDailyComplete(taskType);
      const cur    = getState();
      update({
        ...cur,
        dailyTasks:      result.dailyTasks,
        consumables:     result.consumables     ?? cur.consumables,
        gardenerLevel:   result.gardenerLevel   ?? cur.gardenerLevel,
        gardenerXp:      result.gardenerXp      ?? cur.gardenerXp,
        gems:            result.gems            ?? cur.gems,
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
      if (result.dailyTasks.tasks.every((t) => t.completed)) {
        incrementStat("daily_sets_completed");
      }
    } catch {
      // server rejected — leave progress as-is, user can retry
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="space-y-3 px-1">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Daily Tasks</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount} / {TASKS_REQUIRED} complete
        </span>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task) => {
          const pct     = Math.min(100, (task.progress / task.target) * 100);
          const isReady = task.progress >= task.target && !task.completed;
          return (
            <div
              key={task.type}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                task.completed
                  ? "border-primary/40 bg-primary/5"
                  : isReady
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-card/60"
              }`}
            >
              <span className="shrink-0">
                <ItemSprite
                  emoji={TASK_EMOJI[task.type as DailyTaskType] ?? "✦"}
                  sprite={TASK_SPRITE[task.type as DailyTaskType]}
                  textSize="text-base"
                  imgSize="w-5 h-5"
                  name={task.type}
                />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={task.completed ? "line-through text-muted-foreground text-xs" : "text-xs"}>
                    {taskLabel(task.type as DailyTaskType, task.target)}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {task.progress}/{task.target}
                  </span>
                </div>
                {!task.completed && !isReady && task.target > 1 && (
                  <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
              {task.completed && (
                <span className="text-primary text-sm shrink-0">✓</span>
              )}
              {isReady && (
                <button
                  onClick={() => handleClaim(task.type as DailyTaskType)}
                  disabled={!!claiming}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {claiming === task.type ? "…" : "Claim"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Reward tiers */}
      <div className="border-t border-border pt-3 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground mb-2">Rewards</p>
        {DAILY_REWARDS.map((reward, i) => {
          const collected = rewardsCollected[i];
          const unlocked  = completedCount >= i + 1;
          const isNext    = !collected && i === collectedCount;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs px-1 ${
                collected ? "text-muted-foreground" : isNext ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] shrink-0 font-semibold ${
                collected
                  ? "border-primary bg-primary text-primary-foreground"
                  : unlocked
                  ? "border-primary text-primary"
                  : "border-muted-foreground"
              }`}>
                {collected ? "✓" : i + 1}
              </span>
              <span className={`flex-1 inline-flex items-center gap-0.5 ${collected ? "line-through" : ""}`}>
                {reward.xp} XP + {reward.label} + {reward.gems}<ItemSprite emoji="💎" sprite="/sprites/ui/gems.png" textSize="text-xs" imgSize="w-3.5 h-3.5" name="gems" />
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
