import { useState, useRef, useLayoutEffect } from "react";
import { audioManager } from "../lib/audioManager";
import { ItemSprite } from "./ItemSprite";
import { FlowerSprite } from "./FlowerSprite";
import {
  type PlantedFlower,
  getCurrentStage,
  getMsUntilNextStage,
  applyFertilizer,
  removePlant,
  applyPlantConsumable,
  stampCropsticksCycles,
} from "../store/gameStore";
import { edgeApplyFertilizer, edgeRemovePlant, edgeApplyAttunement, edgeApplyPlantConsumable, edgeUnpinPlant } from "../lib/edgeFunctions";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import { FlowerTypeBadges } from "./FlowerTypeBadges";
import { FERTILIZERS, type FertilizerType } from "../data/upgrades";
import { useGame } from "../store/GameContext";
import { useDailyProgress } from "../hooks/useDailyProgress";
import { useAchievementStats } from "../hooks/useAchievementStats";
import type { AchievementStatKey } from "../data/achievements";
import { CONSUMABLE_RECIPE_MAP, ROMAN, RARITY_TIER, type ConsumableId } from "../data/consumables";

interface Props {
  plant:                 PlantedFlower;
  row:                   number;
  col:                   number;
  onClose?:              () => void;
  /** Called when the user clicks the Harvest button (for bloomed plants). */
  onHarvestRequest?:     () => void;
  /** True when this plant is actively serving as a Cropsticks cross-breed source. */
  isCrossBreeding?:      boolean;
  /** Combined sprinkler × grow-lamp growth multiplier for this cell. */
  gearGrowthMultiplier?: number;
  isUnderSprinkler?:     boolean;
  sprinklerMutations?:   { emoji: string; label: string; sprite?: string }[];
  isUnderGrowLamp?:      boolean;
  isUnderScarecrow?:     boolean;
  isUnderComposter?:     boolean;
  isUnderFan?:           boolean;
  isUnderHarvestBell?:   boolean;
  isUnderLawnmower?:     boolean;
  /** "boost" (3×) or "slow" (0.5×) when covered by an active Balance Scale. */
  balanceScaleSide?:     "boost" | "slow";
  /** Ms until the balance scale flips to the other side — shown in the gear chip (#240). */
  balanceScaleFlipMs?:   number;
  /** True when this cell is covered by an active Aqueduct (displayed instead of sprinkler 💧). */
  isUnderAqueduct?:      boolean;
  /** True when this cell is shielded by an active Aegis. */
  isUnderAegis?:         boolean;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
}

export function PlotTooltip({
  plant, row, col, onClose, onHarvestRequest, isCrossBreeding = false,
  gearGrowthMultiplier = 1.0,
  isUnderSprinkler, isUnderAqueduct, sprinklerMutations = [],
  isUnderGrowLamp, isUnderScarecrow, isUnderComposter, isUnderFan, isUnderHarvestBell, isUnderLawnmower,
  balanceScaleSide, balanceScaleFlipMs, isUnderAegis,
}: Props) {
  const { state, getState, perform, update, activeWeather, pushHarvestPopup, pushGenericToast } = useGame();
  const { trackProgress } = useDailyProgress();
  const { incrementStat } = useAchievementStats();
  const [showFertPicker,    setShowFertPicker]    = useState(false);
  const [confirmRemove,     setConfirmRemove]     = useState(false);
  const [removing,          setRemoving]          = useState(false);
  const [applyingAttunement, setApplyingAttunement] = useState(false);
  const [applyingConsumable,setApplyingConsumable]= useState<string | null>(null);
  const [unpinning,         setUnpinning]         = useState(false);
  const [nudge,             setNudge]             = useState(0);
  const [flipped,           setFlipped]           = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw  = document.documentElement.clientWidth;
    const pad = 8;

    // Horizontal clamping
    if (rect.left < pad) {
      setNudge(pad - rect.left);
    } else if (rect.right > vw - pad) {
      setNudge(vw - pad - rect.right);
    }

    // Vertical: flip below the plot if tooltip is hidden behind the sticky nav
    const navEl = document.querySelector<HTMLElement>("[data-sticky-nav]");
    const navBottom = navEl ? navEl.getBoundingClientRect().bottom : 0;
    if (rect.top < navBottom + pad) {
      setFlipped(true);
    }
  }, []);

  const now     = Date.now();
  const species = getFlower(plant.speciesId);
  if (!species) return null;

  const stage         = getCurrentStage(plant, now, activeWeather, gearGrowthMultiplier);
  const msLeft        = getMsUntilNextStage(plant, now, activeWeather, gearGrowthMultiplier);
  const rarity        = RARITY_CONFIG[species.rarity];
  const isBloomed     = stage === "bloom";
  // A plant is "identified" (species known to this player) if it's already in the
  // codex (harvested before), the player used a Magnifying Glass on this tile,
  // or the plant has reached bloom (identity revealed at peak).
  const isIdentified = state.discovered.includes(plant.speciesId) || !!plant.revealed || isBloomed;
  const hasFertilizer = !!plant.fertilizer;
  const availableFerts = state.fertilizers
    .filter((f) => f.quantity > 0)
    .sort((a, b) => FERTILIZERS[a.type].speedMultiplier - FERTILIZERS[b.type].speedMultiplier);

  // Rarity ordering used for both infuser and consumable matching.
  const RARITY_ORDER: Record<string, number> = {
    common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4, exalted: 5, prismatic: 6,
  };

  // Infuser matching — backwards-tier: any infuser with tier ≥ flower's rarity tier works.
  // Select the lowest matching tier first to conserve higher-tier infusers.
  const flowerRarityTier = RARITY_ORDER[species.rarity] ?? 0;
  const matchingInfuser = [...(state.infusers ?? [])]
    .filter((i) => (RARITY_ORDER[i.rarity] ?? 0) >= flowerRarityTier && i.quantity > 0)
    .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0))[0] ?? null;

  // Consumables applicable to this plant right now.
  //
  // Tier-vs-rarity rule: ALL plant-targeting consumables match DOWNWARD — a
  // higher-tier consumable works on lower-rarity plants (e.g. Mythic vial on
  // a Rare). Floor is still tier 1 (Rare), so Common/Uncommon plants stay
  // excluded.
  // Null-tier utility consumables that are applied directly to a plant plot.
  const NULL_TIER_PLANT_CONSUMABLES = new Set(["garden_pin", "ruler"]);

  const applicableConsumables = (state.consumables ?? []).filter((c) => {
    if (c.quantity <= 0) return false;
    const recipe = CONSUMABLE_RECIPE_MAP[c.id as ConsumableId];
    if (!recipe) return false;
    // Speed boosts, seed pouches, and Eclipse Tonics don't target individual plots.
    if (recipe.category === "speed_boost" || recipe.category === "seed_pouch") return false;
    if (c.id.startsWith("eclipse_tonic_")) return false;
    // Allow null-tier plant utilities through; block all other null-tier items
    // (seed pouches, etc. are handled elsewhere).
    if (recipe.tier === null && !NULL_TIER_PLANT_CONSUMABLES.has(c.id)) return false;

    // Magnifying Glass, Garden Pin, and Ruler bypass the rarity gate — they work on any species
    if (c.id !== "magnifying_glass" && c.id !== "garden_pin" && c.id !== "ruler" && (RARITY_ORDER[recipe.rarity] ?? -1) < (RARITY_ORDER[species.rarity] ?? 999)) return false;

    // Bloom Burst only works on non-bloomed plants
    if (c.id.startsWith("bloom_burst_") && isBloomed) return false;
    // Heirloom Charm only works on bloomed plants, and only once per plant
    if (c.id.startsWith("heirloom_charm_") && !isBloomed) return false;
    if (c.id.startsWith("heirloom_charm_") && plant.heirloomActive) return false;
    // Magnifying Glass: only usable when species is still unknown on this tile
    // (blocks if: already revealed via mag glass, plant is bloomed and now visible,
    //  or species already in codex so there's nothing left to reveal)
    if (c.id === "magnifying_glass" && (plant.revealed || isBloomed || state.discovered.includes(plant.speciesId))) return false;
    // Garden Pin: hide once the plant is already pinned
    if (c.id === "garden_pin" && plant.pinned) return false;
    // Ruler: hide once already applied, or on a bloomed plant
    if (c.id === "ruler" && (plant.showMultiplier || isBloomed)) return false;
    // Mutation vials: blocked when the bloom already carries a mutation.
    // Player must use a Purity Vial to clear it first.
    if (
      (c.id.startsWith("giant_vial_")   ||
       c.id.startsWith("frost_vial_")   ||
       c.id.startsWith("ember_vial_")   ||
       c.id.startsWith("storm_vial_")   ||
       c.id.startsWith("moon_vial_")    ||
       c.id.startsWith("golden_vial_")  ||
       c.id.startsWith("rainbow_vial_")) &&
      isBloomed && typeof plant.mutation === "string"
    ) return false;
    return true;
  });

  async function handleApplyAttunement() {
    if (applyingAttunement) return;
    setApplyingAttunement(true);
    try {
      const res = await edgeApplyAttunement(row, col);
      const cur = getState();
      // Client-side fallback: stamp crossbreedStartedAt on adjacent cropsticks that
      // now have a valid infused pair, in case the edge function didn't (e.g. older
      // deployment or network quirk). Skips cells already stamped by the server.
      const activeGrid = stampCropsticksCycles(res.grid, row, col, Date.now());
      update({ ...cur, grid: activeGrid, infusers: res.infusers, serverUpdatedAt: res.serverUpdatedAt });
      onClose?.();
    } catch {
      // Server function not yet active or error — silently re-enable button
    } finally {
      setApplyingAttunement(false);
    }
  }

  // Garden Pin removal — required before a pinned plant can be manually
  // harvested. Pin is consumed (no refund of the original consumable).
  async function handleRemovePin() {
    if (unpinning) return;
    setUnpinning(true);
    try {
      const res = await edgeUnpinPlant(row, col);
      const cur = getState();
      update({ ...cur, grid: res.grid, serverUpdatedAt: res.serverUpdatedAt });
    } catch {
      // Silent — server rejected (e.g. CAS miss); pin stays in place
    } finally {
      setUnpinning(false);
    }
  }

  function handleApplyFertilizer(type: FertilizerType) {
    const optimistic = applyFertilizer(state, row, col, type);
    if (optimistic) {
      const f = FERTILIZERS[type];
      perform(optimistic, () => edgeApplyFertilizer(row, col, type), () => {
        pushGenericToast(`loss:fert:${type}`, f.emoji, f.name, undefined, "loss", 1, f.sprite);
        void trackProgress("apply_fertilizer");
        incrementStat("fertilizers_applied");
      });
    }
    setShowFertPicker(false);
    onClose?.();
  }

  function handleUseConsumable(consumableId: string) {
    if (applyingConsumable) return;
    const cur = getState();
    const optimistic = applyPlantConsumable(cur, row, col, consumableId);
    if (!optimistic) return;
    const savedCell       = cur.grid[row][col];
    const savedConsumables = cur.consumables;
    setApplyingConsumable(consumableId);
    const recipe = CONSUMABLE_RECIPE_MAP[consumableId as ConsumableId];
    perform(
      optimistic,
      () => edgeApplyPlantConsumable(row, col, consumableId),
      () => {
        setApplyingConsumable(null);
        if (recipe) pushGenericToast(`loss:consumable:${consumableId}`, recipe.emoji, recipe.name, undefined, "loss", 1, recipe.sprite);
        // Strip trailing tier suffix (_1…_5) to get the family key
        const familyKey = consumableId.replace(/_[1-5]$/, "");
        incrementStat(`used_${familyKey}` as AchievementStatKey);
      },
      {
        rollback: (c) => ({
          ...c,
          grid: c.grid.map((r, ri) =>
            r.map((p, ci) => ri === row && ci === col ? savedCell : p)
          ),
          consumables: savedConsumables,
        }),
      }
    );
  }

  // Shovel check — required to dig up any growing plant
  const hasShovel = (state.consumables ?? []).some((c) => c.id === "shovel" && c.quantity > 0);

  function handleRemove() {
    if (removing || !hasShovel) return;
    const cur = getState();
    const optimistic = removePlant(cur, row, col);
    if (!optimistic) return;
    setRemoving(true);
    // Fire feedback immediately — don't wait for server round-trip
    audioManager.playSfx("harvest");
    pushHarvestPopup(plant.speciesId, undefined, true);
    pushGenericToast("loss:shovel", "🥄", "Shovel", undefined, "loss");
    onClose?.();
    // Snapshot the cell + consumables for surgical rollback
    const savedCell        = cur.grid[row][col];
    const savedConsumables = cur.consumables;
    perform(
      optimistic,
      async () => {
        try {
          return await edgeRemovePlant(row, col);
        } finally {
          setRemoving(false);
        }
      },
      () => {},
      {
        rollback: (c) => ({
          ...c,
          grid: c.grid.map((r, ri) =>
            r.map((p, ci) => ri === row && ci === col ? savedCell : p)
          ),
          // Undo the seed that was optimistically added back
          inventory: c.inventory
            .map((i) =>
              i.speciesId === plant.speciesId && i.isSeed
                ? { ...i, quantity: i.quantity - 1 }
                : i
            )
            .filter((i) => i.quantity > 0),
          // Restore the shovel that was optimistically deducted
          consumables: savedConsumables,
        }),
      }
    );
  }

  return (
    <div
      ref={tooltipRef}
      className={`absolute ${flipped ? "top-full mt-2" : "bottom-full mb-2"} left-1/2 z-40 pointer-events-none`}
      style={{ transform: `translateX(calc(-50% + ${nudge}px))` }}
    >
      <div className="pointer-events-auto bg-card/80 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl w-48 space-y-2 max-h-[80vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-2">
          {(!isIdentified && isBloomed)
            ? <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-xl" imgSize="w-6 h-6" />
            : <FlowerSprite species={species} stage={!isIdentified ? "seed" : stage} textSize="text-xl" imgSize="w-6 h-6" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-tight">{!isIdentified ? "???" : species.name}</p>
            <p className={`text-[10px] font-mono ${rarity.color}`}>{rarity.label}</p>
            {isIdentified && <FlowerTypeBadges types={species.types} className="mt-1" />}
          </div>
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs flex-shrink-0 leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Stage: <span className="text-foreground capitalize">{stage}</span>
          </p>
          {!isBloomed && (
            <p>
              Next stage in:{" "}
              <span className={`font-mono inline-flex items-center gap-0.5 ${plant.masteredBonus ? "text-yellow-400" : "text-primary"}`}>
                {plant.masteredBonus && <ItemSprite emoji="⚡" sprite="/sprites/ui/mastery.png" name="Mastered" textSize="text-xs" imgSize="w-3.5 h-3.5" />}{formatMs(msLeft)}
              </span>
            </p>
          )}
          {plant.masteredBonus && (
            <p className="text-[10px] font-mono text-yellow-400 inline-flex items-center gap-1">
              <ItemSprite emoji="⚡" sprite="/sprites/ui/mastery.png" name="Mastered" textSize="text-[10px]" imgSize="w-3.5 h-3.5" />
              Mastered · 20% faster
            </p>
          )}
          {isBloomed && (
            <p className="text-primary font-semibold">Ready to harvest!</p>
          )}
          {/* Mutation display — only for identified bloomed plants */}
          {isBloomed && isIdentified && plant.mutation && (() => {
            const mut = MUTATIONS[plant.mutation];
            return (
              <p className={`text-[10px] font-mono ${mut.color} inline-flex items-center gap-1`}>
                <ItemSprite emoji={mut.emoji} sprite={mut.sprite} name={mut.emoji} textSize="text-[10px]" imgSize="w-3.5 h-3.5" />
                {mut.name} · ×{mut.valueMultiplier} value
              </p>
            );
          })()}
          {/* "No mutation" — only for identified bloomed plants */}
          {isBloomed && isIdentified && plant.mutation === null && (
            <p className="text-[10px] text-muted-foreground font-mono">No mutation</p>
          )}
          {/* Magnifying Glass used — species is revealed for this growing tile */}
          {plant.revealed && !isBloomed && (
            <p className="text-[10px] font-mono text-sky-400 flex items-center gap-0.5">
              <ItemSprite emoji="🔎" sprite="/sprites/consumables/magnifying_glass.png" name="Species revealed" textSize="text-[10px]" imgSize="w-3 h-3" />
              {" "}Species revealed
            </p>
          )}
          {/* Active consumable flags */}
          {plant.infused && (() => {
            const crossbreedActive = (
              [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]] as [number, number][]
            ).some(([r, c]) => {
              const g = state.grid[r]?.[c]?.gear;
              return g?.gearType === "cropsticks" && g.crossbreedStartedAt != null;
            });
            return (
              <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                <ItemSprite emoji="💉" sprite="/sprites/consumables/infuser.png" name="Infuser" textSize="text-[10px]" imgSize="w-3 h-3" />
                {crossbreedActive ? "Cross-breeding…" : "Infused · awaiting Cropsticks"}
              </p>
            );
          })()}
          {plant.heirloomActive && (
            <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
              <ItemSprite emoji="🔮" sprite="/sprites/consumables/heirloom_charm.png" name="Heirloom Charm" textSize="text-[10px]" imgSize="w-3 h-3" />
              {" "}Heirloom Charm active
            </p>
          )}
          {plant.forcedMutation === "giant" && (
            <p className="text-[10px] font-mono text-violet-400">🧬 Giant Force active</p>
          )}
        </div>

        {/* Plant-targeting consumables + infuser */}
        {(applicableConsumables.length > 0 || (isBloomed && !plant.infused && matchingInfuser)) && (
          <div className="pt-1 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-1">Use consumable</p>
            <div className="flex flex-wrap gap-1">
              {applicableConsumables.map((c) => {
                const recipe = CONSUMABLE_RECIPE_MAP[c.id as ConsumableId];
                if (!recipe) return null;
                const busy = applyingConsumable === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleUseConsumable(c.id)}
                    disabled={!!applyingConsumable}
                    title={`${recipe.name} — ${recipe.description}`}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] transition-colors disabled:opacity-50 ${
                      busy
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                    }`}
                  >
                    <ItemSprite emoji={recipe.emoji} sprite={recipe.sprite} name={recipe.name} textSize="text-[10px]" imgSize="w-3 h-3" />
                    {recipe.tier !== null && (
                      <span>{ROMAN[recipe.tier as 1|2|3|4|5]}</span>
                    )}
                    <span className="text-muted-foreground ml-0.5">×{c.quantity}</span>
                  </button>
                );
              })}
              {isBloomed && (!!plant.bloomedAt || plant.timePlanted === 0) && !plant.infused && matchingInfuser && (() => {
                const tier  = RARITY_TIER[matchingInfuser.rarity as keyof typeof RARITY_TIER] ?? 1;
                const roman = ROMAN[tier as 1|2|3|4|5];
                return (
                  <button
                    onClick={handleApplyAttunement}
                    disabled={!!applyingAttunement}
                    title={`Infuser ${roman} — Mark this bloom as a cross-breeding participant`}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] transition-colors disabled:opacity-50 ${
                      applyingAttunement
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    <ItemSprite emoji="💉" sprite="/sprites/consumables/infuser.png" name="Infuser" textSize="text-[10px]" imgSize="w-3 h-3" />
                    <span>{roman}</span>
                    <span className="text-muted-foreground ml-0.5">×{matchingInfuser.quantity}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* Bloomed / pinned actions — Harvest + Remove Pin + Attunement.
            Pinned plants surface "Remove Pin" instead of Harvest; the user must
            unpin first to actually take the bloom (pin is consumed). Unbloomed
            pinned plants also get the button so a misplaced pin can be undone.
            Cross-breeding plants show a lock message instead of Harvest. */}
        {(isBloomed || plant.pinned) && (
          <div className="pt-1 border-t border-border space-y-1.5">
            {plant.pinned ? (
              <button
                onClick={handleRemovePin}
                disabled={unpinning}
                title="Removes the Garden Pin (consumed). Required before harvesting."
                className="w-full py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors text-center disabled:opacity-50"
              >
                {unpinning ? "Removing…" : (
                  <span className="inline-flex items-center gap-0.5">
                    <ItemSprite emoji="📌" sprite="/sprites/ui/pin.png" name="Pin" textSize="text-xs" imgSize="w-3.5 h-3.5" />
                    {" "}Remove Pin
                  </span>
                )}
              </button>
            ) : isCrossBreeding ? (
              <p className="text-[11px] text-emerald-400/80 font-mono text-center py-0.5">
                🔗 Cross-breeding — harvest locked
              </p>
            ) : onHarvestRequest && (
              <button
                onClick={() => { onHarvestRequest(); onClose?.(); }}
                className="w-full py-1.5 rounded-lg bg-primary/20 border border-primary/50 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors text-center"
              >
                Harvest
              </button>
            )}

          </div>
        )}

        {/* Active gear effects */}
        {(isUnderSprinkler || isUnderAqueduct || sprinklerMutations.length > 0 || isUnderGrowLamp || isUnderScarecrow || isUnderComposter || isUnderFan || isUnderHarvestBell || isUnderLawnmower || !!balanceScaleSide || isUnderAegis) && (
          <div className="pt-1 border-t border-border space-y-1">
            <p className="text-[10px] text-muted-foreground">Active gear</p>

            {/* Chip labels */}
            <div className="flex flex-wrap gap-1">
              {isUnderGrowLamp && (
                <span className="relative inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/30 text-[10px] text-amber-300 overflow-hidden">
                  <div className="absolute inset-0 gear-lamp-glow pointer-events-none" />
                  <span className="relative"><ItemSprite emoji="💡" sprite="/sprites/gear/grow_lamp.png" name="Grow lamp" textSize="text-[10px]" imgSize="w-3 h-3" /></span>
                  <span className="relative">Grow lamp</span>
                </span>
              )}
              {isUnderAqueduct && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-400/10 border border-blue-400/20 text-[10px] text-blue-300">
                  <ItemSprite emoji="⛲" sprite="/sprites/gear/aqueduct.png" name="Aqueduct" textSize="text-[10px]" imgSize="w-3 h-3" /><span>Aqueduct</span>
                </span>
              )}
              {isUnderSprinkler && !isUnderAqueduct && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-400/10 border border-blue-400/20 text-[10px] text-blue-300">
                  <ItemSprite emoji="💧" sprite="/sprites/gear/sprinkler.png" name="Sprinkler" textSize="text-[10px]" imgSize="w-3 h-3" /><span>Sprinkler</span>
                </span>
              )}
              {sprinklerMutations.map(({ emoji, label, sprite }, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-400/10 border border-blue-400/20 text-[10px] text-blue-300">
                  <ItemSprite emoji={emoji} sprite={sprite} name={label} textSize="text-[10px]" imgSize="w-3 h-3" /><span>{label}</span>
                </span>
              ))}
              {isUnderScarecrow && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-400/10 border border-green-400/20 text-[10px] text-green-300">
                  <ItemSprite emoji="🧹" sprite="/sprites/gear/scarecrow.png" name="Scarecrow" textSize="text-[10px]" imgSize="w-3 h-3" /><span>Scarecrow</span>
                </span>
              )}
              {isUnderComposter && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-400/10 border border-green-400/20 text-[10px] text-green-300">
                  <ItemSprite emoji="🧺" sprite="/sprites/gear/composter.png" name="Composter" textSize="text-[10px]" imgSize="w-3 h-3" /><span>Composter</span>
                </span>
              )}
              {isUnderFan && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-stone-400/10 border border-stone-400/20 text-[10px] text-stone-300">
                  <ItemSprite emoji="💨" sprite="/sprites/gear/fan.png" name="Fan" textSize="text-[10px]" imgSize="w-3 h-3" /><span>Fan</span>
                </span>
              )}
              {isUnderHarvestBell && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-yellow-400/10 border border-yellow-400/20 text-[10px] text-yellow-300">
                  <ItemSprite emoji="🔔" sprite="/sprites/gear/harvest_bell.png" name="Harvest Bell" textSize="text-[10px]" imgSize="w-3 h-3" /><span>Harvest Bell</span>
                </span>
              )}
              {isUnderLawnmower && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-400/10 border border-green-400/20 text-[10px] text-green-300">
                  <ItemSprite emoji="🦼" sprite="/sprites/gear/lawnmower.png" name="Lawnmower" textSize="text-[10px]" imgSize="w-3 h-3" /><span>Lawnmower</span>
                </span>
              )}
              {balanceScaleSide === "boost" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/20 text-[10px] text-amber-300">
                  <ItemSprite emoji="⚖️" sprite="/sprites/gear/balance_scale.png" name="Balance Scale" textSize="text-[10px]" imgSize="w-3 h-3" />
                  <span>Scale boost</span>
                  {balanceScaleFlipMs !== undefined && (
                    <span className="text-amber-400/60 ml-0.5">· flips {formatMs(balanceScaleFlipMs)}</span>
                  )}
                </span>
              )}
              {balanceScaleSide === "slow" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-400/10 border border-slate-400/20 text-[10px] text-slate-400">
                  <ItemSprite emoji="⚖️" sprite="/sprites/gear/balance_scale.png" name="Balance Scale" textSize="text-[10px]" imgSize="w-3 h-3" />
                  <span>Scale slow</span>
                  {balanceScaleFlipMs !== undefined && (
                    <span className="text-slate-400/60 ml-0.5">· flips {formatMs(balanceScaleFlipMs)}</span>
                  )}
                </span>
              )}
              {isUnderAegis && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-sky-400/10 border border-sky-400/30 text-[10px] text-sky-300">
                  <ItemSprite emoji="🛡️" sprite="/sprites/gear/aegis.png" name="Aegis" textSize="text-[10px]" imgSize="w-3 h-3" /><span>Aegis</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fertilizer section */}
        {!isBloomed && (
          <div className="pt-1 border-t border-border">
            {hasFertilizer ? (
              <p className="text-[10px] text-green-400 font-mono flex items-center gap-1">
                <ItemSprite
                  emoji={FERTILIZERS[plant.fertilizer!].emoji}
                  sprite={FERTILIZERS[plant.fertilizer!].sprite}
                  name={FERTILIZERS[plant.fertilizer!].name}
                  textSize="text-[10px]"
                  imgSize="w-3 h-3"
                />
                {FERTILIZERS[plant.fertilizer!].name} applied
              </p>
            ) : availableFerts.length > 0 ? (
              <>
                <button
                  onClick={() => setShowFertPicker((v) => !v)}
                  className="text-[10px] text-primary hover:underline w-full text-left"
                >
                  + Apply fertilizer
                </button>
                {showFertPicker && (
                  <div className="mt-1.5 space-y-1">
                    {availableFerts.map((f) => (
                      <button
                        key={f.type}
                        onClick={() => handleApplyFertilizer(f.type)}
                        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                      >
                        <ItemSprite emoji={FERTILIZERS[f.type].emoji} sprite={FERTILIZERS[f.type].sprite} name={FERTILIZERS[f.type].name} textSize="text-[10px]" imgSize="w-3 h-3" />
                        <span className="text-[10px] text-foreground">
                          {FERTILIZERS[f.type].name}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          ×{f.quantity}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">No fertilizer available</p>
            )}
          </div>
        )}

        {/* Remove section — only for growing (non-bloomed), non-pinned plants.
            Pinned plants are protected; the pin must be removed first. */}
        {!isBloomed && (
          <div className="pt-1 border-t border-border">
            {plant.pinned ? (
              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <ItemSprite emoji="📌" sprite="/sprites/ui/pin.png" name="Pin" textSize="text-[10px]" imgSize="w-3 h-3" />
                {" "}Remove Pin first to dig up
              </p>
            ) : !hasShovel ? (
              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <ItemSprite emoji="🥄" sprite="/sprites/consumables/shovel.png" name="Shovel" textSize="text-[10px]" imgSize="w-3 h-3" />
                {" "}Need a Shovel to dig up
              </p>
            ) : confirmRemove ? (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Uses 1 Shovel. Seed returned. Sure?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleRemove}
                    disabled={removing}
                    className="flex-1 text-[10px] py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40 text-center"
                  >
                    {removing ? "Removing..." : "Yes, remove"}
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 text-[10px] py-1 rounded-lg bg-card border border-border text-muted-foreground hover:border-primary/30 transition-colors text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowFertPicker(false); setConfirmRemove(true); }}
                className="text-[10px] text-red-400 hover:text-red-300 transition-colors w-full text-left"
              >
                🥄 Remove plant
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
