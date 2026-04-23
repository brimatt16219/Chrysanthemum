import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  type GameState,
  type OfflineSummary,
  loadGame,
  saveGame,
  tickShop,
  msUntilShopReset,
  applyOfflineTick,
} from "./gameStore";
import {
  loadCloudSave,
  saveToCloud,
  type CloudProfile,
} from "./cloudSave";
import { supabase } from "../lib/supabase";
import { getProfile } from "./cloudSave";

interface GameContextValue {
  state: GameState;
  update: (newState: GameState) => void;
  offlineSummary: OfflineSummary;
  clearSummary: () => void;
  shopJustRestocked: boolean;
  clearShopNotification: () => void;
  // Auth
  user: User | null;
  profile: CloudProfile | null;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  // Migration
  pendingMigration: { localSave: GameState; cloudSave: GameState } | null;
  resolveMigration: (choice: "local" | "cloud") => Promise<void>;
  needsUsername: boolean;
  completeUsername: (username: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const EMPTY_SUMMARY: OfflineSummary = {
  minutesAway: 0,
  readyToHarvest: 0,
  shopRestocked: false,
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const loaded = useRef(loadGame());
  const [state, setState]                   = useState<GameState>(loaded.current.state);
  const [offlineSummary, setOfflineSummary] = useState<OfflineSummary>(loaded.current.summary);
  const [shopJustRestocked, setShopJustRestocked] = useState(false);

  // Auth state
  const [user, setUser]             = useState<User | null>(null);
  const [profile, setProfile]       = useState<CloudProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);

  // Migration state
  const [pendingMigration, setPendingMigration] = useState<{
    localSave: GameState;
    cloudSave: GameState;
  } | null>(null);

  // ── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await handleSignIn(u);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (event === "SIGNED_IN" && u) {
          await handleSignIn(u);
        }
        if (event === "SIGNED_OUT") {
          setProfile(null);
          setNeedsUsername(false);
          // Reload local save on sign out
          const { state: localState, summary } = loadGame();
          setState(localState);
          setOfflineSummary(summary);
        }
        setAuthLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignIn(u: User) {
    // Check if they have a profile
    const p = await getProfile(u.id);

    if (!p) {
      // Brand new user — they need a username
      setNeedsUsername(true);
      return;
    }

    setProfile(p);

    // Load their cloud save
    const cloudSave = await loadCloudSave(u.id);
    const localRaw  = localStorage.getItem("chrysanthemum_save");
    const localSave = localRaw ? loadGame().state : null;

    if (!cloudSave) {
      // No cloud save yet — migrate local save up
      const saveToUse = localSave ?? loaded.current.state;
      const { state: ticked, summary } = applyOfflineTick(saveToUse);
      setState(ticked);
      setOfflineSummary(summary);
      await saveToCloud(u.id, ticked);
      localStorage.removeItem("chrysanthemum_save");
    } else if (localSave && localSave.lastSaved > cloudSave.lastSaved + 60_000) {
      // Both exist and local is meaningfully newer — ask player to choose
      setPendingMigration({ localSave, cloudSave });
    } else {
      // Use cloud save
      const { state: ticked, summary } = applyOfflineTick(cloudSave);
      setState(ticked);
      setOfflineSummary(summary);
      localStorage.removeItem("chrysanthemum_save");
    }
  }

  // ── Auto-save ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && !pendingMigration && !needsUsername) {
      saveToCloud(user.id, state);
    } else if (!user) {
      saveGame(state);
    }
  }, [state, user]);

  // ── Shop tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const msLeft = msUntilShopReset(prev);
        if (msLeft === 0) {
          const next = tickShop(prev);
          if (next !== prev) setShopJustRestocked(true);
          return next;
        }
        return prev;
      });
    }, 1_000);
    return () => clearInterval(interval);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────
  const update = useCallback((newState: GameState) => setState(newState), []);

  async function resolveMigration(choice: "local" | "cloud") {
    if (!pendingMigration || !user) return;
    const saveToUse = choice === "local"
      ? pendingMigration.localSave
      : pendingMigration.cloudSave;

    const { state: ticked, summary } = applyOfflineTick(saveToUse);
    setState(ticked);
    setOfflineSummary(summary);
    await saveToCloud(user.id, ticked);
    localStorage.removeItem("chrysanthemum_save");
    setPendingMigration(null);
  }

  function completeUsername(username: string) {
    setNeedsUsername(false);
    // Reload profile
    if (user) {
      getProfile(user.id).then(setProfile);
      // Migrate local save for new user
      const saveToUse = loaded.current.state;
      saveToCloud(user.id, saveToUse);
      localStorage.removeItem("chrysanthemum_save");
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <GameContext.Provider value={{
      state, update,
      offlineSummary, clearSummary: () => setOfflineSummary(EMPTY_SUMMARY),
      shopJustRestocked, clearShopNotification: () => setShopJustRestocked(false),
      user, profile, authLoading,
      signInWithGoogle, signOut,
      pendingMigration, resolveMigration,
      needsUsername, completeUsername,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}