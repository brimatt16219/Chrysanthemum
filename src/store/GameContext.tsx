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
  defaultState,
} from "./gameStore";
import {
  loadCloudSave,
  saveToCloud,
  getProfile,
  type CloudProfile,
} from "./cloudSave";
import { supabase } from "../lib/supabase";

interface GameContextValue {
  state: GameState;
  update: (newState: GameState) => void;
  offlineSummary: OfflineSummary;
  clearSummary: () => void;
  shopJustRestocked: boolean;
  clearShopNotification: () => void;
  user: User | null;
  profile: CloudProfile | null;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
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

  const [state, setState]                         = useState<GameState>(loaded.current.state);
  const [offlineSummary, setOfflineSummary]       = useState<OfflineSummary>(loaded.current.summary);
  const [shopJustRestocked, setShopJustRestocked] = useState(false);

  const [user, setUser]               = useState<User | null>(null);
  const [profile, setProfile]         = useState<CloudProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);

  const [pendingMigration, setPendingMigration] = useState<{
    localSave: GameState;
    cloudSave: GameState;
  } | null>(null);

  // Prevents handleSignIn from running concurrently or for the same user twice
  const handlingSignIn  = useRef(false);
  const lastHandledUser = useRef<string | null>(null);

  // Blocks auto-save during auth flow so stale default state can't overwrite cloud
  const authInProgress = useRef(true);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await handleSignIn(u);
      } else {
        authInProgress.current = false;
      }
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
          lastHandledUser.current = null;
          handlingSignIn.current  = false;

          // Clear localStorage so it doesn't interfere with next sign-in
          localStorage.removeItem("chrysanthemum_save");

          // Reset to a fresh default state for guest play
          const fresh = defaultState();
          setState(fresh);
          setOfflineSummary(EMPTY_SUMMARY);

          // Unblock after reset is committed
          setTimeout(() => { authInProgress.current = false; }, 500);
        }

        setAuthLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignIn(u: User) {
    if (handlingSignIn.current || lastHandledUser.current === u.id) {
      console.log("[handleSignIn] skipping duplicate for", u.id);
      return;
    }

    handlingSignIn.current  = true;
    authInProgress.current  = true;
    lastHandledUser.current = u.id;

    console.log("[handleSignIn] running for", u.id);

    try {
      const p = await getProfile(u.id);
      console.log("[handleSignIn] profile result:", p);

      if (!p) {
        setNeedsUsername(true);
        authInProgress.current = false;
        return;
      }

      setProfile(p);

      console.log("[handleSignIn] loading cloud save...");
      const cloudSave = await loadCloudSave(u.id);
      console.log("[handleSignIn] cloudSave result:", cloudSave?.coins ?? "NULL");

      const localRaw  = localStorage.getItem("chrysanthemum_save");
      const localSave = localRaw ? loadGame().state : null;
      console.log("[handleSignIn] localSave coins:", localSave?.coins ?? "NULL");

      if (!cloudSave) {
        console.log("[handleSignIn] branch: NO CLOUD SAVE");
        const saveToUse = localSave ?? loaded.current.state;
        const { state: ticked, summary } = applyOfflineTick(saveToUse);
        setState(ticked);
        setOfflineSummary(summary);
        await saveToCloud(u.id, ticked);
        localStorage.removeItem("chrysanthemum_save");
        setTimeout(() => { authInProgress.current = false; }, 1_500);
      } else if (localSave && localSave.lastSaved > cloudSave.lastSaved + 60_000) {
        console.log("[handleSignIn] branch: MIGRATION MODAL");
        setPendingMigration({ localSave, cloudSave });
        authInProgress.current = false;
      } else {
        console.log("[handleSignIn] branch: USE CLOUD SAVE — coins:", cloudSave.coins);
        const { state: ticked, summary } = applyOfflineTick(cloudSave);
        setState(ticked);
        setOfflineSummary(summary);
        localStorage.removeItem("chrysanthemum_save");
        setTimeout(() => { authInProgress.current = false; }, 1_500);
      }
    } catch (e) {
      console.error("[handleSignIn] CAUGHT ERROR:", e);
      authInProgress.current = false;
    } finally {
      handlingSignIn.current = false;
    }
  }

  // ── Auto-save — blocked during auth flow ──────────────────────────────────
  useEffect(() => {
    if (authInProgress.current) {
      console.log("[autosave] BLOCKED by authInProgress — coins:", state.coins);
      return;
    }

    if (user && !pendingMigration && !needsUsername) {
      console.log("[autosave] saving to cloud — coins:", state.coins);
      saveToCloud(user.id, state);
    } else if (!user) {
      saveGame(state);
    }
  }, [state, user]);

  // ── Shop tick — every second ───────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      // Don't tick during auth flow
      if (authInProgress.current) return;

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

  // ── Actions ───────────────────────────────────────────────────────────────
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
    if (user) {
      getProfile(user.id).then((p) => {
        setProfile(p);
        const saveToUse = loaded.current.state;
        saveToCloud(user.id, saveToUse);
        localStorage.removeItem("chrysanthemum_save");
        authInProgress.current = false;
      });
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    authInProgress.current = true;
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
