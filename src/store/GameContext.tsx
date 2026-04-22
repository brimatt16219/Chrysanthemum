import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  type GameState,
  type OfflineSummary,
  loadGame,
  saveGame,
  tickShop,
  msUntilShopReset,
} from "./gameStore";

interface GameContextValue {
  state: GameState;
  update: (newState: GameState) => void;
  offlineSummary: OfflineSummary;
  clearSummary: () => void;
  shopJustRestocked: boolean;
  clearShopNotification: () => void;
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
  const [shopJustRestocked, setShopJustRestocked] = useState(false);

  // Auto-save whenever state changes
  useEffect(() => {
    saveGame(state);
  }, [state]);

  // Tick every second — detects restock the moment the timer hits 0
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const msLeft = msUntilShopReset(prev);

        // Timer just hit 0 — restock immediately
        if (msLeft === 0) {
          const next = tickShop(prev);
          if (next !== prev) {
            // Only notify if state actually changed (i.e. restock happened)
            setShopJustRestocked(true);
          }
          return next;
        }

        return prev;
      });
    }, 1_000);

    return () => clearInterval(interval);
  }, []);

  const update = useCallback((newState: GameState) => {
    setState(newState);
  }, []);

  function clearSummary() {
    setOfflineSummary(EMPTY_SUMMARY);
  }

  function clearShopNotification() {
    setShopJustRestocked(false);
  }

  return (
    <GameContext.Provider
      value={{
        state,
        update,
        offlineSummary,
        clearSummary,
        shopJustRestocked,
        clearShopNotification,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
