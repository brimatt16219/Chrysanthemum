import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { WeatherType } from "../data/weather";

export interface WeatherState {
  type: WeatherType;
  startedAt: number;
  endsAt: number;
}

const DEFAULT: WeatherState = {
  type:      "clear",
  startedAt: 0,
  endsAt:    0,
};

export function useWeather() {
  const [weather, setWeather] = useState<WeatherState>(DEFAULT);

  useEffect(() => {
    // Load current weather on mount
    supabase
      .from("weather")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setWeather({
            type:      data.type as WeatherType,
            startedAt: data.started_at,
            endsAt:    data.ends_at,
          });
        }
      });

    // Subscribe to realtime changes
    const channel = supabase
      .channel("weather-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "weather" },
        (payload) => {
          const d = payload.new;
          setWeather({
            type:      d.type as WeatherType,
            startedAt: d.started_at,
            endsAt:    d.ends_at,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const now        = Date.now();
  const isActive   = weather.endsAt > now;
  const msLeft     = Math.max(0, weather.endsAt - now);
  const activeType = isActive ? weather.type : "clear";

  return { weather, activeType, isActive, msLeft };
}