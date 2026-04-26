import { useEffect, useRef, useState } from "react";
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
  const [, setTick]             = useState(0);

  // Keep a ref so callbacks always see the latest weather without stale closures
  const weatherRef = useRef(weather);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  function applyRow(data: Record<string, unknown>) {
    const next: WeatherState = {
      type:      data.type as WeatherType,
      startedAt: data.started_at as number,
      endsAt:    data.ends_at as number,
    };
    weatherRef.current = next;
    setWeather(next);

    const raw = data.forecast as unknown[] | null;
    setForecast(
      Array.isArray(raw)
        ? raw.map((e) =>
            typeof e === "string"
              ? { type: e as WeatherType }
              : { type: (e as { type: string }).type as WeatherType }
          )
        : []
    );
  }

  async function fetchAndApply() {
    const { data } = await supabase
      .from("weather")
      .select("*")
      .eq("id", 1)
      .single();
    if (data) applyRow(data as Record<string, unknown>);
  }

  async function advanceAndRefresh() {
    await supabase.rpc("advance_weather");
    await fetchAndApply();
  }

  useEffect(() => {
    supabase
      .from("weather")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (!data) return;
        applyRow(data as Record<string, unknown>);
        if ((data.ends_at as number) < Date.now()) {
          advanceAndRefresh();
        }
      });

    // Realtime — still subscribe as a fast-path when it works
    const channel = supabase
      .channel("weather-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "weather" },
        (payload) => applyRow(payload.new as Record<string, unknown>)
      )
      .subscribe();

    // Per-second tick for countdown display
    const ticker = setInterval(() => setTick((n) => n + 1), 1_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(ticker);
    };
  }, []);

  // When weather expires while the tab is open: advance immediately, then
  // keep polling every 5 s until the row actually moves forward (guards
  // against Realtime delays or a silent RPC failure).
  useEffect(() => {
    if (weather.endsAt <= 0) return;

    const msUntilExpiry = weather.endsAt - Date.now();

    // Schedule the first advance call
    const firstShot = setTimeout(async () => {
      await advanceAndRefresh();

      const retryId = setInterval(async () => {
        if (weatherRef.current.endsAt > Date.now()) {
          clearInterval(retryId);
          return;
        }
        await advanceAndRefresh();
      }, 5_000);

      // Clean up retry loop after 2 min regardless
      setTimeout(() => clearInterval(retryId), 2 * 60_000);
    }, Math.max(0, msUntilExpiry) + 500);

    return () => clearTimeout(firstShot);
  }, [weather.endsAt]);

  const now         = Date.now();
  const isActive    = weather.endsAt > now && weather.type !== "clear";
  const msLeft      = Math.max(0, weather.endsAt - now);
  // msUntilNext counts down regardless of clear vs active — used for forecast timing
  const msUntilNext = msLeft;
  const activeType  = isActive ? weather.type : "clear";

  return { weather, activeType, isActive, msLeft, msUntilNext, forecast };
}
