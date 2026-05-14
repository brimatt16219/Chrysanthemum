import { useEffect, useState } from "react";
import { useGame } from "../store/GameContext";
import { useSettings } from "../store/SettingsContext";
import { ItemSprite } from "./ItemSprite";

const PX = { imageRendering: "pixelated" as const };
import { msUntilShopReset, upgradeShopSlots, buyAllSeeds, SHOP_RARITY_WEIGHTS } from "../store/gameStore";
import { edgeUpgradeShopSlots, edgeBuyAllSeeds } from "../lib/edgeFunctions";
import { getNextShopSlotUpgrade, MAX_SHOP_SLOTS } from "../data/upgrades";
import { ShopSlotCard } from "./ShopSlotCard";
import { SupplyShop } from "./SupplyShop";
import { RatesModal } from "./RatesModal";
import type { RateRow } from "./RatesModal";
import { getFlower } from "../data/flowers";
import type { Rarity } from "../data/flowers";

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

const SEED_RATE_ROWS: RateRow[] = [
  // Rarities that actually roll in the seed shop
  ...(Object.entries(SHOP_RARITY_WEIGHTS) as [Rarity, number][]).map(
    ([rarity, weight]) => ({ rarity, weight })
  ),
  // Rarities that never appear in the seed shop
  { rarity: "exalted"   as Rarity, weight: 0, unavailable: true },
  { rarity: "prismatic" as Rarity, weight: 0, unavailable: true },
];

interface ShopProps {
  view: "seeds" | "supply";
}

export function Shop({ view }: ShopProps) {
  const { state, getState, perform, user, requestSignIn, pushGenericToast } = useGame();
  const { settings } = useSettings();
  const [countdown,  setCountdown]  = useState(() => msUntilShopReset(state));
  const [showRates,  setShowRates]  = useState(false);
  const [buyingAll,  setBuyingAll]  = useState(false);

  // Use getState() to always read the latest state — avoids a stale closure where
  // the interval captures an old lastShopReset and shows "00:00" after a restock.
  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilShopReset(getState())), 1_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flowerSlots = state.shop.filter((s) => !s.isFertilizer);
  const activeCount = flowerSlots.filter((s) => !s.isEmpty).length;

  const nextSlotUpgrade = getNextShopSlotUpgrade(state.shopSlots);
  const canAffordSlot   = nextSlotUpgrade ? state.coins >= nextSlotUpgrade.cost : false;
  const atMaxSlots      = state.shopSlots >= MAX_SHOP_SLOTS;

  function handleUpgradeShopSlots() {
    if (!user) { requestSignIn("to upgrade your shop slots"); return; }
    const optimistic = upgradeShopSlots(state);
    if (optimistic) perform(optimistic, () => edgeUpgradeShopSlots());
  }

  async function handleBuyAll() {
    if (!user) { requestSignIn("to buy seeds"); return; }
    if (buyingAll) return;
    const cur = getState();
    const optimistic = buyAllSeeds(cur);
    if (!optimistic) return;
    // Compute per-species qty deltas for toast notifications
    const seedDeltas = flowerSlots
      .filter((s) => !s.isEmpty && s.quantity > 0 && cur.coins >= s.price && s.speciesId)
      .map((s) => {
        const before     = cur.inventory.find((i) => i.speciesId === s.speciesId && i.isSeed)?.quantity ?? 0;
        const after      = optimistic.inventory.find((i) => i.speciesId === s.speciesId && i.isSeed)?.quantity ?? 0;
        const sp         = getFlower(s.speciesId!);
        const discovered = cur.discovered.includes(s.speciesId!);
        return {
          speciesId: s.speciesId!,
          qty:       after - before,
          emoji:     discovered && sp ? sp.emoji.seed : "❓",
          label:     discovered && sp ? `${sp.name} Seed` : "??? Seed",
          sprite:    discovered && sp ? "/sprites/flowers/seed.png" : "/sprites/ui/unknown.png",
        };
      })
      .filter((d) => d.qty > 0);
    setBuyingAll(true);
    try {
      await perform(optimistic, () => edgeBuyAllSeeds(), () => {
        for (const { speciesId, qty, emoji, label, sprite } of seedDeltas) {
          pushGenericToast(`gain:seed:${speciesId}`, emoji, label, "text-green-400", "gain", qty, sprite);
        }
      });
    } finally {
      setBuyingAll(false);
    }
  }

  const affordableSeeds  = flowerSlots.filter((s) => !s.isEmpty && s.quantity > 0 && state.coins >= s.price);
  const buyAllOptimistic = affordableSeeds.length > 0 ? buyAllSeeds(state) : null;
  const buyAllCost       = buyAllOptimistic ? state.coins - buyAllOptimistic.coins : 0;

  // Supply view is self-contained
  if (view === "supply") return <SupplyShop />;

  return (
    <div className="flex flex-col gap-6">

      {showRates && (
        <RatesModal
          title="Seed shop drop rates"
          subtitle="Chance per slot roll each restock"
          rows={SEED_RATE_ROWS}
          onClose={() => setShowRates(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Seeds</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {`${activeCount} seed${activeCount !== 1 ? "s" : ""} available`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRates(true)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg border border-border hover:border-primary/40"
            title="View drop rates"
          >
            <span className="flex items-center gap-1">
              {settings.useSprites
                ? <img src="/sprites/ui/shop_rates.png" alt="📊" className="w-3.5 h-3.5 object-contain" style={PX} />
                : <span>📊</span>
              }
              Rates
            </span>
          </button>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-mono">Restocks in</p>
            <p className="text-sm font-mono font-semibold text-primary">
              {formatCountdown(countdown)}
            </p>
          </div>
        </div>
      </div>

      {/* Coins */}
      <div className="flex items-center gap-2 bg-card/40 border border-border rounded-lg px-4 py-2.5">
        <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-lg" imgSize="w-5 h-5" />
        <span className="text-sm font-mono font-medium">
          {state.coins.toLocaleString()} coins
        </span>
      </div>

      {affordableSeeds.length > 0 && (
        <button
          onClick={handleBuyAll}
          disabled={buyingAll}
          className="w-full py-2.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-1.5">
            {`Buy All Seeds — ${buyAllCost.toLocaleString()}`}
            <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-sm" imgSize="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {flowerSlots.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {flowerSlots.map((slot) => (
            <ShopSlotCard key={slot.speciesId} slot={slot} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12">No seeds in stock right now.</p>
      )}

      {/* Shop slot upgrade */}
      <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Expand Shop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {atMaxSlots
              ? `Maximum size reached (${MAX_SHOP_SLOTS} slots)`
              : `${state.shopSlots} seed slots — upgrade to ${nextSlotUpgrade!.slots}`}
          </p>
        </div>
        {!atMaxSlots && (
          <button
            onClick={handleUpgradeShopSlots}
            disabled={!canAffordSlot}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${canAffordSlot
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-card border border-border text-muted-foreground cursor-not-allowed opacity-50"
              }`}
          >
            <span className="flex items-center gap-1">
              <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-sm" imgSize="w-3.5 h-3.5" />
              {nextSlotUpgrade!.cost.toLocaleString()}
            </span>
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Shop stock is random every 10 minutes. Rarer flowers appear less often.
      </p>
    </div>
  );
}
