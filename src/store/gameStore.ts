import { FLOWERS, MUTATIONS, getFlower, type GrowthStage, type MutationType, type Rarity } from "../data/flowers";
import { FERTILIZERS, getNextUpgrade, getNextShopSlotUpgrade, DEFAULT_SHOP_SLOTS, type FertilizerType } from "../data/upgrades";
import type { WeatherType } from "../data/weather";
import { WEATHER } from "../data/weather";
import { BOTANY_REQUIREMENTS, NEXT_RARITY } from "../data/botany";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlantedFlower {
  speciesId: string;
  timePlanted: number;
  fertilizer: FertilizerType | null;
  /** undefined = not yet rolled; null = Giant tried + failed (weather can still assign); MutationType = has mutation */
  mutation?: MutationType | null;
  /** Stamped the moment the plant actually transitioned — locks stage permanently */
  sproutedAt?: number;
  bloomedAt?: number;
  /** Accumulated effective milliseconds of growth (fertilizer + weather multipliers applied).
   *  Incremented each tick — never recalculated from weather, so the progress bar never snaps. */
  growthMs?: number;
  /** Wall-clock time when growthMs was last saved */
  lastTickAt?: number;
}

export interface Plot {
  id: string;
  plant: PlantedFlower | null;
}

export interface InventoryItem {
  speciesId: string;
  quantity: number;
  mutation?: MutationType;
  isSeed?: boolean;
}

export interface FertilizerItem {
  type: FertilizerType;
  quantity: number;
}

export interface ShopSlot {
  speciesId: string;
  price: number;
  quantity: number;
  isFertilizer?: boolean;
  fertilizerType?: FertilizerType;
  isEmpty?: boolean;
}

export interface GameState {
  coins: number;
  farmSize: number; // column count (max 6)
  farmRows: number; // row count (equals farmSize for square grids, can exceed for 7×6+)
  shopSlots: number;
  grid: Plot[][];
  inventory: InventoryItem[];
  fertilizers: FertilizerItem[];
  shop: ShopSlot[];
  lastShopReset: number;
  lastSaved: number;
  // Codex — tracks every species + mutation combo ever harvested
  // Format: "speciesId" for base, "speciesId:mutationId" for mutated
  discovered: string[];
  // Weather forecast — number of upcoming slots the player has purchased (0 = not unlocked)
  weatherForecastSlots: number;
}

export interface OfflineSummary {
  minutesAway: number;
  readyToHarvest: number;
  shopRestocked: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SAVE_KEY            = "chrysanthemum_save";
const SHOP_RESET_INTERVAL = 5 * 60 * 1_000; // 5 minutes

// ── Grid helpers ───────────────────────────────────────────────────────────

export function makeGrid(rows: number, cols: number): Plot[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      id: `${row}-${col}`,
      plant: null,
    }))
  );
}

export function resizeGrid(old: Plot[][], newRows: number, newCols: number): Plot[][] {
  return Array.from({ length: newRows }, (_, row) =>
    Array.from({ length: newCols }, (_, col) => {
      const existing = old[row]?.[col];
      return existing ?? { id: `${row}-${col}`, plant: null };
    })
  );
}

// ── Codex helpers ──────────────────────────────────────────────────────────

const ALL_MUTATIONS = Object.keys(MUTATIONS) as MutationType[];

// Total possible codex entries: 1 base + all mutations per species
export function getTotalCodexEntries(): number {
  return FLOWERS.reduce((total) => total + 1 + ALL_MUTATIONS.length, 0);
}

// Build the codex key for a harvest
export function codexKey(speciesId: string, mutation?: MutationType): string {
  return mutation ? `${speciesId}:${mutation}` : speciesId;
}

// Check if a specific entry is discovered
export function isDiscovered(discovered: string[], speciesId: string, mutation?: MutationType): boolean {
  return discovered.includes(codexKey(speciesId, mutation));
}

// Get completion count for a specific species (base + mutations)
export function getSpeciesCompletion(discovered: string[], speciesId: string): {
  found: number;
  total: number;
} {
  const species = getFlower(speciesId);
  if (!species) return { found: 0, total: 0 };

  const total = 1 + ALL_MUTATIONS.length;
  let found = 0;
  if (isDiscovered(discovered, speciesId)) found++;
  for (const mut of ALL_MUTATIONS) {
    if (isDiscovered(discovered, speciesId, mut)) found++;
  }
  return { found, total };
}

// ── Shop helpers ───────────────────────────────────────────────────────────

/**
 * Rarity weights for shop slot generation.
 * A rarity is rolled first, then a random flower from that rarity is picked.
 * Rarities omitted here (exalted, prismatic) never appear in the shop by default.
 */
export const SHOP_RARITY_WEIGHTS: Partial<Record<Rarity, number>> = {
  common:    50,
  uncommon:  30,
  rare:      15,
  legendary: 4,
  mythic:    1,
};

function generateShop(shopSlots: number = DEFAULT_SHOP_SLOTS): ShopSlot[] {
  const chosen: ShopSlot[] = [];
  const usedIds = new Set<string>();

  // ── FLOWERS — roll rarity first, then pick a random flower from that tier ─
  let attempts = 0;

  while (chosen.length < shopSlots && attempts < 1000) {
    attempts++;

    // Build eligible rarities: has weight > 0 AND has at least one unused flower
    const eligibleRarities = (Object.entries(SHOP_RARITY_WEIGHTS) as [Rarity, number][])
      .filter(([rarity, weight]) =>
        weight > 0 &&
        FLOWERS.some((f) => f.rarity === rarity && f.shopWeight > 0 && !usedIds.has(f.id))
      );

    if (eligibleRarities.length === 0) break;

    // Roll a rarity by weight
    const totalWeight = eligibleRarities.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * totalWeight;
    let chosenRarity: Rarity = eligibleRarities[eligibleRarities.length - 1][0];

    for (const [rarity, weight] of eligibleRarities) {
      roll -= weight;
      if (roll <= 0) { chosenRarity = rarity; break; }
    }

    // Pick a random unused flower from that rarity
    const pool = FLOWERS.filter(
      (f) => f.rarity === chosenRarity && f.shopWeight > 0 && !usedIds.has(f.id)
    );
    if (pool.length === 0) continue;

    const flower = pool[Math.floor(Math.random() * pool.length)];
    usedIds.add(flower.id);
    chosen.push({
      speciesId: flower.id,
      price:     Math.max(5, Math.floor(flower.sellValue * 0.6)),
      quantity:  Math.floor(Math.random() * 4) + 1,
    });
  }

  // ── FERTILIZERS (weighted, 2 picks) ─────
  const ferts = Object.values(FERTILIZERS);
  const fertTotalWeight = ferts.reduce((s, f) => s + f.shopWeight, 0);

  let fertCount = 0;
  attempts = 0;

  while (fertCount < 2 && attempts < 1000) {
    let roll = Math.random() * fertTotalWeight;

    for (const f of ferts) {
      roll -= f.shopWeight;

      const id = `fertilizer_${f.id}`;

      if (roll <= 0 && !usedIds.has(id)) {
        chosen.push({
          speciesId: id,
          isFertilizer: true,
          fertilizerType: f.id,
          price: f.shopPrice,
          quantity: Math.floor(Math.random() * 3) + 1,
        });

        usedIds.add(id);
        fertCount++;
        break;
      }
    }

    attempts++;
  }

  return chosen;
}
// ── Default state ──────────────────────────────────────────────────────────

export function defaultState(): GameState {
  const size = 3;
  return {
    coins:                100,
    farmSize:             size,
    farmRows:             size,
    shopSlots:            DEFAULT_SHOP_SLOTS,
    grid:                 makeGrid(size, size),
    inventory:            [],
    fertilizers:          [{ type: "basic", quantity: 3 }],
    shop:                 generateShop(DEFAULT_SHOP_SLOTS),
    lastShopReset:        Date.now(),
    lastSaved:            Date.now(),
    discovered:           [],
    weatherForecastSlots: 0,
  };
}

// ── Save / Load ────────────────────────────────────────────────────────────

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSaved: Date.now() }));
  } catch (e) {
    // console.warn("Failed to save game:", e);
  }
}

export function loadGame(): { state: GameState; summary: OfflineSummary } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const state = defaultState();
      return { state, summary: { minutesAway: 0, readyToHarvest: 0, shopRestocked: false } };
    }
    const parsed = JSON.parse(raw) as GameState;
    // Backfill discovered for saves that predate the codex
    if (!parsed.discovered) parsed.discovered = [];
    return applyOfflineTick(parsed);
  } catch (e) {
    // console.warn("Failed to load save, starting fresh:", e);
    const state = defaultState();
    return { state, summary: { minutesAway: 0, readyToHarvest: 0, shopRestocked: false } };
  }
}

export function resetGame(): GameState {
  localStorage.removeItem(SAVE_KEY);
  return defaultState();
}

// ── Offline tick ───────────────────────────────────────────────────────────

export function applyOfflineTick(save: GameState): { state: GameState; summary: OfflineSummary } {
  const now         = Date.now();
  const minutesAway = Math.floor((now - save.lastSaved) / 60_000);

  const expectedCols = save.farmSize ?? 3;
  const expectedRows = save.farmRows ?? expectedCols; // backfill: square for old saves
  const needsRebuild =
    !save.grid ||
    save.grid.length === 0 ||
    save.grid.length    !== expectedRows ||
    save.grid[0]?.length !== expectedCols;

  let updated: GameState = {
    ...save,
    farmRows:             expectedRows,
    grid:                 needsRebuild ? makeGrid(expectedRows, expectedCols) : save.grid,
    discovered:           save.discovered           ?? [],
    shopSlots:            save.shopSlots            ?? DEFAULT_SHOP_SLOTS,
    weatherForecastSlots: save.weatherForecastSlots ?? 0,
  };

  let shopRestocked    = false;
  const timeSinceReset = now - updated.lastShopReset;

  if (timeSinceReset >= SHOP_RESET_INTERVAL) {
    updated       = { ...updated, shop: generateShop(updated.shopSlots), lastShopReset: now };
    shopRestocked = true;
  }

  const readyToHarvest = updated.grid
    .flat()
    .filter((p) => p.plant && getCurrentStage(p.plant, now) === "bloom").length;

  return {
    state:   updated,
    summary: { minutesAway, readyToHarvest, shopRestocked },
  };
}

// ── Weather forecast ────────────────────────────────────────────────────────

export const FORECAST_SLOT_COSTS = [
  500,      // → 1 slot
  2_000,    // → 2 slots
  5_000,    // → 3 slots
  15_000,   // → 4 slots
  35_000,   // → 5 slots
  75_000,   // → 6 slots
  150_000,  // → 7 slots
  300_000,  // → 8 slots
] as const;

export const MAX_FORECAST_SLOTS = FORECAST_SLOT_COSTS.length;

/** Purchase the next forecast slot tier. Returns null if already maxed or can't afford. */
export function buyWeatherForecastSlot(state: GameState): GameState | null {
  const current = state.weatherForecastSlots ?? 0;
  if (current >= MAX_FORECAST_SLOTS) return null;
  const cost = FORECAST_SLOT_COSTS[current];
  if (state.coins < cost) return null;
  return {
    ...state,
    coins:                state.coins - cost,
    weatherForecastSlots: current + 1,
  };
}

// ── Shop tick ─────────────────────────────────────────────────────────────

export function tickShop(state: GameState): GameState {
  const now = Date.now();
  if (now - state.lastShopReset < SHOP_RESET_INTERVAL) return state;
  return {
    ...state,
    shop:          generateShop(state.shopSlots),
    lastShopReset: now,
  };
}

export function msUntilShopReset(state: GameState): number {
  return Math.max(0, SHOP_RESET_INTERVAL - (Date.now() - state.lastShopReset));
}

// ── Growth calculation ─────────────────────────────────────────────────────

/**
 * Returns the accumulated effective growth in milliseconds for a plant.
 * If `growthMs` is stored on the plant, extrapolates from that checkpoint
 * using the CURRENT multiplier for the delta since lastTickAt.
 * This means the progress bar can never snap by more than ~1 tick of error
 * (as long as stampStageTransitions runs every ~1 s to refresh checkpoints).
 */
function computeGrowthMs(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType
): number {
  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  if (plant.bloomedAt) {
    return species.growthTime.seed + species.growthTime.sprout; // fully grown
  }

  const fertMultiplier    = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1.0;
  const weatherMultiplier = WEATHER[weatherType].growthMultiplier;
  const multiplier        = fertMultiplier * weatherMultiplier;

  if (plant.growthMs !== undefined && plant.lastTickAt !== undefined) {
    // Extrapolate from last saved checkpoint (delta is always small — updated every ~1 s)
    const delta = Math.max(0, now - plant.lastTickAt);
    return plant.growthMs + delta * multiplier;
  }

  // No checkpoint yet — backfill using known timestamps
  if (plant.sproutedAt !== undefined) {
    return species.growthTime.seed + Math.max(0, now - plant.sproutedAt) * multiplier;
  }
  return Math.max(0, now - plant.timePlanted) * multiplier;
}

export function getCurrentStage(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType = "clear"
): GrowthStage {
  if (plant.bloomedAt && now >= plant.bloomedAt) return "bloom";

  const species = getFlower(plant.speciesId);
  if (!species) return "seed";

  const gMs    = computeGrowthMs(plant, now, weatherType);
  const seedMs = species.growthTime.seed;

  if (gMs >= seedMs + species.growthTime.sprout) return "bloom";
  if (gMs >= seedMs)                              return "sprout";
  return "seed";
}

export function getStageProgress(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType = "clear"
): number {
  if (plant.bloomedAt && now >= plant.bloomedAt) return 1;

  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const gMs     = computeGrowthMs(plant, now, weatherType);
  const seedMs  = species.growthTime.seed;
  const sproutMs = species.growthTime.sprout;

  if (gMs >= seedMs + sproutMs) return 1;
  if (gMs >= seedMs) return Math.min(1, (gMs - seedMs) / sproutMs);
  return Math.min(1, gMs / seedMs);
}

export function getMsUntilNextStage(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType = "clear"
): number {
  if (plant.bloomedAt && now >= plant.bloomedAt) return 0;

  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const fertMultiplier    = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1.0;
  const weatherMultiplier = WEATHER[weatherType].growthMultiplier;
  const multiplier        = fertMultiplier * weatherMultiplier;

  const gMs     = computeGrowthMs(plant, now, weatherType);
  const seedMs  = species.growthTime.seed;
  const sproutMs = species.growthTime.sprout;

  if (gMs >= seedMs + sproutMs) return 0;
  if (gMs >= seedMs) {
    // In sprout — remaining base ms converted to real ms at current speed
    const remainingBase = (seedMs + sproutMs) - gMs;
    return Math.max(0, Math.ceil(remainingBase / multiplier));
  }
  // In seed
  const remainingBase = seedMs - gMs;
  return Math.max(0, Math.ceil(remainingBase / multiplier));
}

// ── Game actions ───────────────────────────────────────────────────────────

export function plantSeed(
  state: GameState,
  row: number,
  col: number,
  speciesId: string
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot || plot.plant) return null;

  const invItem = state.inventory.find(
    (i) => i.speciesId === speciesId && i.isSeed
  );
  if (!invItem || invItem.quantity < 1) return null;

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col)
        return { ...p, plant: { speciesId, timePlanted: Date.now(), fertilizer: null } };
      return p;
    })
  );

  const newInventory = state.inventory
    .map((i) =>
      i.speciesId === speciesId && i.isSeed
        ? { ...i, quantity: i.quantity - 1 }
        : i
    )
    .filter((i) => i.quantity > 0);

  return { ...state, grid: newGrid, inventory: newInventory };
}

/** Called every tick. Two jobs:
 *  1. Accumulate growthMs (effective ms of growth) so the progress bar is
 *     weather-change-proof — it only adds, never recalculates from scratch.
 *  2. Stamp sproutedAt / bloomedAt when thresholds are crossed so stage
 *     transitions are permanent regardless of future weather changes.
 *
 *  A 100 ms guard prevents the no-deps useEffect from triggering an
 *  infinite re-render loop on near-zero deltas. */
export function stampStageTransitions(
  state: GameState,
  now: number,
  weatherType: WeatherType = "clear"
): GameState {
  const MIN_TICK_MS = 100; // don't save growthMs for sub-100 ms deltas (prevents render loops)
  let changed = false;

  const newGrid = state.grid.map((row) =>
    row.map((plot) => {
      if (!plot.plant || plot.plant.bloomedAt) return plot; // fully grown — nothing to do

      const plant   = plot.plant;
      const species = getFlower(plant.speciesId);
      if (!species) return plot;

      const fertMultiplier    = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1.0;
      const weatherMultiplier = WEATHER[weatherType].growthMultiplier;
      const multiplier        = fertMultiplier * weatherMultiplier;

      const seedMs   = species.growthTime.seed;
      const sproutMs = species.growthTime.sprout;

      // ── Step 1: compute new growthMs ──────────────────────────────────────
      let newGrowthMs: number;
      let newLastTickAt = now;

      if (plant.growthMs !== undefined && plant.lastTickAt !== undefined) {
        const delta = Math.max(0, now - plant.lastTickAt);
        if (delta < MIN_TICK_MS) return plot; // too soon — skip to prevent render loop
        newGrowthMs = plant.growthMs + delta * multiplier;
      } else {
        // First encounter — backfill from known timestamps (use current multiplier as best guess)
        if (plant.sproutedAt !== undefined) {
          newGrowthMs = seedMs + Math.max(0, now - plant.sproutedAt) * multiplier;
        } else {
          newGrowthMs = Math.max(0, now - plant.timePlanted) * multiplier;
        }
      }

      let updated      = { ...plant, growthMs: newGrowthMs, lastTickAt: newLastTickAt };
      let plantChanged = true; // growthMs always changes after MIN_TICK_MS guard

      // ── Step 2: stamp sproutedAt on first sprout transition ───────────────
      if (!plant.sproutedAt && newGrowthMs >= seedMs) {
        updated = { ...updated, sproutedAt: now };
      }

      // ── Step 3: stamp bloomedAt on first bloom transition ─────────────────
      if (!plant.bloomedAt && newGrowthMs >= seedMs + sproutMs) {
        updated = { ...updated, bloomedAt: now };
      }

      if (plantChanged) {
        changed = true;
        return { ...plot, plant: updated };
      }
      return plot;
    })
  );

  return changed ? { ...state, grid: newGrid } : state;
}

// ── Mutation tick rates ────────────────────────────────────────────────────
// Per-tick chances (tick = 5 s, weather event ≈ 15 min = 180 ticks)
// Per-tick rates (tick ≈ 1 s).  Formula: p = 1 − (1 − target)^(1/ticks)
// Rain            20 min  = 1200 ticks → 60% over event
// Heatwave        15 min  =  900 ticks → 40% over event
// Cold Front      15 min  =  900 ticks → 40% over event
// Star Shower   17.5 min  = 1050 ticks → 20% over event
// Prismatic       15 min  =  900 ticks → 20% over event
// Golden Hour     15 min  =  900 ticks → 20% over event
const WEATHER_MUTATION_CHANCE: Partial<Record<WeatherType, number>> = {
  rain:            0.00076,  // 60% over 20-min event
  heatwave:        0.00057,  // 40% over 15-min event
  cold_front:      0.00057,  // 40% over 15-min event
  star_shower:     0.000213, // 20% over 17.5-min event
  prismatic_skies: 0.000248, // 20% over 15-min event
  golden_hour:     0.000248, // 20% over 15-min event
  tornado:         1.0,      // 100% — instant on first tick, all bloomed flowers hit
  thunderstorm:    0.00057,  // 40% over 20-min event (normal shocked roll for non-wet plants)
};

const WEATHER_MUTATION_TYPE: Partial<Record<WeatherType, MutationType>> = {
  rain:            "wet",
  heatwave:        "scorched",
  cold_front:      "frozen",
  star_shower:     "moonlit",
  prismatic_skies: "rainbow",
  golden_hour:     "golden",
  tornado:         "windstruck",
  thunderstorm:    "shocked",
};

const MOONLIT_NIGHT_CHANCE = 0.000019; // 50% over a 10-hour night (1 - 0.5^(1/36000))
const GIANT_BLOOM_CHANCE   = 0.08;   // 8% flat, only at bloom transition

function isNighttime(): boolean {
  const h = new Date().getHours();
  return h >= 20 || h < 6;
}

/** Called every tick. Rolls weather-based mutations for all unassigned plants.
 *  - Weather mutations apply at ANY growth stage (wet included, per user request)
 *  - Moonlit also rolls at night at a lower rate
 *  - Giant is NOT rolled here — see assignBloomMutations below */
export function tickWeatherMutations(
  state: GameState,
  weatherType: WeatherType = "clear"
): GameState {
  const weatherMut    = WEATHER_MUTATION_TYPE[weatherType];
  const weatherChance = weatherMut ? (WEATHER_MUTATION_CHANCE[weatherType] ?? 0) : 0;
  const night         = isNighttime();
  let changed         = false;

  const now = Date.now();

  const newGrid = state.grid.map((row) =>
    row.map((plot) => {
      if (!plot.plant) return plot;

      // Weather mutations only apply at bloom — the plant must be at peak to be affected
      const stage = getCurrentStage(plot.plant, now, weatherType);
      if (stage !== "bloom") return plot;

      // Thunderstorm combo: wet flowers have a ~50% chance to become shocked
      // over the full 20-min storm duration (p ≈ 0.000578 per tick)
      if (weatherType === "thunderstorm" && plot.plant.mutation === "wet") {
        if (Math.random() < 0.000578) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: "shocked" as MutationType } };
        }
        return plot;
      }

      // Skip if already has any other mutation (string); allow null and undefined
      if (typeof plot.plant.mutation === "string") return plot;

      // Thunderstorm: unmutated (null) plants can also become wet — same rate as rain.
      // Those wet plants can then upgrade to shocked via the combo roll on the next tick.
      if (weatherType === "thunderstorm" && plot.plant.mutation === null) {
        if (Math.random() < 0.00076) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: "wet" as MutationType } };
        }
        // fall through to the direct shocked roll below
      }

      // Roll weather mutation
      if (weatherMut && weatherChance > 0) {
        if (Math.random() < weatherChance) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: weatherMut } };
        }
      }

      // Moonlit at night (outside star_shower — that's already covered above)
      if (night && weatherType !== "star_shower") {
        if (Math.random() < MOONLIT_NIGHT_CHANCE) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: "moonlit" as MutationType } };
        }
      }

      return plot;
    })
  );

  return changed ? { ...state, grid: newGrid } : state;
}

/** Called every tick. Assigns Giant to newly-bloomed plants that have no mutation yet.
 *  Giant is weather-independent — it's a flat chance at the moment of bloom. */
export function assignBloomMutations(
  state: GameState,
  weatherType: WeatherType = "clear"
): GameState {
  const now = Date.now();
  let changed = false;

  const newGrid = state.grid.map((row) =>
    row.map((plot) => {
      // Only process undefined plants (never been checked for Giant)
      // null means Giant was already tried and failed — skip to avoid repeated rolls
      if (!plot.plant || plot.plant.mutation !== undefined) return plot;
      const stage = getCurrentStage(plot.plant, now, weatherType);
      if (stage !== "bloom") return plot;

      // Giant: flat 8% at the moment of bloom — tried exactly once per plant
      // On failure, set null so this block is never entered again for this plant
      // (weather mutations in tickWeatherMutations still apply to null plants)
      const mutation: MutationType | null = Math.random() < GIANT_BLOOM_CHANCE
        ? "giant"
        : null;

      changed = true;
      return { ...plot, plant: { ...plot.plant, mutation } };
    })
  );

  return changed ? { ...state, grid: newGrid } : state;
}

export function harvestPlant(
  state: GameState,
  row: number,
  col: number,
  weatherType: WeatherType = "clear"
): { state: GameState; mutation: MutationType | undefined } | null {
  const plot = state.grid[row]?.[col];
  if (!plot?.plant) return null;

  const stage = getCurrentStage(plot.plant, Date.now(), weatherType);
  if (stage !== "bloom") return null;

  const { speciesId } = plot.plant;
  // Use pre-rolled mutation from bloom time; fall back to null if somehow missed
  const mutation = plot.plant.mutation ?? undefined;
  const species  = getFlower(speciesId)!;

  const bonusCoins = mutation
    ? Math.floor(species.sellValue * (MUTATIONS[mutation].valueMultiplier - 1))
    : 0;

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col) return { ...p, plant: null };
      return p;
    })
  );

  // Update inventory
  const existing = state.inventory.find(
    (i) => i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
  );
  const newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
    : [...state.inventory, { speciesId, quantity: 1, mutation, isSeed: false }];

  // Update codex — add base entry and mutation entry if new
  const newDiscovered = [...state.discovered];
  const baseKey = codexKey(speciesId);
  if (!newDiscovered.includes(baseKey)) {
    newDiscovered.push(baseKey);
  }
  if (mutation) {
    const mutKey = codexKey(speciesId, mutation);
    if (!newDiscovered.includes(mutKey)) {
      newDiscovered.push(mutKey);
    }
  }

  return {
    state: {
      ...state,
      coins:      state.coins + bonusCoins,
      grid:       newGrid,
      inventory:  newInventory,
      discovered: newDiscovered,
    },
    mutation,
  };
}

const RARITY_PRIORITY: Record<Rarity, number> = {
  prismatic: 0,
  exalted:   1,
  mythic:    2,
  legendary: 3,
  rare:      4,
  uncommon:  5,
  common:    6,
};

export function plantAll(state: GameState): GameState {
  // Build sorted seed list: highest rarity first, then highest sell value
  const seeds = state.inventory
    .filter((i) => i.isSeed && i.quantity > 0)
    .map((i) => ({ ...i, species: getFlower(i.speciesId) }))
    .filter((i) => i.species)
    .sort((a, b) => {
      const rarityDiff = RARITY_PRIORITY[a.species!.rarity] - RARITY_PRIORITY[b.species!.rarity];
      if (rarityDiff !== 0) return rarityDiff;
      return b.species!.sellValue - a.species!.sellValue;
    });

  if (seeds.length === 0) return state;

  let current = state;

  for (let row = 0; row < current.grid.length; row++) {
    for (let col = 0; col < current.grid[row].length; col++) {
      if (current.grid[row][col].plant) continue;

      // Find next available seed
      const seedItem = seeds.find((s) => {
        const inv = current.inventory.find((i) => i.speciesId === s.speciesId && i.isSeed);
        return inv && inv.quantity > 0;
      });
      if (!seedItem) return current; // no seeds left

      const next = plantSeed(current, row, col, seedItem.speciesId);
      if (next) current = next;
    }
  }

  return current;
}

export function harvestAll(
  state: GameState,
  weatherType: WeatherType = "clear"
): GameState {
  let current = state;
  for (let row = 0; row < current.grid.length; row++) {
    for (let col = 0; col < current.grid[row].length; col++) {
      const result = harvestPlant(current, row, col, weatherType);
      if (result) current = result.state;
    }
  }
  return current;
}

export function sellFlower(
  state: GameState,
  speciesId: string,
  quantity: number = 1,
  mutation?: MutationType
): GameState | null {
  const item = state.inventory.find(
    (i) => i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
  );
  if (!item || item.quantity < quantity) return null;

  const species = getFlower(speciesId);
  if (!species) return null;

  const multiplier = mutation ? MUTATIONS[mutation].valueMultiplier : 1;
  const earned     = Math.floor(species.sellValue * multiplier) * quantity;

  const newInventory = state.inventory
    .map((i) =>
      i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
        ? { ...i, quantity: i.quantity - quantity }
        : i
    )
    .filter((i) => i.quantity > 0);

  return { ...state, coins: state.coins + earned, inventory: newInventory };
}

export function buyFromShop(state: GameState, speciesId: string): GameState | null {
  const slot = state.shop.find((s) => s.speciesId === speciesId && !s.isFertilizer);
  if (!slot || slot.quantity < 1) return null;
  if (state.coins < slot.price) return null;

  const newShop = state.shop.map((s) =>
    s.speciesId === speciesId && !s.isFertilizer
      ? { ...s, quantity: s.quantity - 1 }
      : s
  );

  const existing = state.inventory.find((i) => i.speciesId === speciesId && i.isSeed);
  const newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId && i.isSeed
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
    : [...state.inventory, { speciesId, quantity: 1, isSeed: true }];

  return { ...state, coins: state.coins - slot.price, shop: newShop, inventory: newInventory };
}

export function buyAllFromShop(state: GameState, speciesId: string): GameState | null {
  const slot = state.shop.find((s) => s.speciesId === speciesId && !s.isFertilizer);
  if (!slot || slot.quantity < 1) return null;
  if (state.coins < slot.price) return null;

  // Buy as many as the player can afford, up to stock
  const canAfford = Math.floor(state.coins / slot.price);
  const qty       = Math.min(slot.quantity, canAfford);
  if (qty < 1) return null;

  const newShop = state.shop.map((s) =>
    s.speciesId === speciesId && !s.isFertilizer
      ? { ...s, quantity: s.quantity - qty }
      : s
  );

  const existing = state.inventory.find((i) => i.speciesId === speciesId && i.isSeed);
  const newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId && i.isSeed
          ? { ...i, quantity: i.quantity + qty }
          : i
      )
    : [...state.inventory, { speciesId, quantity: qty, isSeed: true }];

  return { ...state, coins: state.coins - slot.price * qty, shop: newShop, inventory: newInventory };
}

export function buyFertilizer(
  state: GameState,
  fertilizerType: FertilizerType
): GameState | null {
  const slot = state.shop.find(
    (s) => s.isFertilizer && s.fertilizerType === fertilizerType
  );
  if (!slot || slot.quantity < 1) return null;
  if (state.coins < slot.price) return null;

  const newShop = state.shop.map((s) =>
    s.isFertilizer && s.fertilizerType === fertilizerType
      ? { ...s, quantity: s.quantity - 1 }
      : s
  );

  const existing = state.fertilizers.find((f) => f.type === fertilizerType);
  const newFertilizers = existing
    ? state.fertilizers.map((f) =>
        f.type === fertilizerType ? { ...f, quantity: f.quantity + 1 } : f
      )
    : [...state.fertilizers, { type: fertilizerType, quantity: 1 }];

  return {
    ...state,
    coins:       state.coins - slot.price,
    shop:        newShop,
    fertilizers: newFertilizers,
  };
}

export function buyAllFertilizer(
  state: GameState,
  fertilizerType: FertilizerType
): GameState | null {
  const slot = state.shop.find(
    (s) => s.isFertilizer && s.fertilizerType === fertilizerType
  );
  if (!slot || slot.quantity < 1) return null;
  if (state.coins < slot.price) return null;

  const canAfford = Math.floor(state.coins / slot.price);
  const qty       = Math.min(slot.quantity, canAfford);
  if (qty < 1) return null;

  const newShop = state.shop.map((s) =>
    s.isFertilizer && s.fertilizerType === fertilizerType
      ? { ...s, quantity: s.quantity - qty }
      : s
  );

  const existing = state.fertilizers.find((f) => f.type === fertilizerType);
  const newFertilizers = existing
    ? state.fertilizers.map((f) =>
        f.type === fertilizerType ? { ...f, quantity: f.quantity + qty } : f
      )
    : [...state.fertilizers, { type: fertilizerType, quantity: qty }];

  return {
    ...state,
    coins:       state.coins - slot.price * qty,
    shop:        newShop,
    fertilizers: newFertilizers,
  };
}

export function applyFertilizer(
  state: GameState,
  row: number,
  col: number,
  fertilizerType: FertilizerType
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot?.plant) return null;
  if (plot.plant.fertilizer) return null;

  const fertItem = state.fertilizers.find((f) => f.type === fertilizerType);
  if (!fertItem || fertItem.quantity < 1) return null;

  const stage = getCurrentStage(plot.plant, Date.now());
  if (stage === "bloom") return null;

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col)
        return { ...p, plant: { ...p.plant!, fertilizer: fertilizerType } };
      return p;
    })
  );

  const newFertilizers = state.fertilizers
    .map((f) =>
      f.type === fertilizerType ? { ...f, quantity: f.quantity - 1 } : f
    )
    .filter((f) => f.quantity > 0);

  return { ...state, grid: newGrid, fertilizers: newFertilizers };
}

export function upgradeShopSlots(state: GameState): GameState | null {
  const next = getNextShopSlotUpgrade(state.shopSlots);
  if (!next) return null;
  if (state.coins < next.cost) return null;

  const newSlotCount = next.slots - state.shopSlots;
  const emptySlots: ShopSlot[] = Array.from({ length: newSlotCount }, (_, i) => ({
    speciesId: `empty_${Date.now()}_${i}`,
    price:     0,
    quantity:  0,
    isEmpty:   true,
  }));

  // Insert empty placeholders after flower slots, before fertilizer slots
  const flowerSlots = state.shop.filter((s) => !s.isFertilizer);
  const fertSlots   = state.shop.filter((s) => s.isFertilizer);

  return {
    ...state,
    coins:     state.coins - next.cost,
    shopSlots: next.slots,
    shop:      [...flowerSlots, ...emptySlots, ...fertSlots],
  };
}

export function botanyConvert(
  state: GameState,
  selections: { speciesId: string; mutation?: MutationType }[]
): { state: GameState; outputSpeciesId: string } | null {
  if (selections.length === 0) return null;

  // Validate all selections share the same rarity
  const firstSpecies = getFlower(selections[0].speciesId);
  if (!firstSpecies) return null;
  const rarity = firstSpecies.rarity;

  const required = BOTANY_REQUIREMENTS[rarity];
  if (!required) return null;
  if (selections.length !== required) return null;

  if (!selections.every((s) => getFlower(s.speciesId)?.rarity === rarity)) return null;

  // Validate inventory quantities
  const consumeCounts = new Map<string, number>();
  for (const sel of selections) {
    const key = `${sel.speciesId}||${sel.mutation ?? ""}`;
    consumeCounts.set(key, (consumeCounts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of consumeCounts) {
    const [speciesId, mutStr] = key.split("||");
    const mutation = mutStr ? (mutStr as MutationType) : undefined;
    const invItem = state.inventory.find(
      (i) => i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
    );
    if (!invItem || invItem.quantity < count) return null;
  }

  // Determine output rarity
  const nextRarity = NEXT_RARITY[rarity];
  if (!nextRarity) return null;

  // Pick output species — prefer ones not yet in codex, then random
  const nextRarityFlowers = FLOWERS.filter((f) => f.rarity === nextRarity);
  if (nextRarityFlowers.length === 0) return null;

  const undiscovered = nextRarityFlowers.filter(
    (f) => !isDiscovered(state.discovered, f.id)
  );
  const pool = undiscovered.length > 0 ? undiscovered : nextRarityFlowers;
  const outputSpecies = pool[Math.floor(Math.random() * pool.length)];

  // Remove consumed flowers
  let newInventory = [...state.inventory];
  for (const [key, count] of consumeCounts) {
    const [speciesId, mutStr] = key.split("||");
    const mutation = mutStr ? (mutStr as MutationType) : undefined;
    newInventory = newInventory
      .map((i) =>
        i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
          ? { ...i, quantity: i.quantity - count }
          : i
      )
      .filter((i) => i.quantity > 0);
  }

  // Add output seed
  const existingSeed = newInventory.find(
    (i) => i.speciesId === outputSpecies.id && i.isSeed
  );
  if (existingSeed) {
    newInventory = newInventory.map((i) =>
      i.speciesId === outputSpecies.id && i.isSeed
        ? { ...i, quantity: i.quantity + 1 }
        : i
    );
  } else {
    newInventory.push({ speciesId: outputSpecies.id, quantity: 1, isSeed: true });
  }

  return {
    state: { ...state, inventory: newInventory },
    outputSpeciesId: outputSpecies.id,
  };
}

export function botanyConvertAll(
  state: GameState,
  rarity: Rarity
): { state: GameState; outputSpeciesIds: string[] } | null {
  const required = BOTANY_REQUIREMENTS[rarity];
  if (!required) return null;

  let current = state;
  const outputs: string[] = [];

  while (true) {
    // Get eligible inventory for this rarity
    const eligible = current.inventory.filter((item) => {
      if (item.isSeed) return false;
      const species = getFlower(item.speciesId);
      return species?.rarity === rarity && item.quantity > 0;
    });

    const totalEligible = eligible.reduce((sum, i) => sum + i.quantity, 0);
    if (totalEligible < required) break;

    // Build selections greedily from available inventory
    const selections: { speciesId: string; mutation?: MutationType }[] = [];
    const tempUsed = new Map<string, number>();

    for (const item of eligible) {
      const key      = `${item.speciesId}||${item.mutation ?? ""}`;
      const used     = tempUsed.get(key) ?? 0;
      const avail    = item.quantity - used;
      const toTake   = Math.min(avail, required - selections.length);
      for (let i = 0; i < toTake; i++) {
        selections.push({ speciesId: item.speciesId, mutation: item.mutation });
      }
      if (toTake > 0) tempUsed.set(key, used + toTake);
      if (selections.length === required) break;
    }

    if (selections.length < required) break;

    const result = botanyConvert(current, selections);
    if (!result) break;

    current = result.state;
    outputs.push(result.outputSpeciesId);
  }

  if (outputs.length === 0) return null;
  return { state: current, outputSpeciesIds: outputs };
}

export function upgradeFarm(state: GameState): GameState | null {
  const next = getNextUpgrade(state.farmRows, state.farmSize);
  if (!next) return null;
  if (state.coins < next.cost) return null;

  return {
    ...state,
    coins:    state.coins - next.cost,
    farmSize: next.cols,
    farmRows: next.rows,
    grid:     resizeGrid(state.grid, next.rows, next.cols),
    shop:     generateShop(state.shopSlots),
  };
}