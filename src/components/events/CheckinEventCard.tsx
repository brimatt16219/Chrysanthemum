import { useState } from "react";
import { useGame } from "../../store/GameContext";
import type { EventEntry } from "../../store/gameStore";
import { edgeCheckinClaim } from "../../lib/edgeFunctions";

interface CheckinConfig {
  days: { day: number; gems: number }[];
}

interface Props { event: EventEntry; }

export function CheckinEventCard({ event }: Props) {
  const { getState, update, pushGenericToast } = useGame();
  const [claiming, setClaiming] = useState(false);

  const config      = event.config as CheckinConfig;
  const progress    = event.progress ?? {};
  const claimedDays = progress.claimedDays ?? [];

  const today               = new Date().toISOString().slice(0, 10);
  const lastDate            = progress.lastClaimedAt
    ? new Date(progress.lastClaimedAt).toISOString().slice(0, 10)
    : null;
  const alreadyClaimedToday = lastDate === today;

  const nextDay    = claimedDays.length + 1;
  const allClaimed = claimedDays.length >= config.days.length;
  const canClaim   = !alreadyClaimedToday && !allClaimed;

  async function handleClaim() {
    if (!canClaim || claiming) return;
    setClaiming(true);
    try {
      const result = await edgeCheckinClaim(event.id);
      const cur = getState();
      update({
        ...cur,
        gems:            result.gems,
        serverUpdatedAt: result.serverUpdatedAt,
        events:          cur.events.map((e) =>
          e.id === event.id ? { ...e, progress: result.progress } : e
        ),
      });
      pushGenericToast("checkin_claim", "💎", `Day ${result.claimedDay} claimed!`, undefined, "gain", result.gemsGained);
    } catch (e) {
      console.error("checkin claim failed:", e);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 flex flex-col gap-4">

      {/* Header */}
      <div>
        <h3 className="font-bold text-sm">{event.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
      </div>

      {/* Day grid — 7 columns */}
      <div className="grid grid-cols-7 gap-1.5">
        {config.days.map(({ day, gems }) => {
          const claimed  = claimedDays.includes(day);
          const isNext   = day === nextDay && !alreadyClaimedToday;
          const isFuture = !claimed && !isNext;
          return (
            <div
              key={day}
              className={`
                flex flex-col items-center justify-center rounded-xl border py-2 gap-0.5 text-center text-[10px]
                ${claimed  ? "bg-primary/20 border-primary/40 text-primary"                          : ""}
                ${isNext   ? "border-primary/60 bg-primary/10 text-foreground ring-1 ring-primary/40" : ""}
                ${isFuture ? "border-border bg-card/30 text-muted-foreground"                        : ""}
              `}
            >
              <span className="font-semibold">Day {day}</span>
              <span>{claimed ? "✓" : `${gems} 💎`}</span>
            </div>
          );
        })}
      </div>

      {/* Claim button */}
      {allClaimed ? (
        <p className="text-xs text-center text-muted-foreground">All rewards claimed! 🎉</p>
      ) : (
        <button
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          className={`
            mx-auto block px-8 py-2 rounded-xl text-xs font-semibold transition-all
            ${canClaim && !claiming
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
            }
          `}
        >
          {claiming
            ? "Claiming…"
            : alreadyClaimedToday
            ? "Come back tomorrow"
            : `Claim Day ${nextDay} (+${config.days[nextDay - 1]?.gems ?? 0} 💎)`}
        </button>
      )}
    </div>
  );
}
