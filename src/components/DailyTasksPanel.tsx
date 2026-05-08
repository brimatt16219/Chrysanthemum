import { useGame } from "../store/GameContext";
import { TASKS_REQUIRED, type DailyTaskType } from "../lib/dailySeed";

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

const REWARDS = [
  { xp:  50, label: "Seed Pouch I"   },
  { xp:  75, label: "Seed Pouch I"   },
  { xp: 100, label: "Seed Pouch II"  },
  { xp: 200, label: "Seed Pouch III" },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function DailyTasksPanel() {
  const { state } = useGame();
  const dailyTasks = state.dailyTasks;

  if (!dailyTasks) return null;

  const { tasks, rewardsCollected } = dailyTasks;
  const completedCount  = tasks.filter((t) => t.completed).length;
  const collectedCount  = rewardsCollected.filter(Boolean).length;

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
          const pct = Math.min(100, (task.progress / task.target) * 100);
          return (
            <div
              key={task.type}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                task.completed
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card/60"
              }`}
            >
              <span className="text-base shrink-0">
                {TASK_EMOJI[task.type as DailyTaskType] ?? "✦"}
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
                {!task.completed && task.target > 1 && (
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
            </div>
          );
        })}
      </div>

      {/* Reward tiers */}
      <div className="border-t border-border pt-3 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground mb-2">Rewards</p>
        {REWARDS.map((reward, i) => {
          const collected = rewardsCollected[i];
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
                  : isNext
                  ? "border-primary text-primary"
                  : "border-muted-foreground"
              }`}>
                {collected ? "✓" : i + 1}
              </span>
              <span className={collected ? "line-through" : ""}>{reward.xp} XP + {reward.label}</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}