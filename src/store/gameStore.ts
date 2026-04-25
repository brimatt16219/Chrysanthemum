import { FLOWERS, MUTATIONS, getFlower, type GrowthStage, type MutationType } from "../data/flowers";
import { FERTILIZERS, getNextUpgrade, getCurrentTier, getNextShopSlotUpgrade, DEFAULT_SHOP_SLOTS, type FertilizerType } from "../data/upgrades";
import type { WeatherType } from "../data/weather";
import { WEATHER } from "../data/weather";
import { BOTANY_REQUIREMENTS, NEXT_RARITY } from "../data/botany";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlantedFlower {
  speciesId: string;
  timePlanted: number;
  fertilizer: FertilizerType | null;
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

// Total possible codex entries: 1 base + N mutations per species
export function getTotalCodexEntries(): number {
  return FLOWERS.reduce((total, f) => total + 1 + f.possibleMutations.length, 0);
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

  const total = 1 + species.possibleMutations.length;
  let found = 0;
  if (isDiscovered(discovered, speciesId)) found++;
  for (const mut of species.possibleMutations) {
    if (isDiscovered(discovered, speciesId, mut)) found++;
  }
  return { found, total };
}

// ── Shop helpers ───────────────────────────────────────────────────────────

function generateShop(shopSlots: number = DEFAULT_SHOP_SLOTS): ShopSlot[] {
  const flowerSlots = shopSlots;

  const chosen: ShopSlot[] = [];
  const usedIds = new Set<string>();

  // ── FLOWERS ─────────────────────────────
  const available   = FLOWERS.filter((f) => f.shopWeight > 0);
  const totalWeight = available.reduce((s, f) => s + f.shopWeight, 0);

  let attempts = 0;

  while (chosen.length < flowerSlots && attempts < 1000) {
    let roll = Math.random() * totalWeight;

    for (const f of available) {
      roll -= f.shopWeight;

      if (roll <= 0 && !usedIds.has(f.id)) {
        chosen.push({
          speciesId: f.id,
          price: Math.max(5, Math.floor(f.sellValue * 0.6)),
          quantity: Math.floor(Math.random() * 4) + 1,
        });

        usedIds.add(f.id);
        break;
      }
    }

    attempts++;
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
    coins:         100,
    farmSize:      size,
    farmRows:      size,
    shopSlots:     DEFAULT_SHOP_SLOTS,
    grid:          makeGrid(size, size),
    inventory:     [],
    fertilizers:   [{ type: "basic", quantity: 3 }],
    shop:          generateShop(DEFAULT_SHOP_SLOTS),
    lastShopReset: Date.now(),
    lastSaved:     Date.now(),
    discovered:    [],
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
    farmRows:   expectedRows,
    grid:       needsRebuild ? makeGrid(expectedRows, expectedCols) : save.grid,
    discovered: save.discovered ?? [],
    shopSlots:  save.shopSlots  ?? DEFAULT_SHOP_SLOTS,
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

export function getCurrentStage(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType = "clear"
): GrowthStage {
  const species = getFlower(plant.speciesId);
  if (!species) return "seed";

  const fertMultiplier = plant.fertilizer
    ? FERTILIZERS[plant.fertilizer].speedMultiplier
    : 1.0;

  const weatherMultiplier = WEATHER[weatherType].growthMultiplier;
  const multiplier = fertMultiplier * weatherMultiplier;

  const elapsed   = now - plant.timePlanted;
  const seedDone  = species.growthTime.seed   / multiplier;
  const bloomDone = seedDone + species.growthTime.sprout / multiplier;

  if (elapsed >= bloomDone) return "bloom";
  if (elapsed >= seedDone)  return "sprout";
  return "seed";
}

export function getStageProgress(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType = "clear"
): number {
  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const fertMultiplier = plant.fertilizer
    ? FERTILIZERS[plant.fertilizer].speedMultiplier
    : 1.0;

  const weatherMultiplier = WEATHER[weatherType].growthMultiplier;
  const multiplier = fertMultiplier * weatherMultiplier;

  const elapsed   = now - plant.timePlanted;
  const seedDone  = species.growthTime.seed   / multiplier;
  const bloomDone = seedDone + species.growthTime.sprout / multiplier;

  if (elapsed >= bloomDone) return 1;
  if (elapsed >= seedDone)
    return (elapsed - seedDone) / (species.growthTime.sprout / multiplier);
  return elapsed / seedDone;
}

export function getMsUntilNextStage(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType = "clear"
): number {
  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const fertMultiplier = plant.fertilizer
    ? FERTILIZERS[plant.fertilizer].speedMultiplier
    : 1.0;

  const weatherMultiplier = WEATHER[weatherType].growthMultiplier;
  const multiplier = fertMultiplier * weatherMultiplier;

  const elapsed   = now - plant.timePlanted;
  const seedDone  = species.growthTime.seed   / multiplier;
  const bloomDone = seedDone + species.growthTime.sprout / multiplier;

  if (elapsed >= bloomDone) return 0;
  if (elapsed >= seedDone)  return Math.ceil(bloomDone - elapsed);
  return Math.ceil(seedDone - elapsed);
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

function rollMutation(
  speciesId: string,
  weatherType: WeatherType = "clear"
): MutationType | undefined {
  const species = getFlower(speciesId);
  if (!species || species.possibleMutations.length === 0) return undefined;

  const boost = WEATHER[weatherType].mutationBoost;

  for (const mutId of species.possibleMutations) {
    const mut = MUTATIONS[mutId];
    const chance = boost?.mutation === mutId
      ? mut.chance * boost.multiplier
      : mut.chance;
    if (Math.random() < chance) return mutId;
  }
  return undefined;
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
  const mutation      = rollMutation(speciesId, weatherType);
  const species       = getFlower(speciesId)!;

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