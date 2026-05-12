import { useState, useCallback, useMemo, useRef, useEffect } from "react";

function formatCoins(n: number): string {
  function floorSigFigs(x: number, digits: number): string {
    if (x === 0) return "0";
    const exp     = Math.floor(Math.log10(x));
    const factor  = Math.pow(10, exp - digits + 1);
    const floored = Math.floor(x / factor) * factor;
    return floored.toPrecision(digits).replace(/\.?0+$/, "");
  }
  if (n >= 1_000_000) return `${floorSigFigs(n / 1_000_000, 3)}m`;
  if (n >= 1_000)     return `${floorSigFigs(n / 1_000, 3)}k`;
  return Math.floor(n).toString();
}
import { useSwipe } from "./hooks/useSwipe";
import { Garden } from "./components/Garden";
import { Shop } from "./components/Shop";
import { Inventory } from "./components/Inventory";
import { OfflineBanner } from "./components/OfflineBanner";
import { ShopRestockBanner } from "./components/ShopRestockBanner";
import { CraftCompletionBanner } from "./components/CraftCompletionBanner";
import { GearExpiryBanner } from "./components/GearExpiryBanner";
import { UsernameModal } from "./components/UsernameModal";
import { SignInPromptModal } from "./components/SignInPromptModal";
import { SearchPage } from "./components/SearchPage";
import { ProfilePage } from "./components/ProfilePage";
import { FriendsPage } from "./components/FriendsPage";
import { MailboxPage } from "./components/MailboxPage";
import { LeaderboardPage } from "./components/LeaderboardPage";
import { FriendRequestNotification } from "./components/FriendRequestNotification";
import { GiftNotification } from "./components/GiftNotification";
import { Codex } from "./components/Codex";
import { AlchemyTab } from "./components/AlchemyTab";
import { CraftingTab } from "./components/CraftingTab";
import { ActiveBoostsHUD } from "./components/ActiveBoostsHUD";
import { MarketplaceTab } from "./components/MarketplaceTab";
import { WeatherOverlay } from "./components/WeatherOverlay";
import { DevWeatherPanel } from "./components/DevWeatherPanel";
import { WeatherBanner } from "./components/WeatherBanner";
import { WeatherForecastPanel } from "./components/WeatherForecastPanel";
import { DayNightOverlay } from "./components/DayNightOverlay";
import { useGame } from "./store/GameContext";
import { supabase } from "./lib/supabase";
import { SettingsProvider, useSettings } from "./store/SettingsContext";
import { useFriendRequests } from "./hooks/useFriendRequests";
import { useGiftNotifications } from "./hooks/useGiftNotifications";
import { useMailbox } from "./hooks/useMailbox";
import { useDayNight } from "./hooks/useDayNight";
import { getFlower, MUTATIONS } from "./data/flowers";
import type { MutationType } from "./data/flowers";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { usePresence } from "./hooks/usePresence";
import { UpdateBanner } from "./components/UpdateBanner";
import { HarvestPopup } from "./components/HarvestPopup";
import { GenericToastPopup } from "./components/GenericToastPopup";
import { GardenerXpBar } from "./components/GardenerXpBar";
import { CHANGELOGS, LATEST_CHANGELOG_VERSION, type ChangelogEntry } from "./data/changelog";
import { EventsTab } from "./components/EventsTab";
import { ACHIEVEMENTS } from "./data/achievements";
import { LoginPage } from "./components/LoginPage";
import { useAudio } from "./hooks/useAudio";
import { audioManager } from "./lib/audioManager";
import { SettingsModal } from "./components/SettingsModal";
import { ItemSprite } from "./components/ItemSprite";

type Tab = "garden" | "shop" | "inventory" | "social" | "codex" | "alchemy" | "craft" | "events";
type ShopView   = "seeds" | "supply";
type SocialView = "search" | "friends" | "mailbox" | "leaderboard" | "marketplace";

const TAB_EMOJI: Record<Tab, string> = {
  garden:    "🌱",
  shop:      "🛒",
  inventory: "🎒",
  alchemy:   "⚗️",
  craft:     "⚒️",
  codex:     "📖",
  events:    "🎉",
  social:    "👥",
};


export default function App() {
  return <SettingsProvider><AppInner /></SettingsProvider>;
}

function AppInner() {
  const {
    state, update, getState, offlineSummary, clearSummary,
    shopJustRestocked,   clearShopNotification,
    supplyJustRestocked, clearSupplyNotification,
    gearExpiry, clearGearExpiry,
    craftCompletions, dismissCraftCompletion,
    attunementCompletions, dismissAttunementCompletion,
    user, profile, authLoading,
    signInWithGoogle, signOut,
    needsUsername, completeUsername,
    isStaleTab,
    signInPromptReason, dismissSignInPrompt,
    activeWeather, weatherMsLeft, weatherIsActive,
  } = useGame();

  const { settings } = useSettings();

  useAudio(!!user);

  // ── Level-up SFX ─────────────────────────────────────────────────────────────
  const prevGardenerLevelRef = useRef(state.gardenerLevel);
  useEffect(() => {
    if (state.gardenerLevel > prevGardenerLevelRef.current) {
      audioManager.playSfx("levelUp");
    }
    prevGardenerLevelRef.current = state.gardenerLevel;
  }, [state.gardenerLevel]);

  usePresence();

  const { pendingCount, newRequest, clearNewRequest } = useFriendRequests(user?.id ?? null);
  const { newGift, clearNewGift } = useGiftNotifications(user?.id ?? null);
  const { unreadCount: mailboxUnreadCount } = useMailbox(user?.id ?? null);
  const [showSettings,  setShowSettings]  = useState(false);

  const [tab, setTab]               = useState<Tab>("garden");
  const [shopView,      setShopView]      = useState<ShopView>("seeds");
  const [socialView,    setSocialView]    = useState<SocialView>("search");
  const [inventoryTab,  setInventoryTab]  = useState<0|1|2|3|4>(0);
  const [alchemyView,   setAlchemyView]   = useState<"sacrifice"|"attune">("sacrifice");
  const [showBanner, setShowBanner] = useState(true);
  const [showForecast, setShowForecast] = useState(false);
  const [tabDir, setTabDir] = useState<"left" | "right" | null>(null);
  const [subDir, setSubDir] = useState<"left" | "right" | null>(null);

  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  const updateAvailable  = useVersionCheck();
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const { harvestPopups, pushHarvestPopup, dismissHarvestPopup, genericToasts, dismissGenericToast } = useGame();

  const [changelogEntry, setChangelogEntry] = useState<ChangelogEntry | null>(() => {
    const seen = localStorage.getItem("changelogSeenVersion");
    return seen !== LATEST_CHANGELOG_VERSION ? CHANGELOGS[0] : null;
  });

  // Day/night cycle — client-side, based on local time
  const dayPeriod = useDayNight();


  // ── Garden bloom badge ────────────────────────────────────────────────────────
  // Tracks new blooms since the user last visited the garden tab.
  // Cleared when they open garden; only increments while on another tab.
  const currentBloomedCount = state.grid.flat().filter((cell) => cell.plant?.bloomedAt).length;

  const gardenBloomBaselineRef = useRef<number | null>(null);
  const [gardenNewBlooms, setGardenNewBlooms] = useState(0);

  useEffect(() => {
    if (gardenBloomBaselineRef.current === null) {
      gardenBloomBaselineRef.current = currentBloomedCount;
      return;
    }
    const delta = currentBloomedCount - gardenBloomBaselineRef.current;
    if (delta > 0 && tabRef.current !== "garden") {
      setGardenNewBlooms((n) => n + delta);
    }
    gardenBloomBaselineRef.current = currentBloomedCount;
  }, [currentBloomedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shop restock badges ───────────────────────────────────────────────────────
  // Each restock that the user hasn't acknowledged = +1 badge on that sub-tab.
  const prevShopRestockedRef   = useRef(false);
  const prevSupplyRestockedRef = useRef(false);
  const [newSeedsShopBadge,  setNewSeedsShopBadge]  = useState(0);
  const [newSupplyShopBadge, setNewSupplyShopBadge] = useState(0);

  useEffect(() => {
    if (shopJustRestocked && !prevShopRestockedRef.current) {
      // Only add badge if user isn't already looking at seeds tab
      if (tabRef.current !== "shop" || shopViewRef.current !== "seeds") {
        setNewSeedsShopBadge((n) => n + 1);
      }
    }
    prevShopRestockedRef.current = shopJustRestocked;
  }, [shopJustRestocked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (supplyJustRestocked && !prevSupplyRestockedRef.current) {
      if (tabRef.current !== "shop" || shopViewRef.current !== "supply") {
        setNewSupplyShopBadge((n) => n + 1);
      }
    }
    prevSupplyRestockedRef.current = supplyJustRestocked;
  }, [supplyJustRestocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inventory new-items badge ─────────────────────────────────────────────────
  // Tracks items added since the user last opened each inventory sub-tab.
  const currentSeedCount   = state.inventory.filter((i) =>  i.isSeed && i.quantity > 0).reduce((s, i) => s + i.quantity, 0);
  const currentBloomCount  = state.inventory.filter((i) => !i.isSeed && i.quantity > 0).reduce((s, i) => s + i.quantity, 0);
  const currentSupplyCount = (state.fertilizers   ?? []).reduce((s, f) => s + f.quantity, 0)
                           + (state.gearInventory ?? []).reduce((s, g) => s + g.quantity, 0);

  const seedBaselineRef   = useRef<number | null>(null);
  const bloomBaselineRef  = useRef<number | null>(null);
  const supplyBaselineRef = useRef<number | null>(null);
  const tabRef            = useRef(tab);
  const shopViewRef       = useRef(shopView);

  const [newSeeds,    setNewSeeds]    = useState(0);
  const [newBlooms,   setNewBlooms]   = useState(0);
  const [newSupplies, setNewSupplies] = useState(0);

  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { shopViewRef.current = shopView; }, [shopView]);

  useEffect(() => {
    // First render: initialise baselines without counting anything as "new"
    if (seedBaselineRef.current === null) {
      seedBaselineRef.current   = currentSeedCount;
      bloomBaselineRef.current  = currentBloomCount;
      supplyBaselineRef.current = currentSupplyCount;
      return;
    }

    const dSeeds   = currentSeedCount   - seedBaselineRef.current;
    const dBlooms  = currentBloomCount  - (bloomBaselineRef.current  ?? 0);
    const dSupplies = currentSupplyCount - (supplyBaselineRef.current ?? 0);

    // Only accumulate when user is NOT viewing inventory (so they notice the badge)
    if (tabRef.current !== "inventory") {
      if (dSeeds   > 0) setNewSeeds((n)   => n + dSeeds);
      if (dBlooms  > 0) setNewBlooms((n)  => n + dBlooms);
      if (dSupplies > 0) setNewSupplies((n) => n + dSupplies);
    }

    seedBaselineRef.current   = currentSeedCount;
    bloomBaselineRef.current  = currentBloomCount;
    supplyBaselineRef.current = currentSupplyCount;
  }, [currentSeedCount, currentBloomCount, currentSupplyCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const newInvTotal = newSeeds + newBlooms + newSupplies;

  // ── Codex unseen entries (badge + red dot + "newly discovered" labels) ───
  // Tracks WHICH entries the user has acknowledged by opening the card —
  // unseen = state.discovered − acknowledged. Persisted to localStorage so
  // the "newly discovered" indicators survive page reloads / new builds.
  // The set persists across tab navigations (badge sticks until user opens
  // the specific entry's card) and is invalidated on sign-out.
  // ── Codex unseen entries (badge + red dot + "newly discovered" labels) ───
  // unseenCodex = state.discovered − state.codexAcked.
  // codexAcked is persisted in the cloud save so badges sync across devices.
  const unseenCodex = useMemo<Set<string>>(() => {
    const acked = new Set(state.codexAcked ?? []);
    const out = new Set<string>();
    for (const id of state.discovered ?? []) {
      if (!acked.has(id)) out.add(id);
    }
    return out;
  }, [state.discovered, state.codexAcked]);

  // Codex calls this when the user expands a flower's card — marks every
  // entry belonging to that species (base + any mutations) as seen.
  const markCodexSeen = useCallback((speciesId: string) => {
    const prefix = `${speciesId}:`;
    const toAdd = (state.discovered ?? []).filter(
      (id) => id === speciesId || id.startsWith(prefix)
    );
    if (toAdd.length === 0) return;
    const next = [...new Set([...(state.codexAcked ?? []), ...toAdd])];
    update({ ...state, codexAcked: next });
    if (user) {
      supabase.from("game_saves")
        .update({ codex_acked: next })
        .eq("user_id", user.id)
        .select("updated_at")
        .single()
        .then(({ data, error }) => {
          if (error) { console.error("Failed to persist codexAcked:", error); return; }
          // Sync serverUpdatedAt so the next CAS save uses the correct DB timestamp.
          if (data?.updated_at) update({ ...getState(), serverUpdatedAt: data.updated_at });
        });
    }
  }, [state, update, getState, user]);

  // Social tab badge = friend requests + unread mailbox
  // (gifts now arrive via mailbox so mailboxUnreadCount already includes them)
  const socialBadgeCount = pendingCount + mailboxUnreadCount;

  // ── Craft tab badge — count of claimable (done) crafts in the queue ─────
  // Drives the badge under the ⚒️ tab. Re-derived every second via the local
  // `craftBadgeNow` ticker (state.craftingQueue itself doesn't change as a
  // craft passes its finish time, so we need our own clock for this).
  const [craftBadgeNow, setCraftBadgeNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setCraftBadgeNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);
  const claimableCraftsCount = (state.craftingQueue ?? []).reduce((acc, e) => {
    const doneAt = new Date(e.startedAt).getTime() + e.durationMs;
    return craftBadgeNow >= doneAt ? acc + 1 : acc;
  }, 0);
  // Same logic for the Alchemy attunement queue — drives the ⚗️ tab badge.
  const claimableAttunementsCount = (state.attunementQueue ?? []).reduce((acc, e) => {
    const doneAt = new Date(e.startedAt).getTime() + e.durationMs;
    return craftBadgeNow >= doneAt ? acc + 1 : acc;
  }, 0);

  // ── Events tab badge ─────────────────────────────────────────────────────────
  // True if any sub-section (events / daily / achievements) has something actionable.
  const eventsBadge = useMemo(() => {
    // Events: any active events
    if ((state.events ?? []).length > 0) return true;
    // Daily: any reward tier unlocked but not yet collected
    if (state.dailyTasks) {
      const { tasks, rewardsCollected } = state.dailyTasks;
      const completedCount = tasks.filter((t) => t.completed).length;
      if (rewardsCollected.some((_c, i) => !rewardsCollected[i] && completedCount >= i + 1)) return true;
    }
    // Achievements: any locally-verifiable achievement ready to claim
    const speciesDiscovered = new Set(
      state.inventory.filter((i) => !i.isSeed).map((i) => i.speciesId)
    ).size;
    return ACHIEVEMENTS.some((a) => {
      if (state.achievementsClaimed.includes(a.id)) return false;
      if (a.check.kind === "friends_count" || a.check.kind === "recipe_completed") return false;
      if (a.check.kind === "stat") return (state.achievementStats[a.check.statKey] ?? 0) >= a.target;
      if (a.check.kind === "species_discovered") return speciesDiscovered >= a.target;
      return false;
    });
  }, [state.events, state.dailyTasks, state.achievementsClaimed, state.achievementStats, state.inventory]);

  // ── Swipe navigation ─────────────────────────────────────────────────────────
  // Flat order: garden(0) → shop:seeds(1) → shop:supply(2) →
  //             inventory(3) → alchemy(4) → codex(5) →
  //             social:search(6) → friends(7) → mailbox(8) →
  //             marketplace(9) → leaderboard(10) → me(profile)
  const MAIN_TABS: Tab[] = ["garden", "shop", "inventory", "alchemy", "craft", "codex", "events", "social"];

  const handleSwipeLeft = useCallback(() => {
    if (profileUsername) return;
    if (tab === "shop") {
      const idx = SHOP_VIEWS.indexOf(shopView);
      if (idx < SHOP_VIEWS.length - 1) {
        setSubDir("left"); setTabDir(null);
        setShopView(SHOP_VIEWS[idx + 1]);
        return;
      }
      setTabDir("left"); setSubDir(null);
      setTab("inventory");
      setInventoryTab(0); // enter inventory at Seeds
      return;
    }
    if (tab === "inventory") {
      if (inventoryTab < 4) {
        setSubDir("left"); setTabDir(null);
        setInventoryTab((inventoryTab + 1) as 0|1|2|3|4);
        return;
      }
      // Last inventory tab → enter alchemy at first view
      setTabDir("left"); setSubDir(null);
      setTab("alchemy");
      setAlchemyView("sacrifice");
      return;
    }
    if (tab === "alchemy") {
      if (alchemyView === "sacrifice") {
        setSubDir("left"); setTabDir(null);
        setAlchemyView("attune");
        return;
      }
      // Last alchemy view → fall through to craft via main tab logic
    }
    if (tab === "social") {
      const idx = SOCIAL_VIEWS.indexOf(socialView);
      if (idx < SOCIAL_VIEWS.length - 1) {
        setSubDir("left"); setTabDir(null);
        setSocialView(SOCIAL_VIEWS[idx + 1]);
        return;
      }
      if (user && profile?.username) {
        setSubDir("left"); setTabDir(null);
        setProfileUsername(profile.username);
      }
      return;
    }
    const idx = MAIN_TABS.indexOf(tab);
    if (idx < MAIN_TABS.length - 1) {
      const next = MAIN_TABS[idx + 1];
      setTabDir("left"); setSubDir(null);
      setTab(next);
      if (next === "shop")   setShopView("seeds");
      if (next === "social") setSocialView("search");
    }
  }, [tab, shopView, socialView, profileUsername, user, profile, inventoryTab, alchemyView]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwipeRight = useCallback(() => {
    if (tab === "social" && profileUsername) {
      setSubDir("right"); setTabDir(null);
      setProfileUsername(null);
      setSocialView("leaderboard");
      return;
    }
    if (tab === "social") {
      const idx = SOCIAL_VIEWS.indexOf(socialView);
      if (idx > 0) {
        setSubDir("right"); setTabDir(null);
        setSocialView(SOCIAL_VIEWS[idx - 1]);
        return;
      }
      setTabDir("right"); setSubDir(null);
      setTab("codex");
      return;
    }
    if (tab === "shop") {
      const idx = SHOP_VIEWS.indexOf(shopView);
      if (idx > 0) {
        setSubDir("right"); setTabDir(null);
        setShopView(SHOP_VIEWS[idx - 1]);
        return;
      }
      setTabDir("right"); setSubDir(null);
      setTab("garden");
      return;
    }
    if (tab === "alchemy") {
      if (alchemyView === "attune") {
        setSubDir("right"); setTabDir(null);
        setAlchemyView("sacrifice");
        return;
      }
      // First alchemy view → enter inventory at last tab (Essences)
      setTabDir("right"); setSubDir(null);
      setTab("inventory");
      setInventoryTab(4);
      return;
    }
    if (tab === "inventory") {
      if (inventoryTab > 0) {
        setSubDir("right"); setTabDir(null);
        setInventoryTab((inventoryTab - 1) as 0|1|2|3|4);
        return;
      }
      // First inventory tab → shop's last sub-tab
      setTabDir("right"); setSubDir(null);
      setTab("shop");
      setShopView("supply");
      return;
    }
    const idx = MAIN_TABS.indexOf(tab);
    if (idx > 0) {
      setTabDir("right"); setSubDir(null);
      setTab(MAIN_TABS[idx - 1]);
    }
  }, [tab, shopView, socialView, profileUsername, inventoryTab, alchemyView]); // eslint-disable-line react-hooks/exhaustive-deps

  const swipeHandlers = useSwipe(handleSwipeLeft, handleSwipeRight);

  // Flat index across the entire nav sequence:
  // garden(0) → shop:seeds(1) → shop:supply(2) → inventory(3) →
  // alchemy(4) → codex(5) → social:search(6) → friends(7) → mailbox(8) →
  // marketplace(9) → leaderboard(10)
  const SHOP_VIEWS:   ShopView[]   = ["seeds", "supply"];
  const SOCIAL_VIEWS: SocialView[] = ["search", "friends", "mailbox", "marketplace", "leaderboard"];

  function flatNavIndex(t: Tab, shv: ShopView, sv: SocialView): number {
    if (t === "garden")    return 0;
    if (t === "shop")      return 1 + SHOP_VIEWS.indexOf(shv);
    if (t === "inventory") return 3;
    if (t === "alchemy")   return 4;
    if (t === "craft")     return 5;
    if (t === "codex")     return 6;
    return 7 + SOCIAL_VIEWS.indexOf(sv); // social
  }

  function handleViewProfile(username: string) {
    setSubDir("left");
    setTabDir(null);
    setTab("social");
    setProfileUsername(username);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleTabChange(t: Tab) {
    const cur  = flatNavIndex(tab, shopView, socialView);
    const next = flatNavIndex(t, "seeds", "search");
    setTabDir(next > cur ? "left" : "right");
    setSubDir(null);
    setTab(t);
    if (t === "shop")   setShopView("seeds");
    if (t === "social") setSocialView("search");
    setProfileUsername(null);

    // Scroll to top whenever the user actually navigates to a different tab.
    // Without this, switching from a deeply-scrolled tab (leaderboard, codex, marketplace)
    // to another tab leaves you mid-page on the new tab, which feels broken on mobile.
    // Skipped on same-tab clicks so re-tapping the active tab doesn't punt you out of context.
    if (t !== tab) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    // Clear inventory new-items badges and reset baselines when entering inventory
    if (t === "inventory") {
      setNewSeeds(0);
      setNewBlooms(0);
      setNewSupplies(0);
      seedBaselineRef.current   = currentSeedCount;
      bloomBaselineRef.current  = currentBloomCount;
      supplyBaselineRef.current = currentSupplyCount;
    }
    // Clear garden badge when entering garden
    if (t === "garden") {
      setGardenNewBlooms(0);
      gardenBloomBaselineRef.current = currentBloomedCount;
    }
    // Clear shop badges when entering shop
    if (t === "shop") {
      setNewSeedsShopBadge(0);
      setNewSupplyShopBadge(0);
    }
    // Codex badge intentionally persists across tab visits — cleared per-flower
    // when the user expands that flower's card (handled inside <Codex/>).
  }

  function handleShopViewChange(v: ShopView) {
    const dir = SHOP_VIEWS.indexOf(v) > SHOP_VIEWS.indexOf(shopView) ? "left" : "right";
    setSubDir(dir);
    setTabDir(null);
    setShopView(v);
    // Clear the badge for whichever sub-tab the user is now viewing
    if (v === "seeds")  setNewSeedsShopBadge(0);
    if (v === "supply") setNewSupplyShopBadge(0);
  }

  function handleSocialViewChange(v: SocialView) {
    const dir = SOCIAL_VIEWS.indexOf(v) > SOCIAL_VIEWS.indexOf(socialView) ? "left" : "right";
    setSubDir(dir);
    setTabDir(null);
    setSocialView(v);
    setProfileUsername(null);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-4xl animate-pulse">🌱</span>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onSignIn={signInWithGoogle}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Stale-tab overlay — shown when another tab took over this session */}
      {isStaleTab && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm mx-4 text-center space-y-3 shadow-2xl">
            <p className="text-2xl">🌿</p>
            <p className="font-semibold text-foreground">Session moved to another tab</p>
            <p className="text-sm text-muted-foreground">
              You opened Chrysanthemum in another tab. Saves are disabled here to prevent conflicts.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Resume here
            </button>
          </div>
        </div>
      )}

      {/* Modals & toasts */}
      {showBanner && (
        <OfflineBanner
          summary={offlineSummary}
          changelog={changelogEntry}
          username={profile?.username ?? null}
          onDismiss={() => {
            setShowBanner(false);
            clearSummary();
            if (changelogEntry) {
              localStorage.setItem("changelogSeenVersion", LATEST_CHANGELOG_VERSION);
              setChangelogEntry(null);
            }
          }}
        />
      )}
      {/* Floating banners — wrapped in a single fixed container so they stack
          vertically when multiple fire instead of rendering on top of each
          other. flex-col-reverse keeps the most recent banner closest to the
          anchor (bottom edge); older banners stack above. */}
      {(shopJustRestocked || supplyJustRestocked || craftCompletions.length > 0 || attunementCompletions.length > 0 || !!gearExpiry) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse items-center gap-2 pointer-events-none">
          {shopJustRestocked && (
            <ShopRestockBanner onDismiss={clearShopNotification} type="seeds" />
          )}
          {supplyJustRestocked && (
            <ShopRestockBanner onDismiss={clearSupplyNotification} type="supply" />
          )}
          {gearExpiry && (
            <GearExpiryBanner gearType={gearExpiry.gearType} onDismiss={clearGearExpiry} />
          )}
          {craftCompletions.map((c) => (
            <CraftCompletionBanner
              key={c.id}
              emoji={c.emoji}
              name={c.name}
              onDismiss={() => dismissCraftCompletion(c.id)}
            />
          ))}
          {attunementCompletions.map((c) => (
            <CraftCompletionBanner
              key={c.id}
              emoji={c.emoji}
              name={c.name}
              title="Attunement Ready!"
              onDismiss={() => dismissAttunementCompletion(c.id)}
            />
          ))}
        </div>
      )}
      {newRequest && (
        <FriendRequestNotification
          onDismiss={clearNewRequest}
          onView={() => {
            clearNewRequest();
            setSocialView("friends");
            setTab("social");
            setProfileUsername(null);
          }}
        />
      )}
      {newGift && (
        <GiftNotification
          onDismiss={clearNewGift}
          onView={() => {
            clearNewGift();
            setSocialView("mailbox");
            setTab("social");
            setProfileUsername(null);
          }}
        />
      )}
      {needsUsername && user && (
        <UsernameModal user={user} onComplete={completeUsername} />
      )}
      {/* Guest sign-in prompt — opened by requestSignIn() from any component
          that needs auth (Buy buttons, Upgrade buttons, etc. — see #148). */}
      {signInPromptReason !== null && (
        <SignInPromptModal
          reason={signInPromptReason}
          onClose={dismissSignInPrompt}
          onSignIn={async () => {
            dismissSignInPrompt();
            await signInWithGoogle();
          }}
        />
      )}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSignOut={user ? () => { setShowSettings(false); signOut(); } : undefined}
        />
      )}

      {updateAvailable && !dismissedUpdate && (
        <UpdateBanner onDismiss={() => setDismissedUpdate(true)} />
      )}

      {/* Dev-only weather tester — never ships to production */}
      {import.meta.env.DEV && <DevWeatherPanel />}

      {/* Weather forecast panel */}
      {showForecast && (
        <WeatherForecastPanel onClose={() => setShowForecast(false)} />
      )}

      {/* Day/night ambient tint — z-10, below weather overlay */}
      <DayNightOverlay period={dayPeriod} />

      {/* Weather overlay — z-20, above day/night */}
      <WeatherOverlay weatherType={activeWeather} isActive={weatherIsActive} />

      {/* HUD + Tab bar — sticky together so both stay pinned while scrolling */}
      <div className="sticky top-0 z-30" data-sticky-nav>
      <header className="bg-card/80 backdrop-blur border-b border-border">
        <div className="w-full sm:max-w-2xl sm:mx-auto flex items-center justify-between px-3 sm:px-4 py-3">
          <h1
            className="font-bold text-primary tracking-wide cursor-pointer flex items-center gap-1"
            onClick={() => handleTabChange("garden")}
          >
            {settings.useSprites
              ? <img src="/sprites/ui/logo.png" alt="🌸" className="w-6 h-6 object-contain" style={{ imageRendering: "pixelated" }} />
              : <span>🌸</span>
            }
            <span className="hidden sm:block text-lg">Chrysanthemum</span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Combined day/night + weather banner — click to open forecast */}
            <button
              onClick={() => setShowForecast(true)}
              className="cursor-pointer hover:opacity-80 transition-opacity rounded-full focus:outline-none"
              title="View weather forecast"
            >
              <WeatherBanner
                weatherType={activeWeather}
                isActive={weatherIsActive}
                msLeft={weatherMsLeft}
                period={dayPeriod}
                suppressTime={(state.activeBoosts ?? []).some(
                  (b) => new Date(b.expiresAt).getTime() > Date.now(),
                )}
              />
            </button>
            <ActiveBoostsHUD activeBoosts={state.activeBoosts} />
            <span className="flex items-center gap-1 text-sm font-mono" title={state.coins.toLocaleString()}>
              <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-4 h-4" />
              {formatCoins(state.coins)}
            </span>
            <span className="flex items-center gap-1 text-sm font-mono" title={state.gems.toLocaleString()}>
              {settings.useSprites
                ? <img src="/sprites/ui/gems.png" alt="gems" className="w-4 h-4 object-contain" style={{ imageRendering: "pixelated" }} />
                : <span>💎</span>
              }
              {state.gems.toLocaleString()}
            </span>
            {!authLoading && (
              user ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewProfile(profile?.username ?? "")}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span className="relative text-base leading-none">
                      {getFlower(profile?.display_flower ?? "daisy")?.emoji.bloom ?? "🌸"}
                      {profile?.display_mutation && (
                        <span className="absolute -top-1 -right-1 text-xs leading-none">
                          {MUTATIONS[profile.display_mutation as MutationType]?.emoji}
                        </span>
                      )}
                    </span>
                    <span className="hidden sm:inline">{profile?.username ?? "..."}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="text-xs px-2 sm:px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                >
                  Sign in
                </button>
              )
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs px-2 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
              title="Settings"
            >
              {settings.useSprites
                ? <img src="/sprites/ui/settings.png" alt="⚙️" className="w-4 h-4 object-contain" style={{ imageRendering: "pixelated" }} />
                : <span>⚙️</span>
              }
            </button>
          </div>
        </div>
        <GardenerXpBar level={state.gardenerLevel} xp={state.gardenerXp} />
      </header>

      {/* Tabs */}
      <nav className="bg-card/40 border-b border-border backdrop-blur">
        <div className="w-full sm:max-w-2xl sm:mx-auto flex">
          {(["garden", "shop", "inventory", "alchemy", "craft", "codex", "events", "social"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`
                flex-1 py-3 text-sm font-medium transition-colors border-b-2 relative
                flex flex-col items-center justify-center
                ${tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {settings.useSprites
                ? <img
                    src={`/sprites/ui/tab_${t}.png`}
                    alt={t}
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                : <span className="text-lg sm:text-xl leading-none">{TAB_EMOJI[t]}</span>
              }
              <span className="hidden sm:inline text-xs capitalize">{t}</span>

              {t === "garden"    && gardenNewBlooms > 0                              && <span className="absolute top-2 right-1 sm:right-6 w-2.5 h-2.5 bg-primary rounded-full" />}
              {t === "shop"      && (newSeedsShopBadge + newSupplyShopBadge) > 0      && <span className="absolute top-2 right-1 sm:right-6 w-2.5 h-2.5 bg-primary rounded-full" />}
              {t === "inventory" && newInvTotal > 0                                   && <span className="absolute top-2 right-1 sm:right-6 w-2.5 h-2.5 bg-primary rounded-full" />}
              {t === "craft"     && claimableCraftsCount > 0                          && <span className="absolute top-2 right-1 sm:right-6 w-2.5 h-2.5 bg-primary rounded-full" />}
              {t === "alchemy"   && claimableAttunementsCount > 0                     && <span className="absolute top-2 right-1 sm:right-6 w-2.5 h-2.5 bg-primary rounded-full" />}
              {t === "codex"     && unseenCodex.size > 0                              && <span className="absolute top-2 right-1 sm:right-6 w-2.5 h-2.5 bg-primary rounded-full" />}
              {t === "events"    && eventsBadge                                        && <span className="absolute top-2 right-1 sm:right-6 w-2.5 h-2.5 bg-primary rounded-full" />}
              {t === "social"    && socialBadgeCount > 0                              && <span className="absolute top-2 right-1 sm:right-6 w-2.5 h-2.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>
      </nav>
      </div>{/* end sticky wrapper */}

      {/* Content */}
      <main
        className="flex-1 w-full sm:max-w-2xl sm:mx-auto px-3 sm:px-4 py-6 sm:py-8 overflow-x-hidden"
        {...swipeHandlers}
      >
        {/* Always-mounted garden — hidden when on another tab so bell/auto-planter keep running */}
        <div className={tab !== "garden" ? "hidden" : ""}>
          <Garden onHarvestPopup={pushHarvestPopup} />
        </div>

        {tab !== "garden" && (
        <div
          key={tab}
          className={tabDir === "left" ? "slide-from-right" : tabDir === "right" ? "slide-from-left" : ""}
        >
        <>
          {tab === "shop"        && (
            <>
              {/* Shop sub-nav */}
              <div className="flex gap-2 mb-6">
                {(["seeds", "supply"] as ShopView[]).map((v) => {
                  const badge = v === "seeds" ? newSeedsShopBadge : newSupplyShopBadge;
                  return (
                    <button
                      key={v}
                      onClick={() => handleShopViewChange(v)}
                      className={`
                        flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center relative
                        ${shopView === v
                          ? "bg-primary/20 border border-primary/50 text-primary"
                          : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                        }
                      `}
                    >
                      {v === "seeds" ? "🌱 Seeds" : "🧪 Supply"}
                      {badge > 0 && shopView !== v && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Animated shop content */}
              <div
                key={shopView}
                className={subDir === "left" ? "slide-from-right" : subDir === "right" ? "slide-from-left" : ""}
              >
                <Shop view={shopView} />
              </div>
            </>
          )}
          {tab === "inventory"   && (
            <Inventory
              newSeeds={newSeeds}
              newBlooms={newBlooms}
              newSupplies={newSupplies}
              activeTab={inventoryTab}
              onTabChange={(t) => setInventoryTab(t)}
              onSubTabView={(subTab) => {
                if (subTab === "seeds")    setNewSeeds(0);
                if (subTab === "blooms")   setNewBlooms(0);
                if (subTab === "supplies") setNewSupplies(0);
              }}
            />
          )}
          {tab === "alchemy"     && <AlchemyTab activeView={alchemyView} onViewChange={setAlchemyView} />}
          {tab === "craft"       && <CraftingTab />}
          {tab === "codex"       && <Codex unseenEntries={unseenCodex} markSeen={markCodexSeen} />}
          {tab === "events"      && <EventsTab />}
          {tab === "social"    && (
            <>
              {/* Sub-nav — always visible for signed-in users; guests only see Market */}
              {(user || socialView === "marketplace") && (
                <div className="flex gap-2 mb-6">
                  {(["search", "friends", "mailbox", "marketplace", "leaderboard"] as SocialView[]).map((v) => {
                    const mailboxBadge = mailboxUnreadCount;
                    return (
                      <button
                        key={v}
                        onClick={() => handleSocialViewChange(v)}
                        className={`
                          flex-1 py-2 rounded-xl text-xs font-semibold transition-all relative text-center
                          ${socialView === v && !profileUsername
                            ? "bg-primary/20 border border-primary/50 text-primary"
                            : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                          }
                        `}
                      >
                        <span>
                          {v === "search"        ? "🔍"
                           : v === "friends"     ? "👥"
                           : v === "mailbox"     ? "📬"
                           : v === "marketplace" ? "🏪"
                           : "🏆"}
                        </span>
                        <span className="hidden sm:inline ml-1">
                          {v === "search"        ? "Search"
                           : v === "friends"     ? "Friends"
                           : v === "mailbox"     ? "Mailbox"
                           : v === "marketplace" ? "Market"
                           : "Ranks"}
                        </span>
                        {v === "friends" && pendingCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                            {pendingCount}
                          </span>
                        )}
                        {v === "mailbox" && mailboxBadge > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                            {mailboxBadge > 9 ? "9+" : mailboxBadge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {user && (
                    <button
                      onClick={() => handleViewProfile(profile?.username ?? "")}
                      className={`
                        flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center
                        ${profileUsername === profile?.username
                          ? "bg-primary/20 border border-primary/50 text-primary"
                          : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                        }
                      `}
                    >
                      <span>👤</span>
                      <span className="hidden sm:inline ml-1">Me</span>
                    </button>
                  )}
                </div>
              )}

              {/* Social content — animated independently from the sub-nav */}
              <div
                key={profileUsername ?? socialView}
                className={subDir === "left" ? "slide-from-right" : subDir === "right" ? "slide-from-left" : ""}
              >
                {/* Profile page takes priority over any social sub-view (including marketplace) */}
                {profileUsername ? (
                  <ProfilePage username={profileUsername} />
                ) : socialView === "marketplace" ? (
                  <MarketplaceTab
                    onViewProfile={handleViewProfile}
                    onSignIn={signInWithGoogle}
                  />
                ) : user ? (
                  <>
                    {socialView === "search"      && <SearchPage onViewProfile={handleViewProfile} />}
                    {socialView === "friends"     && <FriendsPage onViewProfile={handleViewProfile} />}
                    {socialView === "mailbox"     && <MailboxPage onViewProfile={handleViewProfile} />}
                    {socialView === "leaderboard" && <LeaderboardPage onViewProfile={handleViewProfile} />}
                  </>
                ) : (
                  <GuestSocialPrompt onSignIn={signInWithGoogle} />
                )}
              </div>
            </>
          )}
        </>
        </div>
        )}
      </main>

      {/* Harvest popups — one pill per unique species+mutation, stacked vertically */}
      {(harvestPopups.size > 0 || genericToasts.size > 0) && (
        <div className="fixed inset-0 pointer-events-none z-50 flex flex-col items-center justify-end pb-24 gap-2">
          {[...harvestPopups.entries()].map(([key, entry]) => (
            <HarvestPopup
              key={key}
              speciesId={entry.speciesId}
              mutation={entry.mutation}
              count={entry.count}
              isSeed={entry.isSeed}
              onDone={() => dismissHarvestPopup(key)}
            />
          ))}
          {[...genericToasts.entries()].map(([key, entry]) => (
            <GenericToastPopup
              key={key}
              emoji={entry.emoji}
              label={entry.label}
              count={entry.count}
              color={entry.color}
              variant={entry.variant}
              onDone={() => dismissGenericToast(key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GuestSocialPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <p className="text-5xl">🌍</p>
      <p className="font-semibold">Sign in to access social features</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Search for other players, view their gardens, and show off your collection.
      </p>
      <button
        onClick={onSignIn}
        className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Sign in with Google
      </button>
    </div>
  );
}
