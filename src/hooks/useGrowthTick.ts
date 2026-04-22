import { useEffect, useState } from "react";

// Forces re-render on an interval so time-based growth stays visually current.
// Nothing in the game state changes — just the UI re-reads Date.now().
export function useGrowthTick(intervalMs = 5_000) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}