import { useState, useEffect } from "react";
import { useGame } from "../store/GameContext";
import { ItemSprite } from "./ItemSprite";
import { getFlower, RARITY_CONFIG, MUTATIONS, FLOWER_TYPES } from "../data/flowers";
import type { FlowerType, MutationType } from "../data/flowers";
import {
  ALL_FLOWER_TYPES, UNIVERSAL_ESSENCE_DISPLAY, UNIVERSAL_ESSENCE_TYPE,
} from "../data/essences";
import { FlowerTypeBadges } from "./FlowerTypeBadges";
import { FlowerSprite } from "./FlowerSprite";
import { InventoryItemCard } from "./InventoryItemCard";
import { sellFlower, rollbackSellAll, applyEclipseTonic, type InventoryItem } from "../store/gameStore";
import { edgeSellAll, edgeUseEclipseTonic, edgeAlchemyCraftSeed, edgeActivateBoost } from "../lib/edgeFunctions";
import { FERTILIZERS } from "../data/upgrades";
import { GEAR } from "../data/gear";
import type { GearInventoryItem } from "../data/gear";
import { CONSUMABLE_RECIPE_MAP, type ConsumableId } from "../data/consumables";
import { useAchievementStats } from "../hooks/useAchievementStats";
import { audioManager } from "../lib/audioManager";
import { awardXp, SELL_XP_PERCENT } from "../data/gardenerLevel";

type Tab = 0 | 1 | 2 | 3 | 4;
const TAB_LABELS   = ["Seeds", "Blooms", "Supplies", "Consumables", "Essences"] as const;
const TAB_EMOJIS   = ["🌱",    "🌸",     "⚙️",       "🧪",          "✨"]       as const;
const TAB_SPRITES  = [
  "/sprites/flowers/seed.png",   // Seeds
  "/sprites/flowers/bloom.png",  // Blooms
  "/sprites/ui/gear.png",        // Supplies
  "/sprites/ui/consumables.png", // Consumables
  "/sprites/ui/other.png",       // Essences
] as const;

interface Props {
  newSeeds?:    number;
  newBlooms?:   number;
  newSupplies?: number;
  onSubTabView?: (subTab: "seeds" | "blooms" | "supplies") => void;
  /** Controlled active tab — passed from App for swipe navigation. */
  activeTab?:   Tab;
  onTabChange?: (tab: Tab) => void;
}

export function Inventory({ newSeeds = 0, newBlooms = 0, newSupplies = 0, onSubTabView, activeTab, onTabChange }: Props) {
  const { state, perform, getState, awaitHarvests, update, pushGenericToast } = useGame();
  const { incrementStat } = useAchievementStats();
  const [localTab, setLocalTab] = useState<Tab>(0);
  const [search, setSearch] = useState("");
  // Use controlled tab when provided by parent (swipe), otherwise local state
  const tab    = activeTab  ?? localTab;
  const setTab = (t: Tab) => { setLocalTab(t); onTabChange?.(t); setSearch(""); };
  const [usingEclipse,        setUsingEclipse]        = useState<string | null>(null);
  const [openingPouch,        setOpeningPouch]        = useState<string | null>(null);
  const [activatingBoost,     setActivatingBoost]     = useState<string | null>(null);
  const [pouchResult,         setPouchResult]         = useState<{ speciesId: string } | null>(null);
  const [pouchResultVisible,  setPouchResultVisible]  = useState(false);

  const items           = state.inventory.filter((i) => i.quantity > 0);
  const seeds           = items.filter((i) => i.isSeed);
  const blooms          = items.filter((i) => !i.isSeed);
  const fertilizers     = state.fertilizers.filter((f) => f.quantity > 0);
  const gearItems       = (state.gearInventory ?? []).filter((g) => g.quantity > 0);
  const consumableItems = (state.consumables ?? []).filter((c) => c.quantity > 0);
  const infuserItems    = (state.infusers   ?? []).filter((i) => i.quantity > 0);

  const seedCount        = seeds.reduce((s, i) => s + i.quantity, 0);
  const bloomCount       = blooms.reduce((s, i) => s + i.quantity, 0);
  const supplyCount      = fertilizers.reduce((s, f) => s + f.quantity, 0)
                         + gearItems.reduce((s, g) => s + g.quantity, 0);
  const consumableCount  = consumableItems.reduce((s, c) => s + c.quantity, 0)
                         + infuserItems.reduce((s, i) => s + i.quantity, 0);
  const essenceCount     = (state.essences ?? []).reduce((s, e) => s + e.amount, 0);

  const q = search.toLowerCase();
  const filteredSeeds = q
    ? seeds.filter((i) => getFlower(i.speciesId)?.name.toLowerCase().includes(q))
    : seeds;
  const filteredBlooms = q
    ? blooms.filter((i) => {
        const name    = getFlower(i.speciesId)?.name.toLowerCase() ?? "";
        const mutName = i.mutation ? (MUTATIONS[i.mutation as MutationType]?.name.toLowerCase() ?? "") : "";
        return name.includes(q) || mutName.includes(q);
      })
    : blooms;
  const filteredFertilizers = q
    ? fertilizers.filter((f) => FERTILIZERS[f.type].name.toLowerCase().includes(q))
    : fertilizers;
  const filteredGear = q
    ? gearItems.filter((g) => GEAR[g.gearType]?.name.toLowerCase().includes(q))
    : gearItems;
  const filteredConsumables = q
    ? consumableItems.filter((c) => CONSUMABLE_RECIPE_MAP[c.id as ConsumableId]?.name.toLowerCase().includes(q))
    : consumableItems;
  const filteredInfusers = q
    ? infuserItems.filter((i) => `${RARITY_CONFIG[i.rarity as keyof typeof RARITY_CONFIG]?.label ?? i.rarity} infuser`.includes(q))
    : infuserItems;


  const totalBloomValue = blooms.reduce((sum, item) => {
    const species = getFlower(item.speciesId);
    const mut     = item.mutation ? MUTATIONS[item.mutation as MutationType] : null;
    return sum + Math.floor((species?.sellValue ?? 0) * (mut?.valueMultiplier ?? 1)) * item.quantity;
  }, 0);

  async function handleSellAll() {
    // Wait for any in-flight serialized harvests to finish before reading/writing
    // the DB — avoids 409 conflicts from concurrent updated_at changes.
    await awaitHarvests();

    const current = getState();
    const currentBlooms = current.inventory.filter((i) => i.quantity > 0 && !i.isSeed);
    if (currentBlooms.length === 0) return;

    // Build a single optimistic state with all blooms sold
    let optimistic = current;
    for (const item of currentBlooms) {
      const next = sellFlower(optimistic, item.speciesId, item.quantity, item.mutation as MutationType | undefined);
      if (next) optimistic = next;
    }

    const items = currentBlooms.map((i) => ({
      speciesId: i.speciesId,
      mutation:  i.mutation as string | undefined,
      quantity:  i.quantity,
    }));

    // Snapshot the coin delta so the rollback can subtract exactly what was
    // optimistically added — without touching coins gained from concurrent
    // actions (a harvest sell card, a marketplace claim, etc.).
    const earned   = optimistic.coins - current.coins;
    const xpGained = Math.floor(earned * SELL_XP_PERCENT);
    const { level: newLevel, xp: newXp } = awardXp(current.gardenerLevel, current.gardenerXp, xpGained);
    const prevLevel = current.gardenerLevel;
    const prevXp    = current.gardenerXp;

    // Single atomic server write — one CAS check, no partial-failure rollback risk.
    // perform() auto-merges the SellAllResult (coins + inventory) on success.
    // On failure, rollbackSellAll undoes only the sold blooms + earnings against
    // whatever state looks like AT rollback time, leaving concurrent harvests
    // and other changes intact.
    const totalSold = currentBlooms.reduce((sum, i) => sum + i.quantity, 0);
    audioManager.playSfx("sell");
    pushGenericToast("sell:all", "🟡", "coins", "text-yellow-400", "gain", earned, "/sprites/ui/coins.png");
    await perform(
      { ...optimistic, gardenerLevel: newLevel, gardenerXp: newXp },
      () => edgeSellAll(items),
      () => { incrementStat("blooms_sold", totalSold); },
      { rollback: (c) => ({ ...rollbackSellAll(c, items, earned), gardenerLevel: prevLevel, gardenerXp: prevXp }) }
    );
  }

  async function handleUseEclipseTonic(consumableId: ConsumableId) {
    if (usingEclipse) return;
    const recipe = CONSUMABLE_RECIPE_MAP[consumableId];
    if (!recipe?.advanceHours) return;
    const cur = getState();
    const optimistic = applyEclipseTonic(cur, consumableId, recipe.advanceHours);
    if (!optimistic) return;
    const savedConsumables = cur.consumables;
    const savedGrid        = cur.grid;
    setUsingEclipse(consumableId);
    perform(
      optimistic,
      () => edgeUseEclipseTonic(consumableId),
      () => setUsingEclipse(null),
      {
        serialize: true,
        rollback: (c) => ({
          ...c,
          grid: savedGrid,
          consumables: savedConsumables,
          lastEclipseTonic: cur.lastEclipseTonic,
        }),
      }
    );
  }

  // Auto-dismiss pouch result toast
  useEffect(() => {
    if (!pouchResult) return;
    const frame = requestAnimationFrame(() => setPouchResultVisible(true));
    const timer = setTimeout(() => {
      setPouchResultVisible(false);
      setTimeout(() => setPouchResult(null), 400);
    }, 4_000);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [pouchResult]);

  async function handleOpenPouch(consumableId: ConsumableId) {
    if (openingPouch) return;
    setOpeningPouch(consumableId);
    try {
      const res = await edgeAlchemyCraftSeed(consumableId);
      const cur = getState();
      update({ ...cur, inventory: res.inventory, consumables: res.consumables, serverUpdatedAt: res.serverUpdatedAt });
      setPouchResult({ speciesId: res.outputSpeciesId });
      incrementStat("pouches_opened");
    } catch {
      // silent — pouch stays in inventory on failure
    } finally {
      setOpeningPouch(null);
    }
  }

  // Phase 5a — activate a Verdant Rush / Forge Haste / Resonance Draft.
  // No optimistic state because the duration depends on consumable tier and we
  // already trust the server response. Roundtrip is one quick edge call.
  async function handleActivateBoost(consumableId: ConsumableId) {
    if (activatingBoost) return;
    setActivatingBoost(consumableId);
    try {
      const res = await edgeActivateBoost(consumableId);
      const cur = getState();
      update({
        ...cur,
        consumables:     res.consumables,
        activeBoosts:    res.activeBoosts,
        craftingQueue:   res.craftingQueue ?? cur.craftingQueue,
        serverUpdatedAt: res.serverUpdatedAt,
      });
    } catch {
      // silent — server rejected (e.g. CAS miss); the consumable wasn't deducted
    } finally {
      setActivatingBoost(null);
    }
  }

  const isEmpty = items.length === 0 && fertilizers.length === 0 && gearItems.length === 0
               && consumableItems.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <span className="text-5xl">🎒</span>
        <p className="font-medium text-muted-foreground">Your inventory is empty</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Buy seeds from the Shop, plant them in your Garden, then harvest bloomed flowers here.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Inventory</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {seedCount} seed{seedCount !== 1 ? "s" : ""} ·{" "}
            {bloomCount} bloom{bloomCount !== 1 ? "s" : ""}
            {supplyCount > 0 && <> · {supplyCount} supplies</>}
            {consumableCount > 0 && <> · {consumableCount} consumable{consumableCount !== 1 ? "s" : ""}</>}
            {essenceCount > 0 && <> · {essenceCount} essence{essenceCount !== 1 ? "s" : ""}</>}
          </p>
        </div>
      </div>

      {/* Coins */}
      <div className="flex items-center gap-2 bg-card/40 border border-border rounded-lg px-4 py-2.5">
        <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-lg" imgSize="w-5 h-5" />
        <span className="text-sm font-mono font-medium">
          {state.coins.toLocaleString()} coins
        </span>
      </div>

      {/* Tab bar — matches the shop / social / alchemy style */}
      <div className="flex gap-2">
        {TAB_LABELS.map((label, i) => {
          const newCount = i === 0 ? newSeeds
                         : i === 1 ? newBlooms
                         : i === 2 ? newSupplies
                         : 0;
          const subKey = (i === 0 ? "seeds" : i === 1 ? "blooms" : "supplies") as "seeds" | "blooms" | "supplies";
          return (
            <button
              key={label}
              onClick={() => {
                setTab(i as Tab);
                if (i < 3) onSubTabView?.(subKey);
              }}
              className={`
                flex-1 py-2 rounded-xl text-xs font-semibold transition-all relative text-center
                ${tab === i
                  ? "bg-primary/20 border border-primary/50 text-primary"
                  : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }
              `}
            >
              <span className="inline-flex items-center justify-center gap-1">
                <ItemSprite emoji={TAB_EMOJIS[i]} sprite={TAB_SPRITES[i]} textSize="text-sm" imgSize="w-4 h-4" name={label} />
                <span className="hidden sm:inline">{label}</span>
              </span>
              {newCount > 0 && tab !== i && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                  {newCount > 9 ? "9+" : newCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search bar — shown on all tabs except Essences */}
      {tab !== 4 && (
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card/60 border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Tab content */}
      <div className="space-y-3">

        {/* ── Seeds ───────────────────────────────────────────────────────── */}
        {tab === 0 && (
          filteredSeeds.length > 0 ? (
            filteredSeeds.map((item, i) => (
              <SeedInventoryRow key={`seed-${item.speciesId}-${i}`} item={item} />
            ))
          ) : (
            <EmptyTab
              emoji="🌱"
              message={q ? "No seeds match your search" : "No seeds in inventory"}
              hint={q ? undefined : "Buy seeds from the Shop to get started."}
            />
          )
        )}

        {/* ── Blooms ──────────────────────────────────────────────────────── */}
        {tab === 1 && (
          blooms.length > 0 ? (
            <>
              <button
                onClick={handleSellAll}
                className="w-full py-2.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-colors text-center"
              >
                <span className="inline-flex items-center gap-0.5">
                  Sell All — {totalBloomValue.toLocaleString()}
                  <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" />
                </span>
              </button>
              {filteredBlooms.length > 0 ? filteredBlooms.map((item, i) => (
                <InventoryItemCard
                  key={`bloom-${item.speciesId}-${item.mutation ?? "none"}-${i}`}
                  item={item}
                />
              )) : (
                <EmptyTab emoji="🌸" message="No blooms match your search" />
              )}
            </>
          ) : (
            <EmptyTab emoji="🌸" message="No blooms to sell" hint="Harvest fully-grown flowers from your Garden." />
          )
        )}

        {/* ── Consumables ─────────────────────────────────────────────────── */}
        {tab === 3 && (
          filteredConsumables.length > 0 || filteredInfusers.length > 0 ? (
            <>
              {filteredInfusers.map((inf) => {
                const rarity = RARITY_CONFIG[inf.rarity as keyof typeof RARITY_CONFIG];
                return (
                  <div
                    key={inf.rarity}
                    className={`flex items-center gap-4 bg-card/60 border rounded-xl px-4 py-3 border-border ${rarity?.glow ?? ""}`}
                  >
                    <ItemSprite emoji="💉" sprite="/sprites/consumables/infuser.png" name="Infuser" textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{rarity?.label ?? inf.rarity} Infuser</h3>
                        <span className={`text-xs font-mono ${rarity?.color ?? "text-muted-foreground"}`}>
                          {rarity?.label ?? inf.rarity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ×{inf.quantity} · Apply to a bloomed plant to enable cross-breeding
                      </p>
                    </div>
                  </div>
                );
              })}
              {filteredConsumables.length > 0 && (
                <ConsumablesTabContent
                  consumables={filteredConsumables}
                  lastEclipseTonic={state.lastEclipseTonic}
                  usingEclipse={usingEclipse}
                  openingPouch={openingPouch}
                  activatingBoost={activatingBoost}
                  activeBoosts={state.activeBoosts ?? []}
                  onUseEclipse={handleUseEclipseTonic}
                  onOpenPouch={handleOpenPouch}
                  onActivateBoost={handleActivateBoost}
                />
              )}
            </>
          ) : (
            <EmptyTab
              emoji="🧪"
              message={q ? "No consumables match your search" : "No consumables"}
              hint={q ? undefined : "Craft consumables in the Alchemy lab."}
            />
          )
        )}

        {/* ── Supplies ────────────────────────────────────────────────────── */}
        {tab === 2 && (
          filteredFertilizers.length > 0 || filteredGear.length > 0 ? (
            <>
              {filteredFertilizers.map((f) => {
                const fert       = FERTILIZERS[f.type];
                const fertRarity = RARITY_CONFIG[fert.rarity];
                return (
                  <div
                    key={f.type}
                    className={`flex items-center gap-4 bg-card/60 border rounded-xl px-4 py-3 ${fert.cardBorder}`}
                  >
                    <ItemSprite emoji={fert.emoji} sprite={fert.sprite} name={fert.name} textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{fert.name}</h3>
                        <span className={`text-xs font-mono ${fertRarity.color}`}>
                          {fertRarity.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ×{f.quantity} · Speeds growth by <span className="text-foreground font-semibold">{fert.speedMultiplier}×</span> · Apply to a growing plant
                      </p>
                    </div>
                  </div>
                );
              })}
              {filteredGear.map((g) => (
                <GearInventoryRow key={g.gearType} item={g} />
              ))}
            </>
          ) : (
            <EmptyTab
              emoji="⚙️"
              message={q ? "No supplies match your search" : "No supplies"}
              hint={q ? undefined : "Buy fertilizers and gear from the Supply Shop."}
            />
          )
        )}

        {/* ── Essences ────────────────────────────────────────────────────── */}
        {tab === 4 && (() => {
          // Always show all 12 elementals + Universal in the same fixed order
          // as the EssenceBank widget. Empty rows dim to 40% so the player can
          // see what's missing — same pattern as the bank tile grid.
          const amountByType = new Map<string, number>(
            (state.essences ?? []).map((e) => [e.type, e.amount])
          );
          const rows = [
            ...ALL_FLOWER_TYPES.map((type) => ({
              type, amount: amountByType.get(type) ?? 0,
              cfg: FLOWER_TYPES[type as FlowerType],
              isUniversal: false,
            })),
            {
              type: UNIVERSAL_ESSENCE_TYPE,
              amount: amountByType.get(UNIVERSAL_ESSENCE_TYPE) ?? 0,
              cfg: UNIVERSAL_ESSENCE_DISPLAY,
              isUniversal: true,
            },
          ];
          return (
            <>
              <p className="text-[11px] text-muted-foreground px-1 pb-1">
                Essences are earned by sacrificing flowers in the Alchemy lab. Combine all 12 elementals into a Universal Essence in Craft → Other.
              </p>
              {rows.map((r) => (
                <EssenceInventoryRow
                  key={r.type}
                  type={r.type}
                  amount={r.amount}
                  emoji={r.cfg.emoji}
                  sprite={r.cfg.sprite}
                  name={r.cfg.name}
                  color={r.cfg.color}
                  bgColor={r.cfg.bgColor}
                  borderColor={r.cfg.borderColor}
                  isUniversal={r.isUniversal}
                />
              ))}
            </>
          );
        })()}

      </div>

    </div>

    {/* ── Pouch result toast ── */}

    {pouchResult && (() => {
      const flower     = getFlower(pouchResult.speciesId);
      const rarity     = flower ? RARITY_CONFIG[flower.rarity] : null;
      return (
        <div
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none
            transition-all duration-400
            ${pouchResultVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
        >
          <div className="flex items-center gap-3 bg-card border border-primary/40 rounded-2xl px-5 py-4 shadow-2xl shadow-primary/10 min-w-64">
            <span className="text-2xl">❓</span>
            <div>
              <p className="text-sm font-bold text-primary mb-0.5">Pouch opened!</p>
              <p className="text-[11px] text-muted-foreground">
                You received a{" "}
                <span className={rarity?.color ?? ""}>{rarity?.label ?? "Unknown"} seed</span>
              </p>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}

function EmptyTab({ emoji, message, hint }: { emoji: string; message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <span className="text-4xl">{emoji}</span>
      <p className="font-medium text-muted-foreground text-sm">{message}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{hint}</p>
    </div>
  );
}

function EssenceInventoryRow({
  type, amount, emoji, sprite, name, color: _color, bgColor, borderColor, isUniversal,
}: {
  type: string; amount: number; emoji: string; sprite?: string; name: string;
  color: string; bgColor: string; borderColor: string; isUniversal: boolean;
}) {
  const empty = amount <= 0;
  // Universal Essence gets the prismatic rainbow treatment; others use their
  // flower-type config. Empty rows dim to 40% but stay visible so the player
  // can see which types they're missing.
  const card = isUniversal
    ? "rainbow-tile border"
    : `bg-card/60 border ${borderColor}`;
  const bg   = isUniversal ? "" : bgColor; // bgColor would conflict with rainbow-tile's animated bg
  return (
    <div
      key={type}
      className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-opacity ${card} ${bg} ${empty ? "opacity-40" : ""}`}
    >
      <ItemSprite emoji={emoji} sprite={sprite} name={name} textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm">{name} Essence</h3>
          {isUniversal && (
            <span className="text-xs font-mono rainbow-text">Prismatic</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          ×{amount.toLocaleString()}
          {isUniversal
            ? " · Used in legendary+ cross-breed recipes"
            : " · Sacrifice flowers to earn more"}
        </p>
      </div>
    </div>
  );
}

function GearInventoryRow({ item }: { item: GearInventoryItem }) {
  const def    = GEAR[item.gearType];
  if (!def) return null; // orphan from a removed gear type (cleaned up on next applyOfflineTick)
  const rarity = RARITY_CONFIG[def.rarity];
  return (
    <div className={`flex items-center gap-4 bg-card/60 border rounded-xl px-4 py-3 ${def.rarity === "prismatic" ? "rainbow-border rainbow-glow" : `${rarity?.glow ?? ""} border-border`}`}>
      <ItemSprite emoji={def.emoji} sprite={def.sprite} name={def.name} textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{def.name}</h3>
          <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{def.description}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          ×{item.quantity} · Place in your garden to activate
        </p>
      </div>
    </div>
  );
}

// ── Consumables tab ──────────────────────────────────────────────────────────

const USAGE_CONTEXT: Record<string, string> = {
  bloom_burst:    "Use in Garden (tap a plant)",
  heirloom_charm: "Use in Garden (tap a bloomed plant)",
  purity_vial:    "Use in Garden (tap a plant that has a mutation)",
  giant_vial:     "Use in Garden (tap a plant)",
  frost_vial:     "Use in Garden (tap a plant)",
  ember_vial:     "Use in Garden (tap a plant)",
  storm_vial:     "Use in Garden (tap a plant)",
  moon_vial:      "Use in Garden (tap a plant)",
  golden_vial:    "Use in Garden (tap a plant)",
  rainbow_vial:   "Use in Garden (tap a plant)",
  magnifying_glass: "Use in Garden (tap a growing plant)",
  garden_pin:     "Use in Garden (tap a growing or bloomed plant)",
  ruler:          "Use in Garden (tap a growing plant)",
  shovel:         "Required to dig up a growing plant (consumed on remove)",
  eclipse_tonic:  "Use below — advances all garden plants",
  wind_shear:     "Use in Supply Shop",
  slot_lock:      "Use in Supply Shop",
  seed_pouch:     "Open below to reveal your mystery seed",
};

function getConsumablePrefix(id: string): string {
  // Trim trailing _1 … _5
  return id.replace(/_\d+$/, "");
}

interface ConsumablesTabProps {
  consumables:      { id: string; quantity: number }[];
  lastEclipseTonic: string | null;
  usingEclipse:     string | null;
  openingPouch:     string | null;
  activatingBoost:  string | null;
  activeBoosts:     { type: string; expiresAt: string; consumableId: string }[];
  onUseEclipse:     (id: ConsumableId) => void;
  onOpenPouch:      (id: ConsumableId) => void;
  onActivateBoost:  (id: ConsumableId) => void;
}

function ConsumablesTabContent({
  consumables, lastEclipseTonic, usingEclipse, openingPouch, activatingBoost, activeBoosts,
  onUseEclipse, onOpenPouch, onActivateBoost,
}: ConsumablesTabProps) {
  const today = new Date().toISOString().slice(0, 10);
  const alreadyUsedToday = lastEclipseTonic === today;

  return (
    <div className="space-y-3">
      {consumables.map((c) => {
        const recipe = CONSUMABLE_RECIPE_MAP[c.id as ConsumableId];
        if (!recipe) return null;
        const prefix    = getConsumablePrefix(c.id);
        const context   = USAGE_CONTEXT[prefix] ?? "Use contextually";
        const isEclipse = c.id.startsWith("eclipse_tonic_");
        const isPouch   = c.id.startsWith("seed_pouch_");
        const isBoost   = recipe.category === "speed_boost";
        const busy      = usingEclipse === c.id;
        const usedToday = isEclipse && alreadyUsedToday;
        const opening   = openingPouch === c.id;
        const activating = activatingBoost === c.id;

        // Surface "currently active" if a boost of this type is live
        const boostType =
          c.id.startsWith("verdant_rush_")    ? "growth"     :
          c.id.startsWith("forge_haste_")     ? "craft"      :
          c.id.startsWith("resonance_draft_") ? "attunement" : null;
        const nowMs       = Date.now();
        const liveBoost   = boostType
          ? activeBoosts.find((b) => b.type === boostType && b.consumableId === c.id && new Date(b.expiresAt).getTime() > nowMs)
          : null;

        const consRarity   = RARITY_CONFIG[recipe.rarity];
        const isPrismatic  = recipe.rarity === "prismatic";
        // Prismatic uses rainbow-tile (animated border + bg + glow in a single
        // declaration) so the border actually animates — `glow` is empty for
        // prismatic in RARITY_CONFIG, so without this branch it'd fall back
        // to the static gray border-border.
        return (
          <div
            key={c.id}
            className={`
              flex items-start gap-4 bg-card/60 border rounded-xl px-4 py-3
              ${isPrismatic ? "rainbow-tile" : `${consRarity?.glow ?? ""} border-border`}
            `}
          >
            <ItemSprite emoji={recipe.emoji} sprite={recipe.sprite} name={recipe.name} textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{recipe.name}</h3>
                {recipe.tier !== null && (
                  <span className={`text-xs font-mono ${consRarity?.color ?? ""}`}>
                    {consRarity?.label ?? recipe.rarity}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{recipe.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">×{c.quantity} · {context}</p>

              {isEclipse && (
                <button
                  onClick={() => onUseEclipse(c.id as ConsumableId)}
                  disabled={busy || usedToday}
                  className={`mt-2 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    usedToday
                      ? "bg-card border border-border text-muted-foreground cursor-not-allowed"
                      : busy
                      ? "bg-primary/20 text-primary"
                      : "bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                  }`}
                >
                  {busy ? "Advancing…" : usedToday ? "Used today" : `🌒 Use (${recipe.advanceHours}h advance)`}
                </button>
              )}

              {isPouch && (
                <button
                  onClick={() => onOpenPouch(c.id as ConsumableId)}
                  disabled={!!openingPouch}
                  className={`mt-2 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    opening
                      ? "border-primary/40 bg-primary/20 text-primary"
                      : "border-primary/50 text-primary hover:bg-primary/10"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {opening ? "Opening…" : "🎁 Open"}
                </button>
              )}

              {isBoost && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onActivateBoost(c.id as ConsumableId)}
                    disabled={!!activatingBoost}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      activating
                        ? "border-primary/40 bg-primary/20 text-primary"
                        : "border-primary/50 text-primary hover:bg-primary/10"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {activating ? "Activating…" : "✨ Activate"}
                  </button>
                  {liveBoost && (
                    <span className="text-[10px] text-amber-400">
                      Active until {new Date(liveBoost.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeedInventoryRow({ item }: { item: InventoryItem }) {
  const { state } = useGame();
  const species = getFlower(item.speciesId);
  const rarity  = species ? RARITY_CONFIG[species.rarity] : null;
  if (!species) return null;

  const isNew = !state.discovered.includes(item.speciesId);

  return (
    <div className={`flex items-center gap-4 bg-card/60 border rounded-xl px-4 py-3 ${rarity?.glow ?? ""} border-border`}>
      {isNew
        ? <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />
        : <FlowerSprite species={species} stage="seed" textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{isNew ? "??? Seed" : `${species.name} Seed`}</h3>
          <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
        </div>
        {!isNew && <FlowerTypeBadges types={species.types} className="mt-1" />}
        <p className="text-xs text-muted-foreground mt-0.5">
          {isNew
            ? `×${item.quantity} · Grow it to reveal the species`
            : `×${item.quantity} · Plant in your garden to grow`}
        </p>
      </div>
    </div>
  );
}
