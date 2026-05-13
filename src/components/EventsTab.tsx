import { useState, useMemo, ComponentType } from "react";
import { useGame } from "../store/GameContext";
import type { EventEntry } from "../store/gameStore";
import { CheckinEventCard }    from "./events/CheckinEventCard";
import { CollectionEventCard } from "./events/CollectionEventCard";
import { DailyTasksPanel }    from "./DailyTasksPanel";
import { AchievementsPanel }  from "./AchievementsPanel";
import { ACHIEVEMENTS }       from "../data/achievements";
import { ItemSprite }         from "./ItemSprite";

// Maps event type string → card component. Unknown types render nothing.
const EVENT_CARD_REGISTRY: Record<string, ComponentType<{ event: EventEntry }>> = {
  checkin:    CheckinEventCard,
  collection: CollectionEventCard,
};

type EventsView = "events" | "daily" | "achievements";

export function EventsTab() {
  const { state } = useGame();
  const [view, setView] = useState<EventsView>("events");

  // ── Badge computations ──────────────────────────────────────────────────────

  const hasActiveEvents = (state.events ?? []).length > 0;

  const hasCollectableReward = useMemo(() => {
    if (!state.dailyTasks) return false;
    const { tasks, rewardsCollected } = state.dailyTasks;
    const completedCount = tasks.filter((t) => t.completed).length;
    return rewardsCollected.some((c, i) => !c && completedCount >= i + 1);
  }, [state.dailyTasks]);

  const hasClaimableAchievement = useMemo(() => {
    const speciesDiscovered = new Set(
      state.inventory.filter((i) => !i.isSeed).map((i) => i.speciesId)
    ).size;
    return ACHIEVEMENTS.some((a) => {
      if (state.achievementsClaimed.includes(a.id)) return false;
      if (a.check.kind === "friends_count" || a.check.kind === "recipe_completed") return false;
      if (a.check.kind === "stat") {
        return (state.achievementStats[a.check.statKey] ?? 0) >= a.target;
      }
      if (a.check.kind === "species_discovered") {
        return speciesDiscovered >= a.target;
      }
      return false;
    });
  }, [state.achievementsClaimed, state.achievementStats, state.inventory]);

  const badgeFor: Record<EventsView, boolean> = {
    events:       hasActiveEvents,
    daily:        hasCollectableReward,
    achievements: hasClaimableAchievement,
  };

  return (
    <>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-6">
        {(["events", "daily", "achievements"] as EventsView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`
              relative flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center
              ${view === v
                ? "bg-primary/20 border border-primary/50 text-primary"
                : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
              }
            `}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <ItemSprite
                emoji={v === "events" ? "🌸" : v === "daily" ? "📅" : "🏆"}
                sprite={v === "events" ? "/sprites/ui/events.png" : v === "daily" ? "/sprites/ui/daily.png" : "/sprites/ui/achievements.png"}
                textSize="text-base"
                imgSize="w-5 h-5"
                name={v}
              />
              <span className="hidden sm:inline">
                {v === "events" ? "Events" : v === "daily" ? "Daily Tasks" : "Achievements"}
              </span>
            </span>
            {badgeFor[v] && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary" style={{ clipPath: "polygon(0px 2px,2px 2px,2px 0px,calc(100% - 2px) 0px,calc(100% - 2px) 2px,100% 2px,100% calc(100% - 2px),calc(100% - 2px) calc(100% - 2px),calc(100% - 2px) 100%,2px 100%,2px calc(100% - 2px),0px calc(100% - 2px))" }} />
            )}
          </button>
        ))}
      </div>

      {view === "events" && (
        <div className="flex flex-col gap-4">
          {(state.events ?? []).length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-8">
              No active events right now — check back soon! 🌱
            </p>
          ) : (
            (state.events ?? []).map((event) => {
              const Card = EVENT_CARD_REGISTRY[event.type];
              if (!Card) return null;
              return <Card key={event.id} event={event} />;
            })
          )}
        </div>
      )}
      {view === "daily"        && <DailyTasksPanel />}
      {view === "achievements" && <AchievementsPanel />}
    </>
  );
}
