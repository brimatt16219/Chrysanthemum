import { useEffect, useState } from "react";
import { WEATHER } from "../data/weather";
import type { WeatherType } from "../data/weather";
import type { DayPeriodDefinition } from "../data/dayNight";

interface Props {
  weatherType: WeatherType;
  isActive: boolean;
  msLeft: number;
  period: DayPeriodDefinition;
}

const SHORT_NAMES: Record<WeatherType, string> = {
  clear:           "Clear",
  rain:            "Rain",
  golden_hour:     "Golden Hr",
  prismatic_skies: "Prismatic",
  star_shower:     "Stars",
  cold_front:      "Cold Front",
  heatwave:        "Heatwave",
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
};

const bgClass: Record<WeatherType, string> = {
  clear:           "bg-card/60",
  rain:            "bg-blue-950/40",
  golden_hour:     "bg-yellow-950/40",
  prismatic_skies: "bg-pink-950/40",
  star_shower:     "bg-indigo-950/40",
  cold_front:      "bg-cyan-950/40",
  heatwave:        "bg-orange-950/40",
};

export function WeatherBanner({ weatherType, isActive, msLeft, period }: Props) {
  const [timeLeft, setTimeLeft] = useState(msLeft);

  useEffect(() => {
    setTimeLeft(msLeft);
    if (!isActive) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1_000));
    }, 1_000);
    return () => clearInterval(id);
  }, [msLeft, isActive]);

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
      <span className="text-sm">{period.emoji}</span>

      {/* Separator + weather info — only when weather is active */}
      {weatherActive && (
        <>
          <span className="opacity-40">·</span>
          <span className="text-sm">{def.emoji}</span>
          <span className="font-semibold hidden">{SHORT_NAMES[weatherType]}</span>
          <span className="opacity-70 sm:hidden">{formatTimeLeftShort(timeLeft)}</span>
          <span className="opacity-70 hidden sm:inline">{formatTimeLeft(timeLeft)}</span>
        </>
      )}

      {/* Period label — only on desktop when no weather active */}
      {!weatherActive && (
        <span className="hidden sm:inline">{period.label}</span>
      )}
    </div>
  );
}
