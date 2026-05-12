import React, { useState, useRef, useEffect } from "react";
import {
  type Plot,
  type PlantedFlower,
  getCurrentStage,
  getStageProgress,
  getPassiveGrowthMultiplier,
  getEffectiveGrowthMultiplier,
  getBoostMultiplier,
  harvestPlant,
} from "../store/gameStore";
import { getFlower, RARITY_CONFIG, MUTATIONS, type MutationType } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import { WEATHER } from "../data/weather";
import type { WeatherType } from "../data/weather";
import { GEAR, isGearExpired, CROPSTICKS_BREED_DURATION_MS, type FanDirection } from "../data/gear";
import { PlotTooltip } from "./PlotTooltip";
import { GearTooltip } from "./GearTooltip";
import { FlowerSprite } from "./FlowerSprite";
import { ItemSprite } from "./ItemSprite";
import { useGame } from "../store/GameContext";
import { useSettings } from "../store/SettingsContext";
import { edgeHarvest } from "../lib/edgeFunctions";
import { useDailyProgress } from "../hooks/useDailyProgress";
import { audioManager } from "../lib/audioManager";

const WEATHER_MUT_LABEL: Partial<Record<WeatherType, string>> = {
  rain:            "wet",
  heatwave:        "scorched",
  cold_front:      "frozen",
  star_shower:     "moonlit",
  prismatic_skies: "rainbow",
  golden_hour:     "golden",
  tornado:         "windstruck",
  thunderstorm:    "→⚡ shocked",
};

interface Props {
  plot:            Plot;
  row:             number;
  col:             number;
  onEmptyClick:    () => void;
  onHarvest:       (speciesId: string, mutation?: MutationType, isBloomPlaced?: boolean, heirloomActive?: boolean) => void;
  onHarvestStart?: () => void;
  onHarvestEnd?:   () => void;
  /** Called at click time to check if this plot is already queued by Collect All. */
  harvestPending?: () => boolean;
  isSelected?:     boolean;
  /** True when this cell is within the radius of an inspected gear item. */
  isHighlighted?:  boolean;
  /** True when this cell is covered by at least one active regular (growth) sprinkler. */
  isUnderSprinkler?: boolean;
  /** True when this cell is covered by an active Aqueduct (displayed instead of sprinkler 💧). */
  isUnderAqueduct?: boolean;
  /** Mutation sprinklers covering this cell — emoji for display, label for tooltip. */
  sprinklerMutations?: { emoji: string; label: string; sprite?: string }[];
  /** True when this cell is within a scarecrow's radius. */
  isUnderScarecrow?: boolean;
  /** True when this cell is within a composter's radius. */
  isUnderComposter?: boolean;
  /** True when this cell is within a grow lamp's radius. */
  isUnderGrowLamp?: boolean;
  /** True when this cell is within a fan's range. */
  isUnderFan?: boolean;
  /** Direction the fan covering this cell is blowing. */
  fanDirection?: FanDirection;
  /** True when this cell is within a harvest bell's radius. */
  isUnderHarvestBell?: boolean;
  /** True when this cell is within a lawnmower's range. */
  isUnderLawnmower?: boolean;
  /** Direction the lawnmower covering this cell is facing. */
  lawnmowerDirection?: FanDirection;
  /** "boost" (3×) or "slow" (0.5×) — set when this cell is covered by a Balance Scale. */
  balanceScaleSide?: "boost" | "slow";
  /** True when this cell is within an auto-planter's radius. */
  isUnderAutoPlanter?: boolean;
  /** True when this cell is shielded by an active Aegis. */
  isUnderAegis?: boolean;
  /** Direction a crossbreed particle should travel (toward the active cropsticks). */
  crossbreedDirection?: "up" | "down" | "left" | "right";
  /** True when this plant is actively serving as a Cropsticks cross-breed source — blocks manual harvest. */
  isCrossBreeding?: boolean;
  /** Called when this cell's gear tooltip opens — lets Garden highlight affected cells. */
  onGearInspect?:      (row: number, col: number, gearType: import("../data/gear").GearType) => void;
  onGearInspectClose?: () => void;
  cellSize?:       string;
  showGrowthDebug?: boolean;
}

export function PlotTile({
  plot, row, col,
  onEmptyClick, onHarvest, onHarvestStart, onHarvestEnd, harvestPending,
  isSelected, isHighlighted,
  isUnderSprinkler, isUnderAqueduct, sprinklerMutations = [],
  isUnderScarecrow, isUnderComposter, isUnderGrowLamp,
  isUnderFan, fanDirection, isUnderHarvestBell, isUnderLawnmower, lawnmowerDirection, balanceScaleSide, isUnderAutoPlanter, isUnderAegis,
  crossbreedDirection, isCrossBreeding = false,
  onGearInspect, onGearInspectClose,
  cellSize = "w-16 h-16",
  showGrowthDebug = false,
}: Props) {
  const { state, perform, getState, activeWeather, reloadFromCloud } = useGame();
  const { settings } = useSettings();
  const now    = Date.now();
  const plant  = plot.plant;
  const gear   = plot.gear;
  const species = plant ? getFlower(plant.speciesId) : null;
  const { trackProgress } = useDailyProgress();

  // gearMult already folds Verdant Rush in so PlotTooltip downstream gets the
  // combined multiplier without needing a separate prop for activeBoosts.
  // Use the time-weighted multiplier so the live progress bar doesn't jump when
  // a gear expires mid-delta (between the last stamp and this render).
  const passiveMult = plant
    ? getEffectiveGrowthMultiplier(
        getState().grid, row, col,
        (plant as PlantedFlower).lastTickAt ?? now,  // from: last saved checkpoint
        now,                                          // to:   current render time
      )
    : 1.0;
  const boostMult   = plant ? getBoostMultiplier(getState().activeBoosts, "growth", now) : 1.0;
  const gearMult    = passiveMult * boostMult;
  // Full multiplier shown on the ruler badge — mirrors computeGrowthMs so the
  // displayed number matches actual growth speed (gear × Verdant Rush × fert ×
  // weather × mastered).
  const rulerMult = plant ? (() => {
    const fMult = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1;
    const mMult = (plant as PlantedFlower).masteredBonus ?? 1;
    const wMult = WEATHER[activeWeather as WeatherType]?.growthMultiplier ?? 1;
    return gearMult * fMult * mMult * wMult;
  })() : gearMult;
  const stage    = plant ? getCurrentStage(plant, now, activeWeather, gearMult) : null;
  const progress = plant ? getStageProgress(plant, now, activeWeather, gearMult) : 0;

  const rarity     = species ? RARITY_CONFIG[species.rarity] : null;
  const isBloomed  = stage === "bloom";
  // A plant is "identified" (species known) if it's already in the codex (harvested
  // before) OR the player used a Magnifying Glass on this specific tile.
  const isIdentified = plant
    ? (state.discovered.includes(plant.speciesId) || !!plant.revealed)
    : false;
  const hasFert    = !!plant?.fertilizer;

  const debugTotalMult = showGrowthDebug && plant ? (() => {
    const gMult = getPassiveGrowthMultiplier(getState().grid, row, col, now);
    const fMult = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1;
    const mMult = (plant as PlantedFlower).masteredBonus ?? 1;
    const wMult = WEATHER[activeWeather as WeatherType]?.growthMultiplier ?? 1;
    return fMult * mMult * wMult * gMult;
  })() : null;

  const [open,     setOpen]     = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  // Force a 1s re-render while a cropsticks cycle is active so the progress
  // bar visually advances even when no other state changes are happening
  // (a fully-bloomed garden with cropsticks doesn't tick anything else).
  const [, forceTick] = useState(0);
  const cropsticksActive =
    plot.gear?.gearType === "cropsticks" && plot.gear.crossbreedStartedAt != null;
  const cropsticksComplete =
    cropsticksActive &&
    (now - (plot.gear!.crossbreedStartedAt as number)) >= CROPSTICKS_BREED_DURATION_MS;
  useEffect(() => {
    if (!cropsticksActive) return;
    const id = setInterval(() => forceTick((n) => (n + 1) & 0xffff), 1_000);
    return () => clearInterval(id);
  }, [cropsticksActive]);
  // When the progress bar hits 100%, poll the server every 10 s until the tick
  // has replaced the cropsticks with a seed (cropsticksActive becomes false).
  useEffect(() => {
    if (!cropsticksComplete) return;
    reloadFromCloud();
    const id = setInterval(() => reloadFromCloud(), 10_000);
    return () => clearInterval(id);
  }, [cropsticksComplete]);
  const tileRef       = useRef<HTMLDivElement>(null);
  const harvestingRef = useRef(false);

  useEffect(() => {
    if (!open && !gearOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (tileRef.current && !tileRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (gearOpen) { setGearOpen(false); onGearInspectClose?.(); }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, gearOpen]);

  useEffect(() => { if (!plant) setOpen(false); }, [plant]);
  useEffect(() => {
    // Only touch local state here — calling onGearInspectClose (Garden's setState) from a
    // child effect triggers React 18's "update while rendering" warning in concurrent mode.
    // Garden watches for stale highlightSource itself (see Garden.tsx).
    if (!gear) setGearOpen(false);
  }, [gear]);

  function handleHarvest() {
    if (!plant) return;
    if (isCrossBreeding) return;
    if (harvestingRef.current) return;
    if (harvestPending?.()) return;
    const currentState = getState();
    const optimistic   = harvestPlant(currentState, row, col, activeWeather);
    if (optimistic) {
      const savedCell         = currentState.grid[row][col];
      const harvestedSpecies  = savedCell.plant?.speciesId;
      const harvestedMutation = savedCell.plant?.mutation ?? undefined;
      harvestingRef.current = true;
      onHarvestStart?.();
      audioManager.playSfx(harvestedMutation ? "mutation" : "harvest");
      onHarvest(plant.speciesId, optimistic.mutation, savedCell.plant?.timePlanted === 0, savedCell.plant?.heirloomActive);
      perform(
        optimistic.state,
        async () => {
          try { return await edgeHarvest(row, col); }
          finally {
            harvestingRef.current = false;
            onHarvestEnd?.();
          }
        },
        () => { void trackProgress("harvest"); },
        {
          serialize: true,
          rollback: (cur) => ({
            ...cur,
            grid: cur.grid.map((r, ri) =>
              r.map((p, ci) => ri === row && ci === col ? savedCell : p)
            ),
            inventory: harvestedSpecies
              ? cur.inventory
                  .map((item) =>
                    item.speciesId === harvestedSpecies &&
                    item.mutation  === harvestedMutation &&
                    !item.isSeed
                      ? { ...item, quantity: item.quantity - 1 }
                      : item
                  )
                  .filter((item) => item.quantity > 0)
              : cur.inventory,
          }),
        }
      );
      setOpen(false);
    }
  }

  function handleClick() {
    if (!plant) { onEmptyClick(); return; }
    setOpen((v) => !v);
  }

  // ── Gear tile ──────────────────────────────────────────────────────────────
  if (gear) {
    const def         = GEAR[gear.gearType];
    const gearRarity  = RARITY_CONFIG[def.rarity];
    const expired     = isGearExpired(gear, now);
    const storedCount = gear.storedFertilizers?.length ?? 0;

    const expiryProgress = def.durationMs
      ? Math.max(0, (gear.placedAt + def.durationMs - now) / def.durationMs)
      : null;

    // Cropsticks cross-breed progress (0..1) — ticks deterministically from
    // crossbreedStartedAt over CROPSTICKS_BREED_DURATION_MS. Replaces the old
    // hourly RNG roll with a visible bar.
    const cropProgress: number | null =
      def.passiveSubtype === "cropsticks" && gear.crossbreedStartedAt != null
        ? Math.min(1, Math.max(0, (now - gear.crossbreedStartedAt) / CROPSTICKS_BREED_DURATION_MS))
        : null;

    // Prismatic uses "rainbow-text" and Exalted uses "text-black" — both need manual mapping
    const gearBarBg = gearRarity.color === "rainbow-text"
      ? "bg-gradient-to-r from-pink-400 via-violet-400 to-sky-400"
      : gearRarity.color === "text-black"
        ? "bg-slate-300"
        : gearRarity.color.replace("text-", "bg-");

    // Prismatic gear: drive all three rainbow animations via inline style so CSS cascade
    // order doesn't matter (inline style wins over any class-based `animation` shorthand).
    const prismaticGearStyle: React.CSSProperties | undefined = def.rarity === "prismatic"
      ? { animation: "rainbow-border-cycle 3s linear infinite, rainbow-bg-cycle 3s linear infinite, rainbow-glow-cycle 3s linear infinite" }
      : undefined;

    return (
      <div ref={tileRef} className="relative">
        {gearOpen && (
          <GearTooltip
            gear={gear}
            row={row}
            col={col}
            onClose={() => { setGearOpen(false); onGearInspectClose?.(); }}
          />
        )}
        <button
          onClick={() => {
            const next = !gearOpen;
            setGearOpen(next);
            if (next) onGearInspect?.(row, col, gear.gearType);
            else      onGearInspectClose?.();
          }}
          style={prismaticGearStyle}
          className={`
            relative ${cellSize} rounded-xl border-2 transition-[transform,opacity] duration-200
            flex flex-col items-center justify-center
            ${gearOpen
              ? `${gearRarity.borderBloom} ${gearRarity.bgBloom} scale-105`
              : `${gearRarity.borderBloom} ${gearRarity.bgBloom} hover:scale-105 hover:brightness-110 ${gearRarity.glow}`
            }
            ${expired ? "opacity-50" : ""}
            ${isHighlighted ? "ring-2 ring-primary/60" : ""}
          `}
          title={`${def.name} — ${def.rarity} — Click to inspect`}
        >
          <ItemSprite emoji={def.emoji} sprite={def.sprite} name={def.name} textSize="text-2xl" imgSize="w-7 h-7" />

          {/* Mutation badge overlay */}
          {def.category === "sprinkler_mutation" && def.mutationType && (
            <span className="absolute -bottom-1 -right-1 leading-none">
              <ItemSprite
                emoji={MUTATIONS[def.mutationType].emoji}
                sprite={MUTATIONS[def.mutationType].sprite}
                name={MUTATIONS[def.mutationType].emoji}
                textSize="text-sm" imgSize="w-4 h-4"
              />
            </span>
          )}

          {/* Expiry progress bar */}
          {expiryProgress !== null && !expired && (
            <div className="absolute bottom-1 left-2 right-2 h-1 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${gearBarBg}`}
                style={{ width: `${expiryProgress * 100}%` }}
              />
            </div>
          )}

          {/* Cropsticks cross-breed progress (deterministic — replaces RNG) */}
          {cropProgress !== null && (
            <div
              className="absolute bottom-1 left-2 right-2 h-1 bg-border rounded-full overflow-hidden"
              title={`Cross-breeding · ${Math.floor(cropProgress * 100)}%`}
            >
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${cropProgress * 100}%`, transition: "width 1s linear" }}
              />
            </div>
          )}

          {/* Composter stored count badge */}
          {def.passiveSubtype === "composter" && storedCount > 0 && (
            <span className="absolute top-0.5 right-0.5 text-[9px] font-mono font-bold text-primary leading-none">
              {storedCount}
            </span>
          )}

          {/* Highlighted ring overlay */}
          {isHighlighted && (
            <div className="absolute inset-0 rounded-xl bg-primary/10 pointer-events-none" />
          )}
        </button>
      </div>
    );
  }

  // ── Empty tile ─────────────────────────────────────────────────────────────
  if (!plant) {
    return (
      <div className="relative">
        <button
          onClick={onEmptyClick}
          className={`
            ${cellSize} rounded-xl border-2 transition-all duration-200
            flex items-center justify-center
            ${isSelected
              ? "border-primary bg-primary/20 scale-105"
              : "border-border bg-card/40 hover:bg-card/80 hover:border-primary/50 hover:scale-105"
            }
            ${isHighlighted ? "ring-2 ring-primary/60 bg-primary/10" : ""}
          `}
          title="Empty plot"
        >
          <span className="text-2xl opacity-30">＋</span>
          {isHighlighted && (
            <div className="absolute inset-0 rounded-xl bg-primary/10 pointer-events-none" />
          )}
        </button>
      </div>
    );
  }

  // ── Plant tile ─────────────────────────────────────────────────────────────
  return (
    <div ref={tileRef} className="relative">
      {open && (
        <PlotTooltip
          plant={plant}
          row={row}
          col={col}
          onClose={() => setOpen(false)}
          onHarvestRequest={isBloomed ? handleHarvest : undefined}
          isCrossBreeding={isCrossBreeding}
          gearGrowthMultiplier={gearMult}
          isUnderSprinkler={isUnderSprinkler}
          isUnderAqueduct={isUnderAqueduct}
          sprinklerMutations={sprinklerMutations}
          isUnderGrowLamp={isUnderGrowLamp}
          isUnderScarecrow={isUnderScarecrow}
          isUnderComposter={isUnderComposter}
          isUnderFan={isUnderFan}
          isUnderHarvestBell={isUnderHarvestBell}
          isUnderLawnmower={isUnderLawnmower}
          balanceScaleSide={balanceScaleSide}
          isUnderAegis={isUnderAegis}
        />
      )}

      <button
        onClick={handleClick}
        style={isBloomed && species?.rarity === "prismatic"
          ? { animation: "rainbow-border-cycle 3s linear infinite, rainbow-bg-cycle 3s linear infinite, rainbow-glow-cycle 3s linear infinite" }
          : undefined
        }
        className={`
          relative ${cellSize} rounded-xl border-2 transition-all duration-200
          flex flex-col items-center justify-center gap-0.5
          ${isBloomed
            ? `${rarity?.borderBloom ?? "border-primary/60"} ${rarity?.bgBloom ?? "bg-primary/10"} hover:scale-110 hover:brightness-125 cursor-pointer ${rarity?.glow}`
            : open
            ? `${rarity?.borderGrowing ?? "border-border/60"} bg-card/80 scale-105`
            : `${rarity?.borderGrowing ?? "border-border/60"} bg-card/60 hover:bg-card/80 cursor-pointer`
          }
          ${plant.infused ? "ring-2 ring-emerald-400/60" : isHighlighted ? "ring-2 ring-primary/40" : ""}
        `}
        title={
          isBloomed
            ? `${species?.name} — ${plant.infused ? "Infused 💉 · " : ""}Tap for options`
            : open
            ? "Click to close"
            : `${isIdentified ? species?.name : "???"} — Click for options`
        }
      >
        {/* ── Gear ambient animation overlay (clipped to cell) ── */}
        {settings.plotAnimations && !isCrossBreeding && (isUnderSprinkler || isUnderAqueduct || sprinklerMutations.length > 0 || isUnderGrowLamp || isUnderScarecrow || isUnderComposter || isUnderFan || isUnderAutoPlanter || isUnderHarvestBell || isUnderLawnmower || !!balanceScaleSide || isUnderAegis) && (
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            {/* Grow lamp: warm amber glow */}
            {isUnderGrowLamp && <div className="absolute inset-0 gear-lamp-glow" />}
            {/* Sprinkler: 💧 drops falling */}
            {isUnderSprinkler && !isUnderAqueduct && (
              <>
                <span className="gear-drop" style={{ left: "15%", animationDelay: "-1.2s" }}>💧</span>
                <span className="gear-drop" style={{ left: "48%", animationDelay: "-0.6s" }}>💧</span>
                <span className="gear-drop" style={{ left: "74%", animationDelay: "0s"    }}>💧</span>
              </>
            )}
            {/* Aqueduct: 💧 drops falling (same water animation, takes priority over sprinkler) */}
            {isUnderAqueduct && (
              <>
                <span className="gear-drop" style={{ left: "15%", animationDelay: "-1.2s" }}>💧</span>
                <span className="gear-drop" style={{ left: "48%", animationDelay: "-0.6s" }}>💧</span>
                <span className="gear-drop" style={{ left: "74%", animationDelay: "0s"    }}>💧</span>
              </>
            )}
            {/* Mutation sprinkler: mutation sprite floating up, 2 per mutation type */}
            {sprinklerMutations.flatMap(({ emoji, sprite }, mi) => [
              <span key={`m${mi}a`} className="gear-float" style={{ left: `${16 + mi * 28}%`, animationDelay: `${mi * 0.5 - 2}s`   }}><ItemSprite emoji={emoji} sprite={sprite} name={emoji} textSize="text-sm" imgSize="w-4 h-4" /></span>,
              <span key={`m${mi}b`} className="gear-float" style={{ left: `${40 + mi * 28}%`, animationDelay: `${mi * 0.5 - 0.9}s` }}><ItemSprite emoji={emoji} sprite={sprite} name={emoji} textSize="text-sm" imgSize="w-4 h-4" /></span>,
            ])}
            {/* Scarecrow: 🐦 birds fluttering away */}
            {isUnderScarecrow && (
              <>
                <span className="gear-bird" style={{ left: "10%", animationDelay: "-1.5s" }}>🐦</span>
                <span className="gear-bird" style={{ left: "52%", animationDelay: "0s"    }}>🐦</span>
              </>
            )}
            {/* Composter: ✦ sparkles rising */}
            {isUnderComposter && (
              <>
                <span className="gear-compost-spark" style={{ left: "18%", animationDelay: "-1.5s"  }}>✦</span>
                <span className="gear-compost-spark" style={{ left: "50%", animationDelay: "-0.75s" }}>✦</span>
                <span className="gear-compost-spark" style={{ left: "76%", animationDelay: "0s"     }}>✦</span>
              </>
            )}
            {/* Auto-Planter: 🌱 seeds gently drifting down */}
            {isUnderAutoPlanter && (
              <>
                <span className="gear-planter-seed" style={{ left: "20%", animationDelay: "-1.6s" }}><ItemSprite emoji="🌱" sprite="/sprites/flowers/seed.png" name="seed" textSize="text-sm" imgSize="w-4 h-4" /></span>
                <span className="gear-planter-seed" style={{ left: "52%", animationDelay: "-0.8s" }}><ItemSprite emoji="🌱" sprite="/sprites/flowers/seed.png" name="seed" textSize="text-sm" imgSize="w-4 h-4" /></span>
                <span className="gear-planter-seed" style={{ left: "76%", animationDelay: "0s"    }}><ItemSprite emoji="🌱" sprite="/sprites/flowers/seed.png" name="seed" textSize="text-sm" imgSize="w-4 h-4" /></span>
              </>
            )}
            {/* Harvest Bell: 🔔 bell sways upward hinting at auto-harvest */}
            {isUnderHarvestBell && (
              <>
                <span className="gear-bell" style={{ left: "18%", animationDelay: "-2.2s" }}><ItemSprite emoji="🔔" sprite="/sprites/gear/harvest_bell.png" name="Harvest Bell" textSize="text-sm" imgSize="w-4 h-4" /></span>
                <span className="gear-bell" style={{ left: "52%", animationDelay: "-1.1s" }}><ItemSprite emoji="🔔" sprite="/sprites/gear/harvest_bell.png" name="Harvest Bell" textSize="text-sm" imgSize="w-4 h-4" /></span>
                <span className="gear-bell" style={{ left: "74%", animationDelay: "0s"    }}><ItemSprite emoji="🔔" sprite="/sprites/gear/harvest_bell.png" name="Harvest Bell" textSize="text-sm" imgSize="w-4 h-4" /></span>
              </>
            )}
            {/* Lawnmower: 🍃 clippings tumble in the mower's direction */}
            {isUnderLawnmower && (() => {
              const dir   = lawnmowerDirection ?? "right";
              const cls   = `gear-mow-${dir}`;
              const horiz = dir === "left" || dir === "right";
              const axis  = horiz ? "top" : "left";
              return (["18%", "50%", "76%"] as const).map((pos, i) => (
                <span key={i} className={cls} style={{ [axis]: pos, animationDelay: `${i * 0.6 - 1.2}s` }}>🍃</span>
              ));
            })()}
            {/* Balance Scale: ✦ boost side rises (amber), ▾ slow side drifts down (gray) */}
            {balanceScaleSide === "boost" && (
              <>
                <span className="gear-scale-boost" style={{ left: "18%", animationDelay: "-1.2s" }}>✦</span>
                <span className="gear-scale-boost" style={{ left: "50%", animationDelay: "-0.5s" }}>✦</span>
                <span className="gear-scale-boost" style={{ left: "76%", animationDelay: "0s"    }}>✦</span>
              </>
            )}
            {balanceScaleSide === "slow" && (
              <>
                <span className="gear-scale-slow" style={{ left: "18%", animationDelay: "-1.6s" }}>▾</span>
                <span className="gear-scale-slow" style={{ left: "50%", animationDelay: "-0.8s" }}>▾</span>
                <span className="gear-scale-slow" style={{ left: "76%", animationDelay: "0s"    }}>▾</span>
              </>
            )}
            {/* Aegis: shields rising — weather mutations blocked */}
            {isUnderAegis && (
              <>
                <span className="gear-aegis-shield" style={{ left: "15%", animationDelay: "-1.8s" }}><ItemSprite emoji="🛡️" sprite="/sprites/gear/aegis.png" name="Aegis" textSize="text-sm" imgSize="w-4 h-4" /></span>
                <span className="gear-aegis-shield" style={{ left: "50%", animationDelay: "-0.9s" }}><ItemSprite emoji="🛡️" sprite="/sprites/gear/aegis.png" name="Aegis" textSize="text-sm" imgSize="w-4 h-4" /></span>
                <span className="gear-aegis-shield" style={{ left: "76%", animationDelay: "0s"    }}><ItemSprite emoji="🛡️" sprite="/sprites/gear/aegis.png" name="Aegis" textSize="text-sm" imgSize="w-4 h-4" /></span>
              </>
            )}
            {/* Fan: 💨 gusts drifting in the fan's direction */}
            {isUnderFan && (() => {
              const dir  = fanDirection ?? "right";
              const cls  = `gear-wind-${dir}`;
              const horiz = dir === "left" || dir === "right";
              const axis  = horiz ? "top" : "left";
              return (["18%", "50%", "76%"] as const).map((pos, i) => (
                <span key={i} className={cls} style={{ [axis]: pos, animationDelay: `${i * 0.65 - 1.3}s` }}>💨</span>
              ));
            })()}
          </div>
        )}

        {/* Verdant Rush overlay — green sparkles while active growth boost is running */}
        {settings.plotAnimations && boostMult > 1 && !isBloomed && (
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            <div className="absolute inset-0 boost-verdant-glow" />
            <span className="boost-verdant-spark" style={{ left: "15%", animationDelay: "-1.3s" }}>✦</span>
            <span className="boost-verdant-spark" style={{ left: "50%", animationDelay: "-0.6s" }}>✦</span>
            <span className="boost-verdant-spark" style={{ left: "78%", animationDelay: "0s"    }}>✦</span>
          </div>
        )}

        {/* Crossbreed particle overlay — emerald dots drift toward adjacent cropsticks */}
        {settings.plotAnimations && !!crossbreedDirection && (
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            {(["0s", "-0.55s", "-1.1s"] as const).map((delay, i) => {
              const horiz = crossbreedDirection === "left" || crossbreedDirection === "right";
              return (
                <div
                  key={i}
                  className="cross-particle"
                  style={{
                    animationName: `cross-particle-${crossbreedDirection}`,
                    animationDuration: "1.4s",
                    animationDelay: delay,
                    // Spread perpendicular to the travel axis so the 3 dots
                    // form distinct lanes rather than stacking on one line.
                    left: horiz ? "42%" : `${20 + i * 22}%`,
                    top:  horiz ? `${20 + i * 22}%` : "42%",
                  }}
                />
              );
            })}
          </div>
        )}

        {species && (isIdentified || isBloomed) ? (
          <FlowerSprite
            species={species}
            stage={stage!}
            textSize="text-xl sm:text-2xl"
            imgSize="w-7 h-7 sm:w-9 sm:h-9"
            className={settings.plotMutationVfx && isBloomed && (plant as PlantedFlower).mutation && species?.rarity !== "prismatic"
              ? MUTATIONS[(plant as PlantedFlower).mutation!].vfxClass
              : ""}
          />
        ) : (
          settings.useSprites
            ? <img src="/sprites/flowers/seed.png" alt="🌱" className="w-7 h-7 sm:w-9 sm:h-9 object-contain" style={{ imageRendering: "pixelated" }} />
            : <span className="text-2xl leading-none">🌱</span>
        )}

        {/* Fertilizer indicator — top-left */}
        {settings.plotFertilizerIndicator && hasFert && !isBloomed && (
          <span className="absolute top-0.5 left-0.5 leading-none">
            <ItemSprite
              emoji={FERTILIZERS[(plant as PlantedFlower).fertilizer!].emoji}
              sprite={FERTILIZERS[(plant as PlantedFlower).fertilizer!].sprite}
              name={FERTILIZERS[(plant as PlantedFlower).fertilizer!].name}
              textSize="text-[10px]"
              imgSize="w-3 h-3"
            />
          </span>
        )}

        {/* ⚡ Mastery bonus indicator — top-right */}
        {settings.plotMasteryIndicator && (plant as PlantedFlower).masteredBonus && (
          <span
            className="absolute top-0.5 right-0.5 leading-none text-yellow-400"
            title="Mastered — grows 20% faster"
          >
            <ItemSprite emoji="⚡" sprite="/sprites/ui/mastery.png" name="Mastered" textSize="text-[10px]" imgSize="w-3 h-3" />
          </span>
        )}

        {/* Gear effect indicators — bottom-left row */}
        {settings.plotGearIndicator && (isUnderSprinkler || isUnderAqueduct || sprinklerMutations.length > 0 || isUnderScarecrow || isUnderComposter || isUnderGrowLamp || isUnderFan || isUnderHarvestBell || isUnderLawnmower || !!balanceScaleSide || isUnderAegis || plant.infused || plant.revealed || plant.showMultiplier) && (
          <div className={`absolute left-0.5 flex leading-none ${isBloomed ? "bottom-1" : "bottom-2.5"}`}>
            {isUnderAqueduct && <ItemSprite emoji="⛲" sprite="/sprites/gear/aqueduct.png" name="Under aqueduct" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {isUnderSprinkler && !isUnderAqueduct && <ItemSprite emoji="💧" sprite="/sprites/gear/sprinkler.png" name="Under sprinkler" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {sprinklerMutations.map(({ emoji, label, sprite }, i) => (
              <ItemSprite key={i} emoji={emoji} sprite={sprite} name={label} textSize="text-[9px]" imgSize="w-3 h-3" />
            ))}
            {isUnderScarecrow && <ItemSprite emoji="🧹" sprite="/sprites/gear/scarecrow.png" name="Under scarecrow" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {isUnderComposter && <ItemSprite emoji="🧺" sprite="/sprites/gear/composter.png" name="Near composter" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {isUnderGrowLamp && <ItemSprite emoji="💡" sprite="/sprites/gear/grow_lamp.png" name="Under grow lamp" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {isUnderFan && <ItemSprite emoji="💨" sprite="/sprites/gear/fan.png" name="In fan range" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {isUnderHarvestBell && <ItemSprite emoji="🔔" sprite="/sprites/gear/harvest_bell.png" name="Auto-harvest active" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {isUnderLawnmower && <ItemSprite emoji="🦼" sprite="/sprites/gear/lawnmower.png" name="Lawnmower" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {isUnderAegis && <ItemSprite emoji="🛡️" sprite="/sprites/gear/aegis.png" name="Aegis" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {balanceScaleSide === "boost" && <ItemSprite emoji="⚖️" sprite="/sprites/gear/balance_scale.png" name="Balance Scale — 3× growth boost" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {balanceScaleSide === "slow"  && <ItemSprite emoji="⚖️" sprite="/sprites/gear/balance_scale.png" name="Balance Scale — 0.5× growth penalty" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {plant.infused && <ItemSprite emoji="💉" sprite="/sprites/consumables/infuser.png" name="Infused" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {plant.revealed && <ItemSprite emoji="🔎" sprite="/sprites/consumables/magnifying_glass.png" name="Species revealed" textSize="text-[9px]" imgSize="w-3 h-3" />}
            {plant.showMultiplier && <ItemSprite emoji="📏" sprite="/sprites/consumables/ruler.png" name={`Ruler — ${rulerMult.toFixed(2)}× total growth`} textSize="text-[9px]" imgSize="w-3 h-3" />}
          </div>
        )}

        {/* Ruler multiplier badge — top-center, amber, permanent once applied */}
        {plant.showMultiplier && !isBloomed && (
          <div className="absolute top-0.5 inset-x-0 flex justify-center pointer-events-none z-10">
            <span className="bg-amber-500/20 border border-amber-500/25 rounded px-0.5 text-[7px] font-mono leading-tight text-amber-300 whitespace-nowrap">
              {rulerMult.toFixed(2)}×
            </span>
          </div>
        )}

        {/* Progress bar — bottom */}
        {!isBloomed && (
          <div className="absolute bottom-1 left-2 right-2 h-1 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                hasFert ? "bg-green-400" : "bg-primary"
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {/* Growth debug overlay — dev only */}
        {debugTotalMult !== null && (
          <div className="absolute top-0.5 inset-x-0 flex justify-center pointer-events-none z-20">
            <span className="bg-black/75 rounded px-0.5 text-[7px] font-mono leading-tight text-cyan-300 whitespace-nowrap">
              {debugTotalMult.toFixed(2)}×
              {WEATHER_MUT_LABEL[activeWeather as WeatherType]
                ? ` ${WEATHER_MUT_LABEL[activeWeather as WeatherType]}`
                : ""}
            </span>
          </div>
        )}

        {/* Top-right indicator:
            - pinned plant → 📌 (overrides the bloom pulse, since auto-harvest is shielded)
            - bloomed unpinned → pulsing circle to draw attention to harvest-ready state */}
        {plant.pinned ? (
          <span
            className="absolute -top-1 -right-1 text-sm leading-none"
            title="Pinned — auto-harvest blocked"
          >
            📌
          </span>
        ) : isBloomed ? (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
        ) : null}

        {/* Mutation badge — bottom-right */}
        {settings.plotMutationIndicator && isBloomed && (plant as PlantedFlower).mutation && (
          <span className="absolute -bottom-1 -right-1 leading-none">
            <ItemSprite
              emoji={MUTATIONS[(plant as PlantedFlower).mutation!].emoji}
              sprite={MUTATIONS[(plant as PlantedFlower).mutation!].sprite}
              name={MUTATIONS[(plant as PlantedFlower).mutation!].emoji}
              textSize="text-sm" imgSize="w-4 h-4"
            />
          </span>
        )}

        {/* Tooltip-open indicator (suppressed when pinned — 📌 occupies the slot) */}
        {open && !isBloomed && !plant.pinned && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary/60 rounded-full" />
        )}

        {/* Sprinkler-highlight ring overlay */}
        {isHighlighted && (
          <div className="absolute inset-0 rounded-xl bg-primary/10 pointer-events-none" />
        )}
      </button>
    </div>
  );
}
