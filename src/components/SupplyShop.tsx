import React, { useEffect, useState, useMemo } from "react";
import { useGame } from "../store/GameContext";
import { useSettings } from "../store/SettingsContext";

const PX = { imageRendering: "pixelated" as const };
import {
  msUntilSupplyReset,
  buyFromSupplyShop,
  buyAllSupply,
  upgradeSupplySlots,
  applyWindShear,
  applySlotLock,
} from "../store/gameStore";
import {
  edgeBuyFromSupplyShop,
  edgeBuyAllFromSupplyShop,
  edgeUpgradeSupplySlots,
  edgeUseWindShear,
  edgeUseSlotLock,
  edgeSyncSupplyShop,
} from "../lib/edgeFunctions";
import {
  RARITY_CONFIG,
  MUTATIONS,
} from "../data/flowers";
import type { Rarity } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import { GEAR, getMaxSupplyRarity, SUPPLY_RARITY_WEIGHTS, isRarityUnlocked } from "../data/gear";
import { CONSUMABLE_RECIPE_MAP, type ConsumableId } from "../data/consumables";
import {
  getNextSupplySlotUpgrade,
  MAX_SUPPLY_SLOTS,
  SUPPLY_SLOT_UPGRADES,
} from "../data/upgrades";
import type { ShopSlot } from "../store/gameStore";
import { RatesModal } from "./RatesModal";
import type { RateRow } from "./RatesModal";
import { audioManager } from "../lib/audioManager";

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1_000));
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1_000);
  const h = Math.floor(totalSec / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  if (h > 0 && m > 0) return `${h}hr ${m}m`;
  if (h > 0)          return `${h}hr`;
  return `${m}m`;
}

// ── Individual supply slot card ─────────────────────────────────────────────

function SupplyCard({ slot, hasSlotLock }: { slot: ShopSlot; hasSlotLock: boolean }) {
  const { state, perform, getState, user, requestSignIn, pushGenericToast } = useGame();
  const { settings } = useSettings();
  const [justBought,  setJustBought]  = useState(false);
  const [lockingSlot, setLockingSlot] = useState(false);

  // ── Empty placeholder ─────────────────────────────────────────────────────
  if (slot.isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-card/20 border border-dashed border-border/50 rounded-xl p-4 min-h-[140px] opacity-60">
        {settings.useSprites
          ? <img src="/sprites/ui/shop_empty_supply.png" alt="🧪" className="w-8 h-8 object-contain" style={PX} />
          : <span className="text-2xl">🧪</span>
        }
        <p className="text-xs text-muted-foreground text-center">New slot — fills on next restock</p>
      </div>
    );
  }

  function handleLockSlot() {
    if (!user) { requestSignIn("to use Slot Lock"); return; }
    if (lockingSlot) return;
    const cur = getState();
    const optimistic = applySlotLock(cur, slot.speciesId);
    if (!optimistic) return;
    const savedConsumables = cur.consumables;
    const savedShop = cur.supplyShop;
    setLockingSlot(true);
    perform(
      optimistic,
      () => edgeUseSlotLock(slot.speciesId),
      () => setLockingSlot(false),
      {
        rollback: (c) => ({
          ...c,
          consumables: savedConsumables,
          supplyShop: savedShop,
        }),
      }
    );
  }

  const canAfford  = state.coins >= slot.price;
  const outOfStock = slot.quantity < 1;

  function handleBuy() {
    if (!user) { requestSignIn("to buy supplies"); return; }
    const optimistic = buyFromSupplyShop(state, slot.speciesId);
    if (!optimistic) return;
    let toastEmoji = "";
    let toastLabel = "";
    let toastColor = "text-primary";
    if (slot.isFertilizer && slot.fertilizerType) {
      const f = FERTILIZERS[slot.fertilizerType];
      toastEmoji = f.emoji; toastLabel = f.name; toastColor = RARITY_CONFIG[f.rarity].color;
    } else if (slot.isGear && slot.gearType) {
      const g = GEAR[slot.gearType];
      toastEmoji = g.emoji; toastLabel = g.name; toastColor = RARITY_CONFIG[g.rarity].color;
    } else if (slot.isConsumable && slot.consumableId) {
      const r = CONSUMABLE_RECIPE_MAP[slot.consumableId as ConsumableId];
      if (r) { toastEmoji = r.emoji; toastLabel = r.name; toastColor = RARITY_CONFIG[r.rarity].color; }
    }
    audioManager.playSfx("buy");
    if (toastEmoji) pushGenericToast(slot.speciesId!, toastEmoji, toastLabel, toastColor);
    perform(
      optimistic,
      () => edgeBuyFromSupplyShop(slot.speciesId),
      undefined,
      {
        rollback: (cur) => {
          const restoredShop = (cur.supplyShop ?? []).map((s) =>
            s.speciesId === slot.speciesId ? { ...s, quantity: s.quantity + 1 } : s
          );
          if (slot.isFertilizer && slot.fertilizerType) {
            return {
              ...cur,
              coins: cur.coins + slot.price,
              supplyShop: restoredShop,
              fertilizers: cur.fertilizers
                .map((f) =>
                  f.type === slot.fertilizerType
                    ? { ...f, quantity: f.quantity - 1 }
                    : f
                )
                .filter((f) => f.quantity > 0),
            };
          }
          if (slot.isGear && slot.gearType) {
            return {
              ...cur,
              coins: cur.coins + slot.price,
              supplyShop: restoredShop,
              gearInventory: (cur.gearInventory ?? [])
                .map((g) =>
                  g.gearType === slot.gearType
                    ? { ...g, quantity: g.quantity - 1 }
                    : g
                )
                .filter((g) => g.quantity > 0),
            };
          }
          if (slot.isConsumable && slot.consumableId) {
            return {
              ...cur,
              coins: cur.coins + slot.price,
              supplyShop: restoredShop,
              consumables: (cur.consumables ?? [])
                .map((c) =>
                  c.id === slot.consumableId
                    ? { ...c, quantity: c.quantity - 1 }
                    : c
                )
                .filter((c) => c.quantity > 0),
            };
          }
          return { ...cur, coins: cur.coins + slot.price, supplyShop: restoredShop };
        },
      }
    );
    setJustBought(true);
    setTimeout(() => setJustBought(false), 800);
  }

  // ── Fertilizer card ────────────────────────────────────────────────────────
  if (slot.isFertilizer && slot.fertilizerType) {
    const fert      = FERTILIZERS[slot.fertilizerType];
    const fertRarity = RARITY_CONFIG[fert.rarity];
    return (
      <div
        className={`
          flex flex-col gap-3 bg-card/60 border rounded-xl p-4 transition-all duration-200
          ${outOfStock ? "border-border opacity-50"
            : justBought ? "border-green-400/70 bg-green-400/5"
            : `${fert.cardBorder} hover:opacity-90`}
        `}
      >
        <div className="flex items-start justify-between">
          <span className="text-3xl">{fert.emoji}</span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${fertRarity.color} border-current bg-current/10`}>
            {fertRarity.label}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold">{fert.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fert.description}</p>
        </div>
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-muted-foreground">
            {outOfStock ? "Out of stock" : `${slot.quantity} left`}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Slot Lock button */}
            {slot.locked ? (
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5">
                {settings.useSprites
                  ? <img src="/sprites/ui/shop_slot_lock.png" alt="📌" className="w-3 h-3 object-contain" style={PX} />
                  : "📌"
                }
                {" "}Locked
              </span>
            ) : hasSlotLock ? (
              <button
                onClick={handleLockSlot}
                disabled={lockingSlot}
                title="Slot Lock — keeps this slot through the next restock"
                className="px-2 py-1 rounded-lg text-[10px] bg-amber-400/10 border border-amber-400/30 text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-50"
              >
                {lockingSlot ? "…" : (
                  <span className="flex items-center gap-0.5">
                    {settings.useSprites
                      ? <img src="/sprites/ui/shop_slot_lock.png" alt="📌" className="w-3 h-3 object-contain" style={PX} />
                      : "📌"
                    }
                    {" "}Lock
                  </span>
                )}
              </button>
            ) : null}
            <button
              onClick={handleBuy}
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
              {justBought ? "✓ Bought!" : (
                <span className="flex items-center gap-1 justify-center">
                  {slot.price.toLocaleString()}
                  {settings.useSprites
                    ? <img src="/sprites/ui/coins.png" alt="🟡" className="w-3.5 h-3.5 object-contain" style={PX} />
                    : <span>🟡</span>
                  }
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Gear card ──────────────────────────────────────────────────────────────
  if (slot.isGear && slot.gearType) {
    const def    = GEAR[slot.gearType];
    const rarity = RARITY_CONFIG[def.rarity];

    return (
      <div
        className={`
          flex flex-col gap-3 bg-card/60 border rounded-xl p-4 transition-all duration-200
          ${outOfStock ? "border-border opacity-50"
            : justBought ? "border-green-400/70 bg-green-400/5"
            : def.rarity === "prismatic" ? "rainbow-border rainbow-glow hover:brightness-110"
            : `border-border hover:border-primary/40 ${rarity.glow}`}
        `}
      >
        <div className="flex items-start justify-between">
          <span className="text-3xl relative">
            {def.emoji}
            {def.category === "sprinkler_mutation" && def.mutationType && (
              <span className="absolute -bottom-0.5 -right-1 text-sm leading-none">
                {MUTATIONS[def.mutationType].emoji}
              </span>
            )}
          </span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${rarity.color} border-current bg-current/10`}>
            {rarity.label}
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold">{def.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
        </div>

        {def.durationMs && (
          <p className="text-xs text-muted-foreground font-mono">
            Duration: {formatDuration(def.durationMs)}
          </p>
        )}
        {!def.durationMs && (
          <p className="text-xs text-muted-foreground font-mono">Permanent (until removed)</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-muted-foreground">
            {outOfStock ? "Out of stock" : `${slot.quantity} left`}
          </span>
          <div className="flex items-center gap-1.5">
            {slot.locked ? (
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5">
                {settings.useSprites
                  ? <img src="/sprites/ui/shop_slot_lock.png" alt="📌" className="w-3 h-3 object-contain" style={PX} />
                  : "📌"
                }
                {" "}Locked
              </span>
            ) : hasSlotLock ? (
              <button
                onClick={handleLockSlot}
                disabled={lockingSlot}
                title="Slot Lock — keeps this slot through the next restock"
                className="px-2 py-1 rounded-lg text-[10px] bg-amber-400/10 border border-amber-400/30 text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-50"
              >
                {lockingSlot ? "…" : (
                  <span className="flex items-center gap-0.5">
                    {settings.useSprites
                      ? <img src="/sprites/ui/shop_slot_lock.png" alt="📌" className="w-3 h-3 object-contain" style={PX} />
                      : "📌"
                    }
                    {" "}Lock
                  </span>
                )}
              </button>
            ) : null}
            <button
              onClick={handleBuy}
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
              {justBought ? "✓ Bought!" : (
                <span className="flex items-center gap-1 justify-center">
                  {slot.price.toLocaleString()}
                  {settings.useSprites
                    ? <img src="/sprites/ui/coins.png" alt="🟡" className="w-3.5 h-3.5 object-contain" style={PX} />
                    : <span>🟡</span>
                  }
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Consumable card ────────────────────────────────────────────────────────
  if (slot.isConsumable && slot.consumableId) {
    const recipe = CONSUMABLE_RECIPE_MAP[slot.consumableId as ConsumableId];
    if (!recipe) return null;
    const rarity = RARITY_CONFIG[recipe.rarity];

    return (
      <div
        className={`
          flex flex-col gap-3 bg-card/60 border rounded-xl p-4 transition-all duration-200
          ${outOfStock ? "border-border opacity-50"
            : justBought ? "border-green-400/70 bg-green-400/5"
            : recipe.rarity === "prismatic" ? "rainbow-border rainbow-glow hover:brightness-110"
            : `border-border hover:border-primary/40 ${rarity.glow}`}
        `}
      >
        <div className="flex items-start justify-between">
          <span className="text-3xl">{recipe.emoji}</span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${rarity.color} border-current bg-current/10`}>
            {rarity.label}
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold">{recipe.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{recipe.description}</p>
        </div>

        <p className="text-xs text-muted-foreground font-mono">Single use</p>

        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-muted-foreground">
            {outOfStock ? "Out of stock" : `${slot.quantity} left`}
          </span>
          <div className="flex items-center gap-1.5">
            {slot.locked ? (
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5">
                {settings.useSprites
                  ? <img src="/sprites/ui/shop_slot_lock.png" alt="📌" className="w-3 h-3 object-contain" style={PX} />
                  : "📌"
                }
                {" "}Locked
              </span>
            ) : hasSlotLock ? (
              <button
                onClick={handleLockSlot}
                disabled={lockingSlot}
                title="Slot Lock — keeps this slot through the next restock"
                className="px-2 py-1 rounded-lg text-[10px] bg-amber-400/10 border border-amber-400/30 text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-50"
              >
                {lockingSlot ? "…" : (
                  <span className="flex items-center gap-0.5">
                    {settings.useSprites
                      ? <img src="/sprites/ui/shop_slot_lock.png" alt="📌" className="w-3 h-3 object-contain" style={PX} />
                      : "📌"
                    }
                    {" "}Lock
                  </span>
                )}
              </button>
            ) : null}
            <button
              onClick={handleBuy}
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
              {justBought ? "✓ Bought!" : (
                <span className="flex items-center gap-1 justify-center">
                  {slot.price.toLocaleString()}
                  {settings.useSprites
                    ? <img src="/sprites/ui/coins.png" alt="🟡" className="w-3.5 h-3.5 object-contain" style={PX} />
                    : <span>🟡</span>
                  }
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── Supply Shop ─────────────────────────────────────────────────────────────

/** Returns the supply slot count at which `rarity` first becomes available */
function supplyUnlockSlots(rarity: Rarity): number | null {
  // Rarities available from the start (1–2 slots unlock up to Rare)
  if (isRarityUnlocked(rarity, 2)) return null;
  const upgrade = SUPPLY_SLOT_UPGRADES.find((u) => isRarityUnlocked(rarity, u.slots));
  return upgrade?.slots ?? null;
}

export function SupplyShop() {
  const { state, perform, getState, user, requestSignIn, pushGenericToast } = useGame();
  const { settings } = useSettings();
  const [countdown,     setCountdown]     = useState(() => msUntilSupplyReset(state));
  const [showRates,     setShowRates]     = useState(false);
  const [usingWindShear,setUsingWindShear]= useState(false);
  const [buyingAll,     setBuyingAll]     = useState(false);

  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilSupplyReset(state)), 1_000);
    return () => clearInterval(id);
  }, [state.lastSupplyReset]);

  // Wind Shear — available if player owns it and cooldown has passed
  const windShearItem = (state.consumables ?? []).find((c) => c.id === "wind_shear" && c.quantity > 0);
  const windShearCooldownMs = 3_600_000; // 1 hour
  const windShearOnCooldown = state.lastWindShearUsed != null
    && Date.now() - state.lastWindShearUsed < windShearCooldownMs;
  const windShearCooldownRemaining = state.lastWindShearUsed != null
    ? Math.max(0, windShearCooldownMs - (Date.now() - state.lastWindShearUsed))
    : 0;

  // Slot Lock — does the player own at least one?
  const hasSlotLock = (state.consumables ?? []).some((c) => c.id === "slot_lock" && c.quantity > 0);

  function handleWindShear() {
    if (usingWindShear || windShearOnCooldown || !windShearItem) return;
    const cur = getState();
    const optimistic = applyWindShear(cur);
    if (!optimistic) return;
    const savedConsumables  = cur.consumables;
    const savedShop         = cur.supplyShop;
    const savedLastReset    = cur.lastSupplyReset;
    const savedLastUsed     = cur.lastWindShearUsed;
    setUsingWindShear(true);
    perform(
      optimistic,
      async () => {
        const res = await edgeUseWindShear();
        // After wind_shear server confirms, sync the newly generated shop
        await edgeSyncSupplyShop(optimistic.supplyShop, optimistic.lastSupplyReset);
        return res;
      },
      () => setUsingWindShear(false),
      {
        rollback: (c) => ({
          ...c,
          consumables:       savedConsumables,
          supplyShop:        savedShop,
          lastSupplyReset:   savedLastReset,
          lastWindShearUsed: savedLastUsed,
        }),
      }
    );
  }

  const supplySlots     = state.supplySlots ?? 2;
  const nextSlotUpgrade = getNextSupplySlotUpgrade(supplySlots);
  const canAffordSlot   = nextSlotUpgrade ? state.coins >= nextSlotUpgrade.cost : false;
  const atMaxSlots      = supplySlots >= MAX_SUPPLY_SLOTS;
  const maxRarity       = getMaxSupplyRarity(supplySlots);
  const maxRarityConfig = RARITY_CONFIG[maxRarity];

  // Build rate rows — locked tiers show the slot count needed to unlock them
  const rateRows = useMemo((): RateRow[] =>
    (Object.entries(SUPPLY_RARITY_WEIGHTS) as [Rarity, number][]).map(([rarity, weight]) => {
      const unlockAt = supplyUnlockSlots(rarity);
      const locked   = !isRarityUnlocked(rarity, supplySlots);
      return {
        rarity,
        weight,
        unlocksAt: locked && unlockAt ? `${unlockAt} supply slots` : undefined,
      };
    }),
  [supplySlots]);

  function handleUpgradeSlots() {
    if (!user) { requestSignIn("to upgrade your supply slots"); return; }
    if (!nextSlotUpgrade) return;
    const optimistic = upgradeSupplySlots(state);
    if (!optimistic) return;
    const prevSlots = state.supplySlots ?? 2;
    const prevShop  = state.supplyShop;
    const cost      = nextSlotUpgrade.cost;
    perform(
      optimistic,
      () => edgeUpgradeSupplySlots(),
      undefined,
      {
        rollback: (cur) => ({
          ...cur,
          coins:       cur.coins + cost,
          supplySlots: prevSlots,
          supplyShop:  prevShop,
        }),
      }
    );
  }

  async function handleBuyAll() {
    if (!user) { requestSignIn("to buy supplies"); return; }
    if (buyingAll) return;
    const cur = getState();
    const optimistic = buyAllSupply(cur);
    if (!optimistic) return;
    // Collect display info for each slot we're about to buy
    const toastItems = (cur.supplyShop ?? [])
      .filter((s) => !s.isEmpty && s.quantity > 0 && cur.coins >= s.price)
      .map((s): { key: string; emoji: string; label: string; color: string } | null => {
        if (s.isFertilizer && s.fertilizerType) {
          const f = FERTILIZERS[s.fertilizerType];
          return { key: s.speciesId!, emoji: f.emoji, label: f.name, color: RARITY_CONFIG[f.rarity].color };
        }
        if (s.isGear && s.gearType) {
          const g = GEAR[s.gearType];
          return { key: s.speciesId!, emoji: g.emoji, label: g.name, color: RARITY_CONFIG[g.rarity].color };
        }
        if (s.isConsumable && s.consumableId) {
          const r = CONSUMABLE_RECIPE_MAP[s.consumableId as ConsumableId];
          if (r) return { key: s.speciesId!, emoji: r.emoji, label: r.name, color: RARITY_CONFIG[r.rarity].color };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    setBuyingAll(true);
    try {
      await perform(optimistic, () => edgeBuyAllFromSupplyShop(), () => {
        for (const { key, emoji, label, color } of toastItems) {
          pushGenericToast(key, emoji, label, color);
        }
      });
    } finally {
      setBuyingAll(false);
    }
  }

  const slots = state.supplyShop ?? [];
  const affordableSupply  = slots.filter((s) => !s.isEmpty && s.quantity > 0 && state.coins >= s.price);
  const buyAllOptimistic  = affordableSupply.length > 0 ? buyAllSupply(state) : null;
  const buyAllCost        = buyAllOptimistic ? state.coins - buyAllOptimistic.coins : 0;

  return (
    <div className="flex flex-col gap-6">

      {showRates && (
        <RatesModal
          title="Supply shop drop rates"
          subtitle="Chance per slot roll each restock"
          rows={rateRows}
          onClose={() => setShowRates(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Supply Shop</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fertilizers &amp; gear — restocks every 10 min
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Wind Shear — shown only when the player owns one */}
          {windShearItem && (
            <button
              onClick={handleWindShear}
              disabled={usingWindShear || windShearOnCooldown}
              title={windShearOnCooldown
                ? `Wind Shear on cooldown — ${Math.ceil(windShearCooldownRemaining / 60_000)}m left`
                : "Wind Shear — refresh supply shop instantly"}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                windShearOnCooldown
                  ? "border-border text-muted-foreground"
                  : "border-sky-400/30 text-sky-400 bg-sky-400/5 hover:bg-sky-400/10"
              }`}
            >
              {settings.useSprites ? (
                <span className="flex items-center gap-1">
                  <img src="/sprites/ui/shop_wind_shear.png" alt="🌀" className="w-3.5 h-3.5 object-contain" style={PX} />
                  {usingWindShear ? "…" : windShearOnCooldown
                    ? `${Math.ceil(windShearCooldownRemaining / 60_000)}m`
                    : `×${windShearItem.quantity}`}
                </span>
              ) : (
                usingWindShear ? "🌀…" : windShearOnCooldown
                  ? `🌀 ${Math.ceil(windShearCooldownRemaining / 60_000)}m`
                  : `🌀 ×${windShearItem.quantity}`
              )}
            </button>
          )}
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
        {settings.useSprites
          ? <img src="/sprites/ui/coins.png" alt="🟡" className="w-5 h-5 object-contain" style={PX} />
          : <span className="text-lg">🟡</span>
        }
        <span className="text-sm font-mono font-medium">
          {state.coins.toLocaleString()} coins
        </span>
      </div>

      {/* Slot grid */}
      {affordableSupply.length > 0 && (
        <button
          onClick={handleBuyAll}
          disabled={buyingAll}
          className="w-full py-2.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-1.5">
            {`Buy All — ${buyAllCost.toLocaleString()}`}
            {settings.useSprites
              ? <img src="/sprites/ui/coins.png" alt="🟡" className="w-3.5 h-3.5 object-contain" style={PX} />
              : <span>🟡</span>
            }
          </span>
        </button>
      )}

      {slots.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {slots.map((slot) => (
            <SupplyCard key={slot.speciesId} slot={slot} hasSlotLock={hasSlotLock} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12">Nothing in stock right now.</p>
      )}

      {/* Slot upgrade */}
      <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Expand Supply Shop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {atMaxSlots
              ? `Maximum size reached (${MAX_SUPPLY_SLOTS} slots)`
              : `${state.supplySlots ?? 2} slots · up to `}
            {!atMaxSlots && (
              <span className={`font-mono ${maxRarityConfig.color}`}>{maxRarityConfig.label}</span>
            )}
            {!atMaxSlots && (() => {
              const nextRarity = getMaxSupplyRarity(nextSlotUpgrade!.slots);
              const unlocksNew = nextRarity !== maxRarity;
              return (
                <> tier — upgrade to {nextSlotUpgrade!.slots} slots{unlocksNew && (
                  <>, unlock{" "}
                    <span className={`font-mono ${RARITY_CONFIG[nextRarity].color}`}>
                      {RARITY_CONFIG[nextRarity].label}
                    </span>
                  </>
                )}</>
              );
            })()}
          </p>
        </div>
        {!atMaxSlots && (
          <button
            onClick={handleUpgradeSlots}
            disabled={!canAffordSlot}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${canAffordSlot
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-card border border-border text-muted-foreground cursor-not-allowed opacity-50"
              }`}
          >
            <span className="flex items-center gap-1">
              {settings.useSprites
                ? <img src="/sprites/ui/coins.png" alt="🟡" className="w-3.5 h-3.5 object-contain" style={PX} />
                : <span>🟡</span>
              }
              {nextSlotUpgrade!.cost.toLocaleString()}
            </span>
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Higher-rarity gear appears less often. Unlock more slots for rarer items.
      </p>
    </div>
  );
}
