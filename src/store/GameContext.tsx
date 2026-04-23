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
  refreshProfile: () => Promise<void>;
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
  const [state, setState]                       = useState<GameState>(() => defaultState());
  const [offlineSummary, setOfflineSummary]     = useState<OfflineSummary>(EMPTY_SUMMARY);
  const [shopJustRestocked, setShopJustRestocked] = useState(false);
  const [user, setUser]                         = useState<User | null>(null);
  const [profile, setProfile]                   = useState<CloudProfile | null>(null);
  const [authLoading, setAuthLoading]           = useState(true);
  const [needsUsername, setNeedsUsername]       = useState(false);
  const [pendingMigration, setPendingMigration] = useState<{
    localSave: GameState;
    cloudSave: GameState;
  } | null>(null);

  const saveEnabled   = useRef(false);
  // Tracks the user ID of the session we already loaded
  // so SIGNED_IN after INITIAL_SESSION doesn't double-load
  const loadedUserId  = useRef<string | null>(null);

  // ── Load session ──────────────────────────────────────────────────────────
  async function loadUserSession(u: User | null) {
    saveEnabled.current = false;

    if (!u) {
      const { state: localState, summary } = loadGame();
      setState(localState);
      setOfflineSummary(summary);
      setUser(null);
      setProfile(null);
      loadedUserId.current = null;
      saveEnabled.current  = true;
      setAuthLoading(false);
      return;
    }

    // Skip if we already loaded this exact user
    if (loadedUserId.current === u.id) {
      console.log("[auth] session already loaded for", u.id, "— skipping");
      setAuthLoading(false);
      return;
    }

    loadedUserId.current = u.id;
    setUser(u);

    try {
      const p = await getProfile(u.id);

      if (!p) {
        setNeedsUsername(true);
        setAuthLoading(false);
        return;
      }

      setProfile(p);

      const cloudSave = await loadCloudSave(u.id);
      const localRaw  = localStorage.getItem("chrysanthemum_save");
      const localSave = localRaw ? (JSON.parse(localRaw) as GameState) : null;

      localStorage.removeItem("chrysanthemum_save");

      if (!cloudSave) {
        const saveToUse = localSave ?? defaultState();
        const { state: ticked, summary } = applyOfflineTick(saveToUse);
        setState(ticked);
        setOfflineSummary(summary);
        await saveToCloud(u.id, ticked);
      } else if (localSave && localSave.lastSaved > cloudSave.lastSaved + 300_000) {
        setPendingMigration({ localSave, cloudSave });
        setAuthLoading(false);
        return;
      } else {
        const { state: ticked, summary } = applyOfflineTick(cloudSave);
        setState(ticked);
        setOfflineSummary(summary);
      }

      setTimeout(() => { saveEnabled.current = true; }, 1_000);
    } catch (e) {
      console.error("[loadUserSession] error:", e);
      const { state: localState, summary } = loadGame();
      setState(localState);
      setOfflineSummary(summary);
      saveEnabled.current = true;
    }

    setAuthLoading(false);
  }

  // ── Auth listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[auth]", event, session?.user?.id ?? "none");

        if (event === "INITIAL_SESSION") {
          if (!session) {
            // Clear stale tokens
            Object.keys(localStorage)
              .filter((k) => k.startsWith("sb-"))
              .forEach((k) => localStorage.removeItem(k));
          }
          await loadUserSession(session?.user ?? null);
          return;
        }

        if (event === "SIGNED_IN") {
          // loadUserSession skips if already loaded for this user
          await loadUserSession(session?.user ?? null);
          return;
        }

        if (event === "SIGNED_OUT") {
          saveEnabled.current  = false;
          loadedUserId.current = null;
          Object.keys(localStorage)
            .filter((k) => k.startsWith("sb-"))
            .forEach((k) => localStorage.removeItem(k));
          setUser(null);
          setProfile(null);
          setNeedsUsername(false);
          setPendingMigration(null);
          localStorage.removeItem("chrysanthemum_save");
          setState(defaultState());
          setOfflineSummary(EMPTY_SUMMARY);
          setTimeout(() => { saveEnabled.current = true; }, 500);
          setAuthLoading(false);
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          // Silently update user — do NOT reload save
          if (session?.user) setUser(session.user);
          return;
        }

        if (event === "USER_UPDATED") {
          // Just refresh profile data — do NOT reload save
          if (session?.user) {
            setUser(session.user);
            const p = await getProfile(session.user.id);
            if (p) setProfile(p);
          }
          return;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Auto-save ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!saveEnabled.current) return;
    if (user && !pendingMigration && !needsUsername) {
      saveToCloud(user.id, state);
    } else if (!user) {
      saveGame(state);
    }
  }, [state]);

  // ── Shop tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (!saveEnabled.current) return;
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

  async function refreshProfile() {
    if (!user) return;
    const p = await getProfile(user.id);
    if (p) setProfile(p);
  }

  async function resolveMigration(choice: "local" | "cloud") {
    if (!pendingMigration || !user) return;
    localStorage.removeItem("chrysanthemum_save");
    const saveToUse = choice === "local"
      ? pendingMigration.localSave
      : pendingMigration.cloudSave;
    const { state: ticked, summary } = applyOfflineTick(saveToUse);
    setState(ticked);
    setOfflineSummary(summary);
    await saveToCloud(user.id, ticked);
    setPendingMigration(null);
    setTimeout(() => { saveEnabled.current = true; }, 500);
  }

  function completeUsername(_username: string) {
    setNeedsUsername(false);
    if (user) {
      getProfile(user.id).then(async (p) => {
        setProfile(p);
        const fresh = defaultState();
        setState(fresh);
        await saveToCloud(user.id, fresh);
        localStorage.removeItem("chrysanthemum_save");
        setTimeout(() => { saveEnabled.current = true; }, 500);
        setAuthLoading(false);
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
    saveEnabled.current = false;
    await supabase.auth.signOut();
  }

  return (
    <GameContext.Provider value={{
      state, update,
      offlineSummary, clearSummary: () => setOfflineSummary(EMPTY_SUMMARY),
      shopJustRestocked, clearShopNotification: () => setShopJustRestocked(false),
      user, profile, authLoading,
      signInWithGoogle, signOut,
      refreshProfile,
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
