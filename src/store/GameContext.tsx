import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  type GameState,
  loadGame,
  saveGame,
  tickShop,
  harvestPlant,
  plantSeed,
} from "./gameStore";

interface GameContextValue {
  state: GameState;
  update: (newState: GameState) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => loadGame());

  // Save whenever state changes
  useEffect(() => {
    saveGame(state);
  }, [state]);

  // Check shop restock every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => tickShop(prev));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  function update(newState: GameState) {
    setState(newState);
  }

  return (
    <GameContext.Provider value={{ state, update }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}