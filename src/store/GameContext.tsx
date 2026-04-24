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

  const saveEnabled        = useRef(false);
  const isLoading          = useRef(false);
  const loadedFor          = useRef<string | null>(null);
  // Set to true once INITIAL_SESSION has fired.
  // SIGNED_IN is ignored until this is true, because Supabase fires
  // SIGNED_IN during _initialize before the client is ready to make requests.
  const initialSessionFired = useRef(false);
  const stateRef            = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Load session ──────────────────────────────────────────────────────────
  async function loadUserSession(u: User | null) {
    // console.log("[load] called — isLoading:", isLoading.current, "loadedFor:", loadedFor.current, "u:", u?.id ?? "null");

    if (isLoading.current) {
      // console.log("[load] DROPPED — lock held");
      return;
    }
    if (u && loadedFor.current === u.id) {
      // console.log("[load] DROPPED — same user already loaded");
      setAuthLoading(false);
      return;
    }

    isLoading.current   = true;
    saveEnabled.current = false;
    // console.log("[load] ACQUIRED lock for", u?.id ?? "guest");

    if (!u) {
      const { state: localState, summary } = loadGame();
      setState(localState);
      setOfflineSummary(summary);
      setUser(null);
      setProfile(null);
      loadedFor.current   = null;
      saveEnabled.current = true;
      isLoading.current   = false;
      setAuthLoading(false);
      // console.log("[load] guest loaded — coins:", localState.coins);
      return;
    }

    loadedFor.current = u.id;
    setUser(u);

    try {
      // console.log("[load] fetching profile...");
      const p = await getProfile(u.id);
      // console.log("[load] profile:", p?.username ?? "null");

      if (!p) {
        setNeedsUsername(true);
        isLoading.current = false;
        setAuthLoading(false);
        return;
      }

      setProfile(p);

      // console.log("[load] fetching cloud save...");
      const cloudSave = await loadCloudSave(u.id);
      // console.log("[load] cloudSave coins:", cloudSave?.coins ?? "null");

      const localRaw  = localStorage.getItem("chrysanthemum_save");
      const localSave = localRaw ? (JSON.parse(localRaw) as GameState) : null;

      localStorage.removeItem("chrysanthemum_save");

      if (!cloudSave) {
        const saveToUse = localSave ?? defaultState();
        const { state: ticked, summary } = applyOfflineTick(saveToUse);
        // console.log("[load] no cloud save — coins:", ticked.coins);
        setState(ticked);
        setOfflineSummary(summary);
        await saveToCloud(u.id, ticked);
      } else if (localSave && localSave.lastSaved > cloudSave.lastSaved + 300_000) {
        // console.log("[load] migration needed");
        setPendingMigration({ localSave, cloudSave });
        isLoading.current = false;
        setAuthLoading(false);
        return;
      } else {
        const { state: ticked, summary } = applyOfflineTick(cloudSave);
        // console.log("[load] using cloud save — coins:", ticked.coins);
        setState(ticked);
        setOfflineSummary(summary);
      }

      setTimeout(() => {
        // console.log("[load] saves ENABLED — coins:", stateRef.current.coins);
        saveEnabled.current = true;
      }, 1_000);

    } catch (e) {
      // console.error("[load] ERROR:", e);
      const { state: localState, summary } = loadGame();
      setState(localState);
      setOfflineSummary(summary);
      saveEnabled.current = true;
    }

    isLoading.current = false;
    setAuthLoading(false);
    // console.log("[load] DONE for", u.id);
  }

  // ── Auth listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // console.log("[auth]", event, session?.user?.id ?? "none");

        if (event === "INITIAL_SESSION") {
          // Supabase is now fully initialized — safe to make requests
          initialSessionFired.current = true;
          await loadUserSession(session?.user ?? null);
          return;
        }

        if (event === "SIGNED_IN") {
          // Supabase fires SIGNED_IN during _initialize BEFORE the client
          // is ready. We must wait for INITIAL_SESSION first.
          if (!initialSessionFired.current) {
            // console.log("[auth] SIGNED_IN ignored — waiting for INITIAL_SESSION");
            return;
          }
          // After INITIAL_SESSION, SIGNED_IN means a genuine new OAuth login
          await loadUserSession(session?.user ?? null);
          return;
        }

        if (event === "SIGNED_OUT") {
          isLoading.current            = false;
          loadedFor.current            = null;
          initialSessionFired.current  = false;
          saveEnabled.current          = false;

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
          if (session?.user) setUser(session.user);
          return;
        }

        if (event === "USER_UPDATED") {
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
