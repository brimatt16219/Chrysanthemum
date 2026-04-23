import { useState, useEffect } from "react";
import { Garden } from "./components/Garden";
import { Shop } from "./components/Shop";
import { Inventory } from "./components/Inventory";
import { OfflineBanner } from "./components/OfflineBanner";
import { ShopRestockBanner } from "./components/ShopRestockBanner";
import { UsernameModal } from "./components/UsernameModal";
import { SaveMigrationModal } from "./components/SaveMigrationModal";
import { SearchPage } from "./components/SearchPage";
import { ProfilePage } from "./components/ProfilePage";
import { FriendsPage } from "./components/FriendsPage";
import { FriendRequestNotification } from "./components/FriendRequestNotification";
import { useGame } from "./store/GameContext";
import { useFriendRequests } from "./hooks/useFriendRequests";
import { msUntilShopReset } from "./store/gameStore";
import { getFlower } from "./data/flowers";

type Tab = "garden" | "shop" | "inventory" | "social";
type SocialView = "search" | "friends" | "profile";

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function App() {
  const {
    state, offlineSummary, clearSummary,
    shopJustRestocked, clearShopNotification,
    user, profile, authLoading,
    signInWithGoogle, signOut,
    pendingMigration, resolveMigration,
    needsUsername, completeUsername,
  } = useGame();

  const { pendingCount, newRequest, clearNewRequest } = useFriendRequests(user?.id ?? null);

  const [tab, setTab]           = useState<Tab>("garden");
  const [socialView, setSocialView] = useState<SocialView>("search");
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(() => msUntilShopReset(state));
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilShopReset(state)), 1_000);
    return () => clearInterval(id);
  }, [state.lastShopReset]);

  const inventoryCount = state.inventory.reduce((s, i) => s + i.quantity, 0);

  function handleViewProfile(username: string) {
    setViewingProfile(username);
    setSocialView("profile");
    setTab("social");
  }

  function handleBackFromProfile() {
    setViewingProfile(null);
    setSocialView("search");
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Modals & notifications */}
      {showBanner && (
        <OfflineBanner
          summary={offlineSummary}
          onDismiss={() => { setShowBanner(false); clearSummary(); }}
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
          }}
        />
      )}
      {needsUsername && user && (
        <UsernameModal user={user} onComplete={completeUsername} />
      )}
      {pendingMigration && (
        <SaveMigrationModal
          localSave={pendingMigration.localSave}
          cloudSave={pendingMigration.cloudSave}
          onChoose={resolveMigration}
        />
      )}

      {/* HUD */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1
            className="text-lg font-bold text-primary tracking-wide cursor-pointer"
            onClick={() => { setTab("garden"); setViewingProfile(null); }}
          >
            🌸 Chrysanthemum
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono">🪙 {state.coins.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground font-mono hidden sm:block">
              Shop {formatCountdown(countdown)}
            </span>
            {!authLoading && (
              user ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setViewingProfile(profile?.username ?? null);
                      setSocialView("profile");
                      setTab("social");
                    }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span className="text-base">
                      {getFlower(profile?.display_flower ?? "daisy")?.emoji.bloom ?? "🌸"}
                    </span>
                    <span className="hidden sm:block">{profile?.username ?? "..."}</span>
                  </button>
                  <button
                    onClick={signOut}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
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
        <div className="max-w-2xl mx-auto flex">
          {(["garden", "shop", "inventory", "social"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t !== "social") setViewingProfile(null);
              }}
              className={`
                flex-1 py-3 text-sm font-medium transition-colors border-b-2 relative
                ${tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {t === "garden" ? "🌱"
               : t === "shop" ? "🛒"
               : t === "inventory" ? "🎒"
               : "🌍"}
              <span className="ml-1 hidden sm:inline capitalize">{t}</span>

              {/* Inventory badge */}
              {t === "inventory" && inventoryCount > 0 && (
                <span className="absolute top-2 right-1 sm:right-6 w-4 h-4 bg-primary rounded-full text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                  {inventoryCount > 9 ? "9+" : inventoryCount}
                </span>
              )}

              {/* Friend request badge */}
              {t === "social" && pendingCount > 0 && (
                <span className="absolute top-2 right-1 sm:right-6 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {tab === "garden"    && <Garden />}
        {tab === "shop"      && <Shop />}
        {tab === "inventory" && <Inventory />}
        {tab === "social"    && (
          user ? (
            <>
              {/* Social sub-nav */}
              {socialView !== "profile" && (
                <div className="flex gap-2 mb-6">
                  {(["search", "friends"] as SocialView[]).map((v) => (
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
                      {v === "search" ? "🔍 Search" : "👥 Friends"}
                      {v === "friends" && pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {socialView === "search"  && <SearchPage onViewProfile={handleViewProfile} />}
              {socialView === "friends" && <FriendsPage onViewProfile={handleViewProfile} />}
              {socialView === "profile" && viewingProfile && (
                <ProfilePage
                  username={viewingProfile}
                  onBack={handleBackFromProfile}
                />
              )}
            </>
          ) : (
            <GuestSocialPrompt onSignIn={signInWithGoogle} />
          )
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