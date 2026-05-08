import { useState } from "react";
import { DailyTasksPanel } from "./DailyTasksPanel";
import { AchievementsPanel } from "./AchievementsPanel";

type EventsView = "daily" | "achievements";

export function EventsTab() {
  const [view, setView] = useState<EventsView>("daily");

  return (
    <>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-6">
        {(["daily", "achievements"] as EventsView[]).map((v) => (
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
            <span>{v === "daily" ? "📅" : "🏆"}</span>
            <span className="hidden sm:inline ml-1">
              {v === "daily" ? "Daily Tasks" : "Achievements"}
            </span>
          </button>
        ))}
      </div>

      {view === "daily"        && <DailyTasksPanel />}
      {view === "achievements" && <AchievementsPanel />}
    </>
  );
}