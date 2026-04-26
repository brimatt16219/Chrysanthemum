import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { WeatherType } from "../data/weather";

export interface WeatherState {
  type: WeatherType;
  startedAt: number;
  endsAt: number;
}

export interface ForecastEntry {
  type: WeatherType;
}

const DEFAULT: WeatherState = {
  type:      "clear",
  startedAt: 0,
  endsAt:    0,
};

export function useWeather() {
  const [weather, setWeather]   = useState<WeatherState>(DEFAULT);
  const [forecast, setForecast] = useState<ForecastEntry[]>([]);
  const [, setTick]             = useState(0); // force re-render tick

  function applyRow(data: Record<string, unknown>) {
    setWeather({
      type:      data.type as WeatherType,
      startedAt: data.started_at as number,
      endsAt:    data.ends_at as number,
    });

    // forecast is a jsonb array — each entry is { type: string } or just a string
    const raw = data.forecast as unknown[] | null;
    if (Array.isArray(raw)) {
      setForecast(
        raw.map((entry) =>
          typeof entry === "string"
            ? { type: entry as WeatherType }
            : { type: (entry as { type: string }).type as WeatherType }
        )
      );
    } else {
      setForecast([]);
    }
  }

  useEffect(() => {
    // Load current weather on mount
    supabase
      .from("weather")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) {
          applyRow(data as Record<string, unknown>);

          // Client-side fallback: if weather has already expired, advance it
          // immediately rather than waiting for the next GitHub Actions tick.
          // advance_weather() is idempotent — it returns early if weather is
          // still active, so it's safe to call on every page load.
          if ((data.ends_at as number) < Date.now()) {
            supabase.rpc("advance_weather").then(() => {
              // Realtime subscription will automatically pick up the new weather
            });
          }
        }
      });

    // Subscribe to realtime changes
    const channel = supabase
      .channel("weather-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "weather" },
        (payload) => {
          applyRow(payload.new as Record<string, unknown>);
        }
      )
      .subscribe();

    // Tick every second so isActive re-evaluates when weather expires
    const ticker = setInterval(() => setTick((n) => n + 1), 1_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(ticker);
    };
  }, []);

  const now        = Date.now();
  const isActive   = weather.endsAt > now && weather.type !== "clear";
  const msLeft     = Math.max(0, weather.endsAt - now);
  const activeType = isActive ? weather.type : "clear";

  return { weather, activeType, isActive, msLeft, forecast };
}
