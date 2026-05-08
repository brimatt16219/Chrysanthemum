import { useState } from "react";
import { useAchievementStats } from "../hooks/useAchievementStats";
import { useGame } from "../store/GameContext";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import type { FertilizerType } from "../data/upgrades";
import { GEAR as GEAR_CATALOG } from "../data/gear";
import type { GearType } from "../data/gear";
import { CONSUMABLE_RECIPE_MAP } from "../data/consumables";
import type { ConsumableId } from "../data/consumables";
import {
  edgeMarketplaceCreateListing,
  edgeMarketplaceCreateFertilizerListing,
  edgeMarketplaceCreateGearListing,
  edgeMarketplaceCreateConsumableListing,
} from "../lib/edgeFunctions";
import { useDailyProgress } from "../hooks/useDailyProgress";

const LISTING_FEE_PCT = 0.05;

type Tab = "flowers" | "consumables" | "gear";

type ConsumableItem =
  | { kind: "fertilizer"; type: FertilizerType; quantity: number }
  | { kind: "consumable"; id: string; quantity: number };

interface Props {
  onClose:  () => void;
  onListed: () => void; // called after successful listing so parent can refresh
}

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export function CreateListingModal({ onClose, onListed }: Props) {
  const { state, update } = useGame();

  const [activeTab,   setActiveTab]   = useState<Tab>("flowers");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [askPriceStr, setAskPriceStr] = useState("");
  const [listing,     setListing]     = useState(false);
  const [error,       setError]       = useState("");

  const flowers   = state.inventory.filter((i) => i.quantity > 0 && !i.isSeed);
  const consumables: ConsumableItem[] = [
    ...state.fertilizers.filter((f) => f.quantity > 0).map((f) => ({ kind: "fertilizer" as const, type: f.type as FertilizerType, quantity: f.quantity })),
    ...(state.consumables ?? []).filter((c) => c.quantity > 0).map((c) => ({ kind: "consumable" as const, id: c.id, quantity: c.quantity })),
  ];
  const gearItems = state.gearInventory
    .filter((g) => g.quantity > 0)
    .map((g) => ({ gearType: g.gearType as GearType, quantity: g.quantity }));

  const { trackProgress } = useDailyProgress();
  const { incrementStat } = useAchievementStats();

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setSelectedIdx(null);
    setAskPriceStr("");
    setError("");
  }

  const tabItems = activeTab === "flowers"     ? flowers
                 : activeTab === "consumables" ? consumables
                 :                               gearItems;

  const askPrice   = parseInt(askPriceStr, 10);
  const validPrice = !isNaN(askPrice) && askPrice >= 1;
  const fee        = validPrice ? Math.max(1, Math.floor(askPrice * LISTING_FEE_PCT)) : 0;

  const selectedItem = selectedIdx !== null ? tabItems[selectedIdx] : null;

  async function handleList() {
    if (selectedIdx === null || !validPrice) return;
    setListing(true);
    setError("");

    try {
      if (activeTab === "consumables") {
        const item = consumables[selectedIdx] as ConsumableItem;
        if (item.kind === "fertilizer") {
          const result = await edgeMarketplaceCreateFertilizerListing(item.type, askPrice);
          update({ ...state, coins: result.coins, fertilizers: result.fertilizers! });
        } else {
          const result = await edgeMarketplaceCreateConsumableListing(item.id, askPrice);
          update({ ...state, coins: result.coins, consumables: result.consumables ?? state.consumables });
        }
      } else if (activeTab === "gear") {
        const gear = gearItems[selectedIdx];
        const result = await edgeMarketplaceCreateGearListing(gear.gearType, askPrice);
        update({ ...state, coins: result.coins, gearInventory: result.gearInventory! });
      } else {
        const invItem = flowers[selectedIdx];
        const result = await edgeMarketplaceCreateListing(
          invItem.speciesId,
          invItem.mutation,
          askPrice,
          invItem.isSeed ?? false,
        );
        update({ ...state, coins: result.coins, inventory: result.inventory });
      }
      void trackProgress("marketplace_list");
      incrementStat("marketplace_sales");
      onListed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create listing");
      setListing(false);
    }
  }

  // Button label
  let btnLabel = "Select an item and set a price";
  if (selectedItem && validPrice) {
    if (activeTab === "consumables") {
      const item = selectedItem as ConsumableItem;
      const name = item.kind === "fertilizer"
        ? FERTILIZERS[item.type].name
        : CONSUMABLE_RECIPE_MAP[item.id as ConsumableId]?.name ?? item.id;
      btnLabel = `List ${name} for ${formatCoins(askPrice)} 🟡`;
    } else if (activeTab === "gear") {
      const name = GEAR_CATALOG[(selectedItem as { gearType: GearType }).gearType]?.name ?? "item";
      btnLabel = `List ${name} for ${formatCoins(askPrice)} 🟡`;
    } else {
      const inv = selectedItem as { speciesId: string; isSeed?: boolean };
      const name = getFlower(inv.speciesId)?.name ?? "item";
      btnLabel = `List ${name} for ${formatCoins(askPrice)} 🟡`;
    }
  }

  const TAB_CONFIG: { id: Tab; emoji: string; count: number }[] = [
    { id: "flowers",     emoji: "🌸", count: flowers.length     },
    { id: "consumables", emoji: "🧪", count: consumables.length },
    { id: "gear",        emoji: "⚙️", count: gearItems.length   },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 py-20"
      onClick={onClose}
    >
      <div
        className="bg-card border border-primary/30 rounded-2xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3 max-h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header — always visible ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Create Listing</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              5% listing fee · 48h expiry · fee is non-refundable
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none ml-4 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* ── Tabs — always visible ── */}
        <div className="flex gap-1.5">
          {TAB_CONFIG.map(({ id, emoji, count }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all text-center ${
                activeTab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {emoji}
              <span className={`ml-1 font-mono text-[10px] ${activeTab === id ? "opacity-75" : "opacity-50"}`}>
                ({count})
              </span>
            </button>
          ))}
        </div>

        {/* ── Item list — capped height, independently scrollable ── */}
        {tabItems.length === 0 ? (
          <div className="min-h-[18vh] flex flex-col items-center justify-center space-y-1">
            <p className="text-2xl">
              {activeTab === "flowers" ? "🌸" : activeTab === "consumables" ? "🧪" : "⚙️"}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeTab === "flowers"     ? "No flowers to list."
               : activeTab === "consumables" ? "No consumables to list."
               : "No gear to list."}
            </p>
            {activeTab === "flowers" && (
              <p className="text-xs text-muted-foreground">Harvest flowers first!</p>
            )}
          </div>
        ) : (
          <div className="overflow-y-auto min-h-[18vh] max-h-[35vh] space-y-1.5 pr-0.5">

            {/* Consumables tab — fertilizers + alchemy consumables */}
            {activeTab === "consumables" && consumables.map((item, idx) => {
              const selected = selectedIdx === idx;
              if (item.kind === "fertilizer") {
                const def = FERTILIZERS[item.type];
                return (
                  <button key={`fert-${item.type}`} onClick={() => { setSelectedIdx(selected ? null : idx); setError(""); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${selected ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}>
                    <span className="text-2xl flex-shrink-0">{def.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${def.color}`}>{def.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">Fertilizer · {def.speedMultiplier}× speed</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                      <p className="text-[10px] text-muted-foreground/60">{formatCoins(def.shopPrice)} 🟡 shop</p>
                    </div>
                  </button>
                );
              } else {
                const recipe = CONSUMABLE_RECIPE_MAP[item.id as ConsumableId];
                const rarityDef = recipe ? RARITY_CONFIG[recipe.rarity] : null;
                return (
                  <button key={`consumable-${item.id}`} onClick={() => { setSelectedIdx(selected ? null : idx); setError(""); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${selected ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}>
                    <span className="text-2xl flex-shrink-0">{recipe?.emoji ?? "🧪"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{recipe?.name ?? item.id}</p>
                      <p className={`text-xs font-mono ${rarityDef?.color ?? "text-muted-foreground"}`}>{rarityDef?.label ?? recipe?.rarity}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                    </div>
                  </button>
                );
              }
            })}

            {/* Gear tab */}
            {activeTab === "gear" && gearItems.map((item, idx) => {
              const def      = GEAR_CATALOG[item.gearType];
              const rarity   = def ? RARITY_CONFIG[def.rarity] : null;
              const selected = selectedIdx === idx;
              return (
                <button key={`gear-${item.gearType}`} onClick={() => { setSelectedIdx(selected ? null : idx); setError(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${selected ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}>
                  <span className="text-2xl flex-shrink-0">{def?.emoji ?? "⚙️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{def?.name ?? item.gearType}</p>
                    <p className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                    {def && <p className="text-[10px] text-muted-foreground/60">{formatCoins(def.shopPrice)} 🟡 shop</p>}
                  </div>
                </button>
              );
            })}

            {/* Flowers tab — inventory rows */}
            {activeTab === "flowers" && flowers.map((item, idx) => {
              const species  = getFlower(item.speciesId);
              const mut      = item.mutation ? MUTATIONS[item.mutation as MutationType] : null;
              const rarity   = species ? RARITY_CONFIG[species.rarity] : null;
              const selected = selectedIdx === idx;
              if (!species) return null;

              return (
                <button
                  key={`${item.speciesId}-${item.mutation ?? "none"}-${item.isSeed ? "seed" : "bloom"}-${idx}`}
                  onClick={() => { setSelectedIdx(selected ? null : idx); setError(""); }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                    ${selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/40"
                    }
                  `}
                >
                  <div className="relative flex-shrink-0">
                    <span className="text-2xl">
                      {item.isSeed ? (species.emoji.seed ?? "🌱") : species.emoji.bloom}
                    </span>
                    {!item.isSeed && mut && (
                      <span className="absolute -top-1 -right-1 text-xs">{mut.emoji}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{species.name}</p>
                      {item.isSeed
                        ? <span className="text-xs font-mono text-muted-foreground">Seed</span>
                        : mut && <span className={`text-xs font-mono ${mut.color}`}>{mut.name}</span>
                      }
                    </div>
                    <p className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                    <p className="text-[10px] text-muted-foreground/60">{formatCoins(Math.floor(species.sellValue * (mut?.valueMultiplier ?? 1)))} 🟡 {mut ? "sell value" : "base"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Bottom controls — always visible ── */}
        <div className="space-y-3 pt-3 border-t border-border/60">

          {/* Ask price */}
          <div className="space-y-1.5">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
              Ask price (🟡 coins)
            </p>
            <input
              type="number"
              min={1}
              value={askPriceStr}
              onChange={(e) => { setAskPriceStr(e.target.value); setError(""); }}
              placeholder="e.g. 50000"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Fee breakdown */}
          {validPrice && (
            <div className="bg-background border border-border rounded-xl px-3 py-2.5 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-muted-foreground">
                <span>Ask price</span>
                <span>{formatCoins(askPrice)} 🟡</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Listing fee (5%)</span>
                <span className="text-red-400">−{formatCoins(fee)} 🟡</span>
              </div>
              <div className="border-t border-border/60 pt-1 flex justify-between font-bold">
                <span>You earn (on sale)</span>
                <span className="text-primary">{formatCoins(askPrice)} 🟡</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-right">
                Fee of {formatCoins(fee)} 🟡 charged now · non-refundable
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

          {/* Confirm button */}
          <button
            onClick={handleList}
            disabled={selectedIdx === null || !validPrice || listing || state.coins < fee}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 text-center"
          >
            {listing ? "Listing..." : btnLabel}
          </button>

          {selectedIdx !== null && validPrice && state.coins < fee && (
            <p className="text-xs text-red-400 font-mono text-center">
              Not enough coins for the listing fee ({formatCoins(fee)} 🟡 needed)
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
