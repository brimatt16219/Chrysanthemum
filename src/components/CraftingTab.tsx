import { useState, useMemo, useEffect, useCallback } from "react";
import { useGame } from "../store/GameContext";
import {
  GEAR_RECIPES, CRAFTING_SLOT_UPGRADES, canCraftGear,
  craftDurationFromRarity, type GearRecipe,
} from "../data/gear-recipes";
import { GEAR, type GearType } from "../data/gear";
import {
  CONSUMABLE_RECIPES, CONSUMABLE_RECIPE_MAP, ATTUNEMENT_RECIPES,
  canCraftConsumable, canCraftAttunement,
  TIER_RARITIES,
  type ConsumableId,
} from "../data/consumables";
import { FERTILIZERS } from "../data/upgrades";
import { RARITY_CONFIG, FLOWER_TYPES, type Rarity } from "../data/flowers";
import type { FlowerType } from "../data/flowers";
import {
  UNIVERSAL_ESSENCE_DISPLAY, UNIVERSAL_ESSENCE_COST_PER_TYPE,
  ALL_FLOWER_TYPES, universalEssenceCraftable,
  type EssenceType,
} from "../data/essences";
import {
  edgeCraftStart, edgeCraftCollect, edgeCraftCancel,
  edgeUpgradeCraftingSlots,
} from "../lib/edgeFunctions";
import type { GameState, CraftingQueueEntry } from "../store/gameStore";
import { getBoostMultiplier } from "../store/gameStore";
import { queueEntryDisplay } from "../lib/craftDisplay";
import { useAchievementStats } from "../hooks/useAchievementStats";
import type { AchievementStatKey } from "../data/achievements";
import { useSettings } from "../store/SettingsContext";
import { ItemSprite } from "./ItemSprite";

// ── Forge Haste / Resonance Draft (Phase 5a) ───────────────────────────────────
// If the relevant boost is active when a craft starts, halve its durationMs.
// Mirrors the server-side logic in craft-start/index.ts.
function applyCraftBoost(
  rawDurationMs: number,
  kind:          "gear" | "consumable" | "attunement" | "essence",
  state:         GameState,
  now:           number,
): number {
  const boostType = kind === "attunement" ? "attunement" : "craft";
  const mult      = getBoostMultiplier(state.activeBoosts, boostType, now);
  return mult > 1 ? Math.max(1, Math.floor(rawDurationMs / mult)) : rawDurationMs;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type CraftFilter = "all" | "gear" | "consumables" | "other";

interface CraftEntry {
  id:          string;          // "gear:sprinkler_rare", "consumable:bloom_burst_1", "attunement:1", "essence:universal"
  kind:        "gear" | "consumable" | "attunement" | "essence";
  emoji:       string;
  sprite?:     string;
  name:        string;
  rarity:      Rarity;
  description: string;
  owned:       number;
  canCraft:    boolean;
  tier?:       number | null;
}

// ── Gear tier derivation ──────────────────────────────────────────────────────

const RARITY_SUFFIXES = new Set(["uncommon","rare","legendary","mythic","exalted","prismatic"]);

function gearFamily(gearType: string): string {
  const parts = gearType.split("_");
  return RARITY_SUFFIXES.has(parts[parts.length - 1]) ? parts.slice(0, -1).join("_") : gearType;
}

const GEAR_TIER_MAP = (() => {
  const counts: Record<string, number> = {};
  const map:    Record<string, number> = {};
  for (const r of GEAR_RECIPES) {
    const fam = gearFamily(r.outputGearType);
    counts[fam] = (counts[fam] ?? 0) + 1;
    map[r.outputGearType] = counts[fam];
  }
  for (const r of GEAR_RECIPES) {
    if (counts[gearFamily(r.outputGearType)] <= 1) delete map[r.outputGearType];
  }
  return map;
})();

// ── Formatting helpers ────────────────────────────────────────────────────────

const ROMAN = ["I","II","III","IV","V"] as const;
function toRoman(n: number): string { return ROMAN[n - 1] ?? String(n); }

function formatDuration(ms: number): string {
  if (ms <= 0) return "Done!";
  const s = Math.ceil(ms / 1000);
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatDurationLabel(ms: number): string {
  if (ms <  60_000)    return `${Math.round(ms / 1000)}s`;
  if (ms <  3_600_000) {
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m} min`;
  }
  if (ms < 86_400_000) {
    const totalMin = Math.round(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} hr`;
  }
  return `${(ms / 86_400_000).toFixed(1).replace(".0", "")} day`;
}

// ── Rarity style helpers ──────────────────────────────────────────────────────

function cellBorderClass(rarity: Rarity): string {
  // Prismatic: return `rainbow-tile` which animates border + bg + glow in a
  // SINGLE animation declaration. Splitting border/bg into separate classes
  // (rainbow-border + rainbow-bg) collides on the `animation` shorthand —
  // the later-defined class wins and the other animation silently drops.
  if (rarity === "prismatic") return "rainbow-tile";
  const cfg = RARITY_CONFIG[rarity];
  return cfg.borderBloom || cfg.borderGrowing || "border-border";
}

function cellBgClass(rarity: Rarity): string {
  // Prismatic's bg is already part of `rainbow-tile` returned by cellBorderClass.
  // Returning an empty string here avoids overriding the animated background.
  if (rarity === "prismatic") return "";
  return RARITY_CONFIG[rarity].bgBloom || "bg-card/60";
}

function rarityChip(rarity: Rarity): { color: string; border: string; bg: string } {
  if (rarity === "prismatic") return { color: "rainbow-text", border: "rainbow-tile", bg: "" };
  const cfg = RARITY_CONFIG[rarity];
  return {
    color:  cfg.color        || "text-foreground",
    border: cfg.borderBloom  || cfg.borderGrowing || "border-border",
    bg:     cfg.bgBloom      || "bg-card/60",
  };
}

function essenceChip(essenceType: string): { color: string; border: string; bg: string } {
  if (essenceType === "universal") return { color: "rainbow-text", border: "rainbow-tile", bg: "" };
  const cfg = FLOWER_TYPES[essenceType as FlowerType];
  return { color: cfg.color, border: cfg.borderColor, bg: cfg.bgColor };
}

// ── Build item list from all recipes ─────────────────────────────────────────

function buildEntries(state: GameState, filter: CraftFilter): CraftEntry[] {
  const essences   = state.essences      ?? [];
  const gearInv    = state.gearInventory ?? [];
  const consum     = state.consumables   ?? [];
  const infusers   = state.infusers      ?? [];
  const ferts      = state.fertilizers   ?? [];
  // All crafts go into the queue — a slot must be free
  const slotsAvail = (state.craftingQueue?.length ?? 0) < (state.craftingSlotCount ?? 1);

  const entries: CraftEntry[] = [];

  // ── Gear ──────────────────────────────────────────────────────────────────
  if (filter === "all" || filter === "gear") {
    for (const recipe of GEAR_RECIPES) {
      const def = GEAR[recipe.outputGearType as GearType];
      entries.push({
        id:          `gear:${recipe.outputGearType}`,
        kind:        "gear",
        emoji:       def.emoji,
        sprite:      def.sprite,
        name:        def.name,
        rarity:      def.rarity,
        description: def.description,
        owned:       gearInv.find((g) => g.gearType === recipe.outputGearType)?.quantity ?? 0,
        canCraft:    slotsAvail && canCraftGear(recipe, essences, gearInv, consum, state.coins),
        tier:        GEAR_TIER_MAP[recipe.outputGearType] ?? null,
      });
    }
  }

  // ── Consumables (seed pouches live in "other") ───────────────────────────
  if (filter === "all" || filter === "consumables") {
    for (const recipe of CONSUMABLE_RECIPES) {
      if (recipe.category === "seed_pouch") continue;
      // Fertilizers are delivered to state.fertilizers — use that for owned count
      const isFertilizer = recipe.category === "fertilizer";
      const fertType = isFertilizer ? recipe.id.replace("fertilizer_", "") : null;
      const owned = isFertilizer
        ? (ferts.find((f) => f.type === fertType)?.quantity ?? 0)
        : (consum.find((c) => c.id === recipe.id)?.quantity ?? 0);
      entries.push({
        id:          `consumable:${recipe.id}`,
        kind:        "consumable",
        emoji:       recipe.emoji,
        sprite:      recipe.sprite,
        name:        recipe.name,
        rarity:      recipe.rarity,
        description: recipe.description,
        tier:        recipe.tier,
        owned,
        canCraft:    slotsAvail && canCraftConsumable(recipe, essences, consum, ferts),
      });
    }

    // Infusion crystals (cross-breeding) — internal kind stays "attunement"
    // for save-format stability, but the UI label is now "Infusion".
    for (const recipe of ATTUNEMENT_RECIPES) {
      entries.push({
        id:          `attunement:${recipe.tier}`,
        kind:        "attunement",
        emoji:       "💉",
        name:        recipe.name,
        rarity:      recipe.rarity,
        description: recipe.description,
        tier:        recipe.tier,
        owned:       infusers.find((i) => i.rarity === recipe.rarity)?.quantity ?? 0,
        canCraft:    slotsAvail && canCraftAttunement(recipe, essences, infusers),
      });
    }
  }

  // ── Other (Universal Essence + Seed Pouches) ─────────────────────────────
  if (filter === "all" || filter === "other") {
    const universalOwned    = essences.find((e) => e.type === "universal")?.amount ?? 0;
    const universalAffordable = universalEssenceCraftable(essences) > 0;
    entries.push({
      id:          "essence:universal",
      kind:        "essence",
      emoji:       UNIVERSAL_ESSENCE_DISPLAY.emoji,
      name:        "Universal Essence",
      rarity:      "prismatic",
      description: `Combine ${UNIVERSAL_ESSENCE_COST_PER_TYPE} of each elemental essence into a Universal Essence — used in legendary+ cross-breed recipes.`,
      owned:       universalOwned,
      canCraft:    slotsAvail && universalAffordable,
    });
    // Seed Pouches (generic + typed, all 65)
    for (const recipe of CONSUMABLE_RECIPES) {
      if (recipe.category !== "seed_pouch") continue;
      entries.push({
        id:          `consumable:${recipe.id}`,
        kind:        "consumable",
        emoji:       recipe.emoji,
        sprite:      recipe.sprite,
        name:        recipe.name,
        rarity:      recipe.rarity,
        description: recipe.description,
        tier:        recipe.tier,
        owned:       consum.find((c) => c.id === recipe.id)?.quantity ?? 0,
        canCraft:    slotsAvail && canCraftConsumable(recipe, essences, consum),
      });
    }
  }

  return entries.sort((a, b) => {
    if (a.canCraft !== b.canCraft) return a.canCraft ? -1 : 1;
    return 0;
  });
}

// ── Popup ingredient display ──────────────────────────────────────────────────

function IngredientRow({
  label, emoji, need, have, enough, color, border, bg,
}: {
  label: string; emoji: string; need: number; have: number; enough: boolean;
  color: string; border: string; bg: string;
}) {
  return (
    <div className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border ${border} ${bg}`}>
      <span className={`flex items-center gap-1.5 font-medium ${color}`}>
        <span>{emoji}</span>
        <span>{label}</span>
      </span>
      <span className={`font-mono font-semibold ml-3 ${enough ? "text-green-400" : "text-red-400"}`}>
        {have.toLocaleString()}/{need.toLocaleString()}
      </span>
    </div>
  );
}

function GearIngredients({
  recipe, essences, gearInventory, consumables, quantity = 1,
}: {
  recipe:        GearRecipe;
  essences:      { type: string; amount: number }[];
  gearInventory: { gearType: string; quantity: number }[];
  consumables:   { id: string; quantity: number }[];
  quantity?:     number;
}) {
  return (
    <div className="space-y-1">
      {recipe.ingredients.map((ing, i) => {
        if (ing.kind === "essence") {
          const isUniversal = ing.essenceType === "universal";
          const cfg   = isUniversal ? UNIVERSAL_ESSENCE_DISPLAY : FLOWER_TYPES[ing.essenceType as FlowerType];
          const have  = essences.find((e) => e.type === ing.essenceType)?.amount ?? 0;
          const label = isUniversal ? "Universal Essence" : `${cfg.name} Essence`;
          const need  = ing.amount * quantity;
          return <IngredientRow key={i} emoji={cfg.emoji} label={label} need={need} have={have} enough={have >= need} {...essenceChip(ing.essenceType)} />;
        }
        if (ing.kind === "gear") {
          const def   = GEAR[ing.gearType as GearType];
          const have  = gearInventory.find((g) => g.gearType === ing.gearType)?.quantity ?? 0;
          const need  = ing.quantity * quantity;
          return <IngredientRow key={i} emoji={def?.emoji ?? "⚙️"} label={def?.name ?? ing.gearType} need={need} have={have} enough={have >= need} {...rarityChip(def?.rarity ?? "common")} />;
        }
        const crec = CONSUMABLE_RECIPE_MAP[ing.consumableId as ConsumableId];
        const have = consumables.find((c) => c.id === ing.consumableId)?.quantity ?? 0;
        const need = ing.quantity * quantity;
        return <IngredientRow key={i} emoji={crec?.emoji ?? "🧪"} label={crec?.name ?? ing.consumableId} need={need} have={have} enough={have >= need} {...(crec ? rarityChip(crec.rarity) : { color: "text-muted-foreground", border: "border-border", bg: "bg-card/60" })} />;
      })}
    </div>
  );
}

// queueEntryDisplay moved to src/lib/craftDisplay.ts so the global craft-completion
// banner in App.tsx can reuse it.

// ── Collect toast ─────────────────────────────────────────────────────────────

function CollectToast({ emoji, name, onDone }: { emoji: string; name: string; onDone: () => void }) {
  // Empty deps on purpose — `onDone` is a fresh closure on every parent render
  // (CraftingTab re-renders every second from setNow), so depending on it would
  // reset the timeout repeatedly and the toast would never dismiss.
  useEffect(() => {
    const id = setTimeout(onDone, 2500);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-2 bg-card/95 border border-green-500/40 text-green-400 rounded-xl px-4 py-2.5 shadow-xl text-sm font-semibold backdrop-blur-sm">
      <span className="text-xl leading-none">{emoji}</span>
      <span>{name} collected!</span>
      <span className="text-green-500 text-base leading-none">✓</span>
    </div>
  );
}

// ── Crafting queue panel ──────────────────────────────────────────────────────

function QueueEntryRow({
  entry, now, onCollect, onCancel, isCollecting, isCanceling, isBoosted,
}: {
  entry:        CraftingQueueEntry;
  now:          number;
  onCollect:    (id: string) => void;
  onCancel:     (id: string) => void;
  isCollecting: boolean;
  isCanceling:  boolean;
  isBoosted:    boolean;
}) {
  const { emoji, name } = queueEntryDisplay(entry);
  const startedAt = new Date(entry.startedAt).getTime();
  const elapsed   = now - startedAt;
  // Clamp progress to [0, 1]. Without Math.max(0, …) a stale `now` (the 1s-tick
  // state lags real time by up to a second) makes `elapsed` negative right after
  // a craft starts → width: -0.3% → browser falls back to width: auto → 100%.
  const progress  = Math.max(0, Math.min(elapsed / entry.durationMs, 1));
  const isDone    = progress >= 1;
  const remaining = Math.max(entry.durationMs - elapsed, 0);
  const qty       = entry.quantity && entry.quantity > 1 ? entry.quantity : 1;

  return (
    <div className={`relative rounded-xl border bg-card/40 px-3 py-2 space-y-1.5 overflow-hidden ${isBoosted && !isDone ? "border-orange-500/50" : "border-border"}`}>
      {/* Forge Haste sparks — visible while boost is active and craft is in-progress */}
      {isBoosted && !isDone && (
        <div className="absolute inset-0 pointer-events-none">
          <span className="boost-forge-spark" style={{ left: "10%",  animationDelay: "-1.2s" }}>✦</span>
          <span className="boost-forge-spark" style={{ left: "45%",  animationDelay: "-0.6s" }}>✦</span>
          <span className="boost-forge-spark" style={{ left: "78%",  animationDelay: "0s"    }}>✦</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none shrink-0">{emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-foreground truncate">{name}</p>
              {qty > 1 && (
                <span className="shrink-0 inline-flex items-center justify-center text-[10px] leading-none font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/40 rounded px-1.5 py-1">
                  ×{qty}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {isDone ? <span className="text-green-400 font-semibold">Ready to collect!</span> : formatDuration(remaining)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isDone && (
            <button
              onClick={() => onCollect(entry.id)}
              disabled={isCollecting || isCanceling}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isCollecting ? "…" : "✅ Collect"}
            </button>
          )}
          {!isDone && (
            <button
              onClick={() => onCancel(entry.id)}
              disabled={isCollecting || isCanceling}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-card/60 border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title="Cancel (refunds ingredients and coins)"
            >
              {isCanceling ? "…" : "✕"}
            </button>
          )}
        </div>
      </div>
      {/* Progress bar — `now` ticks every 1s in discrete steps, so without a
          width transition the bar visibly stutters on short (<5 min) crafts.
          A 1s linear width transition smooths it out between ticks; the amber
          → green colour fade keeps its faster 500ms ease. */}
      <div className="w-full h-1.5 rounded-full bg-card/60 overflow-hidden">
        <div
          className={`h-full rounded-full ${isDone ? "bg-green-500" : "bg-amber-500"}`}
          style={{
            width: `${progress * 100}%`,
            transition: "width 1s linear, background-color 500ms",
          }}
        />
      </div>
    </div>
  );
}

// ── Empty slot placeholder ───────────────────────────────────────────────────
// Rendered for each unused crafting slot so the "Crafting Slots" panel is
// always visible at the same height regardless of queue length. Keeps the user
// oriented to how many slots they have and which are free.
function EmptySlotRow() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/20 px-3 py-2 min-h-[3rem] flex items-center gap-2">
      <span className="text-lg leading-none shrink-0 opacity-30">⚒️</span>
      <p className="text-xs text-muted-foreground italic">Empty slot</p>
    </div>
  );
}

// ── Upgrade-as-next-slot row ────────────────────────────────────────────────
// Renders as a "ghost" slot directly after the player's current slots — clicking
// it spends the upgrade cost to permanently unlock the next slot.
function UpgradeSlotRow({
  upgrade, onUpgrade, disabled, upgrading,
}: {
  upgrade:   { slots: number; cost: number };
  onUpgrade: () => void;
  disabled:  boolean;
  upgrading: boolean;
}) {
  return (
    <button
      onClick={onUpgrade}
      disabled={disabled}
      title={`Unlock crafting slot ${upgrade.slots}`}
      className="
        w-full rounded-xl border border-dashed border-amber-600/40 bg-amber-500/5
        hover:bg-amber-500/10 hover:border-amber-400/60
        px-3 py-2 min-h-[3rem] flex items-center justify-between gap-2
        transition-all disabled:opacity-40 disabled:cursor-not-allowed
      "
    >
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none shrink-0 opacity-70">➕</span>
        <p className="text-xs font-semibold text-amber-400">
          {upgrading ? "Unlocking…" : `Unlock slot ${upgrade.slots}`}
        </p>
      </div>
      <span className="text-[11px] font-mono text-amber-400">
        {upgrade.cost.toLocaleString()} 🟡
      </span>
    </button>
  );
}

// ── Bulk crafting ─────────────────────────────────────────────────────────────
// Hard cap on bulk quantity per craft. Mirrors MAX_BULK_QUANTITY in
// supabase/functions/craft-start/index.ts — keep them in sync.
const MAX_BULK_QUANTITY = 50;

// ── Universal Essence (kind="essence") ───────────────────────────────────────
// Base duration per Universal Essence — must mirror
// UNIVERSAL_ESSENCE_BASE_DURATION_MS in supabase/functions/craft-start/index.ts.
const UNIVERSAL_ESSENCE_BASE_DURATION_MS = 60_000;

/** How many of `entry` the player can afford right now (capped at MAX_BULK_QUANTITY). */
function maxCraftableQuantity(entry: CraftEntry, state: GameState): number {
  const essences = state.essences      ?? [];
  const gearInv  = state.gearInventory ?? [];
  const consum   = state.consumables   ?? [];
  const infusers = state.infusers      ?? [];
  const ferts    = state.fertilizers   ?? [];

  let cap = MAX_BULK_QUANTITY;
  const limit = (have: number, need: number) => {
    if (need <= 0) return;
    cap = Math.min(cap, Math.floor(have / need));
  };

  if (entry.kind === "gear") {
    const gearType = entry.id.replace("gear:", "");
    const recipe   = GEAR_RECIPES.find((r) => r.outputGearType === gearType);
    if (!recipe) return 0;
    if (recipe.coinCost > 0) limit(state.coins, recipe.coinCost);
    for (const ing of recipe.ingredients) {
      if (ing.kind === "essence") {
        limit(essences.find((e) => e.type === ing.essenceType)?.amount ?? 0, ing.amount);
      } else if (ing.kind === "gear") {
        limit(gearInv.find((g) => g.gearType === ing.gearType)?.quantity ?? 0, ing.quantity);
      } else {
        limit(consum.find((c) => c.id === ing.consumableId)?.quantity ?? 0, ing.quantity);
      }
    }
  } else if (entry.kind === "consumable") {
    const id     = entry.id.replace("consumable:", "") as ConsumableId;
    const recipe = CONSUMABLE_RECIPE_MAP[id];
    if (!recipe) return 0;
    const cost = recipe.cost;
    if (cost.kind === "essence") {
      for (const { type, amount } of cost.amounts) {
        limit(essences.find((e) => e.type === type)?.amount ?? 0, amount);
      }
    } else if ((cost.id as string).startsWith("fertilizer_")) {
      const fertType = (cost.id as string).replace("fertilizer_", "");
      limit(ferts.find((f) => f.type === fertType)?.quantity ?? 0, cost.quantity);
    } else {
      limit(consum.find((c) => c.id === cost.id)?.quantity ?? 0, cost.quantity);
    }
  } else if (entry.kind === "attunement") {
    const tier   = parseInt(entry.id.replace("attunement:", ""), 10) as 1|2|3|4|5;
    const recipe = ATTUNEMENT_RECIPES.find((r) => r.tier === tier);
    if (!recipe) return 0;
    const cost = recipe.cost;
    if (cost.kind === "essence") {
      for (const { type, amount } of cost.amounts) {
        limit(essences.find((e) => e.type === type)?.amount ?? 0, amount);
      }
    } else {
      const prevRarity = TIER_RARITIES[cost.tier as 1|2|3|4|5] as string;
      limit(infusers.find((i) => i.rarity === prevRarity)?.quantity ?? 0, cost.quantity);
    }
  } else if (entry.kind === "essence") {
    // Universal Essence: 1 of each of the 12 elementals per craft.
    for (const type of ALL_FLOWER_TYPES) {
      limit(essences.find((e) => e.type === type)?.amount ?? 0, UNIVERSAL_ESSENCE_COST_PER_TYPE);
    }
  }

  return Math.max(0, cap);
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function CraftPopup({
  entry, onClose, onCraft, isCrafting, craftError, state, slotsAvailable,
}: {
  entry:          CraftEntry;
  onClose:        () => void;
  onCraft:        (quantity: number) => void;
  isCrafting:     boolean;
  craftError:     string | null;
  state:          GameState;
  slotsAvailable: boolean;
}) {
  // Lock body scroll while the popup is open so the underlying CraftingTab
  // list doesn't jump when the sheet mounts / unmounts on mobile.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const essences  = state.essences      ?? [];
  const gearInv   = state.gearInventory ?? [];
  const consum    = state.consumables   ?? [];
  const infusers  = state.infusers      ?? [];
  const ferts     = state.fertilizers   ?? [];
  const rc = RARITY_CONFIG[entry.rarity];

  const gearType   = entry.kind === "gear" ? entry.id.replace("gear:", "") : null;
  const gearRecipe = gearType ? GEAR_RECIPES.find((r) => r.outputGearType === gearType) : null;

  // ── Bulk crafting selector ─────────────────────────────────────────────────
  // `maxAffordable` is the largest quantity the player can afford right now.
  // The local quantity is clamped to [1, max(1, maxAffordable)] so the +/- UI
  // always points at a valid value as inventory changes.
  const maxAffordable = useMemo(
    () => maxCraftableQuantity(entry, state),
    [entry, state],
  );
  const [quantity, setQuantity] = useState(1);
  // Re-clamp whenever maxAffordable shrinks (e.g., another tab spent essences).
  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, maxAffordable)));
  }, [maxAffordable]);

  // All crafts now go into the queue — slot availability applies to all kinds
  const canAct = slotsAvailable && entry.canCraft && quantity >= 1 && quantity <= maxAffordable;

  // Compute which specific ingredients are short so the button label is actionable
  const craftBlockReason = useMemo((): string => {
    if (entry.canCraft) return "";
    const missing: string[] = [];

    if (entry.kind === "gear" && gearRecipe) {
      const coinNeed = gearRecipe.coinCost * quantity;
      if (state.coins < coinNeed)
        missing.push(`${(coinNeed - state.coins).toLocaleString()} coins`);
      for (const ing of gearRecipe.ingredients) {
        if (ing.kind === "essence") {
          const have = essences.find((e) => e.type === ing.essenceType)?.amount ?? 0;
          const need = ing.amount * quantity;
          if (have < need) {
            const cfg = FLOWER_TYPES[ing.essenceType as FlowerType];
            missing.push(`${(need - have).toLocaleString()} ${cfg?.name ?? ing.essenceType} essence`);
          }
        } else if (ing.kind === "gear") {
          const have = gearInv.find((g) => g.gearType === ing.gearType)?.quantity ?? 0;
          const need = ing.quantity * quantity;
          if (have < need)
            missing.push(`${need - have} ${GEAR[ing.gearType].name}`);
        } else if (ing.kind === "consumable") {
          const have = consum.find((c) => c.id === ing.consumableId)?.quantity ?? 0;
          const need = ing.quantity * quantity;
          if (have < need) {
            const src = CONSUMABLE_RECIPE_MAP[ing.consumableId as ConsumableId];
            missing.push(`${need - have} ${src?.name ?? ing.consumableId}`);
          }
        }
      }
    } else if (entry.kind === "consumable") {
      const id     = entry.id.replace("consumable:", "") as ConsumableId;
      const recipe = CONSUMABLE_RECIPE_MAP[id];
      if (recipe) {
        const cost = recipe.cost;
        if (cost.kind === "essence") {
          for (const { type, amount } of cost.amounts) {
            const have = essences.find((e) => e.type === type)?.amount ?? 0;
            const need = amount * quantity;
            if (have < need) {
              const isUni = type === "universal";
              const cfg   = isUni ? UNIVERSAL_ESSENCE_DISPLAY : FLOWER_TYPES[type as FlowerType];
              missing.push(`${(need - have).toLocaleString()} ${cfg.name} essence`);
            }
          }
        } else if ((cost.id as string).startsWith("fertilizer_")) {
          const fertType = (cost.id as string).replace("fertilizer_", "");
          const have     = ferts.find((f) => f.type === fertType)?.quantity ?? 0;
          const need     = cost.quantity * quantity;
          if (have < need) {
            const fertDef = FERTILIZERS[fertType as keyof typeof FERTILIZERS];
            missing.push(`${need - have} ${fertDef?.name ?? fertType}`);
          }
        } else {
          const have = consum.find((c) => c.id === cost.id)?.quantity ?? 0;
          const need = cost.quantity * quantity;
          if (have < need) {
            const src = CONSUMABLE_RECIPE_MAP[cost.id as ConsumableId];
            missing.push(`${need - have} ${src?.name ?? cost.id}`);
          }
        }
      }
    } else if (entry.kind === "attunement") {
      const tier   = parseInt(entry.id.replace("attunement:", ""), 10) as 1|2|3|4|5;
      const recipe = ATTUNEMENT_RECIPES.find((r) => r.tier === tier);
      if (recipe) {
        const cost = recipe.cost;
        if (cost.kind === "essence") {
          for (const { type, amount } of cost.amounts) {
            const have = essences.find((e) => e.type === type)?.amount ?? 0;
            const need = amount * quantity;
            if (have < need) {
              const isUni = type === "universal";
              const cfg   = isUni ? UNIVERSAL_ESSENCE_DISPLAY : FLOWER_TYPES[type as FlowerType];
              missing.push(`${(need - have).toLocaleString()} ${cfg.name} essence`);
            }
          }
        } else {
          const prevRarity = TIER_RARITIES[cost.tier as 1|2|3|4|5];
          const have       = infusers.find((i) => i.rarity === prevRarity)?.quantity ?? 0;
          const need       = cost.quantity * quantity;
          if (have < need)
            missing.push(`${need - have} Infuser ${toRoman(cost.tier)}`);
        }
      }
    } else if (entry.kind === "essence") {
      for (const type of ALL_FLOWER_TYPES) {
        const have = essences.find((e) => e.type === type)?.amount ?? 0;
        const need = UNIVERSAL_ESSENCE_COST_PER_TYPE * quantity;
        if (have < need) {
          const cfg = FLOWER_TYPES[type];
          missing.push(`${(need - have).toLocaleString()} ${cfg.name} essence`);
        }
      }
    }

    if (missing.length === 0) return "Missing ingredients";
    if (missing.length === 1) return `Need ${missing[0]}`;
    if (missing.length === 2) return `Need ${missing[0]} + ${missing[1]}`;
    return `Need ${missing[0]} + ${missing.length - 1} more`;
  }, [entry, gearRecipe, gearInv, essences, consum, ferts, infusers, quantity, state.coins]);

  let buttonLabel: string;
  if (isCrafting)           buttonLabel = "Starting…";
  else if (!slotsAvailable) buttonLabel = "No crafting slots available";
  else if (!entry.canCraft) buttonLabel = craftBlockReason;
  else if (quantity > 1)    buttonLabel = `⏳ Craft ×${quantity}`;
  else                      buttonLabel = "⏳ Start Crafting";

  // Duration for display (multiplied by quantity)
  let baseDurationMs = 0;
  if (entry.kind === "gear" && gearRecipe) {
    baseDurationMs = gearRecipe.durationMs;
  } else if (entry.kind === "consumable") {
    baseDurationMs = craftDurationFromRarity(entry.rarity);
  } else if (entry.kind === "attunement") {
    baseDurationMs = craftDurationFromRarity(entry.rarity);
  } else if (entry.kind === "essence") {
    baseDurationMs = UNIVERSAL_ESSENCE_BASE_DURATION_MS;
  }
  const totalDurationMs = baseDurationMs * quantity;

  // Render ingredients section depending on item kind
  let ingredientsSection: React.ReactNode = null;

  if (entry.kind === "gear" && gearRecipe) {
    const totalCoinCost = gearRecipe.coinCost * quantity;
    ingredientsSection = (
      <div className="space-y-1">
        <IngredientRow
          emoji="🟡"
          label="Coin Cost"
          need={totalCoinCost}
          have={state.coins}
          enough={state.coins >= totalCoinCost}
          color="text-amber-400"
          border="border-amber-500/40"
          bg="bg-amber-950/20"
        />
        <GearIngredients recipe={gearRecipe} essences={essences} gearInventory={gearInv} consumables={consum} quantity={quantity} />
      </div>
    );
  } else if (entry.kind === "consumable") {
    const id = entry.id.replace("consumable:", "") as ConsumableId;
    const recipe = CONSUMABLE_RECIPE_MAP[id];
    if (recipe) {
      const cost = recipe.cost;
      if (cost.kind === "essence") {
        ingredientsSection = (
          <div className="space-y-1">
            {cost.amounts.map(({ type, amount }) => {
              const isUniversal = type === "universal";
              const cfg   = isUniversal ? UNIVERSAL_ESSENCE_DISPLAY : FLOWER_TYPES[type as FlowerType];
              const have  = essences.find((e) => e.type === type)?.amount ?? 0;
              const label = isUniversal ? "Universal Essence" : `${cfg.name} Essence`;
              const need  = amount * quantity;
              return <IngredientRow key={type} emoji={cfg.emoji} label={label} need={need} have={have} enough={have >= need} {...essenceChip(type)} />;
            })}
          </div>
        );
      } else if ((cost.id as string).startsWith("fertilizer_")) {
        // Fertilizer ingredient: check state.fertilizers for stock
        const fertType = (cost.id as string).replace("fertilizer_", "") as keyof typeof FERTILIZERS;
        const fertDef  = FERTILIZERS[fertType];
        const have     = ferts.find((f) => f.type === fertType)?.quantity ?? 0;
        const need     = cost.quantity * quantity;
        const srcRec   = CONSUMABLE_RECIPE_MAP[cost.id as ConsumableId];
        ingredientsSection = (
          <div className="space-y-1">
            <IngredientRow emoji={fertDef?.emoji ?? "🌱"} label={fertDef?.name ?? cost.id} need={need} have={have} enough={have >= need} {...(srcRec ? rarityChip(srcRec.rarity) : { color: "text-muted-foreground", border: "border-border", bg: "bg-card/60" })} />
          </div>
        );
      } else {
        const src  = CONSUMABLE_RECIPE_MAP[cost.id as ConsumableId];
        const have = consum.find((c) => c.id === cost.id)?.quantity ?? 0;
        const need = cost.quantity * quantity;
        ingredientsSection = (
          <div className="space-y-1">
            <IngredientRow emoji={src?.emoji ?? "?"} label={src?.name ?? cost.id} need={need} have={have} enough={have >= need} {...(src ? rarityChip(src.rarity) : { color: "text-muted-foreground", border: "border-border", bg: "bg-card/60" })} />
          </div>
        );
      }
    }
  } else if (entry.kind === "attunement") {
    const tier   = parseInt(entry.id.replace("attunement:", ""), 10) as 1|2|3|4|5;
    const recipe = ATTUNEMENT_RECIPES.find((r) => r.tier === tier);
    if (recipe) {
      const cost = recipe.cost;
      if (cost.kind === "essence") {
        ingredientsSection = (
          <div className="space-y-1">
            {cost.amounts.map(({ type, amount }) => {
              const isUniversal = type === "universal";
              const cfg   = isUniversal ? UNIVERSAL_ESSENCE_DISPLAY : FLOWER_TYPES[type as FlowerType];
              const have  = essences.find((e) => e.type === type)?.amount ?? 0;
              const label = isUniversal ? "Universal Essence" : `${cfg.name} Essence`;
              const need  = amount * quantity;
              return <IngredientRow key={type} emoji={cfg.emoji} label={label} need={need} have={have} enough={have >= need} {...essenceChip(type)} />;
            })}
          </div>
        );
      } else {
        const prevRarity = TIER_RARITIES[cost.tier as 1|2|3|4|5];
        const have = infusers.find((i) => i.rarity === prevRarity)?.quantity ?? 0;
        const need = cost.quantity * quantity;
        ingredientsSection = (
          <div className="space-y-1">
            <IngredientRow emoji="💉" label={`Infuser ${toRoman(cost.tier)}`} need={need} have={have} enough={have >= need} {...rarityChip(prevRarity)} />
          </div>
        );
      }
    }
  } else if (entry.kind === "essence") {
    // Universal Essence: 1 of each of the 12 elementals per craft. Show all 12.
    ingredientsSection = (
      <div className="space-y-1">
        {ALL_FLOWER_TYPES.map((type) => {
          const cfg  = FLOWER_TYPES[type];
          const have = essences.find((e) => e.type === type)?.amount ?? 0;
          const need = UNIVERSAL_ESSENCE_COST_PER_TYPE * quantity;
          return <IngredientRow key={type} emoji={cfg.emoji} label={`${cfg.name} Essence`} need={need} have={have} enough={have >= need} {...essenceChip(type)} />;
        })}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 border-b border-border ${cellBgClass(entry.rarity)}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <ItemSprite emoji={entry.emoji} sprite={entry.sprite} name={entry.name} textSize="text-4xl" imgSize="w-10 h-10" />
              <div>
                <p className="font-bold text-base text-foreground leading-tight">{entry.name}</p>
                <span className={`text-xs font-semibold ${rc.color}`}>{rc.label}</span>
                {entry.owned > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Owned: <span className="text-foreground font-semibold">{entry.owned}</span>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none pt-0.5"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-snug">{entry.description}</p>
        </div>

        {/* Quantity selector — only shown when bulk is possible */}
        {entry.canCraft && maxAffordable > 1 && (
          <div className="px-5 pt-4 pb-1">
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-card/40 border border-border">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Quantity
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isCrafting}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-card/60 border border-border text-foreground hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-base font-bold leading-none pb-0.5"
                  aria-label="Decrease quantity"
                >−</button>
                <span className="font-mono font-semibold text-sm text-foreground min-w-[2rem] text-center">
                  ×{quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(maxAffordable, q + 1))}
                  disabled={quantity >= maxAffordable || isCrafting}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-card/60 border border-border text-foreground hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-base font-bold leading-none"
                  aria-label="Increase quantity"
                >+</button>
                <button
                  onClick={() => setQuantity(maxAffordable)}
                  disabled={quantity >= maxAffordable || isCrafting}
                  className="ml-1 px-2 py-1 rounded-lg bg-card/60 border border-border text-[10px] font-semibold text-muted-foreground hover:text-amber-300 hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Max ({maxAffordable})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ingredients */}
        <div className="px-5 py-4 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
            {entry.kind === "gear" ? "Cost & Ingredients" : "Ingredients"}
          </p>
          {ingredientsSection}
          {totalDurationMs > 0 && (
            <p className="text-[10px] text-muted-foreground pt-1 px-0.5">
              ⏱ Duration: <span className="text-foreground">{formatDurationLabel(totalDurationMs)}</span>
              {quantity > 1 && (
                <span className="text-muted-foreground/70"> ({formatDurationLabel(baseDurationMs)} × {quantity})</span>
              )}
            </p>
          )}
        </div>

        {/* Craft button */}
        <div className="px-5 pb-5">
          {craftError && (
            <p className="text-xs text-red-400 mb-2">{craftError}</p>
          )}
          <button
            onClick={() => onCraft(quantity)}
            disabled={!canAct || isCrafting}
            className={`
              w-full py-3 rounded-xl font-semibold text-sm transition-all text-center
              ${canAct && !isCrafting
                ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              }
            `}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cell ──────────────────────────────────────────────────────────────────────

function CraftCell({ entry, onClick }: { entry: CraftEntry; onClick: () => void }) {
  const borderCls = cellBorderClass(entry.rarity);
  const bgCls     = cellBgClass(entry.rarity);

  return (
    <button
      onClick={onClick}
      className={`
        relative h-16 w-16 rounded-xl border-2 flex flex-col items-center justify-center
        transition-all duration-150
        ${borderCls} ${bgCls}
        ${entry.canCraft
          ? "hover:scale-[1.08] hover:shadow-lg cursor-pointer"
          : "opacity-30 grayscale cursor-pointer"
        }
      `}
    >
      <ItemSprite emoji={entry.emoji} sprite={entry.sprite} name={entry.name} textSize="text-xl" imgSize="w-6 h-6" className="select-none" />
      {entry.tier != null && (
        <span className="absolute top-0.5 right-1 text-[9px] font-bold text-muted-foreground leading-none">
          {toRoman(entry.tier)}
        </span>
      )}
      {entry.owned > 0 && (
        <span className="absolute bottom-0.5 left-1 text-[9px] font-bold text-muted-foreground leading-none">
          ×{entry.owned}
        </span>
      )}
    </button>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const FILTER_LABELS: { id: CraftFilter; label: string; emoji: string }[] = [
  { id: "all",         label: "All",         emoji: "✦"  },
  { id: "gear",        label: "Gear",        emoji: "⚙️" },
  { id: "consumables", label: "Consumables", emoji: "🧪" },
  { id: "other",       label: "Other",       emoji: "✨" },
];

export function CraftingTab() {
  const { state, getState, update, perform, pushGenericToast } = useGame();
  const { incrementStat } = useAchievementStats();
  const [filter,       setFilter]       = useState<CraftFilter>("all");
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState<CraftEntry | null>(null);
  const [crafting,     setCrafting]     = useState(false);
  const [craftError,   setCraftError]   = useState<string | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [cancelingId,  setCancelingId]  = useState<string | null>(null);
  const [upgradingSlots, setUpgradingSlots] = useState(false);

  const [collectToasts, setCollectToasts] = useState<{ id: string; emoji: string; name: string }[]>([]);

  // Tick once per second to drive queue progress bars + countdowns
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const craftingQueue     = state.craftingQueue     ?? [];
  const craftingSlotCount = state.craftingSlotCount ?? 1;
  const slotsInUse        = craftingQueue.length;
  const slotsAvailable    = slotsInUse < craftingSlotCount;
  const isForgeHasteActive = getBoostMultiplier(state.activeBoosts ?? [], "craft", now) > 1;

  const nextSlotUpgrade = CRAFTING_SLOT_UPGRADES.find((u) => u.slots > craftingSlotCount) ?? null;

  const entries = useMemo(() => {
    const all = buildEntries(state, filter);
    if (!search.trim()) return all;
    return all.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.essences, state.gearInventory, state.consumables, state.infusers, state.fertilizers,
      state.coins, state.craftingQueue, state.craftingSlotCount, filter, search]);

  const liveSelected = selected
    ? entries.find((e) => e.id === selected.id) ?? selected
    : null;

  function openEntry(entry: CraftEntry) {
    setSelected(entry);
    setCraftError(null);
  }

  function closePopup() {
    setSelected(null);
    setCraftError(null);
  }

  // ── Start crafting (all kinds → queue) ───────────────────────────────────
  // `quantity` is the bulk count; costs and durationMs are multiplied. Server
  // mirrors this multiplication (gear) or accepts the multiplier (consumable /
  // attunement, where the client passes BASE costs + quantity).
  async function handleCraft(quantity: number) {
    if (!liveSelected || crafting) return;
    const qty = Math.max(1, Math.min(MAX_BULK_QUANTITY, Math.floor(quantity)));
    setCrafting(true);
    setCraftError(null);

    const cur = getState();

    try {
      if (liveSelected.kind === "gear") {
        // ── Gear: server-authoritative ────────────────────────────────────
        const gearType = liveSelected.id.replace("gear:", "");
        const recipe   = GEAR_RECIPES.find((r) => r.outputGearType === gearType);
        if (!recipe) return;

        // Optimistic: deduct coins + ingredients (multiplied by qty), push a temp queue entry
        let essences = [...(cur.essences      ?? [])];
        let gearInv  = [...(cur.gearInventory ?? [])];
        let consum   = [...(cur.consumables   ?? [])];

        for (const ing of recipe.ingredients) {
          if (ing.kind === "essence") {
            const need = ing.amount * qty;
            essences = essences.map((e) => e.type === ing.essenceType ? { ...e, amount: e.amount - need } : e).filter((e) => e.amount > 0);
          } else if (ing.kind === "gear") {
            const need = ing.quantity * qty;
            gearInv = gearInv.map((g) => g.gearType === ing.gearType ? { ...g, quantity: g.quantity - need } : g).filter((g) => g.quantity > 0);
          } else {
            const need = ing.quantity * qty;
            consum = consum.map((c) => c.id === ing.consumableId ? { ...c, quantity: c.quantity - need } : c).filter((c) => c.quantity > 0);
          }
        }

        // Build stored costs for optimistic cancel refund (already × qty)
        const essenceCosts    = recipe.ingredients.filter((i): i is { kind: "essence"; essenceType: string; amount: number } => i.kind === "essence").map(({ essenceType: type, amount }) => ({ type, amount: amount * qty }));
        const gearCosts       = recipe.ingredients.filter((i): i is { kind: "gear"; gearType: GearType; quantity: number } => i.kind === "gear").map(({ gearType: gt, quantity }) => ({ gearType: gt, quantity: quantity * qty }));
        const consumableCosts = recipe.ingredients.filter((i): i is { kind: "consumable"; consumableId: string; quantity: number } => i.kind === "consumable").map(({ consumableId: id, quantity }) => ({ id, quantity: quantity * qty }));

        const tempEntry: CraftingQueueEntry = {
          id:              crypto.randomUUID(),
          kind:            "gear",
          outputId:        gearType,
          startedAt:       new Date().toISOString(),
          durationMs:      applyCraftBoost(recipe.durationMs * qty, "gear", cur, Date.now()),
          ...(qty > 1 && { quantity: qty }),
          ...(essenceCosts.length    && { essenceCosts }),
          ...(gearCosts.length       && { gearCosts }),
          ...(consumableCosts.length && { consumableCosts }),
        };

        await perform(
          {
            ...cur,
            coins:         cur.coins - recipe.coinCost * qty,
            essences,
            gearInventory: gearInv,
            consumables:   consum,
            craftingQueue: [...(cur.craftingQueue ?? []), tempEntry],
          },
          () => edgeCraftStart("gear", gearType, undefined, undefined, qty),
          (res) => {
            const fresh = getState();
            update({
              ...fresh,
              coins:           res.coins,
              essences:        res.essences,
              gearInventory:   res.gearInventory,
              consumables:     res.consumables,
              infusers:        res.infusers,
              craftingQueue:   res.craftingQueue,
              serverUpdatedAt: res.serverUpdatedAt,
            });
            closePopup();
            for (const { type, amount } of essenceCosts) {
              const ft = FLOWER_TYPES[type as FlowerType];
              if (ft) pushGenericToast(`loss:craft:essence:${type}`, ft.emoji, `${ft.name} Essence`, ft.color, "loss", amount);
            }
            for (const { gearType: gt, quantity } of gearCosts) {
              const gd = GEAR[gt]; pushGenericToast(`loss:craft:gear:${gt}`, gd.emoji, gd.name, RARITY_CONFIG[gd.rarity].color, "loss", quantity);
            }
            for (const { id: cid, quantity } of consumableCosts) {
              const r = CONSUMABLE_RECIPE_MAP[cid as ConsumableId];
              if (r) pushGenericToast(`loss:craft:consumable:${cid}`, r.emoji, r.name, RARITY_CONFIG[r.rarity].color, "loss", quantity);
            }
          },
        );

      } else if (liveSelected.kind === "essence") {
        // ── Universal Essence: server-authoritative, 1m per essence ───────
        const outputId = liveSelected.id.replace("essence:", ""); // "universal"

        // Optimistic deduction: 1 of each elemental × qty
        const need = UNIVERSAL_ESSENCE_COST_PER_TYPE * qty;
        let essences = [...(cur.essences ?? [])];
        for (const type of ALL_FLOWER_TYPES) {
          essences = essences.map((e) => e.type === type ? { ...e, amount: e.amount - need } : e).filter((e) => e.amount > 0);
        }

        // Stored essence costs for cancel refund (already × qty)
        const essenceCosts = ALL_FLOWER_TYPES.map((type) => ({ type, amount: need }));

        const tempEntry: CraftingQueueEntry = {
          id:        crypto.randomUUID(),
          kind:      "essence",
          outputId,
          startedAt: new Date().toISOString(),
          // Boost only adjusts the optimistic display; server halves its own copy.
          durationMs: applyCraftBoost(UNIVERSAL_ESSENCE_BASE_DURATION_MS * qty, "essence", cur, Date.now()),
          ...(qty > 1 && { quantity: qty }),
          essenceCosts,
        };

        await perform(
          { ...cur, essences, craftingQueue: [...(cur.craftingQueue ?? []), tempEntry] },
          () => edgeCraftStart("essence", outputId, undefined, undefined, qty),
          (res) => {
            const fresh = getState();
            update({
              ...fresh,
              coins:           res.coins,
              essences:        res.essences,
              gearInventory:   res.gearInventory,
              consumables:     res.consumables,
              infusers:        res.infusers,
              craftingQueue:   res.craftingQueue,
              serverUpdatedAt: res.serverUpdatedAt,
            });
            closePopup();
            for (const { type, amount } of essenceCosts) {
              const ft = FLOWER_TYPES[type as FlowerType];
              if (ft) pushGenericToast(`loss:craft:essence:${type}`, ft.emoji, `${ft.name} Essence`, ft.color, "loss", amount);
            }
          },
        );

      } else if (liveSelected.kind === "consumable") {
        // ── Consumable: client-declared BASE costs, server multiplies by qty
        const id     = liveSelected.id.replace("consumable:", "") as ConsumableId;
        const recipe = CONSUMABLE_RECIPE_MAP[id];
        if (!recipe) return;

        const baseDurationMs = craftDurationFromRarity(recipe.rarity);
        const cost           = recipe.cost;

        // BASE costs (sent to server)
        const baseEssenceCosts:    { type: string; amount: number }[]  = [];
        const baseConsumableCosts: { id: string; quantity: number }[]  = [];
        if (cost.kind === "essence") {
          baseEssenceCosts.push(...cost.amounts);
        } else {
          baseConsumableCosts.push({ id: cost.id, quantity: cost.quantity });
        }
        // MULTIPLIED costs (used for optimistic deduction and stored on entry for cancel refund)
        const essenceCosts    = baseEssenceCosts.map((c)    => ({ type: c.type, amount: c.amount * qty }));
        const consumableCosts = baseConsumableCosts.map((c) => ({ id: c.id,     quantity: c.quantity * qty }));

        // Split consumable costs into regular vs fertilizer for optimistic deduction
        const fertilizerCosts = consumableCosts.filter((c) => c.id.startsWith("fertilizer_"));
        const regularCosts    = consumableCosts.filter((c) => !c.id.startsWith("fertilizer_"));

        // Optimistic deductions
        let essences = [...(cur.essences      ?? [])];
        let consum   = [...(cur.consumables   ?? [])];
        let fertsOpt = [...(cur.fertilizers   ?? [])];

        for (const { type, amount } of essenceCosts) {
          essences = essences.map((e) => e.type === type ? { ...e, amount: e.amount - amount } : e).filter((e) => e.amount > 0);
        }
        for (const { id: cid, quantity } of regularCosts) {
          consum = consum.map((c) => c.id === cid ? { ...c, quantity: c.quantity - quantity } : c).filter((c) => c.quantity > 0);
        }
        for (const { id: cid, quantity } of fertilizerCosts) {
          const fType = cid.replace("fertilizer_", "");
          fertsOpt = fertsOpt.map((f) => f.type === fType ? { ...f, quantity: f.quantity - quantity } : f).filter((f) => f.quantity > 0);
        }

        const tempEntry: CraftingQueueEntry = {
          id:        crypto.randomUUID(),
          kind:      "consumable",
          outputId:  id,
          startedAt: new Date().toISOString(),
          // Boost only adjusts the optimistic display — server halves its own
          // copy when it sees an active boost, and we read durationMs back from
          // res.craftingQueue when the server responds.
          durationMs: applyCraftBoost(baseDurationMs * qty, "consumable", cur, Date.now()),
          ...(qty > 1 && { quantity: qty }),
          ...(essenceCosts.length    && { essenceCosts }),
          ...(consumableCosts.length && { consumableCosts }),
        };

        await perform(
          { ...cur, essences, consumables: consum, fertilizers: fertsOpt, craftingQueue: [...(cur.craftingQueue ?? []), tempEntry] },
          () => edgeCraftStart("consumable", id, baseDurationMs, { essenceCosts: baseEssenceCosts, consumableCosts: baseConsumableCosts }, qty),
          (res) => {
            const fresh = getState();
            update({
              ...fresh,
              coins:           res.coins,
              essences:        res.essences,
              gearInventory:   res.gearInventory,
              consumables:     res.consumables,
              infusers:        res.infusers,
              ...(res.fertilizers !== undefined && { fertilizers: res.fertilizers }),
              craftingQueue:   res.craftingQueue,
              serverUpdatedAt: res.serverUpdatedAt,
            });
            closePopup();
            for (const { type, amount } of essenceCosts) {
              const ft = FLOWER_TYPES[type as FlowerType];
              if (ft) pushGenericToast(`loss:craft:essence:${type}`, ft.emoji, `${ft.name} Essence`, ft.color, "loss", amount);
            }
            for (const { id: cid, quantity } of consumableCosts) {
              if (cid.startsWith("fertilizer_")) {
                const f = FERTILIZERS[cid.replace("fertilizer_", "") as import("../data/upgrades").FertilizerType];
                if (f) pushGenericToast(`loss:craft:fert:${cid}`, f.emoji, f.name, undefined, "loss", quantity);
              } else {
                const r = CONSUMABLE_RECIPE_MAP[cid as ConsumableId];
                if (r) pushGenericToast(`loss:craft:consumable:${cid}`, r.emoji, r.name, RARITY_CONFIG[r.rarity].color, "loss", quantity);
              }
            }
          },
        );

      } else {
        // ── Attunement: client-declared BASE costs, server multiplies by qty
        const tier   = parseInt(liveSelected.id.replace("attunement:", ""), 10) as 1|2|3|4|5;
        const recipe = ATTUNEMENT_RECIPES.find((r) => r.tier === tier);
        if (!recipe) return;

        const outputId       = TIER_RARITIES[tier] as string;
        const baseDurationMs = craftDurationFromRarity(recipe.rarity);
        const cost           = recipe.cost;

        // BASE costs (sent to server)
        const baseEssenceCosts:    { type: string; amount: number }[]    = [];
        const baseAttunementCosts: { rarity: string; quantity: number }[] = [];
        if (cost.kind === "essence") {
          baseEssenceCosts.push(...cost.amounts);
        } else {
          // cost.tier = previous tier; cost.quantity = how many needed
          const prevRarity = TIER_RARITIES[cost.tier as 1|2|3|4|5] as string;
          baseAttunementCosts.push({ rarity: prevRarity, quantity: cost.quantity });
        }
        // MULTIPLIED costs
        const essenceCosts    = baseEssenceCosts.map((c)    => ({ type: c.type,     amount: c.amount * qty }));
        const attunementCosts = baseAttunementCosts.map((c) => ({ rarity: c.rarity, quantity: c.quantity * qty }));

        // Optimistic deductions
        let essences = [...(cur.essences  ?? [])];
        let infusers = [...(cur.infusers  ?? [])];

        for (const { type, amount } of essenceCosts) {
          essences = essences.map((e) => e.type === type ? { ...e, amount: e.amount - amount } : e).filter((e) => e.amount > 0);
        }
        for (const { rarity, quantity } of attunementCosts) {
          infusers = infusers.map((inf) => inf.rarity === rarity ? { ...inf, quantity: inf.quantity - quantity } : inf).filter((inf) => inf.quantity > 0);
        }

        const tempEntry: CraftingQueueEntry = {
          id:        crypto.randomUUID(),
          kind:      "attunement",
          outputId,
          startedAt: new Date().toISOString(),
          // Boost only adjusts the optimistic display; server halves its own copy.
          durationMs: applyCraftBoost(baseDurationMs * qty, "attunement", cur, Date.now()),
          ...(qty > 1 && { quantity: qty }),
          ...(essenceCosts.length    && { essenceCosts }),
          ...(attunementCosts.length && { attunementCosts }),
        };

        await perform(
          { ...cur, essences, infusers, craftingQueue: [...(cur.craftingQueue ?? []), tempEntry] },
          () => edgeCraftStart("attunement", outputId, baseDurationMs, { essenceCosts: baseEssenceCosts, attunementCosts: baseAttunementCosts }, qty),
          (res) => {
            const fresh = getState();
            update({
              ...fresh,
              coins:           res.coins,
              essences:        res.essences,
              gearInventory:   res.gearInventory,
              consumables:     res.consumables,
              infusers:        res.infusers,
              craftingQueue:   res.craftingQueue,
              serverUpdatedAt: res.serverUpdatedAt,
            });
            closePopup();
            for (const { type, amount } of essenceCosts) {
              const ft = FLOWER_TYPES[type as FlowerType];
              if (ft) pushGenericToast(`loss:craft:essence:${type}`, ft.emoji, `${ft.name} Essence`, ft.color, "loss", amount);
            }
            for (const { rarity, quantity } of attunementCosts) {
              pushGenericToast(`loss:craft:infuser:${rarity}`, "💉", `${RARITY_CONFIG[rarity as Rarity].label} Infuser`, RARITY_CONFIG[rarity as Rarity].color, "loss", quantity);
            }
          },
        );
      }
    } catch (e: unknown) {
      setCraftError(e instanceof Error ? e.message : "Craft failed — please retry.");
    } finally {
      setCrafting(false);
    }
  }

  // ── Collect finished craft ────────────────────────────────────────────────
  const handleCollect = useCallback(async (craftId: string) => {
    if (collectingId || cancelingId) return;
    setCollectingId(craftId);

    const cur   = getState();
    const entry = (cur.craftingQueue ?? []).find((e) => e.id === craftId);
    if (!entry) { setCollectingId(null); return; }

    const kind     = entry.kind     ?? "gear";
    const outputId = entry.outputId ?? (entry as unknown as { gearType?: string }).gearType ?? "";
    const qty      = Math.max(1, entry.quantity ?? 1);
    const newQueue = (cur.craftingQueue ?? []).filter((e) => e.id !== craftId);

    // Build optimistic delivery based on kind (×qty for bulk crafts)
    const optimistic: Partial<GameState> = { craftingQueue: newQueue };

    if (kind === "gear") {
      const gearInv = cur.gearInventory ?? [];
      const idx     = gearInv.findIndex((g) => g.gearType === outputId);
      optimistic.gearInventory = idx >= 0
        ? gearInv.map((g, i) => i === idx ? { ...g, quantity: g.quantity + qty } : g)
        : [...gearInv, { gearType: outputId as GearType, quantity: qty }];
    } else if (kind === "consumable" && outputId.startsWith("fertilizer_")) {
      // Fertilizer crafts are delivered to state.fertilizers
      const fertType = outputId.replace("fertilizer_", "");
      const fertsArr = cur.fertilizers ?? [];
      const idx      = fertsArr.findIndex((f) => f.type === fertType);
      optimistic.fertilizers = idx >= 0
        ? fertsArr.map((f, i) => i === idx ? { ...f, quantity: f.quantity + qty } : f)
        : [...fertsArr, { type: fertType as import("../data/upgrades").FertilizerType, quantity: qty }];
    } else if (kind === "consumable") {
      const consum = cur.consumables ?? [];
      const idx    = consum.findIndex((c) => c.id === outputId);
      optimistic.consumables = idx >= 0
        ? consum.map((c, i) => i === idx ? { ...c, quantity: c.quantity + qty } : c)
        : [...consum, { id: outputId as ConsumableId, quantity: qty }];
    } else if (kind === "attunement") {
      const inf = cur.infusers ?? [];
      const idx = inf.findIndex((i) => i.rarity === outputId);
      optimistic.infusers = idx >= 0
        ? inf.map((i, j) => j === idx ? { ...i, quantity: i.quantity + qty } : i)
        : [...inf, { rarity: outputId as Rarity, quantity: qty }];
    } else if (kind === "essence") {
      const ess = cur.essences ?? [];
      const idx = ess.findIndex((e) => e.type === outputId);
      optimistic.essences = idx >= 0
        ? ess.map((e, j) => j === idx ? { ...e, amount: e.amount + qty } : e)
        : [...ess, { type: outputId as EssenceType, amount: qty }];
    }

    const { emoji, name } = queueEntryDisplay(entry);

    try {
      await perform(
        { ...cur, ...optimistic },
        () => edgeCraftCollect(craftId),
        (res) => {
          const fresh = getState();
          update({
            ...fresh,
            craftingQueue:   res.craftingQueue,
            essences:        res.essences,
            gearInventory:   res.gearInventory,
            consumables:     res.consumables,
            infusers:        res.infusers,
            ...(res.fertilizers !== undefined && { fertilizers: res.fertilizers }),
            serverUpdatedAt: res.serverUpdatedAt,
          });
          // Show collect notification
          const toastId = crypto.randomUUID();
          setCollectToasts((prev) => [...prev, { id: toastId, emoji, name }]);
          // Achievement stats
          if (kind === "gear") {
            incrementStat(`crafted_gear_${outputId}` as AchievementStatKey, qty);
          } else if (kind === "consumable") {
            incrementStat(`crafted_${outputId}` as AchievementStatKey, qty);
          }
        },
      );
    } catch (e) {
      console.error("collect error:", e);
    } finally {
      setCollectingId(null);
    }
  }, [collectingId, cancelingId, getState, perform, update]);

  // ── Cancel in-progress craft ──────────────────────────────────────────────
  const handleCancel = useCallback(async (craftId: string) => {
    if (collectingId || cancelingId) return;
    setCancelingId(craftId);

    const cur   = getState();
    const entry = (cur.craftingQueue ?? []).find((e) => e.id === craftId);
    if (!entry) { setCancelingId(null); return; }

    const newQueue = (cur.craftingQueue ?? []).filter((e) => e.id !== craftId);

    // Refund from stored ingredient costs
    let essences  = [...(cur.essences      ?? [])];
    let gearInv   = [...(cur.gearInventory ?? [])];
    let consum    = [...(cur.consumables   ?? [])];
    let infusers  = [...(cur.infusers      ?? [])];
    let fertsCanc = [...(cur.fertilizers   ?? [])];

    for (const { type, amount } of (entry.essenceCosts ?? [])) {
      const i = essences.findIndex((e) => e.type === type);
      essences = i >= 0
        ? essences.map((e, j) => j === i ? { ...e, amount: e.amount + amount } : e)
        : [...essences, { type: type as EssenceType, amount }];
    }
    for (const { gearType, quantity } of (entry.gearCosts ?? [])) {
      const i = gearInv.findIndex((g) => g.gearType === gearType);
      gearInv = i >= 0
        ? gearInv.map((g, j) => j === i ? { ...g, quantity: g.quantity + quantity } : g)
        : [...gearInv, { gearType: gearType as GearType, quantity }];
    }
    for (const { id, quantity } of (entry.consumableCosts ?? [])) {
      if (id.startsWith("fertilizer_")) {
        // Refund fertilizer ingredients to state.fertilizers
        const fType = id.replace("fertilizer_", "");
        const i = fertsCanc.findIndex((f) => f.type === fType);
        fertsCanc = i >= 0
          ? fertsCanc.map((f, j) => j === i ? { ...f, quantity: f.quantity + quantity } : f)
          : [...fertsCanc, { type: fType as import("../data/upgrades").FertilizerType, quantity }];
      } else {
        const i = consum.findIndex((c) => c.id === id);
        consum = i >= 0
          ? consum.map((c, j) => j === i ? { ...c, quantity: c.quantity + quantity } : c)
          : [...consum, { id: id as ConsumableId, quantity }];
      }
    }
    for (const { rarity, quantity } of (entry.attunementCosts ?? [])) {
      const i = infusers.findIndex((inf) => inf.rarity === rarity);
      infusers = i >= 0
        ? infusers.map((inf, j) => j === i ? { ...inf, quantity: inf.quantity + quantity } : inf)
        : [...infusers, { rarity: rarity as Rarity, quantity }];
    }

    // Coin refund (stored on the queue entry as `coinCost`, server already
    // multiplied by quantity at start time). Legacy entries lack this field.
    const entryWithCoin = entry as CraftingQueueEntry & { coinCost?: number };
    const coinRefund    = typeof entryWithCoin.coinCost === "number" && entryWithCoin.coinCost > 0
      ? entryWithCoin.coinCost
      : 0;

    try {
      await perform(
        { ...cur, coins: cur.coins + coinRefund, craftingQueue: newQueue, essences, gearInventory: gearInv, consumables: consum, infusers, fertilizers: fertsCanc },
        () => edgeCraftCancel(craftId),
        (res) => {
          const fresh = getState();
          update({
            ...fresh,
            coins:           res.coins,
            craftingQueue:   res.craftingQueue,
            essences:        res.essences,
            gearInventory:   res.gearInventory,
            consumables:     res.consumables,
            infusers:        res.infusers,
            ...(res.fertilizers !== undefined && { fertilizers: res.fertilizers }),
            serverUpdatedAt: res.serverUpdatedAt,
          });
        },
      );
    } catch (e) {
      console.error("cancel error:", e);
    } finally {
      setCancelingId(null);
    }
  }, [collectingId, cancelingId, getState, perform, update]);

  // ── Upgrade crafting slots ────────────────────────────────────────────────
  async function handleUpgradeSlots() {
    if (!nextSlotUpgrade || upgradingSlots) return;
    const cur = getState();
    if (cur.coins < nextSlotUpgrade.cost) return;

    setUpgradingSlots(true);
    try {
      await perform(
        { ...cur, coins: cur.coins - nextSlotUpgrade.cost, craftingSlotCount: nextSlotUpgrade.slots },
        () => edgeUpgradeCraftingSlots(),
        (res) => {
          const fresh = getState();
          update({
            ...fresh,
            coins:             res.coins,
            craftingSlotCount: res.crafting_slot_count,
            serverUpdatedAt:   res.serverUpdatedAt,
          });
        },
      );
    } catch (e) {
      console.error("upgrade slots error:", e);
    } finally {
      setUpgradingSlots(false);
    }
  }

  const craftableCount = entries.filter((e) => e.canCraft).length;

  return (
    <>
      {/* ── Window ──────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-amber-800/30 shadow-lg shadow-amber-950/20 max-w-[33rem] mx-auto w-full">

        {/* Window header — slot counter + upgrade button moved into the
            "Crafting Slots" panel below to colocate the metadata with the
            slots themselves. The header now just frames the tab. */}
        <div className="px-4 py-3 bg-gradient-to-r from-amber-950/50 to-card/80 border-b border-amber-800/25 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base text-foreground">⚒️ Craft</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {craftableCount > 0
                ? <><span className="text-amber-400 font-semibold">{craftableCount}</span> item{craftableCount !== 1 ? "s" : ""} ready to craft</>
                : "Gather essences to unlock recipes"
              }
            </p>
          </div>
          {!nextSlotUpgrade && craftingSlotCount >= 6 && (
            <p className="text-[10px] text-amber-400/60 shrink-0">Max slots</p>
          )}
        </div>

        {/* ── Crafting slots panel ─────────────────────────────────────────── */}
        {/*  Always visible (even when empty) so the user can see how many slots
            they have at a glance. The next-tier upgrade is rendered directly
            below as a "ghost slot" with a purchase button — combines the
            "show empty slots" + "move upgrade button to be the next slot"
            polish items. */}
        <div className="px-4 py-3 bg-card/50 border-b border-amber-800/25 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Crafting Slots <span className="text-muted-foreground/60">· {slotsInUse}/{craftingSlotCount}</span>
          </p>
          {Array.from({ length: craftingSlotCount }).map((_, i) => {
            const qEntry = craftingQueue[i];
            return qEntry ? (
              <QueueEntryRow
                key={qEntry.id}
                entry={qEntry}
                now={now}
                onCollect={handleCollect}
                onCancel={handleCancel}
                isCollecting={collectingId === qEntry.id}
                isCanceling={cancelingId === qEntry.id}
                isBoosted={isForgeHasteActive}
              />
            ) : (
              <EmptySlotRow key={`empty-${i}`} />
            );
          })}
          {nextSlotUpgrade && (
            <UpgradeSlotRow
              upgrade={nextSlotUpgrade}
              onUpgrade={handleUpgradeSlots}
              disabled={state.coins < nextSlotUpgrade.cost || upgradingSlots}
              upgrading={upgradingSlots}
            />
          )}
        </div>

        {/* Category filter */}
        <div className="px-4 pt-3 pb-2 bg-card/60 flex gap-2">
          {FILTER_LABELS.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`
                flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all text-center
                ${filter === id
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                  : "bg-card/40 border border-border text-muted-foreground hover:border-amber-800/40"
                }
              `}
            >
              {emoji} {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pb-2 bg-card/60">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes…"
              className="w-full pl-7 pr-8 py-1.5 rounded-lg bg-card/60 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs leading-none"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Grid — uses Tailwind 4 container queries so column count adapts
            to the actual container width (not viewport — the CraftingTab's
            parent caps at 33rem and gets narrower on phones). The grid is
            sized to its content via `w-fit` and centered with `mx-auto`,
            so the cell block centers within the amber window and the last
            partial row naturally left-aligns within the centered block.
            Cell+gap math: each col is 4rem + 0.5rem gap.
              4 cols = 17.5rem · 5 = 22rem · 6 = 26.5rem · 7 = 31rem        */}
        <div className="@container px-3 pb-4 pt-2 bg-card/40">
          <div className="grid gap-2 mx-auto w-fit grid-cols-4 @[22rem]:grid-cols-5 @[26.5rem]:grid-cols-6 @[31rem]:grid-cols-7">
            {entries.map((entry) => (
              <CraftCell key={entry.id} entry={entry} onClick={() => openEntry(entry)} />
            ))}
            {entries.length === 0 && (
              <div className="col-span-full py-10 text-center text-xs text-muted-foreground">
                {search.trim() ? `No recipes matching "${search}"` : "No items in this category yet."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Popup ──────────────────────────────────────────────────────────── */}
      {liveSelected && (
        <CraftPopup
          entry={liveSelected}
          onClose={closePopup}
          onCraft={handleCraft}
          isCrafting={crafting}
          craftError={craftError}
          state={state}
          slotsAvailable={slotsAvailable}
        />
      )}

      {/* ── Collect toasts ───────────────────────────────────────────────── */}
      {collectToasts.length > 0 && (
        <div className="fixed bottom-20 inset-x-0 flex flex-col items-center gap-2 pointer-events-none z-[60]">
          {collectToasts.map((t) => (
            <CollectToast
              key={t.id}
              emoji={t.emoji}
              name={t.name}
              onDone={() => setCollectToasts((prev) => prev.filter((x) => x.id !== t.id))}
            />
          ))}
        </div>
      )}
    </>
  );
}
