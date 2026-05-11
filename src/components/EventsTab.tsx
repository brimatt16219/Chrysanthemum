import { useState, ComponentType } from "react";
import { useGame } from "../store/GameContext";
import type { EventEntry } from "../store/gameStore";
import { CheckinEventCard }    from "./events/CheckinEventCard";
import { CollectionEventCard } from "./events/CollectionEventCard";
import { DailyTasksPanel } from "./DailyTasksPanel";
import { AchievementsPanel } from "./AchievementsPanel";

// Maps event type string → card component. Unknown types render nothing.
const EVENT_CARD_REGISTRY: Record<string, ComponentType<{ event: EventEntry }>> = {
  checkin:    CheckinEventCard,
  collection: CollectionEventCard,
};

type EventsView = "events" | "daily" | "achievements";

export function EventsTab() {
  const { state } = useGame();
  const [view, setView] = useState<EventsView>("events");

  return (
    <>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-6">
        {(["events", "daily", "achievements"] as EventsView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`
              flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center
              ${view === v
                ? "bg-primary/20 border border-primary/50 text-primary"
                : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
              }
            `}
          >
            <span>
              {v === "events" ? "🌸" : v === "daily" ? "📅" : "🏆"}
            </span>
            <span className="hidden sm:inline ml-1">
              {v === "events" ? "Events" : v === "daily" ? "Daily Tasks" : "Achievements"}
            </span>
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
