import { useState, useEffect } from "react";
import { Garden } from "./components/Garden";
import { Shop } from "./components/Shop";
import { Inventory } from "./components/Inventory";
import { OfflineBanner } from "./components/OfflineBanner";
import { useGame } from "./store/GameContext";
import { msUntilShopReset } from "./store/gameStore";

type Tab = "garden" | "shop" | "inventory";

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function App() {
  const { state, offlineSummary, clearSummary } = useGame();
  const [tab, setTab] = useState<Tab>("garden");
  const [countdown, setCountdown] = useState(() => msUntilShopReset(state));
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilShopReset(state)), 1_000);
    return () => clearInterval(id);
  }, [state.lastShopReset]);

  const inventoryCount = state.inventory.reduce((s, i) => s + i.quantity, 0);

  function handleDismissBanner() {
    setShowBanner(false);
    clearSummary();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col garden-theme">

      {/* Offline banner */}
      {showBanner && (
        <OfflineBanner summary={offlineSummary} onDismiss={handleDismissBanner} />
      )}

      {/* HUD */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary tracking-wide">
            🌸 Chrysanthemum
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono">🟡 {state.coins.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground font-mono hidden sm:block">
              Shop {formatCountdown(countdown)}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-card/40 border-b border-border">
        <div className="max-w-2xl mx-auto flex">
          {(["garden", "shop", "inventory"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`
                flex-1 py-3 text-sm font-medium capitalize transition-colors border-b-2 relative
                ${tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {t === "garden" ? "🌱 Garden"
               : t === "shop" ? "🛒 Shop"
               : "🎒 Inventory"}

              {/* Inventory badge */}
              {t === "inventory" && inventoryCount > 0 && (
                <span className="absolute top-2 right-6 w-4 h-4 bg-primary rounded-full text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                  {inventoryCount > 9 ? "9+" : inventoryCount}
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
      </main>
    </div>
  );
}
