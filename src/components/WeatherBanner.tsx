import React from "react";
import { WEATHER } from "../data/weather";
import type { WeatherType } from "../data/weather";
import type { DayPeriodDefinition, DayPeriod } from "../data/dayNight";

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

const PERIOD_SPRITE: Record<DayPeriod, string> = {
  midnight:  "/sprites/ui/period_midnight.png",
  dawn:      "/sprites/ui/period_dawn.png",
  morning:   "/sprites/ui/period_morning.png",
  midday:    "/sprites/ui/period_midday.png",
  afternoon: "/sprites/ui/period_afternoon.png",
  sunset:    "/sprites/ui/period_sunset.png",
  dusk:      "/sprites/ui/period_dusk.png",
  night:     "/sprites/ui/period_night.png",
};

interface Props {
  weatherType: WeatherType;
  isActive: boolean;
  msLeft: number;
  period: DayPeriodDefinition;
  /** When true, hides the weather time countdown (e.g. when boosts fill the HUD). */
  suppressTime?: boolean;
}

const SHORT_NAMES: Record<WeatherType, string> = {
  clear:           "Clear",
  rain:            "Rain",
  golden_hour:     "Golden Hr",
  prismatic_skies: "Prismatic",
  star_shower:     "Stars",
  cold_front:      "Cold Front",
  heatwave:        "Heatwave",
  thunderstorm:    "Storm",
  tornado:         "Tornado",
};

function formatTimeLeft(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1_000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatTimeLeftShort(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  return `${m}m`;
}

const accentClass: Record<WeatherType, string> = {
  clear:           "border-border text-muted-foreground",
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
  clear:           "bg-card/60",
  rain:            "bg-blue-950/40",
  golden_hour:     "bg-yellow-950/40",
  prismatic_skies: "bg-pink-950/40",
  star_shower:     "bg-indigo-950/40",
  cold_front:      "bg-cyan-950/40",
  heatwave:        "bg-orange-950/40",
  thunderstorm:    "bg-slate-950/60",
  tornado:         "bg-stone-950/50",
};

export function WeatherBanner({ weatherType, isActive, msLeft, period, suppressTime = false }: Props) {
  const def = WEATHER[weatherType];
  const weatherActive = isActive && weatherType !== "clear";

  return (
    <div
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono
        transition-all duration-500
        ${weatherActive ? bgClass[weatherType] : "bg-card/60 border-border text-muted-foreground"}
        ${weatherActive ? accentClass[weatherType] : ""}
      `}
      title={weatherActive ? def.description : period.label}
    >
      {/* Day/night period — always shown */}
      <img src={PERIOD_SPRITE[period.id]} alt={period.label} className="w-4 h-4 object-contain" style={PX} />

      {/* Separator + weather info — only when weather is active */}
      {weatherActive && (
        <>
          <span className="opacity-40">·</span>
          <img src={WEATHER_SPRITE[weatherType]} alt={def.name} className="w-4 h-4 object-contain" style={PX} />
          <span className="font-semibold hidden">{SHORT_NAMES[weatherType]}</span>
          {!suppressTime && <span className="opacity-70 sm:hidden">{formatTimeLeftShort(msLeft)}</span>}
          {!suppressTime && <span className="opacity-70 hidden sm:inline">{formatTimeLeft(msLeft)}</span>}
        </>
      )}

      {/* Period label — only on desktop when no weather active */}
      {!weatherActive && (
        <span className="hidden sm:inline">{period.label}</span>
      )}
    </div>
  );
}
