import { useEffect, useState } from "react";
import { getCurrentPeriod, type DayPeriodDefinition } from "../data/dayNight";

function getHour(): number {
  return new Date().getHours();
}

export function useDayNight(): DayPeriodDefinition {
  const [period, setPeriod] = useState<DayPeriodDefinition>(
    () => getCurrentPeriod(getHour())
  );

  useEffect(() => {
    // Re-evaluate every minute — periods are hours long so this is plenty
    const id = setInterval(() => {
      setPeriod(getCurrentPeriod(getHour()));
    }, 60_000);

    return () => clearInterval(id);
  }, []);

  return period;
}
