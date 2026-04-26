import { useEffect, useState } from "react";
import { getCurrentPeriod, type DayPeriodDefinition } from "../data/dayNight";

function getUtcHour(): number {
  return new Date().getUTCHours();
}

export interface TimeOfDay {
  period: DayPeriodDefinition;
  utcHour: number;
  /** midnight (0–5) or night (21–24) */
  isNight: boolean;
  /** morning (7–11), midday (11–14), afternoon (14–17) */
  isDaytime: boolean;
  /** dawn (5–7), sunset (17–19), dusk (19–21) */
  isSunriseSunset: boolean;
}

/**
 * Returns the current UTC-based time-of-day period, updated every minute.
 *
 * Uses UTC so that weather gating is consistent for all players worldwide —
 * the server's advance_weather() SQL function also runs on UTC.
 *
 * For local-time visual overlays (day/night tint) use useDayNight() instead.
 */
export function useTimeOfDay(): TimeOfDay {
  const [utcHour, setUtcHour] = useState<number>(() => getUtcHour());

  useEffect(() => {
    // Re-check every minute — periods are hours-long so this is more than frequent enough
    const id = setInterval(() => setUtcHour(getUtcHour()), 60_000);
    return () => clearInterval(id);
  }, []);

  const period = getCurrentPeriod(utcHour);

  return {
    period,
    utcHour,
    isNight:         period.id === "midnight" || period.id === "night",
    isDaytime:       period.id === "morning"  || period.id === "midday" || period.id === "afternoon",
    isSunriseSunset: period.id === "dawn"     || period.id === "sunset" || period.id === "dusk",
  };
}
