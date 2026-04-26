import { useState } from "react";
import { getFlower, RARITY_CONFIG } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import { useGame } from "../store/GameContext";
import { buyFromShop, buyFertilizer, buyAllFromShop, buyAllFertilizer, getSpeciesCompletion } from "../store/gameStore";
import type { ShopSlot } from "../store/gameStore";
import type { Rarity } from "../data/flowers";


interface Props {
  slot: ShopSlot;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1_000);
  const hours    = Math.floor(totalSec / 3_600);
  const minutes  = Math.floor((totalSec % 3_600) / 60);
  const seconds  = totalSec % 60;

  if (hours > 0 && minutes > 0) return `${hours}hr ${minutes}m`;
  if (hours > 0)                return `${hours}hr`;
  if (minutes > 0 && seconds > 0) return `${minutes}m ${seconds}s`;
  if (minutes > 0)              return `${minutes}m`;
  return `${seconds}s`;
}

function rarityBadgeClass(rarity: Rarity): string {
  switch (rarity) {
    case "common":    return "bg-gray-500 text-white";
    case "uncommon":  return "bg-green-500 text-white";
    case "rare":      return "bg-blue-500 text-white";
    case "legendary": return "bg-yellow-500 text-black";
    case "mythic":    return "bg-pink-500 text-white";
    case "exalted":   return "bg-slate-700 text-slate-200";
  }
}

export function ShopSlotCard({ slot }: Props) {
  const { state, update } = useGame();
  const [justBought, setJustBought] = useState(false);

  function flashBought() {
    setJustBought(true);
    setTimeout(() => setJustBought(false), 800);
  }

  // ── Empty placeholder slot ───────────────────────────────────────────────
  if (slot.isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-card/20 border border-dashed border-border/50 rounded-xl p-4 min-h-[160px] opacity-60">
        <span className="text-2xl">🌱</span>
        <p className="text-xs text-muted-foreground text-center">New slot — fills on next restock</p>
      </div>
    );
  }

  // ── Fertilizer slot ──────────────────────────────────────────────────────
  if (slot.isFertilizer && slot.fertilizerType) {
    const fert       = FERTILIZERS[slot.fertilizerType];
    const canAfford  = state.coins >= slot.price;
    const outOfStock = slot.quantity === 0;

    function handleBuyFert() {
      const next = buyFertilizer(state, slot.fertilizerType!);
      if (next) { update(next); flashBought(); }
    }

    function handleBuyAllFert() {
      const next = buyAllFertilizer(state, slot.fertilizerType!);
      if (next) { update(next); flashBought(); }
    }

    return (
      <div
        className={`
          flex flex-col gap-3 bg-card/60 border rounded-xl p-4 transition-all duration-200
          ${outOfStock ? "border-border opacity-50"
            : justBought ? "border-green-400/70 bg-green-400/5"
            : "border-border hover:border-primary/40"}
        `}
      >
        <div className="flex items-start justify-between">
          <span className="text-4xl">{fert.emoji}</span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${fert.color} border-current bg-current/10`}>
            Fertilizer
          </span>
        </div>
        <div>
          <h3 className="font-semibold text-sm">{fert.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{fert.description}</p>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          <p>Speed boost: {fert.speedMultiplier}×</p>
          <p className="text-foreground/60">Applied per plot</p>
        </div>
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-muted-foreground">
            {outOfStock ? "Out of stock" : `${slot.quantity} left`}
          </span>
          <div className="flex gap-1.5">
            {!outOfStock && slot.quantity > 1 && canAfford && (
              <button
                onClick={handleBuyAllFert}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 bg-card border border-primary/50 text-primary hover:bg-primary/10"
              >
                Buy All
              </button>
            )}
            <button
              onClick={handleBuyFert}
              disabled={!canAfford || outOfStock}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                ${justBought
                  ? "bg-green-500 text-white scale-105"
                  : canAfford && !outOfStock
                  ? "bg-primary text-primary-foreground hover:scale-105"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
                }
              `}
            >
              {justBought ? "✓ Bought!" : `${slot.price} 🟡`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Flower seed slot ─────────────────────────────────────────────────────
  const species = getFlower(slot.speciesId);
  if (!species) return null;

  const rarity     = RARITY_CONFIG[species.rarity];
  const canAfford  = state.coins >= slot.price;
  const outOfStock = slot.quantity === 0;
  const isNew      = !state.discovered.includes(species.id);
  const isComplete = getSpeciesCompletion(state.discovered, species.id).found ===
                   getSpeciesCompletion(state.discovered, species.id).total;
  const ownedSeeds = state.inventory.find(
    (i) => i.speciesId === species.id && i.isSeed
  )?.quantity ?? 0;
  const ownedBlooms = state.inventory.find(
    (i) => i.speciesId === species.id && !i.isSeed
  )?.quantity ?? 0;

  function handleBuy() {
    const next = buyFromShop(state, slot.speciesId);
    if (next) { update(next); flashBought(); }
  }

  function handleBuyAll() {
    const next = buyAllFromShop(state, slot.speciesId);
    if (next) { update(next); flashBought(); }
  }

  return (
    <div
      className={`
        relative flex flex-col gap-3 bg-card/60 border rounded-xl p-4 transition-all duration-200
        ${outOfStock
          ? "border-border opacity-50"
          : justBought
          ? "border-green-400/70 bg-green-400/5"
          : `border-border hover:border-primary/40 ${rarity.glow}`
        }
      `}
    >
      {/* Undiscovered badge — solid rarity color, no transparency */}
      {isNew && !outOfStock && (
        <div className="absolute -top-3 -right-2 z-10">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md ${rarityBadgeClass(species.rarity)}`}>
            ✦ NEW
          </span>
        </div>
      )}
      
      {isComplete && !outOfStock && (
        <div className="absolute -top-3 -right-2 z-10">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md ${rarityBadgeClass(species.rarity)}`}>
            ✦ DONE
          </span>
        </div>
      )}

      <div className="flex items-start justify-between">
        <span className="text-4xl">{species.emoji.bloom}</span>
        <span
          className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full border ${rarity.color} border-current bg-current/10`}
        >
          {rarity.label}
        </span>
      </div>

      <div>
        <h3 className="font-semibold text-sm">{species.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
          {species.description}
        </p>
      </div>

      <div className="text-xs text-muted-foreground font-mono space-y-0.5">
        <p>Seed → Sprout: {formatDuration(species.growthTime.seed)}</p>
        <p>Sprout → Bloom: {formatDuration(species.growthTime.sprout)}</p>
        <p className="text-foreground/60">Sells for: {species.sellValue} 🟡</p>
        <p className={`mt-1 ${ownedSeeds > 0 || ownedBlooms > 0 ? "text-primary/70" : "text-muted-foreground/50"}`}>
          You own: {ownedSeeds} seed{ownedSeeds !== 1 ? "s" : ""}
          {ownedBlooms > 0 && ` · ${ownedBlooms} bloom${ownedBlooms !== 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-muted-foreground">
          {outOfStock ? "Out of stock" : `${slot.quantity} left`}
        </span>
        <div className="flex gap-1.5">
          {!outOfStock && slot.quantity > 1 && canAfford && (
            <button
              onClick={handleBuyAll}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 bg-card border border-primary/50 text-primary hover:bg-primary/10"
            >
              Buy All
            </button>
          )}
          <button
            onClick={handleBuy}
            disabled={!canAfford || outOfStock}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
              ${justBought
                ? "bg-green-500 text-white scale-105"
                : canAfford && !outOfStock
                ? "bg-primary text-primary-foreground hover:scale-105 hover:shadow-[0_0_10px_rgba(139,92,246,0.4)]"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
              }
            `}
          >
            {justBought ? "✓ Bought!" : `${slot.price} 🟡`}
          </button>
        </div>
      </div>
    </div>
  );
}
