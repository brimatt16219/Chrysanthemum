import type { OfflineSummary } from "../store/gameStore";

interface Props {
  summary: OfflineSummary;
  onDismiss: () => void;
}

export function OfflineBanner({ summary, onDismiss }: Props) {
  const { minutesAway, readyToHarvest, shopRestocked } = summary;

  // Nothing interesting happened — don't show
  if (minutesAway < 1 && !readyToHarvest && !shopRestocked) return null;

  const h = Math.floor(minutesAway / 60);
  const m = minutesAway % 60;
  const timeAway = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-primary/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-primary/10 space-y-4">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-3xl">🌸</p>
          <h2 className="text-lg font-bold">Welcome back!</h2>
          {minutesAway >= 1 && (
            <p className="text-sm text-muted-foreground">
              You were away for {timeAway}
            </p>
          )}
        </div>

        {/* Summary items */}
        <div className="space-y-2">
          {readyToHarvest > 0 && (
            <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
              <span className="text-2xl">🌼</span>
              <div>
                <p className="text-sm font-semibold">
                  {readyToHarvest} flower{readyToHarvest > 1 ? "s" : ""} ready to harvest
                </p>
                <p className="text-xs text-muted-foreground">
                  Head to your garden to collect them
                </p>
              </div>
            </div>
          )}
          {shopRestocked && (
            <div className="flex items-center gap-3 bg-card/80 border border-border rounded-xl px-4 py-3">
              <span className="text-2xl">🛒</span>
              <div>
                <p className="text-sm font-semibold">Shop has restocked</p>
                <p className="text-xs text-muted-foreground">
                  Fresh seeds and fertilizer available
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Let's go! 🌱
        </button>
      </div>
    </div>
  );
}
