import { useEffect, useState } from "react";
import { useGame } from "../store/GameContext";
import { msUntilShopReset } from "../store/gameStore";
import { ShopSlotCard } from "./ShopSlotCard";

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function Shop() {
  const { state } = useGame();
  const [countdown, setCountdown] = useState(() => msUntilShopReset(state));

  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilShopReset(state)), 1_000);
    return () => clearInterval(id);
  }, [state.lastShopReset]);

  const flowerSlots     = state.shop.filter((s) => !s.isFertilizer);
  const fertilizerSlots = state.shop.filter((s) => s.isFertilizer);

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

      {/* Flower seeds — 1 col mobile, 2 col desktop */}
      {flowerSlots.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Seeds ({flowerSlots.length} available)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {flowerSlots.map((slot) => (
              <ShopSlotCard key={slot.speciesId} slot={slot} />
            ))}
          </div>
        </div>
      )}

      {/* Fertilizers — always 1 col since there are only 2 */}
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

      <p className="text-xs text-muted-foreground text-center pb-4">
        Shop stock is random every 10 minutes. Rarer flowers appear less often.
      </p>
    </div>
  );
}
