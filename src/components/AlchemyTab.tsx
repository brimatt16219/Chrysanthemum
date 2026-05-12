import { useState, useMemo, useEffect } from "react";
import { useGame } from "../store/GameContext";
import { FLOWER_TYPES, RARITY_CONFIG, getFlower, MUTATIONS } from "../data/flowers";
import {
  calculateEssenceYield, mergeEssences,
  UNIVERSAL_ESSENCE_DISPLAY,
} from "../data/essences";
import { EssenceBank } from "./EssenceBank";
import { FlowerSprite } from "./FlowerSprite";
import { ItemSprite } from "./ItemSprite";
import { YieldTableModal } from "./YieldTableModal";
import { ROMAN } from "../data/consumables";
import { sacrificeFlowers, getBoostMultiplier, type SacrificeEntry } from "../store/gameStore";
import { useDailyProgress } from "../hooks/useDailyProgress";
import { useAchievementStats } from "../hooks/useAchievementStats";
import type { AchievementStatKey } from "../data/achievements";
import {
  edgeAlchemySacrifice,
  edgeAttuneStart, edgeAttuneCollect, edgeAttuneCancel, edgeUpgradeAttunementSlots,
} from "../lib/edgeFunctions";
import {
  MAX_ATTUNEMENT_SLOTS, getNextAttunementSlotUpgrade, attunementDurationMs,
} from "../data/gear-recipes";
import type { MutationType, Rarity, FlowerType } from "../data/flowers";
import type { EssenceItem } from "../data/essences";

// ── Types ─────────────────────────────────────────────────────────────────

type SacrificeMap = Map<string, number>; // key: "speciesId||mutation"

function mapKey(speciesId: string, mutation?: MutationType): string {
  return `${speciesId}||${mutation ?? ""}`;
}

function parseKey(key: string): { speciesId: string; mutation?: MutationType } {
  const [speciesId, mutStr] = key.split("||");
  return { speciesId, mutation: (mutStr || undefined) as MutationType | undefined };
}

// EssenceWallet replaced by the shared EssenceBank component (shows all 12
// + Universal even at 0). See src/components/EssenceBank.tsx.

// ── Sub-component: Sacrifice preview strip ────────────────────────────────

function SacrificePreview({ selections }: { selections: SacrificeMap }) {
  const preview = useMemo(() => {
    let acc: EssenceItem[] = [];
    for (const [key, qty] of selections) {
      if (qty <= 0) continue;
      const { speciesId } = parseKey(key);
      const flower = getFlower(speciesId);
      if (!flower) continue;
      const yields = calculateEssenceYield(flower.types, flower.rarity, qty);
      acc = mergeEssences(acc, yields);
    }
    return acc;
  }, [selections]);

  if (preview.length === 0) return null;

  return (
    <div className="bg-card/60 border border-border rounded-xl px-3 py-2.5">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
        You will receive
      </p>
      <div className="flex flex-wrap gap-1.5">
        {preview.map(({ type, amount }) => {
          const cfg = type === "universal" ? UNIVERSAL_ESSENCE_DISPLAY : FLOWER_TYPES[type as FlowerType];
          return (
            <span
              key={type}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.bgColor} ${cfg.borderColor} ${cfg.color}`}
            >
              <ItemSprite emoji={cfg.emoji} sprite={(cfg as { sprite?: string }).sprite} name={cfg.name} textSize="text-xs" imgSize="w-3.5 h-3.5" /> {amount}
            </span>
          );
        })}
      </div>
    </div>
  );
}



// ── Main AlchemyTab component ─────────────────────────────────────────────

type AlchemyView = "sacrifice" | "attune";

interface AlchemyTabProps {
  /** Controlled view — passed from App for swipe navigation. */
  activeView?:  AlchemyView;
  onViewChange?: (view: AlchemyView) => void;
}

export function AlchemyTab({ activeView, onViewChange }: AlchemyTabProps = {}) {
  const { state, perform, getState, update } = useGame();
  const { trackProgress } = useDailyProgress();
  const { incrementStat } = useAchievementStats();

  const [localView, setLocalView] = useState<AlchemyView>("sacrifice");
  // Use controlled view when provided by parent (swipe), otherwise local state
  const view    = activeView  ?? localView;
  const setView = (v: AlchemyView) => { setLocalView(v); onViewChange?.(v); };
  const [selections, setSelections] = useState<SacrificeMap>(new Map());
  const [activeRarities, setActiveRarities] = useState<Rarity[]>([]);
  const [activeTypes,    setActiveTypes]    = useState<FlowerType[]>([]);
  const [sacrificing,    setSacrificing]    = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState<EssenceItem[] | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  // Yield-rates modal — opened from a button on the Sacrifice view, replaces
  // the standalone "Essences" view that used to host the yield table inline.
  const [showYieldModal, setShowYieldModal] = useState(false);

  // Attune view state
  const [attuneSpeciesId,  setAttuneSpeciesId]  = useState<string | null>(null);
  const [attuneEssType,    setAttuneEssType]    = useState<string | null>(null);
  const [attuneQty,        setAttuneQty]        = useState(1);
  const [attuning,         setAttuning]         = useState(false);
  const [attuneError,      setAttuneError]      = useState<string | null>(null);
  const [attuneResult,     setAttuneResult]     = useState<{ mutation: string; tier: number } | null>(null);
  const [attuneResultVisible, setAttuneResultVisible] = useState(false);

  // Tick once a second for the attunement queue progress bars.
  const [attuneNow, setAttuneNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAttuneNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!success) return;
    const frame = requestAnimationFrame(() => setSuccessVisible(true));
    const timer = setTimeout(() => {
      setSuccessVisible(false);
      setTimeout(() => setSuccess(null), 400);
    }, 3_000);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [success]);

  // Auto-dismiss attune result
  useEffect(() => {
    if (!attuneResult) return;
    const frame = requestAnimationFrame(() => setAttuneResultVisible(true));
    const timer = setTimeout(() => {
      setAttuneResultVisible(false);
      setTimeout(() => setAttuneResult(null), 400);
    }, 4_000);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [attuneResult]);


  // Inventory of harvested (non-seed) flowers grouped by rarity
  const sacrificableByRarity = useMemo(() => {
    const map = new Map<Rarity, typeof state.inventory[number][]>();
    for (const item of state.inventory) {
      if (item.isSeed || item.quantity <= 0) continue;
      const flower = getFlower(item.speciesId);
      if (!flower) continue;
      const list = map.get(flower.rarity) ?? [];
      list.push(item);
      map.set(flower.rarity, list);
    }
    return map;
  }, [state.inventory]);

  const rarityOrder: Rarity[] = ["common", "uncommon", "rare", "legendary", "mythic", "exalted", "prismatic"];

  // Items after rarity filter (before type filter) — used to compute available types
  const rarityFiltered = useMemo(() => {
    if (activeRarities.length === 0) return rarityOrder.flatMap((r) => sacrificableByRarity.get(r) ?? []);
    return activeRarities.flatMap((r) => sacrificableByRarity.get(r) ?? []);
  }, [activeRarities, sacrificableByRarity]);

  // Which types have at least one item in the current rarity selection
  const availableTypes = useMemo(() => {
    const set = new Set<FlowerType>();
    for (const item of rarityFiltered) {
      const flower = getFlower(item.speciesId);
      flower?.types.forEach((t) => set.add(t));
    }
    return set;
  }, [rarityFiltered]);

  const typeOrder = Object.keys(FLOWER_TYPES) as FlowerType[];

  const filteredItems = useMemo(() => {
    if (activeTypes.length === 0) return rarityFiltered;
    return rarityFiltered.filter((item) => {
      const flower = getFlower(item.speciesId);
      return flower?.types.some((t) => activeTypes.includes(t)) ?? false;
    });
  }, [activeTypes, rarityFiltered]);

  const totalSelected = useMemo(() =>
    Array.from(selections.values()).reduce((sum, n) => sum + n, 0),
    [selections]
  );

  function setQty(speciesId: string, mutation: MutationType | undefined, qty: number) {
    const key = mapKey(speciesId, mutation);
    setSelections((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(key);
      else next.set(key, qty);
      return next;
    });
  }

  function getQty(speciesId: string, mutation: MutationType | undefined): number {
    return selections.get(mapKey(speciesId, mutation)) ?? 0;
  }

  function handleSelectAll() {
    const next = new Map(selections);
    for (const item of filteredItems) {
      const available = item.quantity - (next.get(mapKey(item.speciesId, item.mutation)) ?? 0);
      if (available > 0) {
        next.set(mapKey(item.speciesId, item.mutation), item.quantity);
      }
    }
    setSelections(next);
  }

  function handleClearRarity() {
    const next = new Map(selections);
    for (const item of filteredItems) {
      next.delete(mapKey(item.speciesId, item.mutation));
    }
    setSelections(next);
  }

  async function handleSacrifice() {
    if (sacrificing || totalSelected === 0) return;
    setSacrificing(true);
    setError(null);

    const sacrifices: SacrificeEntry[] = [];
    for (const [key, quantity] of selections) {
      if (quantity <= 0) continue;
      const { speciesId, mutation } = parseKey(key);
      sacrifices.push({ speciesId, mutation, quantity });
    }

    const optimistic = sacrificeFlowers(state, sacrifices);
    if (!optimistic) {
      setError("Invalid selection — check your inventory.");
      setSacrificing(false);
      return;
    }

    // Snapshot essences before the sacrifice so we can compute the gain delta
    const prevEssences = state.essences ?? [];

    let succeeded = false;

    await perform(
      optimistic,
      () => edgeAlchemySacrifice(
        sacrifices.map((s) => ({
          speciesId: s.speciesId,
          mutation:  s.mutation as string | undefined,
          quantity:  s.quantity,
        }))
      ),
      (result) => {
        // Show only what was gained, not the entire bank
        const gained = result.essences
          .map((e) => ({
            type:   e.type,
            amount: e.amount - (prevEssences.find((p) => p.type === e.type)?.amount ?? 0),
          }))
          .filter((e) => e.amount > 0);
        setSuccess(gained);
        setSelections(new Map());
        succeeded = true;
        void trackProgress("alchemy_sacrifice");
        // Achievement stats — tally total and per-type counts
        let totalSacrificed = 0;
        const typeCounts: Record<string, number> = {};
        for (const s of sacrifices) {
          totalSacrificed += s.quantity;
          const flower = getFlower(s.speciesId);
          if (flower) {
            for (const type of flower.types) {
              typeCounts[type] = (typeCounts[type] ?? 0) + s.quantity;
            }
          }
        }
        incrementStat("total_sacrifices", totalSacrificed);
        for (const [type, count] of Object.entries(typeCounts)) {
          incrementStat(`sacrifice_${type}` as AchievementStatKey, count);
        }
      },
    );

    if (!succeeded) {
      setError("Sacrifice failed — please try again.");
    }

    setSacrificing(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">

      {/* Tab switcher: Sacrifice | Attune */}
      <div className="flex gap-2">
        {(["sacrifice", "attune"] as AlchemyView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold text-center transition-all duration-150
              ${view === v
                ? "bg-primary/20 border border-primary/50 text-primary"
                : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
              }
            `}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <ItemSprite
                emoji={v === "sacrifice" ? "⚗️" : "🌿"}
                sprite={v === "sacrifice" ? "/sprites/ui/sacrifice.png" : "/sprites/ui/attune.png"}
                name={v === "sacrifice" ? "Sacrifice" : "Attune"}
                textSize="text-xs" imgSize="w-3.5 h-3.5"
              />
              {v === "sacrifice" ? "Sacrifice" : "Attune"}
            </span>
          </button>
        ))}
      </div>

      {/* ── Yield-rates modal (opened from Sacrifice header button) ───────── */}
      {showYieldModal && <YieldTableModal onClose={() => setShowYieldModal(false)} />}

      {/* ── SACRIFICE view ── */}
      {view === "sacrifice" && (
        <div className="flex flex-col gap-4">

          {/* Description + yield-rates trigger */}
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground flex-1">
              Sacrifice harvested flowers to extract their elemental essence. Higher rarity yields more essence.
            </p>
            <button
              onClick={() => setShowYieldModal(true)}
              className="shrink-0 text-xs font-semibold px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
              title="Show essence yield rates by rarity"
            >
              <span className="inline-flex items-center gap-1">
                <ItemSprite emoji="📊" sprite="/sprites/ui/chart.png" name="Yield rates" textSize="text-xs" imgSize="w-3.5 h-3.5" />
                Yield rates
              </span>
            </button>
          </div>

          {/* Essence bank — always visible at top, shows all 12 + Universal */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Essence Bank
            </p>
            <EssenceBank essences={state.essences ?? []} />
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-xl px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Rarity filter tabs */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Filter by rarity
            </p>
            <div className="flex flex-wrap gap-1.5">
              {/* All button */}
              <button
                onClick={() => setActiveRarities([])}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${activeRarities.length === 0
                    ? "bg-primary/20 border border-primary/50 text-primary"
                    : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                  }
                `}
              >
                All
              </button>
              {rarityOrder.map((rarity) => {
                const cfg      = RARITY_CONFIG[rarity];
                const hasAny   = (sacrificableByRarity.get(rarity)?.length ?? 0) > 0;
                const isActive = activeRarities.includes(rarity);
                return (
                  <button
                    key={rarity}
                    onClick={() => setActiveRarities((prev) =>
                      isActive ? prev.filter((r) => r !== rarity) : [...prev, rarity]
                    )}
                    disabled={!hasAny}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
                      ${isActive
                        ? `bg-primary/20 border border-primary/50 ${cfg.color}`
                        : hasAny
                          ? "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                          : "bg-card/60 border border-border/30 text-muted-foreground/30 cursor-not-allowed"
                      }
                    `}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type filter */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Filter by type
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveTypes([])}
                className={`
                  px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                  ${activeTypes.length === 0
                    ? "bg-foreground/10 border border-foreground/40 text-foreground"
                    : "bg-card/60 border border-border text-muted-foreground hover:border-foreground/30"
                  }
                `}
              >
                All types
              </button>
              {typeOrder.map((type) => {
                const cfg      = FLOWER_TYPES[type];
                const hasAny   = availableTypes.has(type);
                const isActive = activeTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTypes((prev) =>
                      isActive ? prev.filter((t) => t !== type) : [...prev, type]
                    )}
                    disabled={!hasAny}
                    className={`
                      inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                      ${isActive
                        ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color} border`
                        : hasAny
                          ? "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                          : "bg-card/60 border border-border/30 text-muted-foreground/30 cursor-not-allowed"
                      }
                    `}
                  >
                    <ItemSprite emoji={cfg.emoji} sprite={cfg.sprite} name={cfg.name} textSize="text-xs" imgSize="w-3.5 h-3.5" />
                    {cfg.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flower grid */}
          {filteredItems.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  {activeRarities.length === 0 && activeTypes.length === 0
                    ? "All flowers"
                    : <>
                        {activeRarities.map((r) => (
                          <span key={r} className={`${RARITY_CONFIG[r].color} mr-1`}>{RARITY_CONFIG[r].label}</span>
                        ))}
                        {activeTypes.map((t) => (
                          <span key={t} className={`inline-flex items-center gap-0.5 ${FLOWER_TYPES[t].color} mr-1`}>
                            <ItemSprite emoji={FLOWER_TYPES[t].emoji} sprite={FLOWER_TYPES[t].sprite} name={FLOWER_TYPES[t].name} textSize="text-xs" imgSize="w-3.5 h-3.5" />
                            {FLOWER_TYPES[t].name}
                          </span>
                        ))}
                        <span>flowers</span>
                      </>
                  }
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-primary hover:text-primary/80 font-semibold"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => { handleClearRarity(); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear selection
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {filteredItems.map((item) => {
                  const flower  = getFlower(item.speciesId);
                  if (!flower) return null;
                  const mut     = item.mutation ? MUTATIONS[item.mutation as MutationType] : null;
                  const qty     = getQty(item.speciesId, item.mutation as MutationType | undefined);
                  const avail   = item.quantity;
                  const isSelected = qty > 0;

                  return (
                    <div
                      key={`${item.speciesId}${item.mutation ?? ""}`}
                      className={`
                        relative rounded-xl border p-3 transition-all duration-150
                        ${isSelected
                          ? "border-primary/60 bg-primary/10"
                          : "border-border bg-card/60"
                        }
                      `}
                    >
                      {/* Top row */}
                      <div className="flex items-center gap-2 mb-2">
                        <FlowerSprite species={flower} stage="bloom" textSize="text-xl" imgSize="w-7 h-7" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {mut ? <span className={mut.color}>{mut.emoji} </span> : null}
                            {flower.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            <span className={RARITY_CONFIG[flower.rarity].color}>{RARITY_CONFIG[flower.rarity].label}</span>
                            {" · "}{avail} available
                            {isSelected && ` · ${qty} selected`}
                          </p>
                        </div>
                      </div>

                      {/* Type pills */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {flower.types.map((t) => {
                          const tc = FLOWER_TYPES[t];
                          return (
                            <span
                              key={t}
                              className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${tc.bgColor} ${tc.borderColor} ${tc.color}`}
                            >
                              <ItemSprite emoji={tc.emoji} sprite={tc.sprite} name={tc.name} textSize="text-[10px]" imgSize="w-3 h-3" />
                              {tc.name}
                            </span>
                          );
                        })}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(item.speciesId, item.mutation as MutationType | undefined, qty - 1)}
                          disabled={qty <= 0}
                          className="w-6 h-6 rounded-md border border-border text-muted-foreground text-xs flex items-center justify-center hover:border-primary/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          −
                        </button>
                        <span className="flex-1 text-center text-xs font-mono text-muted-foreground">
                          {qty}
                        </span>
                        <button
                          onClick={() => setQty(item.speciesId, item.mutation as MutationType | undefined, Math.min(qty + 1, avail))}
                          disabled={qty >= avail}
                          className="w-6 h-6 rounded-md border border-border text-muted-foreground text-xs flex items-center justify-center hover:border-primary/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          +
                        </button>
                        <button
                          onClick={() => setQty(item.speciesId, item.mutation as MutationType | undefined, avail)}
                          disabled={qty >= avail}
                          className="ml-1 text-xs text-primary font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state — no flowers in inventory at all */}
          {filteredItems.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
              <ItemSprite emoji="⚗️" sprite="/sprites/ui/sacrifice.png" name="Alchemy" textSize="text-2xl" imgSize="w-8 h-8" className="mx-auto" />
              <p>Harvest some flowers to sacrifice them.</p>
            </div>
          )}

          {/* Preview */}
          <SacrificePreview selections={selections} />

          {/* Summary + Sacrifice button */}
          {totalSelected > 0 && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-xs text-muted-foreground">
                {totalSelected} flower{totalSelected !== 1 ? "s" : ""} selected
              </p>
              <button
                onClick={handleSacrifice}
                disabled={sacrificing}
                className={`
                  px-10 py-3 rounded-full text-sm font-semibold border transition-all duration-200
                  ${sacrificing
                    ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                    : "border-destructive/60 text-destructive hover:bg-destructive/10 hover:scale-[1.02]"
                  }
                `}
              >
                {sacrificing ? "Sacrificing…" : `Sacrifice ${totalSelected} flower${totalSelected !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── ATTUNE view ── */}
      {view === "attune" && (() => {
        // ── Derived data ──────────────────────────────────────────────────────
        const rarityOrder: Rarity[] = ["common","uncommon","rare","legendary","mythic","exalted","prismatic"];

        // Unmutated blooms available to infuse
        const attunableBlooms = state.inventory.filter(
          (i) => !i.isSeed && i.quantity > 0 && (i.mutation === undefined || i.mutation === null)
        );

        // Essences the player owns (excluding universal for infuse — only elemental count)
        const ownedEssences = (state.essences ?? []).filter(
          (e) => e.type !== "universal" && e.amount > 0
        );

        // Selected bloom's species data
        const attuneSpecies  = attuneSpeciesId ? getFlower(attuneSpeciesId) : null;
        const attuneRarity   = attuneSpecies?.rarity ?? null;

        // Effective essence and tier preview
        let effectiveEssence = 0;
        let tierPreview: 1 | 2 | 3 | 4 = 1;
        const GOLD_COST_TABLE: Record<string, [number,number,number,number]> = {
          common:    [     15,      60,      200,       700],
          uncommon:  [     75,     300,      900,     3_000],
          rare:      [    300,   1_200,    4_000,    14_000],
          legendary: [  1_200,   5_000,   16_000,    55_000],
          mythic:    [  5_000,  20_000,   70_000,   250_000],
          exalted:   [ 20_000,  80_000,  280_000, 1_000_000],
          prismatic: [ 80_000, 300_000,1_000_000, 3_500_000],
        };
        let goldCostPreview = 0;

        if (attuneSpecies && attuneEssType && attuneQty > 0) {
          const isMatching = attuneSpecies.types.includes(attuneEssType as never) || attuneEssType === "universal";
          effectiveEssence = attuneQty * (isMatching ? 2 : 1);
          tierPreview = effectiveEssence >= 40 ? 4 : effectiveEssence >= 20 ? 3 : effectiveEssence >= 8 ? 2 : 1;
          const costs = GOLD_COST_TABLE[attuneRarity!];
          goldCostPreview = costs ? costs[tierPreview - 1] : 0;
        }

        const TIER_LABEL = ["", "I — Common", "II — Balanced", "III — Rare-Weighted", "IV — Rare Dominant"];
        const TIER_COLOR = ["", "text-muted-foreground", "text-blue-400", "text-violet-400", "text-yellow-400"];

        // ── Handlers ──────────────────────────────────────────────────────────
        async function handleAttune() {
          if (attuning || !attuneSpeciesId || !attuneEssType || attuneQty < 1) return;
          setAttuneError(null);
          setAttuning(true);
          try {
            // v2.3: starts a time-gated queue entry instead of resolving instantly.
            // Result modal only fires on collect.
            const res = await edgeAttuneStart(attuneSpeciesId, attuneEssType, attuneQty);
            const cur = getState();
            update({
              ...cur,
              coins:           res.coins,
              inventory:       res.inventory,
              essences:        res.essences,
              attunementQueue: res.attunementQueue,
              serverUpdatedAt: res.serverUpdatedAt,
            });
            setAttuneSpeciesId(null);
            setAttuneEssType(null);
            setAttuneQty(1);
          } catch (e) {
            setAttuneError(e instanceof Error ? e.message : "Attunement failed");
          } finally {
            setAttuning(false);
          }
        }

        // ── Attunement queue handlers (v2.3) ────────────────────────────────
        async function handleCollectAttune(id: string) {
          try {
            const res = await edgeAttuneCollect(id);
            const cur = getState();
            update({
              ...cur,
              inventory:       res.inventory,
              discovered:      res.discovered,
              attunementQueue: res.attunementQueue,
              serverUpdatedAt: res.serverUpdatedAt,
            });
            setAttuneResult({ mutation: res.mutation, tier: res.tier });
            incrementStat("attunements_completed");
          } catch (e) {
            setAttuneError(e instanceof Error ? e.message : "Collect failed");
          }
        }
        async function handleCancelAttune(id: string) {
          try {
            const res = await edgeAttuneCancel(id);
            const cur = getState();
            update({
              ...cur,
              inventory:       res.inventory,
              attunementQueue: res.attunementQueue,
              serverUpdatedAt: res.serverUpdatedAt,
            });
          } catch (e) {
            setAttuneError(e instanceof Error ? e.message : "Cancel failed");
          }
        }
        async function handleUpgradeAttuneSlots() {
          try {
            const res = await edgeUpgradeAttunementSlots();
            const cur = getState();
            update({
              ...cur,
              coins:           res.coins,
              attunementSlots: res.attunement_slots,
              serverUpdatedAt: res.serverUpdatedAt,
            });
          } catch (e) {
            setAttuneError(e instanceof Error ? e.message : "Upgrade failed");
          }
        }

        // ── Attunement queue derived state ──────────────────────────────────
        const attuneSlots        = state.attunementSlots ?? 0;
        const attuneQueue        = state.attunementQueue ?? [];
        const slotsAvailable     = attuneSlots > 0 && attuneQueue.length < attuneSlots;
        const isResonanceActive  = getBoostMultiplier(state.activeBoosts ?? [], "attunement", attuneNow) > 1;
        const nextSlotUpgrade = getNextAttunementSlotUpgrade(attuneSlots);
        const canAffordSlot   = nextSlotUpgrade ? state.coins >= nextSlotUpgrade.cost : false;
        const atMaxSlots      = attuneSlots >= MAX_ATTUNEMENT_SLOTS;

        return (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-muted-foreground">
              Transform a base bloom into a mutated one by spending elemental essence and coins.
              Higher essence (especially matching the flower's type) unlocks rarer mutation pools.
              Attunements are <span className="text-foreground">time-gated</span> — start one in a slot, wait, then collect the result.
            </p>

            {/* ── Attunement slots + queue ────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card/40 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  Attunement Slots <span className="text-muted-foreground/60">· {attuneQueue.length}/{attuneSlots}</span>
                </p>
                {atMaxSlots && (
                  <p className="text-[10px] text-amber-400/60 shrink-0">Max slots</p>
                )}
              </div>

              {/* Slot rows */}
              {Array.from({ length: Math.max(attuneSlots, 1) }).map((_, i) => {
                const entry = attuneQueue[i];
                if (!entry && attuneSlots === 0 && i === 0) {
                  return (
                    <div key={`locked-${i}`} className="rounded-xl border border-dashed border-border/60 bg-card/20 px-3 py-2 min-h-[3rem] flex items-center gap-2">
                      <ItemSprite emoji="🔒" sprite="/sprites/ui/lock.png" name="Locked" textSize="text-lg" imgSize="w-5 h-5" className="shrink-0 opacity-30" />
                      <p className="text-xs text-muted-foreground italic">Buy your first attunement slot to start</p>
                    </div>
                  );
                }
                if (!entry) {
                  return (
                    <div key={`empty-${i}`} className="rounded-xl border border-dashed border-border/60 bg-card/20 px-3 py-2 min-h-[3rem] flex items-center gap-2">
                      <ItemSprite emoji="🌿" sprite="/sprites/ui/attune.png" name="Empty slot" textSize="text-lg" imgSize="w-5 h-5" className="shrink-0 opacity-30" />
                      <p className="text-xs text-muted-foreground italic">Empty slot</p>
                    </div>
                  );
                }
                const flower = getFlower(entry.speciesId);
                const startedMs = new Date(entry.startedAt).getTime();
                const elapsed   = attuneNow - startedMs;
                const progress  = Math.max(0, Math.min(elapsed / entry.durationMs, 1));
                const isDone    = progress >= 1;
                const remaining = Math.max(entry.durationMs - elapsed, 0);
                const fmt = (ms: number) => {
                  if (ms <= 0) return "Done!";
                  const s = Math.ceil(ms / 1000);
                  if (s < 60) return `${s}s`;
                  const m = Math.floor(s / 60);
                  if (m < 60) return `${m}m ${s % 60}s`;
                  const h = Math.floor(m / 60);
                  return `${h}h ${m % 60}m`;
                };
                const tierLabel = ROMAN[entry.tier as 1|2|3|4|5] ?? entry.tier;
                return (
                  <div key={entry.id} className={`relative rounded-xl border bg-card/40 px-3 py-2 space-y-1.5 overflow-hidden ${isResonanceActive && !isDone ? "border-violet-500/50" : "border-border"}`}>
                    {/* Resonance Draft sparks — visible while boost is active and attunement is in-progress */}
                    {isResonanceActive && !isDone && (
                      <div className="absolute inset-0 pointer-events-none">
                        <span className="boost-resonance-spark" style={{ left: "10%",  animationDelay: "-1.2s" }}>✦</span>
                        <span className="boost-resonance-spark" style={{ left: "45%",  animationDelay: "-0.6s" }}>✦</span>
                        <span className="boost-resonance-spark" style={{ left: "78%",  animationDelay: "0s"    }}>✦</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {flower
                          ? <FlowerSprite species={flower} stage="bloom" textSize="text-lg" imgSize="w-6 h-6" className="shrink-0" />
                          : <span className="text-lg leading-none shrink-0">🌸</span>
                        }
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1 flex-wrap">
                            {flower?.name ?? entry.speciesId}
                            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                              → <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-[10px]" imgSize="w-3 h-3" /> Tier {tierLabel}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isDone ? <span className="text-green-400 font-semibold">Ready to collect!</span> : fmt(remaining)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDone && (
                          <button
                            onClick={() => handleCollectAttune(entry.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30 transition"
                          >
                            ✅ Collect
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelAttune(entry.id)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-card/60 border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition"
                          title="Cancel (refunds the bloom, NOT the essence)"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-card/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isDone ? "bg-green-500" : "bg-amber-500"}`}
                        style={{ width: `${progress * 100}%`, transition: "width 1s linear, background-color 500ms" }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Slot upgrade button */}
              {!atMaxSlots && nextSlotUpgrade && (
                <button
                  onClick={handleUpgradeAttuneSlots}
                  disabled={!canAffordSlot}
                  className={`
                    w-full rounded-xl border border-dashed border-amber-600/40 bg-amber-500/5
                    hover:bg-amber-500/10 hover:border-amber-400/60
                    px-3 py-2 min-h-[3rem] flex items-center justify-between gap-2
                    transition-all disabled:opacity-40 disabled:cursor-not-allowed
                  `}
                >
                  <div className="flex items-center gap-2">
                    <ItemSprite emoji="➕" sprite="/sprites/ui/plus.png" name="Add slot" textSize="text-lg" imgSize="w-5 h-5" className="shrink-0 opacity-70" />
                    <p className="text-xs font-semibold text-amber-400">
                      Unlock attunement slot {nextSlotUpgrade.slots}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-0.5 text-xs font-mono text-amber-400">
                    {nextSlotUpgrade.cost.toLocaleString()}
                    <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" />
                  </span>
                </button>
              )}
            </div>

            {/* ── Attune section ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card/40 px-4 py-3 space-y-4">
              <p className="text-xs font-semibold flex items-center gap-1">
                <ItemSprite emoji="🌿" sprite="/sprites/ui/attune.png" name="Attune" textSize="text-xs" imgSize="w-3.5 h-3.5" />
                Attune a Bloom
              </p>

              {/* Bloom picker */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                  Pick a base bloom
                </p>
                {attunableBlooms.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No unmutated blooms in inventory.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {rarityOrder.flatMap((r) =>
                      attunableBlooms
                        .filter((i) => getFlower(i.speciesId)?.rarity === r)
                        .map((item) => {
                          const sp      = getFlower(item.speciesId)!;
                          const rc      = RARITY_CONFIG[sp.rarity];
                          const isSelected = attuneSpeciesId === item.speciesId;
                          return (
                            <button
                              key={item.speciesId}
                              onClick={() => {
                                setAttuneSpeciesId(isSelected ? null : item.speciesId);
                                setAttuneEssType(null);
                                setAttuneQty(1);
                                setAttuneError(null);
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                                isSelected
                                  ? `${rc.color} border-current bg-current/10`
                                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              }`}
                            >
                              <FlowerSprite species={sp} stage="bloom" textSize="text-xs" imgSize="w-4 h-4" />
                              <span>{sp.name}</span>
                              <span className="text-muted-foreground/60">×{item.quantity}</span>
                            </button>
                          );
                        })
                    )}
                  </div>
                )}
              </div>

              {/* Essence picker — only shown once a bloom is selected */}
              {attuneSpecies && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                    Choose essence type
                    <span className="ml-1 normal-case">
                      (matching: {attuneSpecies.types.join(", ")})
                    </span>
                  </p>
                  {ownedEssences.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No essence in bank.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {ownedEssences.map(({ type, amount }) => {
                        const cfg        = FLOWER_TYPES[type as never] as { emoji: string; sprite?: string; name: string; color: string; bgColor: string; borderColor: string };
                        const isMatch    = attuneSpecies.types.includes(type as never);
                        const isSelected = attuneEssType === type;
                        return (
                          <button
                            key={type}
                            onClick={() => { setAttuneEssType(type); setAttuneQty(1); }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                              isSelected
                                ? `${cfg.color} border-current ${cfg.bgColor}`
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                          >
                            <ItemSprite emoji={cfg.emoji} sprite={cfg.sprite} name={cfg.name} textSize="text-xs" imgSize="w-3.5 h-3.5" />
                            {cfg.name}
                            {isMatch && <span className="text-[10px] text-primary ml-0.5">✦ match</span>}
                            <span className="text-muted-foreground/60 ml-0.5">×{amount}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Quantity stepper + tier preview */}
              {attuneSpecies && attuneEssType && (() => {
                const ownedAmt = ownedEssences.find((e) => e.type === attuneEssType)?.amount ?? 0;
                const canAfford = state.coins >= goldCostPreview;
                const canAttune = ownedAmt >= attuneQty && canAfford && slotsAvailable;
                const previewDurMs = attuneRarity ? attunementDurationMs(tierPreview, attuneRarity) : 0;
                const fmtDur = (ms: number) => {
                  const m = Math.round(ms / 60_000);
                  if (m < 60) return `${m} min`;
                  const h = Math.floor(m / 60);
                  return `${h}h ${m % 60}m`;
                };
                return (
                  <div className="space-y-3">
                    {/* Qty row */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Quantity</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setAttuneQty((q) => Math.max(1, q - 1))} disabled={attuneQty <= 1}
                          className="w-6 h-6 rounded-md border border-border text-xs flex items-center justify-center hover:border-primary/50 disabled:opacity-30">−</button>
                        <span className="w-8 text-center text-sm font-mono">{attuneQty}</span>
                        <button onClick={() => setAttuneQty((q) => Math.min(ownedAmt, q + 1))} disabled={attuneQty >= ownedAmt}
                          className="w-6 h-6 rounded-md border border-border text-xs flex items-center justify-center hover:border-primary/50 disabled:opacity-30">+</button>
                        <button onClick={() => setAttuneQty(ownedAmt)} disabled={attuneQty >= ownedAmt}
                          className="ml-1 text-xs text-primary disabled:opacity-30">Max</button>
                      </div>
                    </div>

                    {/* Tier + cost summary */}
                    <div className="rounded-lg bg-card/60 border border-border px-3 py-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Effective essence</span>
                        <span className="font-mono">{effectiveEssence}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mutation pool</span>
                        <span className={`font-semibold ${TIER_COLOR[tierPreview]}`}>
                          Tier {TIER_LABEL[tierPreview]}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gold cost</span>
                        <span className={`inline-flex items-center gap-0.5 font-mono ${canAfford ? "" : "text-destructive"}`}>
                          {goldCostPreview.toLocaleString()}
                          <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" />
                          {!canAfford && " (insufficient)"}
                        </span>
                      </div>
                    </div>

                    {/* Duration preview */}
                    {previewDurMs > 0 && (
                      <p className="text-xs text-muted-foreground text-right flex items-center justify-end gap-1">
                        <ItemSprite emoji="⏱" sprite="/sprites/ui/timer.png" name="Duration" textSize="text-xs" imgSize="w-3 h-3" />
                        Duration: <span className="text-foreground">{fmtDur(previewDurMs)}</span>
                        {!slotsAvailable && (
                          <span className="ml-2 text-amber-400">· no free slot</span>
                        )}
                      </p>
                    )}

                    {attuneError && (
                      <p className="text-xs text-destructive">{attuneError}</p>
                    )}

                    <button
                      onClick={handleAttune}
                      disabled={attuning || !canAttune}
                      className="w-full py-2 rounded-xl bg-primary/20 border border-primary/50 text-primary text-sm font-semibold hover:bg-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-center"
                    >
                      {attuning
                        ? "Starting…"
                        : !slotsAvailable
                          ? attuneSlots === 0 ? "Buy a slot to start" : "All slots in use"
                          : <span className="inline-flex items-center justify-center gap-1"><ItemSprite emoji="🌿" sprite="/sprites/ui/attune.png" name="Attune" textSize="text-sm" imgSize="w-4 h-4" /> Start Attune</span>}
                    </button>
                  </div>
                );
              })()}
            </div>

          </div>
        );
      })()}

      {/* ── Attune result toast ── */}
      {attuneResult && (() => {
        const mut = MUTATIONS[attuneResult.mutation as MutationType];
        const TIER_COLOR = ["","text-muted-foreground","text-blue-400","text-violet-400","text-yellow-400"];
        return (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-400 ${attuneResultVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="flex items-center gap-3 bg-card border border-primary/40 rounded-2xl px-5 py-4 shadow-2xl shadow-primary/10 min-w-64">
              <span className="text-2xl">{mut?.emoji ?? "🌿"}</span>
              <div>
                <p className="text-sm font-bold text-primary mb-0.5">Attunement complete!</p>
                <p className={`text-xs font-semibold ${mut?.color ?? ""}`}>{mut?.name ?? attuneResult.mutation}</p>
                <p className={`text-[10px] ${TIER_COLOR[attuneResult.tier]}`}>Tier {attuneResult.tier} pool</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Success toast (floating, auto-dismiss) ── */}
      {success && (
        <div
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none
            transition-all duration-400
            ${successVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
        >
          <div className="flex items-center gap-3 bg-card border border-primary/40 rounded-2xl px-5 py-4 shadow-2xl shadow-primary/10 min-w-64">
            <ItemSprite emoji="⚗️" sprite="/sprites/ui/sacrifice.png" name="Alchemy" textSize="text-2xl" imgSize="w-8 h-8" />
            <div>
              <p className="text-sm font-bold text-primary mb-1.5">Sacrifice complete!</p>
              <div className="flex flex-wrap gap-1.5">
                {success.filter((e) => e.amount > 0).map(({ type, amount }) => {
                  const cfg = type === "universal"
                    ? UNIVERSAL_ESSENCE_DISPLAY
                    : FLOWER_TYPES[type as FlowerType];
                  return (
                    <span
                      key={type}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.bgColor} ${cfg.borderColor} ${cfg.color}`}
                    >
                      <ItemSprite emoji={cfg.emoji} sprite={(cfg as { sprite?: string }).sprite} name={cfg.name} textSize="text-xs" imgSize="w-3.5 h-3.5" /> +{amount}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
