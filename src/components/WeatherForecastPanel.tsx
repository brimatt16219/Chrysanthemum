import React from "react";
import { WEATHER } from "../data/weather";
import type { WeatherType } from "../data/weather";
import { useGame } from "../store/GameContext";
import { FORECAST_SLOT_COSTS, MAX_FORECAST_SLOTS } from "../store/gameStore";
import { useSettings } from "../store/SettingsContext";
import { ItemSprite } from "./ItemSprite";

const PX: React.CSSProperties = { imageRendering: "pixelated" };

const WEATHER_SPRITE: Record<WeatherType, string> = {
  clear:           "/sprites/ui/weather_clear.png",
  rain:            "/sprites/ui/weather_rain.png",
  golden_hour:     "/sprites/ui/weather_golden_hour.png",
  prismatic_skies: "/sprites/ui/weather_prismatic_skies.png",
  star_shower:     "/sprites/ui/weather_star_shower.png",
  cold_front:      "/sprites/ui/weather_cold_front.png",
  heatwave:        "/sprites/ui/weather_heatwave.png",
  thunderstorm:    "/sprites/ui/weather_thunderstorm.png",
  tornado:         "/sprites/ui/weather_tornado.png",
};

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

function formatRelative(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1_000));
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) {
    const s = totalSec % 60;
    return `in ${totalMin}m ${s.toString().padStart(2, "0")}s`;
  }
  const totalHours = Math.floor(totalMin / 60);
  if (totalHours < 24) {
    const m = totalMin % 60;
    return m > 0 ? `in ${totalHours}h ${m}m` : `in ${totalHours}h`;
  }
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return h > 0 ? `in ${d}d ${h}h` : `in ${d}d`;
}

function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface Props {
  onClose: () => void;
}

export function WeatherForecastPanel({ onClose }: Props) {
  const {
    state,
    weatherForecast,
    buyForecastSlot,
    activeWeather,
    weatherMsLeft,
    weatherMsUntilNext,
    weatherIsActive,
  } = useGame();

  const { settings } = useSettings();

  const slots      = state.weatherForecastSlots ?? 0;
  const canUpgrade = slots < MAX_FORECAST_SLOTS;
  const nextCost   = canUpgrade ? FORECAST_SLOT_COSTS[slots] : null;
  const canAfford  = nextCost !== null && state.coins >= nextCost;

  // Current weather countdown
  const msLeft   = Math.max(0, weatherMsLeft);
  const minsLeft = Math.floor(msLeft / 60_000);
  const secsLeft = Math.floor((msLeft % 60_000) / 1_000);
  const timeStr  = minsLeft > 0
    ? `${minsLeft}m ${secsLeft.toString().padStart(2, "0")}s`
    : `${secsLeft}s`;

  // Pre-compute start time for each forecast slot
  const now           = Date.now();
  const currentEndsAt = now + weatherMsUntilNext;

  const slotStartTimes: number[] = [];
  let cursor = currentEndsAt;
  for (let i = 0; i < slots; i++) {
    slotStartTimes.push(cursor);
    const entry = weatherForecast[i];
    if (entry) cursor += WEATHER[entry.type].durationMs;
  }

  const currentDef = WEATHER[activeWeather];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag indicator */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-card rounded-t-2xl z-10 border-b border-border/40">
          <h2 className="font-bold text-base flex items-center gap-2">
            {settings.useSprites
              ? <img src="/sprites/ui/forecast.png" alt="forecast" className="w-5 h-5 object-contain" style={PX} />
              : <span>🔭</span>
            }
            <span>Weather Forecast</span>
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col gap-4 p-5 overflow-y-auto">

        {/* Current weather */}
        <div className={`flex items-center gap-3 rounded-xl border p-3 ${bgClass[activeWeather]} ${accentClass[activeWeather]}`}>
          {settings.useSprites
            ? <img src={WEATHER_SPRITE[activeWeather]} alt={currentDef.name} className="w-10 h-10 object-contain shrink-0" style={PX} />
            : <span className="text-3xl shrink-0">{currentDef.emoji}</span>
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{currentDef.name}</p>
            <p className="text-xs text-muted-foreground">Now</p>
          </div>
          {weatherIsActive && (
            <div className="text-right shrink-0">
              <p className="text-xs font-mono text-muted-foreground">ends in</p>
              <p className="text-sm font-mono font-semibold">{timeStr}</p>
            </div>
          )}
        </div>

        {/* Forecast queue */}
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
            Coming Up
          </p>

          {slots === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              {settings.useSprites
                ? <img src="/sprites/ui/weather_unknown.png" alt="unknown" className="w-10 h-10 object-contain" style={PX} />
                : <span className="text-3xl">🌫️</span>
              }
              <p className="text-sm text-muted-foreground">
                Purchase forecast slots to see upcoming weather.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: slots }, (_, i) => {
                const entry     = weatherForecast[i];
                const startsAt  = slotStartTimes[i] ?? currentEndsAt;
                const msFromNow = Math.max(0, startsAt - now);

                if (!entry) {
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 p-3 opacity-50"
                    >
                      <ItemSprite emoji="❓" sprite="/sprites/ui/weather_unknown.png" name="Pending forecast" textSize="text-2xl" imgSize="w-7 h-7" className="opacity-40" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Pending…</p>
                        <p className="text-xs text-muted-foreground/60">
                          {formatRelative(msFromNow)} · {formatClock(startsAt)}
                        </p>
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
                    {settings.useSprites
                      ? <img src={WEATHER_SPRITE[entry.type]} alt={def.name} className="w-8 h-8 object-contain shrink-0" style={PX} />
                      : <span className="text-2xl shrink-0">{def.emoji}</span>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{def.name}</p>
                      <p className="text-xs text-muted-foreground/70 font-mono">
                        {formatRelative(msFromNow)} · {formatClock(startsAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upgrade / max */}
        {canUpgrade ? (
          <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
            <button
              onClick={buyForecastSlot}
              disabled={!canAfford}
              className={`
                w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 text-center
                ${canAfford
                  ? "bg-primary text-primary-foreground hover:opacity-90 hover:scale-[1.02]"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
                }
              `}
            >
              <span className="flex items-center justify-center gap-1.5">
                {`Unlock slot ${slots + 1} — ${nextCost!.toLocaleString()}`}
                <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-sm" imgSize="w-4 h-4" />
              </span>
            </button>
            {!canAfford && (
              <p className="text-xs text-muted-foreground/60 text-center">
                You have {state.coins.toLocaleString()}{" "}
                <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" />
              </p>
            )}
          </div>
        ) : (
          <div className="border-t border-border/40 pt-3">
            <p className="text-xs text-center text-green-400 font-medium">
              ✓ Max forecast unlocked ({MAX_FORECAST_SLOTS} slots)
            </p>
          </div>
        )}
        </div>{/* end scrollable body */}
      </div>
    </div>
  );
}
