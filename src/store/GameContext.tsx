import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  type GameState,
  type OfflineSummary,
  loadGame,
  saveGame,
  tickShop,
} from "./gameStore";

interface GameContextValue {
  state: GameState;
  update: (newState: GameState) => void;
  offlineSummary: OfflineSummary;
  clearSummary: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const EMPTY_SUMMARY: OfflineSummary = {
  minutesAway: 0,
  readyToHarvest: 0,
  shopRestocked: false,
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const loaded = useRef(loadGame());
  const [state, setState] = useState<GameState>(loaded.current.state);
  const [offlineSummary, setOfflineSummary] = useState<OfflineSummary>(
    loaded.current.summary
  );

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => tickShop(prev));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  function update(newState: GameState) {
    setState(newState);
  }

  function clearSummary() {
    setOfflineSummary(EMPTY_SUMMARY);
  }

  return (
    <GameContext.Provider value={{ state, update, offlineSummary, clearSummary }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}