import { useState } from "react";
import { Garden } from "./components/Garden";
import { Shop } from "./components/Shop";
import { Inventory } from "./components/Inventory";
import { OfflineBanner } from "./components/OfflineBanner";
import { ShopRestockBanner } from "./components/ShopRestockBanner";
import { UsernameModal } from "./components/UsernameModal";
import { SearchPage } from "./components/SearchPage";
import { ProfilePage } from "./components/ProfilePage";
import { FriendsPage } from "./components/FriendsPage";
import { GiftsPage } from "./components/GiftsPage";
import { LeaderboardPage } from "./components/LeaderboardPage";
import { FriendRequestNotification } from "./components/FriendRequestNotification";
import { GiftNotification } from "./components/GiftNotification";
import { Codex } from "./components/Codex";
import { Botany } from "./components/Botany";
import { WeatherOverlay } from "./components/WeatherOverlay";
import { WeatherBanner } from "./components/WeatherBanner";
import { DayNightOverlay } from "./components/DayNightOverlay";
import { useGame } from "./store/GameContext";
import { useFriendRequests } from "./hooks/useFriendRequests";
import { useGiftNotifications } from "./hooks/useGiftNotifications";
import { useDayNight } from "./hooks/useDayNight";
import { getFlower } from "./data/flowers";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { UpdateBanner } from "./components/UpdateBanner";
import { CHANGELOGS, LATEST_CHANGELOG_VERSION, type ChangelogEntry } from "./data/changelog";

type Tab = "garden" | "shop" | "inventory" | "social" | "codex" | "botany";
type SocialView = "search" | "friends" | "gifts" | "leaderboard";


export default function App() {
  const {
    state, offlineSummary, clearSummary,
    shopJustRestocked, clearShopNotification,
    user, profile, authLoading,
    signInWithGoogle, signOut,
    needsUsername, completeUsername,
    activeWeather, weatherMsLeft, weatherIsActive,
  } = useGame();

  const { pendingCount, newRequest, clearNewRequest } = useFriendRequests(user?.id ?? null);
  const { pendingCount: giftCount, newGift, clearNewGift } = useGiftNotifications(user?.id ?? null);

  const [tab, setTab]               = useState<Tab>("garden");
  const [socialView, setSocialView] = useState<SocialView>("search");
  const [showBanner, setShowBanner] = useState(true);

  const [profileUsername, setProfileUsername]     = useState<string | null>(null);
  const [profileReturnTab, setProfileReturnTab]   = useState<Tab>("social");
  const [profileReturnView, setProfileReturnView] = useState<SocialView>("search");

  const updateAvailable  = useVersionCheck();
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const [changelogEntry, setChangelogEntry] = useState<ChangelogEntry | null>(() => {
    const seen = localStorage.getItem("changelogSeenVersion");
    return seen !== LATEST_CHANGELOG_VERSION ? CHANGELOGS[0] : null;
  });

  // Day/night cycle — client-side, based on local time
  const dayPeriod = useDayNight();


  const inventoryCount = state.inventory.reduce((s, i) => s + i.quantity, 0);

  function handleViewProfile(username: string) {
    setProfileReturnTab(tab);
    setProfileReturnView(socialView);
    setProfileUsername(username);
  }

  function handleBackFromProfile() {
    setProfileUsername(null);
    setTab(profileReturnTab);
    setSocialView(profileReturnView);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    setProfileUsername(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

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
      {shopJustRestocked && (
        <ShopRestockBanner onDismiss={clearShopNotification} />
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
            setSocialView("gifts");
            setTab("social");
            setProfileUsername(null);
          }}
        />
      )}
      {needsUsername && user && (
        <UsernameModal user={user} onComplete={completeUsername} />
      )}

      {updateAvailable && !dismissedUpdate && (
        <UpdateBanner onDismiss={() => setDismissedUpdate(true)} />
      )}

      {/* Day/night ambient tint — z-10, below weather overlay */}
      <DayNightOverlay period={dayPeriod} />

      {/* Weather overlay — z-20, above day/night */}
      <WeatherOverlay weatherType={activeWeather} isActive={weatherIsActive} />

      {/* HUD */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border">
        <div className="w-full sm:max-w-2xl sm:mx-auto flex items-center justify-between px-3 sm:px-4 py-3">
          <h1
            className="font-bold text-primary tracking-wide cursor-pointer flex items-center gap-1"
            onClick={() => handleTabChange("garden")}
          >
            <span className="text-lg">🌸</span>
            <span className="hidden sm:block text-lg">Chrysanthemum</span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Combined day/night + weather banner */}
            <WeatherBanner
              weatherType={activeWeather}
              isActive={weatherIsActive}
              msLeft={weatherMsLeft}
              period={dayPeriod}
            />
            <span className="text-sm font-mono">🟡 {state.coins.toLocaleString()}</span>
            {!authLoading && (
              user ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewProfile(profile?.username ?? "")}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span className="text-base">
                      {getFlower(profile?.display_flower ?? "daisy")?.emoji.bloom ?? "🌸"}
                    </span>
                    <span className="hidden sm:inline">{profile?.username ?? "..."}</span>
                  </button>
                  <button
                    onClick={signOut}
                    className="text-xs px-2 sm:px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    Sign out
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
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-card/40 border-b border-border">
        <div className="w-full sm:max-w-2xl sm:mx-auto flex">
          {(["garden", "shop", "inventory", "botany", "codex", "social"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`
                flex-1 py-3 text-sm font-medium transition-colors border-b-2 relative
                flex flex-col items-center justify-center
                ${tab === t && !profileUsername
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {t === "garden"      ? "🌱"
               : t === "shop"      ? "🛒"
               : t === "inventory" ? "🎒"
               : t === "botany"    ? "🌿"
               : t === "codex"     ? "📖"
               : "🌍"}
              <span className="ml-1 hidden sm:inline capitalize">{t}</span>

              {t === "inventory" && inventoryCount > 0 && (
                <span className="absolute top-2 right-1 sm:right-6 w-4 h-4 bg-primary rounded-full text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                  {inventoryCount > 9 ? "9+" : inventoryCount}
                </span>
              )}
              {t === "social" && (pendingCount + giftCount) > 0 && (
                <span className="absolute top-2 right-1 sm:right-6 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {(pendingCount + giftCount) > 9 ? "9+" : pendingCount + giftCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 w-full sm:max-w-2xl sm:mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {profileUsername ? (
          <ProfilePage
            username={profileUsername}
            onBack={handleBackFromProfile}
          />
        ) : (
          <>
            {tab === "garden"    && <Garden />}
            {tab === "shop"      && <Shop />}
            {tab === "inventory" && <Inventory />}
            {tab === "botany"    && <Botany />}
            {tab === "codex"     && <Codex />}
            {tab === "social"    && (
              user ? (
                <>
                  <div className="flex gap-2 mb-6 flex-wrap">
                    {(["search", "friends", "gifts", "leaderboard"] as SocialView[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setSocialView(v)}
                        className={`
                          px-4 py-2 rounded-xl text-xs font-semibold transition-all relative
                          ${socialView === v
                            ? "bg-primary/20 border border-primary/50 text-primary"
                            : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                          }
                        `}
                      >
                        {v === "search"      ? "🔍 Search"
                         : v === "friends"   ? "👥 Friends"
                         : v === "gifts"     ? "🎁 Gifts"
                         : "🏆 Ranks"}
                        {v === "friends" && pendingCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                            {pendingCount}
                          </span>
                        )}
                        {v === "gifts" && giftCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                            {giftCount}
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => handleViewProfile(profile?.username ?? "")}
                      className="px-4 py-2 rounded-xl text-xs font-semibold transition-all bg-card/60 border border-border text-muted-foreground hover:border-primary/30 ml-auto"
                    >
                      👤 My Profile
                    </button>
                  </div>
                  {socialView === "search"      && <SearchPage onViewProfile={handleViewProfile} />}
                  {socialView === "friends"     && <FriendsPage onViewProfile={handleViewProfile} />}
                  {socialView === "gifts"       && <GiftsPage onViewProfile={handleViewProfile} />}
                  {socialView === "leaderboard" && <LeaderboardPage onViewProfile={handleViewProfile} />}
                </>
              ) : (
                <GuestSocialPrompt onSignIn={signInWithGoogle} />
              )
            )}
          </>
        )}
      </main>
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
