import { FLOWERS, MUTATIONS, getFlower, type GrowthStage, type MutationType } from "../data/flowers";
import { FERTILIZERS, getNextUpgrade, type FertilizerType } from "../data/upgrades";

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
}

export interface GameState {
  coins: number;
  farmSize: number;
  grid: Plot[][];
  inventory: InventoryItem[];
  fertilizers: FertilizerItem[];
  shop: ShopSlot[];
  lastShopReset: number;
  lastSaved: number;
}

export interface OfflineSummary {
  minutesAway: number;
  readyToHarvest: number;
  shopRestocked: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SAVE_KEY = "chrysanthemum_save";
const SHOP_RESET_INTERVAL = 5 * 60 * 1_000; // 5 min
const SHOP_FLOWER_SLOTS = 4;

// ── Grid helpers ───────────────────────────────────────────────────────────

export function makeGrid(size: number): Plot[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      id: `${row}-${col}`,
      plant: null,
    }))
  );
}

export function resizeGrid(old: Plot[][], newSize: number): Plot[][] {
  return Array.from({ length: newSize }, (_, row) =>
    Array.from({ length: newSize }, (_, col) => {
      const existing = old[row]?.[col];
      return existing ?? { id: `${row}-${col}`, plant: null };
    })
  );
}

// ── Growth calculation ─────────────────────────────────────────────────────

export function getCurrentStage(plant: PlantedFlower, now: number): GrowthStage {
  const species = getFlower(plant.speciesId);
  if (!species) return "seed";

  const multiplier = plant.fertilizer
    ? FERTILIZERS[plant.fertilizer].speedMultiplier
    : 1.0;

  const elapsed   = now - plant.timePlanted;
  const seedDone  = species.growthTime.seed   / multiplier;
  const bloomDone = seedDone + species.growthTime.sprout / multiplier;

  if (elapsed >= bloomDone) return "bloom";
  if (elapsed >= seedDone)  return "sprout";
  return "seed";
}

export function getStageProgress(plant: PlantedFlower, now: number): number {
  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const multiplier = plant.fertilizer
    ? FERTILIZERS[plant.fertilizer].speedMultiplier
    : 1.0;

  const elapsed   = now - plant.timePlanted;
  const seedDone  = species.growthTime.seed   / multiplier;
  const bloomDone = seedDone + species.growthTime.sprout / multiplier;

  if (elapsed >= bloomDone) return 1;
  if (elapsed >= seedDone)
    return (elapsed - seedDone) / (species.growthTime.sprout / multiplier);
  return elapsed / seedDone;
}

export function getMsUntilNextStage(plant: PlantedFlower, now: number): number {
  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const multiplier = plant.fertilizer
    ? FERTILIZERS[plant.fertilizer].speedMultiplier
    : 1.0;

  const elapsed   = now - plant.timePlanted;
  const seedDone  = species.growthTime.seed   / multiplier;
  const bloomDone = seedDone + species.growthTime.sprout / multiplier;

  if (elapsed >= bloomDone) return 0;
  if (elapsed >= seedDone)  return Math.ceil(bloomDone - elapsed);
  return Math.ceil(seedDone - elapsed);
}

// ── Shop helpers ───────────────────────────────────────────────────────────

function weightedSample(count: number): string[] {
  const pool: string[] = [];
  FLOWERS.forEach((f) => {
    for (let i = 0; i < f.shopWeight; i++) pool.push(f.id);
  });

  const picked = new Set<string>();
  const result: string[] = [];
  let attempts = 0;

  while (result.length < count && attempts < 1000) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (!picked.has(id)) {
      picked.add(id);
      result.push(id);
    }
    attempts++;
  }

  return result;
}

function generateShop(): ShopSlot[] {
  const flowerIds = weightedSample(SHOP_FLOWER_SLOTS);
  const flowerSlots: ShopSlot[] = flowerIds.map((id) => {
    const species = getFlower(id)!;
    return {
      speciesId: id,
      price:  Math.max(5, Math.floor(species.sellValue * 0.6)),
      quantity: Math.floor(Math.random() * 4) + 2,
    };
  });

  const fertTypes: FertilizerType[] = ["basic", "premium", "miracle"];
  const pickedFerts = [...fertTypes].sort(() => Math.random() - 0.5).slice(0, 2);

  const fertSlots: ShopSlot[] = pickedFerts.map((type) => ({
    speciesId: `fertilizer_${type}`,
    price: FERTILIZERS[type].shopPrice,
    quantity: Math.floor(Math.random() * 3) + 1,
    isFertilizer: true,
    fertilizerType: type,
  }));

  return [...flowerSlots, ...fertSlots];
}

// ── Default state ──────────────────────────────────────────────────────────

export function defaultState(): GameState {
  return {
    coins: 50,
    farmSize: 3,
    grid: makeGrid(3),
    inventory: [],
    fertilizers: [
      { type: "basic", quantity: 3 },
    ],
    shop: generateShop(),
    lastShopReset: Date.now(),
    lastSaved: Date.now(),
  };
}

// ── Save / Load ────────────────────────────────────────────────────────────

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSaved: Date.now() }));
  } catch (e) {
    console.warn("Failed to save game:", e);
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
    return applyOfflineTick(parsed);
  } catch (e) {
    console.warn("Failed to load save, starting fresh:", e);
    const state = defaultState();
    return { state, summary: { minutesAway: 0, readyToHarvest: 0, shopRestocked: false } };
  }
}

export function resetGame(): GameState {
  localStorage.removeItem(SAVE_KEY);
  return defaultState();
}

// ── Offline tick ───────────────────────────────────────────────────────────

export function applyOfflineTick(state: GameState): { state: GameState; summary: OfflineSummary } {
  const now = Date.now();
  const minutesAway = Math.floor((now - state.lastSaved) / 60_000);
  let updated = { ...state };
  let shopRestocked = false;

  const timeSinceReset = now - state.lastShopReset;
  if (timeSinceReset >= SHOP_RESET_INTERVAL) {
    updated = { ...updated, shop: generateShop(), lastShopReset: now };
    shopRestocked = true;
  }

  const readyToHarvest = updated.grid
    .flat()
    .filter((p) => p.plant && getCurrentStage(p.plant, now) === "bloom").length;

  return {
    state: updated,
    summary: { minutesAway, readyToHarvest, shopRestocked },
  };
}

// ── Shop tick (called every minute while app is open) ─────────────────────

export function tickShop(state: GameState): GameState {
  const now = Date.now();
  if (now - state.lastShopReset < SHOP_RESET_INTERVAL) return state;
  return { ...state, shop: generateShop(), lastShopReset: now };
}

export function msUntilShopReset(state: GameState): number {
  return Math.max(0, SHOP_RESET_INTERVAL - (Date.now() - state.lastShopReset));
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
    (i) => i.speciesId === speciesId && !i.mutation
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
      i.speciesId === speciesId && !i.mutation
        ? { ...i, quantity: i.quantity - 1 }
        : i
    )
    .filter((i) => i.quantity > 0);

  return { ...state, grid: newGrid, inventory: newInventory };
}

function rollMutation(speciesId: string): MutationType | undefined {
  const species = getFlower(speciesId);
  if (!species || species.possibleMutations.length === 0) return undefined;

  for (const mutId of species.possibleMutations) {
    const mut = MUTATIONS[mutId];
    if (Math.random() < mut.chance) return mutId;
  }
  return undefined;
}

export function harvestPlant(
  state: GameState,
  row: number,
  col: number
): { state: GameState; mutation: MutationType | undefined } | null {
  const plot = state.grid[row]?.[col];
  if (!plot?.plant) return null;

  const stage = getCurrentStage(plot.plant, Date.now());
  if (stage !== "bloom") return null;

  const { speciesId } = plot.plant;
  const mutation = rollMutation(speciesId);
  const species = getFlower(speciesId)!;

  const bonusCoins = mutation
    ? Math.floor(species.sellValue * (MUTATIONS[mutation].valueMultiplier - 1))
    : 0;

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col) return { ...p, plant: null };
      return p;
    })
  );

  const existing = state.inventory.find(
    (i) => i.speciesId === speciesId && i.mutation === mutation
  );
  const newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId && i.mutation === mutation
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
    : [...state.inventory, { speciesId, quantity: 1, mutation }];

  return {
    state: { ...state, coins: state.coins + bonusCoins, grid: newGrid, inventory: newInventory },
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
    (i) => i.speciesId === speciesId && i.mutation === mutation
  );
  if (!item || item.quantity < quantity) return null;

  const species = getFlower(speciesId);
  if (!species) return null;

  const multiplier = mutation ? MUTATIONS[mutation].valueMultiplier : 1;
  const earned = Math.floor(species.sellValue * multiplier) * quantity;

  const newInventory = state.inventory
    .map((i) =>
      i.speciesId === speciesId && i.mutation === mutation
        ? { ...i, quantity: i.quantity - quantity }
        : i
    )
    .filter((i) => i.quantity > 0);

  return { ...state, coins: state.coins + earned, inventory: newInventory };
}

export function buyFromShop(
  state: GameState,
  speciesId: string
): GameState | null {
  const slot = state.shop.find((s) => s.speciesId === speciesId && !s.isFertilizer);
  if (!slot || slot.quantity < 1) return null;
  if (state.coins < slot.price) return null;

  const newShop = state.shop.map((s) =>
    s.speciesId === speciesId && !s.isFertilizer
      ? { ...s, quantity: s.quantity - 1 }
      : s
  );

  const existing = state.inventory.find((i) => i.speciesId === speciesId && !i.mutation);
  const newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId && !i.mutation
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
    : [...state.inventory, { speciesId, quantity: 1 }];

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
    coins: state.coins - slot.price,
    shop: newShop,
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

export function upgradeFarm(state: GameState): GameState | null {
  const next = getNextUpgrade(state.farmSize);
  if (!next) return null;
  if (state.coins < next.cost) return null;

  return {
    ...state,
    coins: state.coins - next.cost,
    farmSize: next.size,
    grid: resizeGrid(state.grid, next.size),
  };
}

