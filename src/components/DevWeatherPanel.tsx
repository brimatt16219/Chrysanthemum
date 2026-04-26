import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { WEATHER, WEATHER_LIST } from "../data/weather";
import type { WeatherType } from "../data/weather";

const DURATION_MS = 30_000;

async function setWeather(type: WeatherType) {
  await supabase.rpc("dev_set_weather", { p_type: type, p_duration_ms: DURATION_MS });
}

export function DevWeatherPanel() {
  const [cycling, setCycling]   = useState(false);
  const [current, setCurrent]   = useState<WeatherType | null>(null);
  const cycleRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  const types = WEATHER_LIST.map((w) => w.id);

  function stopCycle() {
    if (cycleRef.current) clearTimeout(cycleRef.current);
    cycleRef.current = null;
    setCycling(false);
    setCurrent(null);
  }

  async function runCycle(remaining: WeatherType[]) {
    if (remaining.length === 0) {
      stopCycle();
      return;
    }
    const [next, ...rest] = remaining;
    setCurrent(next);
    await setWeather(next);
    cycleRef.current = setTimeout(() => runCycle(rest), DURATION_MS + 500);
  }

  async function startCycle() {
    stopCycle();
    setCycling(true);
    await runCycle([...types]);
  }

  useEffect(() => () => stopCycle(), []);

  return (
    <div className="fixed bottom-4 left-4 z-[100] bg-black/90 border border-yellow-500/40 rounded-2xl p-4 w-72 shadow-2xl text-xs">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-yellow-400">⚗️ Dev — Weather</p>
        {cycling && (
          <button onClick={stopCycle} className="text-red-400 hover:text-red-300 font-semibold">
            ✕ Stop
          </button>
        )}
      </div>

      {/* Individual weather buttons */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {types.map((type) => {
          const def = WEATHER[type];
          return (
            <button
              key={type}
              onClick={() => { stopCycle(); setCurrent(type); setWeather(type); }}
              className={`
                flex flex-col items-center gap-0.5 py-1.5 rounded-lg border transition-all
                ${current === type
                  ? "border-yellow-400/80 bg-yellow-400/10 text-yellow-300"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/30"
                }
              `}
            >
              <span className="text-lg leading-none">{def.emoji}</span>
              <span className="text-[9px] font-mono leading-none">{def.name.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Auto-cycle */}
      <button
        onClick={cycling ? stopCycle : startCycle}
        className={`
          w-full py-1.5 rounded-lg text-xs font-semibold transition-all text-center
          ${cycling
            ? "bg-red-500/20 border border-red-500/50 text-red-400"
            : "bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/30"
          }
        `}
      >
        {cycling ? `⏹ Stop cycle (on: ${WEATHER[current!]?.name ?? "…"})` : "▶ Auto-cycle all (30s each)"}
      </button>
    </div>
  );
}
