import { WEATHER } from "../data/weather";
import type { WeatherType } from "../data/weather";
import { useGame } from "../store/GameContext";
import { FORECAST_SLOT_COSTS } from "../store/gameStore";

const TIER_LABELS = ["1 slot", "2 slots", "3 slots", "4 slots"] as const;

const accentClass: Record<WeatherType, string> = {
  clear:           "border-border/40 text-muted-foreground",
  rain:            "border-blue-400/40 text-blue-300",
  golden_hour:     "border-yellow-400/40 text-yellow-300",
  prismatic_skies: "border-pink-400/40 text-pink-300",
  star_shower:     "border-indigo-400/40 text-indigo-300",
  cold_front:      "border-cyan-400/40 text-cyan-300",
  heatwave:        "border-orange-400/40 text-orange-300",
  thunderstorm:    "border-slate-400/40 text-slate-300",
  tornado:         "border-stone-400/40 text-stone-300",
};

const bgClass: Record<WeatherType, string> = {
  clear:           "bg-card/40",
  rain:            "bg-blue-950/40",
  golden_hour:     "bg-yellow-950/40",
  prismatic_skies: "bg-pink-950/40",
  star_shower:     "bg-indigo-950/40",
  cold_front:      "bg-cyan-950/40",
  heatwave:        "bg-orange-950/40",
  thunderstorm:    "bg-slate-950/50",
  tornado:         "bg-stone-950/40",
};

interface Props {
  onClose: () => void;
}

export function WeatherForecastPanel({ onClose }: Props) {
  const { state, weatherForecast, buyForecastSlot, activeWeather, weatherMsLeft, weatherIsActive } = useGame();

  const slots    = state.weatherForecastSlots ?? 0;
  const maxSlots = 4;
  const canUpgrade = slots < maxSlots;
  const nextCost   = canUpgrade ? FORECAST_SLOT_COSTS[slots] : null;
  const canAfford  = nextCost !== null && state.coins >= nextCost;

  function handleBuy() {
    buyForecastSlot();
  }

  // Current weather info
  const currentDef = WEATHER[activeWeather];
  const msLeft = Math.max(0, weatherMsLeft);
  const minsLeft = Math.floor(msLeft / 60_000);
  const secsLeft = Math.floor((msLeft % 60_000) / 1_000);
  const timeStr = minsLeft > 0 ? `${minsLeft}m ${secsLeft.toString().padStart(2, "0")}s` : `${secsLeft}s`;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-card border border-border rounded-2xl shadow-2xl flex flex-col gap-4 p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2">
            <span>🔭</span>
            <span>Weather Forecast</span>
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Current weather */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-3 ${bgClass[activeWeather]} ${accentClass[activeWeather]}`}
        >
          <span className="text-3xl">{currentDef.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{currentDef.name}</p>
            <p className="text-xs text-muted-foreground">{currentDef.description}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-mono text-muted-foreground">
              {weatherIsActive ? `ends in` : "active"}
            </p>
            <p className="text-sm font-mono font-semibold">
              {weatherIsActive ? timeStr : "—"}
            </p>
          </div>
        </div>

        {/* Forecast queue */}
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
            Coming Up
          </p>

          {slots === 0 ? (
            // Not unlocked yet
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="text-4xl">🌫️</span>
              <p className="text-sm text-muted-foreground">
                Purchase forecast slots to see upcoming weather.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: slots }, (_, i) => {
                const entry = weatherForecast[i];
                if (!entry) {
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 p-3 opacity-50"
                    >
                      <span className="text-2xl opacity-40">❓</span>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Slot {i + 1}</p>
                        <p className="text-xs text-muted-foreground/60">Forecast pending…</p>
                      </div>
                    </div>
                  );
                }

                const def = WEATHER[entry.type];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${bgClass[entry.type]} ${accentClass[entry.type]}`}
                  >
                    <div className="flex items-center gap-1 text-xs text-muted-foreground/60 font-mono w-4 shrink-0 justify-center">
                      {i + 1}
                    </div>
                    <span className="text-2xl">{def.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{def.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{def.description}</p>
                    </div>
                    {def.growthMultiplier > 1 && (
                      <span className="text-xs font-mono text-green-400 shrink-0">
                        {def.growthMultiplier}×
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upgrade section */}
        {canUpgrade && (
          <div className="border-t border-border/40 pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
              Upgrade Forecast
            </p>

            <div className="flex flex-col gap-2 mb-3">
              {FORECAST_SLOT_COSTS.map((cost, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
                    i < slots
                      ? "bg-green-950/30 border border-green-500/20 text-green-400"
                      : i === slots
                      ? "bg-primary/10 border border-primary/30 text-foreground"
                      : "bg-card/20 border border-border/20 text-muted-foreground/50"
                  }`}
                >
                  <span className="font-medium">{TIER_LABELS[i]}</span>
                  <span className="font-mono">
                    {i < slots ? "✓ Owned" : `${cost.toLocaleString()} 🟡`}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleBuy}
              disabled={!canAfford}
              className={`
                w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150
                ${canAfford
                  ? "bg-primary text-primary-foreground hover:opacity-90 hover:scale-[1.02]"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
                }
              `}
            >
              {canAfford
                ? `Unlock ${TIER_LABELS[slots]} — ${nextCost!.toLocaleString()} 🟡`
                : `Need ${nextCost!.toLocaleString()} 🟡`
              }
            </button>

            {!canAfford && nextCost !== null && (
              <p className="text-xs text-muted-foreground/60 text-center mt-1.5">
                You have {state.coins.toLocaleString()} 🟡
              </p>
            )}
          </div>
        )}

        {!canUpgrade && (
          <div className="border-t border-border/40 pt-3">
            <p className="text-xs text-center text-green-400 font-medium">
              ✓ Max forecast unlocked (4 slots)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
