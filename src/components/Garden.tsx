import { useState, useEffect, useRef, useMemo } from "react";
import { useGame } from "../store/GameContext";
import { useGrowthTick } from "../hooks/useGrowthTick";
import { PlotTile } from "./PlotTile";
import { SeedPicker } from "./SeedPicker";
import {
  getCurrentStage,
  plantSeed,
  plantBloom,
  upgradeFarm,
  harvestPlant,
  plantAll,
  assignBloomMutations,
  tickWeatherMutations,
  tickSprinklerMutations,
  tickScarecrowStrip,
  tickFanMutations,
  findHarvestBellTargets,
  findAutoPlantTargets,
  stampStageTransitions,
  placeGear,
  getDevShowGrowthDebug,
} from "../store/gameStore";
import { edgePlantSeed, edgePlantBloom, edgeUpgradeFarm, edgeHarvest, edgeHarvestAll, edgePlantAll, edgePlaceGear } from "../lib/edgeFunctions";
import { getNextUpgrade, getCurrentTier } from "../data/upgrades";
import { getAffectedCells, GEAR, isGearExpired } from "../data/gear";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import type { GearType, FanDirection } from "../data/gear";
import { useDailyProgress } from "../hooks/useDailyProgress";
import { useAchievementStats } from "../hooks/useAchievementStats";
import type { AchievementStatKey } from "../data/achievements";

export function Garden({ onHarvestPopup }: { onHarvestPopup: (speciesId: string, mutation?: MutationType, isSeed?: boolean) => void }) {
  const { state, update, perform, getState, awaitHarvests, activeWeather, reloadFromCloud, saveGridNow, user, requestSignIn, pushGenericToast } = useGame();
  useGrowthTick(5_000);

  const [showGrowthDebug, setShowGrowthDebug] = useState(getDevShowGrowthDebug());
  useEffect(() => {
    const h = (e: Event) => setShowGrowthDebug((e as CustomEvent<boolean>).detail);
    window.addEventListener("devGrowthDebugToggle", h);
    return () => window.removeEventListener("devGrowthDebugToggle", h);
  }, []);

  // Throttle the mutation tick to at most once per second to prevent the no-dep
  // useEffect from spinning in an infinite render loop when a tick function
  // (e.g. fan strip/apply oscillation) produces a new state object every call.
  const lastMutationTickRef = useRef(0);

  // Every render: stamp transitions, roll weather mutations, roll sprinkler/fan mutations.
  // IMPORTANT: use getState() (the ref) not `state` (the React closure) as the starting point.
  // The closure can be stale when perform() has already advanced stateRef synchronously but
  // the React re-render hasn't flushed yet. Using the stale closure would write an old state
  // back through update(), wiping out any in-flight optimistic plants/harvests.
  useEffect(() => {
    const now     = Date.now();
    if (now - lastMutationTickRef.current < 1_000) return;
    lastMutationTickRef.current = now;
    const weather = activeWeather ?? "clear";
    const latest  = getState();                            // always the freshest state
    let next = stampStageTransitions(latest, now, weather);
    next = tickWeatherMutations(next, weather);
    // Track whether a sprinkler tick newly mutated any plant so we can flush to
    // the DB — the server's harvest function reads plant.mutation from the DB,
    // and sprinkler mutations are purely client-side until cloud-saved.
    const beforeSprinkler = next;
    next = tickSprinklerMutations(next, weather);
    const sprinklerMutated = next !== beforeSprinkler;
    next = tickScarecrowStrip(next, weather);
    next = tickFanMutations(next, weather);
    next = assignBloomMutations(next, weather);
    if (next !== latest) update(next);
    // Persist sprinkler mutations to the DB immediately so harvest sees them.
    // saveGridNow is a no-op for guests and during loading — safe to fire and forget.
    if (sprinklerMutated) saveGridNow();

    // Bell harvests — throttled to 1 per GEAR_ACTION_INTERVAL_MS to prevent server races
    const bellTargets = findHarvestBellTargets(next, weather);
    const nowBell = Date.now();
    if (nowBell - lastBellActionRef.current >= GEAR_ACTION_INTERVAL_MS) {
      // Skip plants that are infused (awaiting cross-breed) or are active Cropsticks sources
      const bellTarget = bellTargets.find(({ row, col }) =>
        !harvestingPlots.current.has(`${row}-${col}`) &&
        !getState().grid[row]?.[col]?.plant?.infused &&
        !crossbreedSourceCells.has(`${row}-${col}`)
      );
      if (bellTarget) {
        const { row, col } = bellTarget;
        const key = `${row}-${col}`;
        lastBellActionRef.current = nowBell;
        harvestingPlots.current.add(key);
        const cur = getState();
        if (!cur.grid[row]?.[col]?.plant) {
          harvestingPlots.current.delete(key);
        } else {
          const savedCell          = cur.grid[row][col];
          const harvestedSpeciesId = savedCell.plant?.speciesId;
          const harvestedMutation  = savedCell.plant?.mutation ?? undefined;
          const harvestedHeirloom  = savedCell.plant?.heirloomActive;
          const opt = harvestPlant(cur, row, col, weather);
          if (!opt) {
            harvestingPlots.current.delete(key);
          } else {
            perform(
              opt.state,
              async () => {
                try {
                  return await edgeHarvest(row, col);
                } finally {
                  harvestingPlots.current.delete(key);
                }
              },
              () => {
                // Show harvest popup for bell auto-harvests just like manual ones
                if (harvestedSpeciesId) {
                  onHarvestPopup(harvestedSpeciesId, harvestedMutation);
                  if (harvestedHeirloom) onHarvestPopup(harvestedSpeciesId, undefined, true);
                  // Achievement stats
                  const flower = getFlower(harvestedSpeciesId);
                  if (flower) {
                    incrementStat("total_harvests");
                    for (const type of flower.types) {
                      incrementStat(`harvest_${type}`);
                    }
                    if (flower.rarity === "legendary" || flower.rarity === "mythic" || flower.rarity === "prismatic") {
                      incrementStat(`harvest_${flower.rarity}` as AchievementStatKey);
                    }
                  }
                }
              },
              {
                serialize: true,
                rollback: (c) => ({
                  ...c,
                  grid: c.grid.map((r2, ri2) =>
                    r2.map((p2, ci2) => ri2 === row && ci2 === col ? savedCell : p2)
                  ),
                  inventory: harvestedSpeciesId
                    ? c.inventory
                        .map((item) =>
                          item.speciesId === harvestedSpeciesId &&
                          item.mutation  === harvestedMutation  &&
                          !item.isSeed
                            ? { ...item, quantity: item.quantity - 1 }
                            : item
                        )
                        .filter((item) => item.quantity > 0)
                    : c.inventory,
                }),
              }
            );
          }
        }
      }
    }

    // Auto-Planter: throttled to 1 per GEAR_ACTION_INTERVAL_MS
    const plantTargets = findAutoPlantTargets(getState());
    const nowPlant = Date.now();
    if (nowPlant - lastPlanterActionRef.current >= GEAR_ACTION_INTERVAL_MS) {
      const plantTarget = plantTargets.find(({ row, col }) => {
        const k = `plant-${row}-${col}`;
        return !plantingPlots.current.has(k) && !autoPlantBlockedRef.current.has(k);
      });
      if (plantTarget) {
        const { row, col, speciesId } = plantTarget;
        const key = `plant-${row}-${col}`;
        lastPlanterActionRef.current = nowPlant;
        plantingPlots.current.add(key);
        const cur = getState();
        if (cur.grid[row]?.[col]?.plant || cur.grid[row]?.[col]?.gear) {
          plantingPlots.current.delete(key);
        } else {
          const opt = plantSeed(cur, row, col, speciesId);
          if (!opt) {
            plantingPlots.current.delete(key);
          } else {
            perform(
              opt,
              async () => {
                try {
                  // Discard grid + inventory from the server response — merging back
                  // would overwrite other in-flight optimistic plants.
                  await edgePlantSeed(row, col, speciesId);
                  return {};
                } catch (e) {
                  // If the server says the plot is already occupied, the offline cron planted
                  // there after our state loaded. Block the cell to stop the spam loop, then
                  // reload from DB so the client immediately reflects what the server has
                  // (user sees planted seeds without needing a page refresh).
                  if ((e as Error).message?.includes("Plot already occupied")) {
                    autoPlantBlockedRef.current.add(key);
                    reloadFromCloud();
                  }
                  throw e;
                } finally {
                  plantingPlots.current.delete(key);
                }
              },
              undefined,
              {
                serialize: true,
                rollback: (c) => ({
                  ...c,
                  grid: c.grid.map((r2, ri2) =>
                    r2.map((p2, ci2) =>
                      ri2 === row && ci2 === col ? { ...p2, plant: null } : p2
                    )
                  ),
                  inventory: c.inventory.map((item) =>
                    item.speciesId === speciesId && item.isSeed
                      ? { ...item, quantity: item.quantity + 1 }
                      : item
                  ),
                }),
              }
            );
          }
        }
      }
    }
  });

  const [selectedPlot, setSelectedPlot]     = useState<{ row: number; col: number } | null>(null);
  /** Which gear cell has its tooltip open — used to highlight affected cells */
  const [highlightSource, setHighlightSource] = useState<{ row: number; col: number; gearType: GearType } | null>(null);
  /** Pending fan placement — waits for the player to choose a direction */
  const [pendingFan, setPendingFan] = useState<{ gearType: GearType; row: number; col: number } | null>(null);

  // Track plots with a harvest in-flight so we don't open the seed picker
  // before the server has removed the plant from the DB.
  const harvestingPlots = useRef<Set<string>>(new Set());
  // Track plots with an auto-plant in-flight to avoid duplicate edge calls
  const plantingPlots = useRef<Set<string>>(new Set());
  // Cells where plant-seed returned "Plot already occupied" — the offline cron planted
  // there while our client state was stale. Block them from being re-queued so the
  // auto-planter doesn't spam the same cell until the client state resyncs.
  const autoPlantBlockedRef = useRef<Set<string>>(new Set());
  // Throttle gear auto-actions to 1 per interval to prevent server race conditions
  const lastBellActionRef    = useRef(0);
  const lastPlanterActionRef = useRef(0);
  const GEAR_ACTION_INTERVAL_MS = 1500; // 1 action per 1.5 s per gear type

  const nextUpgrade = getNextUpgrade(state.farmRows, state.farmSize);
  const currentTier = getCurrentTier(state.farmRows, state.farmSize);

  // Smaller cells on mobile for larger farm sizes
  const cellSize =
    state.farmSize <= 4 ? "w-16 h-16" :
    state.farmSize === 5 ? "w-15 h-15 sm:w-16 sm:h-16" :
    "w-11 h-11 sm:w-16 sm:h-16"; // 6+ cols: compact on mobile

  // Auto-clear highlightSource when the gear tile it's tracking is removed or expires.
  // This runs in Garden (the owner of highlightSource) rather than in PlotTile's useEffect
  // so we never call a parent's setState from a child effect (React 18 concurrent-mode warning).
  useEffect(() => {
    if (!highlightSource) return;
    const plot = state.grid[highlightSource.row]?.[highlightSource.col];
    if (!plot?.gear || plot.gear.gearType !== highlightSource.gearType) {
      setHighlightSource(null);
    }
  }, [state.grid, highlightSource]);

  // Cells highlighted by the currently-inspected gear item
  const highlightedCells = useMemo((): Set<string> => {
    if (!highlightSource) return new Set();
    const { row, col, gearType } = highlightSource;
    // Look up direction from the placed gear (needed for fans)
    const direction = state.grid[row]?.[col]?.gear?.direction;
    const affected = getAffectedCells(gearType, row, col, state.farmRows, state.farmSize, direction);
    return new Set(affected.map(([r, c]) => `${r}-${c}`));
  }, [highlightSource, state.farmRows, state.farmSize, state.grid]);

  // Per-cell gear coverage — used for plant indicator icons
  const { regularSprinklerKeys, aqueductCoveredCells, mutationSprinklerMap, scarecrowCoveredCells, composterCoveredCells, growLampKeys, fanCoveredCells, harvestBellCoveredCells, lawnmowerCoveredCells, balanceScaleCoveredCells, autoPlantCoveredCells, aegisCoveredCells } =
    useMemo(() => {
      const regular   = new Set<string>(); // sprinkler_regular only — excludes aqueduct
      const aqueduct  = new Set<string>(); // aqueduct only — displayed separately from sprinkler
      const mutation  = new Map<string, { emoji: string; label: string }[]>(); // cellKey → unique mutation sprinklers
      const scarecrow = new Set<string>();
      const composter = new Set<string>();
      const growLamp  = new Set<string>();
      const fan        = new Map<string, FanDirection>();
      const harvestBell  = new Set<string>();
      const lawnmower    = new Map<string, FanDirection>();
      const balanceScale = new Map<string, "boost" | "slow">();
      const autoPlanter  = new Set<string>();
      const aegis        = new Set<string>();
      const now = Date.now();
      for (let ri = 0; ri < state.grid.length; ri++) {
        for (let ci = 0; ci < state.grid[ri].length; ci++) {
          const g = state.grid[ri][ci].gear;
          if (!g || isGearExpired(g, now)) continue;
          const def     = GEAR[g.gearType];
          const affected = getAffectedCells(g.gearType, ri, ci, state.farmRows, state.farmSize, g.direction);
          const keys    = affected.map(([r, c]) => `${r}-${c}`);
          if (def.category === "sprinkler_regular" && def.passiveSubtype !== "aqueduct") {
            keys.forEach((k) => regular.add(k));
          } else if (def.passiveSubtype === "aqueduct") {
            keys.forEach((k) => aqueduct.add(k));
          } else if (def.category === "sprinkler_mutation" && def.mutationType) {
            const emoji = MUTATIONS[def.mutationType as MutationType]?.emoji ?? "✨";
            const label = def.name;
            keys.forEach((k) => {
              const existing = mutation.get(k);
              if (!existing) mutation.set(k, [{ emoji, label }]);
              else if (!existing.some((e) => e.emoji === emoji)) existing.push({ emoji, label });
            });
          } else if (def.passiveSubtype === "scarecrow") {
            keys.forEach((k) => scarecrow.add(k));
          } else if (def.passiveSubtype === "composter") {
            keys.forEach((k) => composter.add(k));
          } else if (def.passiveSubtype === "grow_lamp") {
            keys.forEach((k) => growLamp.add(k));
          } else if (def.passiveSubtype === "fan") {
            const dir = g.direction ?? "right";
            keys.forEach((k) => fan.set(k, dir));
          } else if (def.passiveSubtype === "harvest_bell") {
            keys.forEach((k) => harvestBell.add(k));
          } else if (def.passiveSubtype === "lawnmower") {
            const dir = g.direction ?? "right";
            keys.forEach((k) => lawnmower.set(k, dir));
          } else if (def.passiveSubtype === "balance_scale") {
            // Must use placedAt-relative phase to match gameStore's growth computation.
            // Wall-clock phase was wrong: it drifted from the actual effect whenever the
            // scale was placed mid-hour, causing boost/slow labels to be flipped (#221).
            const phase  = Math.floor((now - (g.placedAt ?? 0)) / 3_600_000) % 2;
            affected.forEach(([r, c]) => {
              const dc      = c - ci;
              const inLeft  = dc < 0;
              const isBoost = phase === 0 ? inLeft : !inLeft;
              balanceScale.set(`${r}-${c}`, isBoost ? "boost" : "slow");
            });
          } else if (def.passiveSubtype === "auto_planter") {
            keys.forEach((k) => autoPlanter.add(k));
          } else if (def.passiveSubtype === "aegis") {
            keys.forEach((k) => aegis.add(k));
          }
        }
      }
      return { regularSprinklerKeys: regular, aqueductCoveredCells: aqueduct, mutationSprinklerMap: mutation, scarecrowCoveredCells: scarecrow, composterCoveredCells: composter, growLampKeys: growLamp, fanCoveredCells: fan, harvestBellCoveredCells: harvestBell, lawnmowerCoveredCells: lawnmower, balanceScaleCoveredCells: balanceScale, autoPlantCoveredCells: autoPlanter, aegisCoveredCells: aegis };
    }, [state.grid, state.farmRows, state.farmSize]);

  // Plant cells adjacent to active cropsticks, mapped to the direction their
  // particle should travel (toward the cropsticks).
  // Uses stored crossbreedSourceA/B coordinates so particles keep flowing even
  // after plant.infused is cleared at cycle-start.
  const crossbreedSourceCells = useMemo(() => {
    const map = new Map<string, "up" | "down" | "left" | "right">();
    const OFFSETS: [number, number, "up" | "down" | "left" | "right"][] = [
      [-1, 0, "down"],
      [ 1, 0, "up"  ],
      [ 0,-1, "right"],
      [ 0, 1, "left" ],
    ];
    for (let ri = 0; ri < state.grid.length; ri++) {
      for (let ci = 0; ci < state.grid[ri].length; ci++) {
        const gear = state.grid[ri][ci].gear;
        if (!gear || gear.gearType !== "cropsticks") continue;
        if (gear.crossbreedStartedAt == null) continue;

        // Prefer stored source coordinates (set when infused is cleared at cycle start)
        if (gear.crossbreedSourceA && gear.crossbreedSourceB) {
          const sources = [gear.crossbreedSourceA, gear.crossbreedSourceB];
          for (const { r: sr, c: sc } of sources) {
            if (!state.grid[sr]?.[sc]?.plant) continue;
            for (const [dr, dc, dir] of OFFSETS) {
              if (ri + dr === sr && ci + dc === sc) {
                map.set(`${sr}-${sc}`, dir);
                break;
              }
            }
          }
          continue;
        }

        // Fallback: legacy cycles where infused flag is still set on the plants
        for (const [dr, dc, dir] of OFFSETS) {
          const nr = ri + dr;
          const nc = ci + dc;
          const plant = state.grid[nr]?.[nc]?.plant;
          if (!plant || !plant.infused) continue;
          map.set(`${nr}-${nc}`, dir);
        }
      }
    }
    return map;
  }, [state.grid]);

  const { trackProgress }  = useDailyProgress();
  const { incrementStat }  = useAchievementStats();

  // Maps a GearType to its "placed_*" achievement stat key group.
  function gearTypeToPlacedGroup(gearType: string): string | null {
    const overrides: Record<string, string> = {
      sprinkler_flame:        "heater",
      sprinkler_frost:        "cooler",
      sprinkler_lightning:    "generator",
      sprinkler_lunar:        "crystal_ball",
      sprinkler_midas:        "golden_veil",
      sprinkler_prism:        "kaleidoscope",
      auto_planter_prismatic: "auto_planter",
      cropsticks:             "cropsticks",
    };
    if (overrides[gearType]) return overrides[gearType];
    return gearType.replace(/_(?:prismatic|exalted|mythic|legendary|rare|uncommon)$/, "") || null;
  }

  function handlePlotClick(row: number, col: number) {
    const plot = state.grid[row][col];
    if (plot.plant || harvestingPlots.current.has(`${row}-${col}`)) return;

    // Guest guard — guests have empty inventories, so opening the SeedPicker
    // would just show "Nothing to place" (#148). Surface the sign-in prompt
    // instead so the next click can actually do something.
    if (!user) { requestSignIn("to plant seeds"); return; }

    setSelectedPlot({ row, col });
  }

  function handleSeedSelect(speciesId: string) {
    if (!selectedPlot) return;
    const { row, col } = selectedPlot;
    const optimistic = plantSeed(state, row, col, speciesId);
    if (optimistic) {
      const sp = getFlower(speciesId);
      perform(
        optimistic,
        async () => {
          try {
            await edgePlantSeed(row, col, speciesId);
            // Discard the response's grid + inventory — merging would clobber
            // any concurrent optimistic plants (auto-planter, Plant All) that
            // are mid-flight. Matches the auto-planter's pattern.
            return {};
          } catch (e) {
            // "Plot already occupied" = client/server desync (server has a plant
            // here that we don't see). Reload cloud state instead of letting the
            // user click endlessly into a 400. Same recovery as auto-planter.
            if ((e as Error).message?.includes("Plot already occupied")) {
              reloadFromCloud();
            }
            throw e;
          }
        },
        () => {
          const discovered = getState().discovered.includes(speciesId);
          const emoji = discovered && sp ? sp.emoji.seed : "❓";
          const label = discovered && sp ? `${sp.name} Seed` : "??? Seed";
          pushGenericToast(`loss:seed:${speciesId}`, emoji, label, "text-green-400", "loss");
          incrementStat("seeds_planted");
        },
      );
    }
    setSelectedPlot(null);
  }

  function handleBloomSelect(speciesId: string, mutation?: string) {
    if (!selectedPlot) return;
    const { row, col } = selectedPlot;
    const optimistic = plantBloom(state, row, col, speciesId, mutation);
    if (optimistic) {
      const sp = getFlower(speciesId);
      perform(
        optimistic,
        () => edgePlantBloom(row, col, speciesId, mutation),
        () => {
          if (sp) pushGenericToast(`loss:bloom:${speciesId}:${mutation ?? ""}`, sp.emoji.bloom, sp.name, RARITY_CONFIG[sp.rarity].color, "loss");
          incrementStat("seeds_planted");
        },
      );
    }
    setSelectedPlot(null);
  }

  function handleGearSelect(gearType: GearType) {
    if (!selectedPlot) return;
    const def = GEAR[gearType];
    if (def.passiveSubtype === "fan" || def.passiveSubtype === "aegis" || def.passiveSubtype === "lawnmower" || def.passiveSubtype === "aqueduct") {
      // Directional gear needs a direction — show direction picker first
      setPendingFan({ gearType, row: selectedPlot.row, col: selectedPlot.col });
      setSelectedPlot(null);
      return;
    }
    placeGearAt(selectedPlot.row, selectedPlot.col, gearType);
    setSelectedPlot(null);
  }

  function placeGearAt(row: number, col: number, gearType: GearType, direction?: FanDirection) {
    const optimistic = placeGear(getState(), row, col, gearType, direction);
    if (!optimistic) return;
    const gearDef = GEAR[gearType];
    perform(
      optimistic,
      async () => {
        try {
          return await edgePlaceGear(row, col, gearType, direction);
        } catch (e) {
          if ((e as Error).message?.includes("Cell already has gear")) reloadFromCloud();
          throw e;
        }
      },
      () => {
        pushGenericToast(`loss:gear:${gearType}`, gearDef.emoji, gearDef.name, RARITY_CONFIG[gearDef.rarity].color, "loss");
        const group = gearTypeToPlacedGroup(gearType);
        if (group) incrementStat(`placed_${group}` as AchievementStatKey);
      },
      {
        rollback: (cur) => ({
          ...cur,
          grid: cur.grid.map((r2, ri) =>
            r2.map((p, ci) =>
              ri === row && ci === col ? { ...p, gear: null } : p
            )
          ),
          gearInventory: (cur.gearInventory ?? []).map((g) =>
            g.gearType === gearType ? { ...g, quantity: g.quantity + 1 } : g
          ),
        }),
      }
    );
  }

  function handleUpgrade() {
    if (!user) { requestSignIn("to upgrade your farm"); return; }
    const optimistic = upgradeFarm(state);
    if (optimistic) perform(optimistic, () => edgeUpgradeFarm());
  }

  function handleCollectAll() {
    const currentState = getState();

    // Collect all bloomed plots and their harvest metadata upfront.
    const toHarvest: {
      row: number; col: number;
      speciesId: string; mutation: MutationType | undefined; heirloomActive: boolean;
    }[] = [];

    let optState = currentState;
    for (let ri = 0; ri < currentState.grid.length; ri++) {
      for (let ci = 0; ci < currentState.grid[ri].length; ci++) {
        const p = currentState.grid[ri][ci];
        if (!p.plant || crossbreedSourceCells.has(`${ri}-${ci}`)) continue;
        if (getCurrentStage(p.plant, Date.now(), activeWeather) !== "bloom") continue;
        if (harvestingPlots.current.has(`${ri}-${ci}`)) continue;

        const next = harvestPlant(optState, ri, ci, activeWeather);
        if (!next) continue;

        toHarvest.push({
          row: ri, col: ci,
          speciesId:    p.plant.speciesId,
          mutation:     p.plant.mutation ?? undefined,
          heirloomActive: !!p.plant.heirloomActive,
        });
        optState = next.state;
        harvestingPlots.current.add(`${ri}-${ci}`);
      }
    }
    if (toHarvest.length === 0) return;

    // Fire all popups immediately — one batch round-trip, no per-plot wait.
    for (const { speciesId, mutation, heirloomActive } of toHarvest) {
      onHarvestPopup(speciesId, mutation);
      if (heirloomActive) onHarvestPopup(speciesId, undefined, true);
    }

    const plots = toHarvest.map(({ row, col }) => ({ row, col }));

    perform(
      optState,
      async () => {
        try {
          return await edgeHarvestAll(plots);
        } finally {
          for (const { row, col } of plots) harvestingPlots.current.delete(`${row}-${col}`);
        }
      },
      () => {
        void trackProgress("harvest", plots.length);
        // Aggregate per-type and per-rarity counts across all harvested plants
        const typeCounts: Record<string, number>   = {};
        const rarityCounts: Record<string, number> = {};
        for (const { speciesId } of toHarvest) {
          const flower = getFlower(speciesId);
          if (!flower) continue;
          for (const type of flower.types) {
            typeCounts[type] = (typeCounts[type] ?? 0) + 1;
          }
          if (flower.rarity === "legendary" || flower.rarity === "mythic" || flower.rarity === "prismatic") {
            rarityCounts[flower.rarity] = (rarityCounts[flower.rarity] ?? 0) + 1;
          }
        }
        incrementStat("total_harvests", toHarvest.length);
        for (const [type, count] of Object.entries(typeCounts)) {
          incrementStat(`harvest_${type}` as AchievementStatKey, count);
        }
        for (const [rarity, count] of Object.entries(rarityCounts)) {
          incrementStat(`harvest_${rarity}` as AchievementStatKey, count);
        }
      },
      {
        serialize: true,
        rollback: () => currentState,
      }
    );
  }

  async function handlePlantAll() {
    await awaitHarvests();

    const currentState = getState();
    const optimistic = plantAll(currentState);
    if (optimistic === currentState) return;

    const planted: { row: number; col: number; speciesId: string }[] = [];
    for (let ri = 0; ri < optimistic.grid.length; ri++) {
      for (let ci = 0; ci < optimistic.grid[ri].length; ci++) {
        const wasEmpty  = !currentState.grid[ri]?.[ci]?.plant;
        const nowFilled = optimistic.grid[ri]?.[ci]?.plant;
        if (wasEmpty && nowFilled) planted.push({ row: ri, col: ci, speciesId: nowFilled.speciesId });
      }
    }
    if (planted.length === 0) return;

    // Fire all toasts immediately.
    const discoveredSet = new Set(currentState.discovered);
    for (const { speciesId } of planted) {
      const sp = getFlower(speciesId);
      const disc  = discoveredSet.has(speciesId);
      const emoji = disc && sp ? sp.emoji.seed : "❓";
      const label = disc && sp ? `${sp.name} Seed` : "??? Seed";
      pushGenericToast(`loss:seed:${speciesId}`, emoji, label, "text-green-400", "loss");
    }

    perform(
      optimistic,
      async () => {
        try {
          return await edgePlantAll(planted);
        } catch (e) {
          if ((e as Error).message?.includes("Plot already occupied")) reloadFromCloud();
          throw e;
        }
      },
      undefined,
      {
        serialize: true,
        rollback: () => currentState,
      }
    );
  }

  const bloomedCount = state.grid
    .flat()
    .filter((p) => p.plant && getCurrentStage(p.plant, Date.now(), activeWeather) === "bloom").length;

  // Exclude gear-occupied cells from "empty" count — they can't receive seeds
  const emptyPlotCount = state.grid.flat().filter((p) => !p.plant && !p.gear).length;
  const availSeedCount = state.inventory.filter((i) => i.isSeed && i.quantity > 0).length;

  return (
    <div className="flex flex-col items-center gap-6">

      {/* Farm tier label */}
      <div className="text-center">
        <p className="text-sm font-mono text-muted-foreground tracking-wide uppercase">
          {currentTier.label} — {state.farmRows}×{state.farmSize}
        </p>
        {(bloomedCount > 0 || (emptyPlotCount > 0 && availSeedCount > 0)) && (
          <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
            {bloomedCount > 0 && (
              <>
                <p className="text-xs text-primary animate-pulse">
                  {bloomedCount} flower{bloomedCount > 1 ? "s" : ""} ready!
                </p>
                <button
                  onClick={handleCollectAll}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-all"
                >
                  Collect All
                </button>
              </>
            )}
            {emptyPlotCount > 0 && availSeedCount > 0 && (
              <button
                onClick={handlePlantAll}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
              >
                🌱 Plant All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="relative">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${state.farmSize}, minmax(0, 1fr))` }}
        >
          {state.grid.flat().map((plot, i) => {
            const row = Math.floor(i / state.farmSize);
            const col = i % state.farmSize;
            return (
              <PlotTile
                key={plot.id}
                plot={plot}
                row={row}
                col={col}
                onEmptyClick={() => handlePlotClick(row, col)}
                onHarvest={(speciesId, mutation, _isBloomPlaced, heirloomActive) => {
                  onHarvestPopup(speciesId, mutation);
                  if (heirloomActive) onHarvestPopup(speciesId, undefined, true);
                }}
                onHarvestStart={() => harvestingPlots.current.add(`${row}-${col}`)}
                onHarvestEnd={() => harvestingPlots.current.delete(`${row}-${col}`)}
                harvestPending={() => harvestingPlots.current.has(`${row}-${col}`)}
                isSelected={selectedPlot?.row === row && selectedPlot?.col === col}
                isHighlighted={highlightedCells.has(`${row}-${col}`)}
                isUnderSprinkler={regularSprinklerKeys.has(`${row}-${col}`)}
                isUnderAqueduct={aqueductCoveredCells.has(`${row}-${col}`)}
                sprinklerMutations={mutationSprinklerMap.get(`${row}-${col}`) ?? []}
                isUnderScarecrow={scarecrowCoveredCells.has(`${row}-${col}`)}
                isUnderComposter={composterCoveredCells.has(`${row}-${col}`)}
                isUnderGrowLamp={growLampKeys.has(`${row}-${col}`)}
                isUnderFan={fanCoveredCells.has(`${row}-${col}`)}
                fanDirection={fanCoveredCells.get(`${row}-${col}`)}
                isUnderHarvestBell={harvestBellCoveredCells.has(`${row}-${col}`)}
                isUnderLawnmower={lawnmowerCoveredCells.has(`${row}-${col}`)}
                lawnmowerDirection={lawnmowerCoveredCells.get(`${row}-${col}`)}
                balanceScaleSide={balanceScaleCoveredCells.get(`${row}-${col}`)}
                isUnderAutoPlanter={autoPlantCoveredCells.has(`${row}-${col}`)}
                isUnderAegis={aegisCoveredCells.has(`${row}-${col}`)}
                crossbreedDirection={crossbreedSourceCells.get(`${row}-${col}`)}
                isCrossBreeding={crossbreedSourceCells.has(`${row}-${col}`)}
                onGearInspect={(r, c, gt) => setHighlightSource({ row: r, col: c, gearType: gt })}
                onGearInspectClose={() => setHighlightSource(null)}
                cellSize={cellSize}
                showGrowthDebug={showGrowthDebug}
              />
            );
          })}
        </div>

        {/* Seed + Gear picker modal */}
        {selectedPlot && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            onClick={() => setSelectedPlot(null)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <SeedPicker
                onSelect={handleSeedSelect}
                onBloomSelect={handleBloomSelect}
                onGearSelect={handleGearSelect}
                onClose={() => setSelectedPlot(null)}
              />
            </div>
          </div>
        )}

        {/* Fan direction picker modal */}
        {pendingFan && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            onClick={() => setPendingFan(null)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <FanDirectionPicker
                onDirection={(dir) => {
                  placeGearAt(pendingFan.row, pendingFan.col, pendingFan.gearType, dir);
                  setPendingFan(null);
                }}
                onClose={() => setPendingFan(null)}
                emoji={GEAR[pendingFan.gearType].emoji}
                bidirectional={GEAR[pendingFan.gearType].passiveSubtype === "aqueduct"}
              />
            </div>
          </div>
        )}
      </div>

      {/* Farm upgrade */}
      {nextUpgrade && (
        <div className="text-center space-y-1">
          <button
            onClick={handleUpgrade}
            disabled={state.coins < nextUpgrade.cost}
            className={`
              px-5 py-2 rounded-full text-sm font-medium border transition-all duration-200
              ${state.coins >= nextUpgrade.cost
                ? "border-primary text-primary hover:bg-primary/10 hover:scale-105"
                : "border-border text-muted-foreground cursor-not-allowed opacity-50"
              }
            `}
          >
            Upgrade to {nextUpgrade.label} — {nextUpgrade.cost.toLocaleString()} 🟡
          </button>
          <p className="text-xs text-muted-foreground">{nextUpgrade.description}</p>
        </div>
      )}

      {nextUpgrade === null && (
        <p className="text-xs text-yellow-400 font-mono">✦ Max farm size reached</p>
      )}

    </div>
  );
}

// ── Direction picker (fan, aegis, lawnmower) ──────────────────────────────

function FanDirectionPicker({
  onDirection,
  onClose,
  emoji = "💨",
  bidirectional = false,
}: {
  onDirection: (dir: FanDirection) => void;
  onClose: () => void;
  emoji?: string;
  bidirectional?: boolean;
}) {

  return (
    <div className="bg-card border border-border rounded-xl p-4 w-64 shadow-xl z-50 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{bidirectional ? "Choose an axis" : "Choose a direction"}</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>
      <p className="text-xs text-muted-foreground">
        {bidirectional
          ? "Flows in both directions along the chosen axis."
          : "Choose which direction it faces."}
      </p>

      {bidirectional ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onDirection("right")}
            className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
          >
            <span className="text-lg font-bold leading-none">←→</span>
            <span className="text-[10px] text-muted-foreground">Horizontal</span>
          </button>
          <button
            onClick={() => onDirection("up")}
            className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
          >
            <span className="text-lg font-bold leading-none">↑↓</span>
            <span className="text-[10px] text-muted-foreground">Vertical</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {/* Top row: just Up */}
          <div />
          <button
            onClick={() => onDirection("up")}
            className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
          >
            <span className="text-lg font-bold leading-none">↑</span>
            <span className="text-[10px] text-muted-foreground">Up</span>
          </button>
          <div />
          {/* Middle row: Left, gear emoji, Right */}
          <button
            onClick={() => onDirection("left")}
            className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
          >
            <span className="text-lg font-bold leading-none">←</span>
            <span className="text-[10px] text-muted-foreground">Left</span>
          </button>
          <div className="flex items-center justify-center text-2xl">{emoji}</div>
          <button
            onClick={() => onDirection("right")}
            className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
          >
            <span className="text-lg font-bold leading-none">→</span>
            <span className="text-[10px] text-muted-foreground">Right</span>
          </button>
          {/* Bottom row: just Down */}
          <div />
          <button
            onClick={() => onDirection("down")}
            className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
          >
            <span className="text-lg font-bold leading-none">↓</span>
            <span className="text-[10px] text-muted-foreground">Down</span>
          </button>
          <div />
        </div>
      )}
    </div>
  );
}
