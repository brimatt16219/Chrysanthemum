import { useEffect, useState } from "react";

// Forces a re-render on an interval so time-based growth stays visually current.
// Nothing in game state changes — components just re-read Date.now().
export function useGrowthTick(intervalMs = 5_000) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
