import { useEffect, useState } from "react";
import { useGame } from "../store/GameContext";
import { msUntilShopReset, upgradeShopSlots } from "../store/gameStore";
import { edgeUpgradeShopSlots } from "../lib/edgeFunctions";
import { getNextShopSlotUpgrade, MAX_SHOP_SLOTS } from "../data/upgrades";
import { ShopSlotCard } from "./ShopSlotCard";

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function Shop() {
  const { state, perform } = useGame();
  const [countdown, setCountdown] = useState(() => msUntilShopReset(state));

  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilShopReset(state)), 1_000);
    return () => clearInterval(id);
  }, [state.lastShopReset]);

  const flowerSlots     = state.shop.filter((s) => !s.isFertilizer);
  const fertilizerSlots = state.shop.filter((s) => s.isFertilizer);
  const activeCount     = flowerSlots.filter((s) => !s.isEmpty).length;

  const nextSlotUpgrade = getNextShopSlotUpgrade(state.shopSlots);
  const canAffordSlot   = nextSlotUpgrade ? state.coins >= nextSlotUpgrade.cost : false;
  const atMaxSlots      = state.shopSlots >= MAX_SHOP_SLOTS;

  function handleUpgradeShopSlots() {
    const optimistic = upgradeShopSlots(state);
    if (optimistic) perform(optimistic, () => edgeUpgradeShopSlots());
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Flower Shop</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Buy seeds and fertilizer for your garden
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-mono">Restocks in</p>
          <p className="text-sm font-mono font-semibold text-primary">
            {formatCountdown(countdown)}
          </p>
        </div>
      </div>

      {/* Coins */}
      <div className="flex items-center gap-2 bg-card/40 border border-border rounded-lg px-4 py-2.5">
        <span className="text-lg">🟡</span>
        <span className="text-sm font-mono font-medium">
          {state.coins.toLocaleString()} coins
        </span>
      </div>

      {/* Flower seeds */}
      {flowerSlots.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Seeds ({activeCount} available)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {flowerSlots.map((slot) => (
              <ShopSlotCard key={slot.speciesId} slot={slot} />
            ))}
          </div>
        </div>
      )}

      {/* Fertilizers */}
      {fertilizerSlots.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Fertilizers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fertilizerSlots.map((slot) => (
              <ShopSlotCard key={slot.speciesId} slot={slot} />
            ))}
          </div>
        </div>
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
            🟡 {nextSlotUpgrade!.cost.toLocaleString()}
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Shop stock is random every 10 minutes. Rarer flowers appear less often.
      </p>
    </div>
  );
}
