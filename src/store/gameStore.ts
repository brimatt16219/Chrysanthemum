import { FLOWERS, getFlower, type GrowthStage } from "../data/flowers";
import { FARM_UPGRADES, getNextUpgrade } from "../data/upgrades";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlantedFlower {
  speciesId: string;        // references FLOWERS[].id
  timePlanted: number;      // Date.now() when seed was placed
}

export interface Plot {
  id: string;               // "row-col"
  plant: PlantedFlower | null;
}

export interface InventoryItem {
  speciesId: string;
  quantity: number;
}

export interface ShopSlot {
  speciesId: string;
  price: number;            // buy price (slightly above sell value)
  quantity: number;         // how many the shop has in stock
}

export interface GameState {
  coins: number;
  farmSize: number;
  grid: Plot[][];
  inventory: InventoryItem[];
  shop: ShopSlot[];
  lastShopReset: number;    // timestamp of last hourly restock
  lastSaved: number;        // timestamp of last save
}

// ── Constants ──────────────────────────────────────────────────────────────

const SAVE_KEY = "chrysanthemum_save";
const SHOP_RESET_INTERVAL = 60 * 60 * 1_000; // 1 hour in ms
const SHOP_SLOTS = 6;                          // how many items the shop shows

// ── Grid helpers ───────────────────────────────────────────────────────────

export function makeGrid(size: number): Plot[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      id: `${row}-${col}`,
      plant: null,
    }))
  );
}

// Preserve existing plants when expanding the grid
export function resizeGrid(old: Plot[][], newSize: number): Plot[][] {
  return Array.from({ length: newSize }, (_, row) =>
    Array.from({ length: newSize }, (_, col) => {
      const existing = old[row]?.[col];
      return existing ?? { id: `${row}-${col}`, plant: null };
    })
  );
}

// ── Growth calculation ─────────────────────────────────────────────────────

// Given a planted flower and the current time, return its current growth stage.
// This is the key function that makes offline growth work — no timers needed.
export function getCurrentStage(plant: PlantedFlower, now: number): GrowthStage {
  const species = getFlower(plant.speciesId);
  if (!species) return "seed";

  const elapsed = now - plant.timePlanted;
  const seedDone = species.growthTime.seed;
  const bloomDone = seedDone + species.growthTime.sprout;

  if (elapsed >= bloomDone) return "bloom";
  if (elapsed >= seedDone)  return "sprout";
  return "seed";
}

// Returns 0–1 progress within the current stage (for progress bars)
export function getStageProgress(plant: PlantedFlower, now: number): number {
  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const elapsed = now - plant.timePlanted;
  const seedDone = species.growthTime.seed;
  const bloomDone = seedDone + species.growthTime.sprout;

  if (elapsed >= bloomDone) return 1;

  if (elapsed >= seedDone) {
    return (elapsed - seedDone) / species.growthTime.sprout;
  }

  return elapsed / species.growthTime.seed;
}

// ── Shop helpers ───────────────────────────────────────────────────────────

// Weighted random selection — higher shopWeight = appears more often
function weightedSample(count: number): string[] {
  const pool: string[] = [];

  FLOWERS.forEach((f) => {
    for (let i = 0; i < f.shopWeight; i++) pool.push(f.id);
  });

  const picked = new Set<string>();
  const result: string[] = [];

  // Keep picking until we have `count` unique species
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
  const ids = weightedSample(SHOP_SLOTS);
  return ids.map((id) => {
    const species = getFlower(id)!;
    return {
      speciesId: id,
      // Shop charges 2× sell value — gives the player a reason to grow, not just buy
      price: species.sellValue * 2,
      quantity: Math.floor(Math.random() * 4) + 2, // 2–5 in stock
    };
  });
}

// ── Default state ──────────────────────────────────────────────────────────

function defaultState(): GameState {
  return {
    coins: 50,              // starting coins — enough to buy one or two common seeds
    farmSize: 3,
    grid: makeGrid(3),
    inventory: [],
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

// Called once on load. Handles everything that happened while the tab was closed:
// — growth is already handled by getCurrentStage() at render time (time-based)
// — shop restock: if >= 1 hour has passed since last reset, generate new stock
export interface OfflineSummary {
  minutesAway: number;
  readyToHarvest: number;    // plants that bloomed while away
  shopRestocked: boolean;
}

// Change the return type and export the summary
export function applyOfflineTick(state: GameState): {
  state: GameState;
  summary: OfflineSummary;
} {
  const now = Date.now();
  const minutesAway = Math.floor((now - state.lastSaved) / 60_000);
  let updated = { ...state };
  let shopRestocked = false;

  const timeSinceReset = now - state.lastShopReset;
  if (timeSinceReset >= SHOP_RESET_INTERVAL) {
    updated = { ...updated, shop: generateShop(), lastShopReset: now };
    shopRestocked = true;
  }

  // Count how many plants bloomed while away
  const readyToHarvest = updated.grid
    .flat()
    .filter(
      (p) => p.plant && getCurrentStage(p.plant, now) === "bloom"
    ).length;

  return {
    state: updated,
    summary: { minutesAway, readyToHarvest, shopRestocked },
  };
}

// ── Game actions ───────────────────────────────────────────────────────────
// These are pure functions — they take state + args and return new state.
// The UI calls these and saves the result.

// Plant a seed in an empty plot
export function plantSeed(
  state: GameState,
  row: number,
  col: number,
  speciesId: string
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot || plot.plant) return null; // plot occupied or invalid

  // Check player has the seed in inventory
  const invItem = state.inventory.find(
    (i) => i.speciesId === speciesId
  );
  if (!invItem || invItem.quantity < 1) return null;

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col) {
        return { ...p, plant: { speciesId, timePlanted: Date.now() } };
      }
      return p;
    })
  );

  const newInventory = state.inventory
    .map((i) =>
      i.speciesId === speciesId
        ? { ...i, quantity: i.quantity - 1 }
        : i
    )
    .filter((i) => i.quantity > 0);

  return { ...state, grid: newGrid, inventory: newInventory };
}

// Harvest a bloomed plant — adds to inventory, clears the plot
export function harvestPlant(
  state: GameState,
  row: number,
  col: number
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot?.plant) return null;

  const stage = getCurrentStage(plot.plant, Date.now());
  if (stage !== "bloom") return null; // not ready

  const { speciesId } = plot.plant;

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col) return { ...p, plant: null };
      return p;
    })
  );

  const existing = state.inventory.find((i) => i.speciesId === speciesId);
  const newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId ? { ...i, quantity: i.quantity + 1 } : i
      )
    : [...state.inventory, { speciesId, quantity: 1 }];

  return { ...state, grid: newGrid, inventory: newInventory };
}

// Sell a harvested flower from inventory
export function sellFlower(
  state: GameState,
  speciesId: string,
  quantity: number = 1
): GameState | null {
  const item = state.inventory.find((i) => i.speciesId === speciesId);
  if (!item || item.quantity < quantity) return null;

  const species = getFlower(speciesId);
  if (!species) return null;

  const earned = species.sellValue * quantity;

  const newInventory = state.inventory
    .map((i) =>
      i.speciesId === speciesId
        ? { ...i, quantity: i.quantity - quantity }
        : i
    )
    .filter((i) => i.quantity > 0);

  return {
    ...state,
    coins: state.coins + earned,
    inventory: newInventory,
  };
}

// Buy a seed from the shop
export function buyFromShop(
  state: GameState,
  speciesId: string
): GameState | null {
  const slot = state.shop.find((s) => s.speciesId === speciesId);
  if (!slot || slot.quantity < 1) return null;
  if (state.coins < slot.price) return null;

  const newShop = state.shop.map((s) =>
    s.speciesId === speciesId ? { ...s, quantity: s.quantity - 1 } : s
  );

  const existing = state.inventory.find((i) => i.speciesId === speciesId);
  const newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId ? { ...i, quantity: i.quantity + 1 } : i
      )
    : [...state.inventory, { speciesId, quantity: 1 }];

  return {
    ...state,
    coins: state.coins - slot.price,
    shop: newShop,
    inventory: newInventory,
  };
}

// Upgrade the farm size
export function upgradeFarm(state: GameState): GameState | null {
  const next = getNextUpgrade(state.farmSize);
  if (!next) return null;             // already maxed
  if (state.coins < next.cost) return null; // can't afford

  return {
    ...state,
    coins: state.coins - next.cost,
    farmSize: next.size,
    grid: resizeGrid(state.grid, next.size),
  };
}

// Trigger a manual shop restock check (called by setInterval in UI)
export function tickShop(state: GameState): GameState {
  const now = Date.now();
  if (now - state.lastShopReset < SHOP_RESET_INTERVAL) return state;

  return {
    ...state,
    shop: generateShop(),
    lastShopReset: now,
  };
}

// How many ms until the next shop restock
export function msUntilShopReset(state: GameState): number {
  return Math.max(0, SHOP_RESET_INTERVAL - (Date.now() - state.lastShopReset));
}