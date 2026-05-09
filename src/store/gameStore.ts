import { FLOWERS, MUTATIONS, getFlower, type FlowerType, type GrowthStage, type MutationType, type Rarity } from "../data/flowers";
import { FERTILIZERS, getNextUpgrade, getNextShopSlotUpgrade, getNextMarketplaceSlotUpgrade, getNextSupplySlotUpgrade, DEFAULT_SHOP_SLOTS, DEFAULT_SUPPLY_SLOTS, type FertilizerType } from "../data/upgrades";
import type { WeatherType } from "../data/weather";
import { WEATHER } from "../data/weather";
import { mergeEssences, calculateEssenceYield, type EssenceItem } from "../data/essences";
import {
  CONSUMABLE_RECIPE_MAP, consumableShopPrice,
  type ConsumableItem, type ConsumableId,
} from "../data/consumables";
import {
  WEATHER_MUT_CHANCE_PER_TICK,
  THUNDERSTORM_WET_CHANCE_PER_TICK,
  THUNDERSTORM_SHOCKED_CHANCE_PER_TICK,
  MOONLIT_NIGHT_CHANCE_PER_TICK,
} from "../data/weatherMutationRates";
import {
  GEAR, isGearExpired, getGearAffectingCell, getAffectedCells,
  isRegularSprinkler, isMutationSprinkler,
  isScarecrow, isAegis, isGrowLamp, isComposter, isFan, isHarvestBell, isLawnmower, isBalanceScale, isAqueduct, isAutoPlanter,
  rollComposterFertilizer, findCrossbreedRecipe,
  SUPPLY_POOLS, SUPPLY_RARITY_WEIGHTS, isRarityUnlocked,
  type GearType, type PlacedGear, type GearInventoryItem, type FanDirection,
} from "../data/gear";
import type { DailyTaskState } from "../lib/dailySeed";
import type { AchievementStats } from "../data/achievements";

// ── Events ───────────────────────────────────────────────────────────────────

export interface EventProgress {
  claimedDays?:     number[];
  lastClaimedAt?:   string;
  completedQuests?: string[];
  claimedRewards?:  string[];
}

export interface EventEntry {
  id:          string;
  type:        string;
  name:        string;
  description: string;
  startsAt:    string;
  endsAt:      string;
  config:      unknown;
  progress:    EventProgress | null;
}

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
  /** 1.25 if this species was fully mastered in the codex at plant time (20% faster growth), otherwise undefined */
  masteredBonus?: number;
  /** true when an Attunement Crystal has been applied to this plant — marks it as an active cross-breed participant */
  infused?: boolean; // kept as "infused" in DB/persistence; displayed as "Attuned" in UI
  /** Set by Heirloom Charm — harvest returns the seed to inventory instead of consuming it */
  heirloomActive?: boolean;
  /** Legacy: set by old Purity Vial behaviour — harvest clears any mutation. No longer written by new code; kept for save compatibility. */
  mutationBlocked?: boolean;
  /** Set by Giant Vial — harvest forces Giant mutation regardless of weather roll */
  forcedMutation?: "giant";
  /** Set by mutation-boost vials — multiplies the chance of the specified mutation during harvest */
  mutationBoost?: { mutation: string; multiplier: number };
  /** Set by Magnifying Glass — locks in whatever mutation state the plant currently has.
   *  Future weather/sprinkler/fan ticks skip this plant so its mutation can no longer change. */
  revealed?: boolean;
  /** Set by Garden Pin — when bloomed, the plant is shielded from auto-harvest
   *  (Harvest Bell, Auto-Planter). Manual harvest still works. */
  pinned?: boolean;
  /** Set by Ruler — permanently shows the live gear growth multiplier as a badge on this tile. */
  showMultiplier?: boolean;
}

export interface Plot {
  id:    string;
  plant: PlantedFlower | null;
  /** A piece of gear occupying this slot — mutually exclusive with plant */
  gear:  PlacedGear | null;
}

export type { GearType, PlacedGear, GearInventoryItem };

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

export type { EssenceItem };

export interface ShopSlot {
  speciesId:     string;
  price:         number;
  quantity:      number;
  isFertilizer?: boolean;
  fertilizerType?: FertilizerType;
  isEmpty?:      boolean;
  /** Supply shop: this slot is a gear item */
  isGear?:       boolean;
  gearType?:     GearType;
  /** Supply shop: this slot is a craftable consumable */
  isConsumable?: boolean;
  consumableId?: string;
  /** Pinned by a Slot Lock — survives the next supply shop refresh */
  locked?:       boolean;
}

// ── Crafting queue ─────────────────────────────────────────────────────────

export type CraftKind = "gear" | "consumable" | "attunement" | "essence";

// ── Active speed-boost consumables (Phase 5a) ─────────────────────────────────
// Verdant Rush  → "growth"     → 2× growth speed for all plants
// Forge Haste   → "craft"      → 2× progress on gear + consumable craft entries
// Resonance Draft → "attunement" → 2× progress on attunement craft entries
export type ActiveBoostType = "growth" | "craft" | "attunement";

export interface ActiveBoost {
  type:         ActiveBoostType;
  expiresAt:    string;   // ISO timestamp
  consumableId: string;   // e.g. "verdant_rush_3" — for UI display + telemetry
}

/** Map a speed_boost consumable id → boost type. Returns null for non-boost ids. */
export function consumableToBoostType(consumableId: string): ActiveBoostType | null {
  if (consumableId.startsWith("verdant_rush_"))    return "growth";
  if (consumableId.startsWith("forge_haste_"))     return "craft";
  if (consumableId.startsWith("resonance_draft_")) return "attunement";
  return null;
}

/** Returns 2.0 if any unexpired boost of `type` exists, otherwise 1.0. */
export function getBoostMultiplier(
  activeBoosts: ActiveBoost[] | undefined,
  type:         ActiveBoostType,
  now:          number,
): number {
  if (!activeBoosts) return 1;
  for (const b of activeBoosts) {
    if (b.type === type && new Date(b.expiresAt).getTime() > now) return 2;
  }
  return 1;
}

/** Drop expired boosts. Pure — returns a new array. */
export function pruneActiveBoosts(boosts: ActiveBoost[] | undefined, now: number): ActiveBoost[] {
  if (!boosts || boosts.length === 0) return [];
  return boosts.filter((b) => new Date(b.expiresAt).getTime() > now);
}

export interface CraftingQueueEntry {
  id:         string;      // server-generated uuid
  kind:       CraftKind;
  outputId:   string;      // gearType | consumableId | rarity string (for attunement)
  startedAt:  string;      // ISO timestamp
  durationMs: number;      // total duration (includes quantity multiplier)
  // Bulk crafting — number of output items the entry will deliver on collect.
  // Defaults to 1 if absent (legacy entries created before bulk crafting shipped).
  // Costs already stored on this entry have been multiplied by quantity at start time.
  quantity?:  number;
  // Stored ingredient costs — used by craft-cancel for refund without recipe lookup.
  // Costs are stored AS PAID (already multiplied by quantity).
  essenceCosts?:    { type: string; amount: number }[];
  gearCosts?:       { gearType: string; quantity: number }[];
  consumableCosts?: { id: string; quantity: number }[];
  attunementCosts?: { rarity: string; quantity: number }[];
}

// ── Alchemy Attunement queue (v2.3) ────────────────────────────────────────
//
// One entry per in-flight alchemy attunement. The mutation outcome is rolled
// at COLLECT time (not start) so the player doesn't know what they're getting
// until the attunement finishes. Cancel refunds the source flower(s) but NOT
// the essence.
export interface AttunementQueueEntry {
  id:           string;       // server-generated uuid
  speciesId:    string;       // input flower species
  /** Mutation tier 1-4 (drives duration + which mutation pool will roll). */
  tier:         number;
  /** Mutation outcome — only present on legacy entries (pre-v2.3-collect-time-roll).
   *  Modern entries leave this undefined; collect rolls it server-side. */
  mutation?:    MutationType;
  startedAt:    string;       // ISO
  durationMs:   number;
  // Stored cost for cancel refund — flowers come back, essence does not.
  flowerCount:        number;
  flowerSourceMutation?: MutationType; // mutation of the input bloom (undefined = base)
}

export interface GameState {
  coins:    number;
  farmSize: number; // column count (max 6)
  farmRows: number; // row count (equals farmSize for square grids, can exceed for 7×6+)
  shopSlots:   number;
  grid:        Plot[][];
  inventory:   InventoryItem[];
  fertilizers: FertilizerItem[];
  shop:          ShopSlot[];
  lastShopReset: number;
  lastSaved:     number;
  // Codex — tracks every species + mutation combo ever harvested
  // Format: "speciesId" for base, "speciesId:mutationId" for mutated
  discovered: string[];
  // Codex acknowledged — entries the user has opened in the Codex UI.
  // Persisted to the cloud so "newly discovered" badges sync across devices.
  codexAcked: string[];
  // Weather forecast — number of upcoming slots the player has purchased (0 = not unlocked)
  weatherForecastSlots: number;
  // Marketplace — number of active listing slots the player has purchased (0 = not unlocked)
  marketplaceSlots: number;
  // Supply shop (fertilizers + gear)
  supplySlots:      number;
  supplyShop:       ShopSlot[];
  lastSupplyReset:  number;
  gearInventory:    GearInventoryItem[];
  // Alchemy — essence tokens per flower type
  essences:          EssenceItem[];
  // Cross-breeding (passive Cropsticks system) — recipe IDs discovered via farm production.
  discoveredRecipes: string[];
  // Attunement Crystals — applied to bloomed plants to mark them as cross-breed participants.
  // Stored by rarity (must match the flower's rarity to apply). DB column: "infusers".
  infusers: { rarity: Rarity; quantity: number }[];
  // Crafted consumable items (Bloom Burst, vials, Eclipse Tonic, etc.)
  consumables: ConsumableItem[];
  // ISO date "YYYY-MM-DD" of last Eclipse Tonic use — enforces once-per-day limit
  lastEclipseTonic: string | null;
  // Unix timestamp of last Wind Shear use — enforces 1-hour cooldown
  lastWindShearUsed: number | null;
  // Phase 3 — time-gated crafting queue
  craftingQueue:     CraftingQueueEntry[];
  craftingSlotCount: number;
  // v2.3 — Alchemy attunement queue (separate from crafting). Player starts
  // with 0 slots and buys up to 4 via the upgrade edge function. Each queue
  // entry stores the rolled mutation outcome + the source flower so cancel
  // can refund the bloom (essence is consumed at start, not refundable).
  attunementSlots: number;
  attunementQueue: AttunementQueueEntry[];
  // Phase 5a — active speed-boost consumables (Verdant Rush, Forge Haste, Resonance Draft).
  // Each entry tracks one consumable activation with its expiry. Multiple of the same type
  // are allowed but only the latest expiry matters; getBoostMultiplier returns 2× while any
  // matching boost is unexpired, otherwise 1×.
  activeBoosts:      ActiveBoost[];
  // Server sync — the updated_at value from the last successful DB read or write.
  // saveToCloud uses this as a CAS guard so stale sessions can't overwrite
  // server-authoritative state (inventory, coins, etc.) with stale client data.
  serverUpdatedAt:   string | null;
  
  gardenerLevel: number,
  gardenerXp: number,
  dailyTasks: DailyTaskState | null,
  gems:       number,
  achievementStats:    AchievementStats,
  achievementsClaimed: string[],
  events:              EventEntry[],
}

export interface OfflineSummary {
  minutesAway: number;
  readyToHarvest: number;
  shopRestocked: boolean;
  supplyRestocked: boolean;
  /** Crafting queue entries whose duration has elapsed but haven't been collected. */
  craftsReady: number;
  /** Alchemy attunement queue entries whose duration has elapsed. */
  attunementsReady: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SAVE_KEY            = "chrysanthemum_save";
const SHOP_RESET_INTERVAL = 5 * 60 * 1_000; // 5 minutes

// ── Grid helpers ───────────────────────────────────────────────────────────

export function makeGrid(rows: number, cols: number): Plot[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      id:    `${row}-${col}`,
      plant: null,
      gear:  null,
    }))
  );
}

export function resizeGrid(old: Plot[][], newRows: number, newCols: number): Plot[][] {
  return Array.from({ length: newRows }, (_, row) =>
    Array.from({ length: newCols }, (_, col) => {
      const existing = old[row]?.[col];
      return existing ?? { id: `${row}-${col}`, plant: null, gear: null };
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

// Returns true when all 10 codex entries (base + 9 mutations) are filled for a species
export function isSpeciesMastered(discovered: string[], speciesId: string): boolean {
  const { found, total } = getSpeciesCompletion(discovered, speciesId);
  return total > 0 && found === total;
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

/**
 * Seed price as a fraction of sellValue, tiered by rarity. Early-game flowers
 * get a higher % profit margin (0.65 → 35% margin) and late-game flowers a
 * tighter margin (0.85 → 15%). Stops bulk-buying high-rarity seeds from being
 * a free coin printer once the player can afford them.
 */
export function floorToTwoSigFigs(n: number): number {
  if (n < 100) return n;
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.floor(n / magnitude) * magnitude;
}
const SEED_PRICE_RATIO: Record<Rarity, number> = {
  common:    0.65,
  uncommon:  0.68,
  rare:      0.72,
  legendary: 0.75,
  mythic:    0.78,
  exalted:   0.82,
  prismatic: 0.85,
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
      price:     floorToTwoSigFigs(Math.max(5, Math.floor(flower.sellValue * SEED_PRICE_RATIO[flower.rarity]))),
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
// ── Supply shop generation ─────────────────────────────────────────────────

export const SUPPLY_RESET_INTERVAL = 10 * 60 * 1_000; // 10 minutes

export function msUntilSupplyReset(state: GameState): number {
  return Math.max(0, SUPPLY_RESET_INTERVAL - (Date.now() - (state.lastSupplyReset ?? 0)));
}

function generateSupplyShop(supplySlots: number = DEFAULT_SUPPLY_SLOTS): ShopSlot[] {
  const chosen: ShopSlot[] = [];

  const eligibleRarities = (Object.entries(SUPPLY_RARITY_WEIGHTS) as [Rarity, number][])
    .filter(([rarity]) => isRarityUnlocked(rarity, supplySlots) && (SUPPLY_POOLS[rarity]?.length ?? 0) > 0);

  let attempts = 0;
  while (chosen.length < supplySlots && attempts < 1000) {
    attempts++;

    if (eligibleRarities.length === 0) break;

    // Roll a rarity by weight
    const totalWeight = eligibleRarities.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * totalWeight;
    let chosenRarity: Rarity = eligibleRarities[eligibleRarities.length - 1][0];
    for (const [rarity, weight] of eligibleRarities) {
      roll -= weight;
      if (roll <= 0) { chosenRarity = rarity; break; }
    }

    const pool = SUPPLY_POOLS[chosenRarity];
    if (!pool || pool.length === 0) continue;

    const item = pool[Math.floor(Math.random() * pool.length)];

    if (item.kind === "fertilizer") {
      const fert = FERTILIZERS[item.fertilizerType];
      chosen.push({
        speciesId:    `supply_fert_${item.fertilizerType}_${chosen.length}`,
        isFertilizer: true,
        fertilizerType: item.fertilizerType,
        price:        fert.shopPrice,
        quantity:     Math.floor(Math.random() * 3) + 1,
      });
    } else if (item.kind === "gear") {
      const gearDef = GEAR[item.gearType];
      chosen.push({
        speciesId: `supply_gear_${item.gearType}_${chosen.length}`,
        isGear:    true,
        gearType:  item.gearType,
        price:     gearDef.shopPrice,
        quantity:  1,
      });
    } else {
      // consumable — derive price from rarity + category multiplier
      const recipe = CONSUMABLE_RECIPE_MAP[item.consumableId as ConsumableId];
      if (!recipe) continue;
      chosen.push({
        speciesId:    `supply_cons_${item.consumableId}_${chosen.length}`,
        isConsumable: true,
        consumableId: item.consumableId,
        price:        consumableShopPrice(recipe),
        quantity:     1,
      });
    }
  }

  return chosen;
}

// ── Default state ──────────────────────────────────────────────────────────

export function defaultState(): GameState {
  const size = 3;
  const now  = Date.now();
  return {
    coins:                100,
    farmSize:             size,
    farmRows:             size,
    shopSlots:            DEFAULT_SHOP_SLOTS,
    grid:                 makeGrid(size, size),
    inventory:            [],
    fertilizers:          [{ type: "basic", quantity: 3 }],
    shop:                 generateShop(DEFAULT_SHOP_SLOTS),
    lastShopReset:        now,
    lastSaved:            now,
    discovered:           [],
    codexAcked:           [],
    weatherForecastSlots: 0,
    marketplaceSlots:     0,
    supplySlots:          DEFAULT_SUPPLY_SLOTS,
    supplyShop:           generateSupplyShop(DEFAULT_SUPPLY_SLOTS),
    lastSupplyReset:      now,
    gearInventory:        [],
    essences:             [],
    discoveredRecipes:    [],
    infusers:             [],
    consumables:          [],
    lastEclipseTonic:     null,
    lastWindShearUsed:    null,
    craftingQueue:        [],
    craftingSlotCount:    1,
    attunementSlots:      0,
    attunementQueue:      [],
    activeBoosts:         [],
    serverUpdatedAt:      null,
    gardenerLevel:        1,
    gardenerXp:           0,
    dailyTasks:           null,
    gems:                 0,
    achievementStats:    {},
    achievementsClaimed: [],
    events: [],
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
      return { state, summary: { minutesAway: 0, readyToHarvest: 0, shopRestocked: false, supplyRestocked: false, craftsReady: 0, attunementsReady: 0 } };
    }
    const parsed = JSON.parse(raw) as GameState;
    // Backfill discovered for saves that predate the codex
    if (!parsed.discovered) parsed.discovered = [];
    return applyOfflineTick(parsed);
  } catch (e) {
    // console.warn("Failed to load save, starting fresh:", e);
    const state = defaultState();
    return { state, summary: { minutesAway: 0, readyToHarvest: 0, shopRestocked: false, supplyRestocked: false, craftsReady: 0, attunementsReady: 0 } };
  }
}

export function resetGame(): GameState {
  localStorage.removeItem(SAVE_KEY);
  return defaultState();
}

// ── Offline tick ───────────────────────────────────────────────────────────

/**
 * Describes the active weather event that was (partially) in progress while the
 * player was offline.  Passed into applyOfflineTick so that rain / thunderstorm
 * growth bonuses are correctly applied to offline growth.
 */
export interface WeatherWindow {
  type:      WeatherType;
  startedAt: number;
  endsAt:    number;
}

export function applyOfflineTick(
  save: GameState,
  offlineWeather?: WeatherWindow,
): { state: GameState; summary: OfflineSummary } {
  const now         = Date.now();
  const minutesAway = Math.floor((now - save.lastSaved) / 60_000);

  const expectedCols = save.farmSize ?? 3;
  const expectedRows = save.farmRows ?? expectedCols; // backfill: square for old saves
  const needsRebuild =
    !save.grid ||
    save.grid.length === 0 ||
    save.grid.length    !== expectedRows ||
    save.grid[0]?.length !== expectedCols;

  const now2 = Date.now();
  let updated: GameState = {
    ...save,
    farmRows:             expectedRows,
    grid:                 needsRebuild ? makeGrid(expectedRows, expectedCols) : save.grid.map((row) =>
      row.map((plot) => plot.gear !== undefined ? plot : { ...plot, gear: null })
    ),
    discovered:           save.discovered           ?? [],
    codexAcked:           save.codexAcked           ?? [],
    shopSlots:            save.shopSlots            ?? DEFAULT_SHOP_SLOTS,
    weatherForecastSlots: save.weatherForecastSlots ?? 0,
    supplySlots:          save.supplySlots          ?? DEFAULT_SUPPLY_SLOTS,
    supplyShop:           save.supplyShop           ?? generateSupplyShop(save.supplySlots ?? DEFAULT_SUPPLY_SLOTS),
    lastSupplyReset:      save.lastSupplyReset       ?? now2,
    // Filter out gear types that no longer exist in the GEAR catalog (e.g. orphan
    // `garden_pin` from before it was migrated to a consumable). Keeps renderers
    // safe from `GEAR[type].rarity` crashes on unknown ids.
    gearInventory:        (save.gearInventory ?? []).filter((g) => GEAR[g.gearType] !== undefined),
    essences:             save.essences              ?? [],
    discoveredRecipes:    save.discoveredRecipes     ?? [],
    infusers:             save.infusers              ?? [],
    consumables:          save.consumables           ?? [],
    lastEclipseTonic:     save.lastEclipseTonic      ?? null,
    lastWindShearUsed:    save.lastWindShearUsed     ?? null,
    attunementSlots:      save.attunementSlots       ?? 0,
    attunementQueue:      save.attunementQueue       ?? [],
    activeBoosts:         pruneActiveBoosts(save.activeBoosts, now),
    gardenerLevel:        save.gardenerLevel         ?? 1,
    gardenerXp:           save.gardenerXp            ?? 0,
    dailyTasks:           save.dailyTasks            ?? null,
    gems:                 save.gems                  ?? 0,
  };

  let shopRestocked    = false;
  const timeSinceReset = now - updated.lastShopReset;

  if (timeSinceReset >= SHOP_RESET_INTERVAL) {
    updated       = { ...updated, shop: generateShop(updated.shopSlots), lastShopReset: now };
    shopRestocked = true;
  }

  // Tick supply shop reset
  let supplyRestocked = false;
  const timeSinceSupplyReset = now - (updated.lastSupplyReset ?? 0);
  if (timeSinceSupplyReset >= SUPPLY_RESET_INTERVAL) {
    updated         = { ...updated, supplyShop: regenerateSupplyShop(updated.supplySlots ?? DEFAULT_SUPPLY_SLOTS, updated.supplyShop ?? []), lastSupplyReset: now };
    supplyRestocked = true;
  }

  // Always sync prices from current data definitions so price changes take effect immediately on load
  updated = {
    ...updated,
    supplyShop: updated.supplyShop.map((slot) => {
      if (slot.isEmpty) return slot;
      if (slot.isFertilizer && slot.fertilizerType) {
        const fert = FERTILIZERS[slot.fertilizerType as FertilizerType];
        return fert ? { ...slot, price: fert.shopPrice } : slot;
      }
      if (slot.isGear && slot.gearType) {
        const gearDef = GEAR[slot.gearType as GearType];
        return gearDef ? { ...slot, price: gearDef.shopPrice } : slot;
      }
      if (slot.isConsumable && slot.consumableId) {
        const recipe = CONSUMABLE_RECIPE_MAP[slot.consumableId as ConsumableId];
        return recipe ? { ...slot, price: consumableShopPrice(recipe) } : slot;
      }
      return slot;
    }),
  };

  // Prune expired gear from grid on load
  updated = { ...updated, grid: pruneExpiredGear(updated.grid, now) };

  // ── Offline weather growth bonus ──────────────────────────────────────────
  // If rain / thunderstorm was active during part of the offline period,
  // bake the extra growth into each plant's growthMs checkpoint so that
  // getCurrentStage() and the progress bar reflect the real offline progress.
  if (offlineWeather) {
    const weatherMult = WEATHER[offlineWeather.type]?.growthMultiplier ?? 1.0;
    if (weatherMult > 1.0) {
      const offlineStart = save.lastSaved;
      // How long the weather overlapped with the offline window
      const weatherStart  = Math.max(offlineWeather.startedAt, offlineStart);
      const weatherEnd    = Math.min(offlineWeather.endsAt, now);
      const overlapMs     = Math.max(0, weatherEnd - weatherStart);

      if (overlapMs > 0) {
        const extraMult = weatherMult - 1.0; // additional multiplier above clear (1.0)
        updated = {
          ...updated,
          grid: updated.grid.map((row) =>
            row.map((plot) => {
              if (!plot.plant || plot.plant.bloomedAt) return plot;
              const fert = plot.plant.fertilizer
                ? FERTILIZERS[plot.plant.fertilizer].speedMultiplier
                : 1.0;
              const mast = plot.plant.masteredBonus ?? 1.0;
              // Compute growth accrued up to the moment the player went offline
              const growthAtSave = computeGrowthMs(plot.plant, offlineStart, "clear");
              // Extra effective ms from the weather window
              const bonusMs      = overlapMs * extraMult * fert * mast;
              return {
                ...plot,
                plant: {
                  ...plot.plant,
                  growthMs:   growthAtSave + bonusMs,
                  lastTickAt: offlineStart,
                },
              };
            })
          ),
        };
      }
    }
  }

  // Stamp stage transitions first — ensures bloomedAt is written on plants that
  // grew to bloom while offline, so tickHarvestBells can see and harvest them.
  // Stamp 6 s in the past so the bell's 5-second grace period doesn't block them.
  updated = stampStageTransitions(updated, now - 6_000, "clear");

  // Auto-harvest via any active Harvest Bells (captures offline progress)
  updated = tickHarvestBells(updated, "clear");

  // Auto-plant via any active Auto-Planters (captures offline progress)
  updated = tickAutoPlanter(updated);

  const readyToHarvest = updated.grid
    .flat()
    .filter((p) => p.plant && getCurrentStage(p.plant, now) === "bloom").length;

  // Crafts whose timer has elapsed but haven't been collected yet — surfaced
  // on the offline banner so users coming back see what's waiting in the queue.
  // Crafts run on a real-time clock, so this includes both jobs that finished
  // while offline and any that were already done when the user logged out.
  const craftsReady = (updated.craftingQueue ?? []).filter((entry) => {
    const doneAt = new Date(entry.startedAt).getTime() + entry.durationMs;
    return now >= doneAt;
  }).length;

  // Same wall-clock check for the attunement queue.
  const attunementsReady = (updated.attunementQueue ?? []).filter((entry) => {
    const doneAt = new Date(entry.startedAt).getTime() + entry.durationMs;
    return now >= doneAt;
  }).length;

  return {
    state:   updated,
    summary: { minutesAway, readyToHarvest, shopRestocked, supplyRestocked, craftsReady, attunementsReady },
  };
}

/**
 * Purely visual offline simulation — used when displaying another player's garden
 * on the profile page.  Does NOT write to the DB.  Applies the same catch-up steps
 * as applyOfflineTick so the garden looks as it would if the owner had been online:
 *   1. Stamp stage transitions  →  sets bloomedAt on plants that matured offline
 *   2. Tick harvest bells       →  removes bloomed plants in bell range
 *   3. Tick auto-planter        →  fills empty plots in planter range from inventory
 */
export function simulateOfflineGarden(save: GameState): GameState {
  const now = Date.now();
  // Prune any expired gear first (same as applyOfflineTick does)
  let sim = { ...save, grid: pruneExpiredGear(save.grid, now) };
  // Stamp bloomedAt / sproutedAt slightly in the past so tickHarvestBells'
  // 5-second grace period doesn't block plants that bloomed while offline.
  sim = stampStageTransitions(sim, now - 6_000, "clear");
  // Harvest bell auto-harvest
  sim = tickHarvestBells(sim, "clear");
  // Auto-planter fill
  sim = tickAutoPlanter(sim);
  return sim;
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

export const MAX_FORECAST_SLOTS = FORECAST_SLOT_COSTS.length; // 8

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

/**
 * Regenerate supply shop slots, preserving any slots marked as `locked`.
 * Locked slots survive one reset, then their lock is cleared.
 */
function regenerateSupplyShop(slots: number, current: ShopSlot[]): ShopSlot[] {
  const lockedSlots = current.filter((s) => s.locked && !s.isEmpty);
  const newSlotCount = Math.max(0, slots - lockedSlots.length);
  const freshSlots = generateSupplyShop(newSlotCount);
  // Clear the lock flag on kept slots so they re-roll on the next reset
  return [
    ...lockedSlots.map((s) => ({ ...s, locked: false })),
    ...freshSlots,
  ];
}

export function tickSupplyShop(state: GameState): GameState {
  const now = Date.now();
  if (now - (state.lastSupplyReset ?? 0) < SUPPLY_RESET_INTERVAL) return state;
  return {
    ...state,
    supplyShop:     regenerateSupplyShop(state.supplySlots ?? DEFAULT_SUPPLY_SLOTS, state.supplyShop ?? []),
    lastSupplyReset: now,
  };
}

/**
 * Instantly regenerates the supply shop, bypassing the reset cooldown.
 * Used by Wind Shear consumable. Preserves locked slots.
 */
export function forceRefreshSupplyShop(state: GameState): GameState {
  const now = Date.now();
  return {
    ...state,
    supplyShop:     regenerateSupplyShop(state.supplySlots ?? DEFAULT_SUPPLY_SLOTS, state.supplyShop ?? []),
    lastSupplyReset: now,
  };
}

/** Returns all PlacedGear items that have expired but not yet been removed from the grid. */
export function getExpiredGear(grid: Plot[][], now: number): PlacedGear[] {
  const expired: PlacedGear[] = [];
  for (const row of grid) {
    for (const plot of row) {
      if (plot.gear && isGearExpired(plot.gear, now)) expired.push(plot.gear);
    }
  }
  return expired;
}

/** Remove gear that has expired from the grid (called on load and each tick). */
export function pruneExpiredGear(grid: Plot[][], now: number): Plot[][] {
  let changed = false;
  const newGrid = grid.map((row) =>
    row.map((plot) => {
      if (!plot.gear) return plot;
      if (isGearExpired(plot.gear, now)) {
        changed = true;
        return { ...plot, gear: null };
      }
      return plot;
    })
  );
  return changed ? newGrid : grid;
}

/** Client-side mirror of tryStartCropsticksCycles in the apply-infuser edge function.
 *
 * After infusing the plant at (row, col), scans its 4 cardinal neighbours for idle
 * cropsticks gear.  For each idle cropsticks whose cardinal neighbours now include
 * at least two infused+bloomed plants with a valid cross-breed recipe:
 *   - Stamps crossbreedStartedAt so the progress bar appears immediately.
 *   - Stores crossbreedSourceA/B so the tick can find the plants at completion
 *     time without relying on the infused flag.
 *   - Clears plant.infused on both source plants immediately.
 *
 * Cells that already have crossbreedStartedAt set are skipped (no double-start). */
export function stampCropsticksCycles(
  grid: Plot[][],
  row:  number,
  col:  number,
  now:  number,
): Plot[][] {
  const OFFSETS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let g = grid;

  for (const [dr, dc] of OFFSETS) {
    const cr = row + dr;
    const cc = col + dc;
    const cropCell = g[cr]?.[cc];
    if (!cropCell?.gear) continue;
    if (cropCell.gear.gearType !== "cropsticks") continue;
    if (cropCell.gear.crossbreedStartedAt != null) continue; // already running

    // Collect infused+bloomed cardinal neighbours of this cropsticks WITH coordinates
    type N = { r: number; c: number; types: FlowerType[]; rarity: Rarity };
    const nbrs: N[] = [];
    for (const [or, oc] of OFFSETS) {
      const nr = cr + or;
      const nc = cc + oc;
      const nPlant = g[nr]?.[nc]?.plant;
      if (!nPlant || (!nPlant.bloomedAt && nPlant.timePlanted !== 0) || !nPlant.infused) continue;
      const sp = getFlower(nPlant.speciesId);
      if (!sp) continue;
      nbrs.push({ r: nr, c: nc, types: sp.types as FlowerType[], rarity: sp.rarity });
    }

    // Need at least 2 infused neighbours to crossbreed
    if (nbrs.length < 2) continue;

    // Pick highest-tier recipe pair; fall back to first available pair when
    // no recipe matches (tick will output the lower-rarity parent at completion).
    let bestPairTier = -1;
    let sourceA: N = nbrs[0];
    let sourceB: N = nbrs[1];
    for (let i = 0; i < nbrs.length; i++) {
      for (let j = i + 1; j < nbrs.length; j++) {
        const recipe = findCrossbreedRecipe(nbrs[i].types, nbrs[i].rarity, nbrs[j].types, nbrs[j].rarity);
        if (recipe && recipe.tier > bestPairTier) {
          bestPairTier = recipe.tier;
          sourceA = nbrs[i];
          sourceB = nbrs[j];
        }
      }
    }

    // Stamp the cropsticks + store source coords + clear infused on source plants
    g = g.map((r, ri) =>
      r.map((p, ci) => {
        if (ri === cr && ci === cc && p.gear) {
          return {
            ...p,
            gear: {
              ...p.gear,
              crossbreedStartedAt: now,
              crossbreedSourceA: { r: sourceA!.r, c: sourceA!.c },
              crossbreedSourceB: { r: sourceB!.r, c: sourceB!.c },
            },
          };
        }
        if ((ri === sourceA!.r && ci === sourceA!.c) || (ri === sourceB!.r && ci === sourceB!.c)) {
          if (p.plant) return { ...p, plant: { ...p.plant, infused: false } };
        }
        return p;
      })
    );
  }
  return g;
}

// ── Growth calculation ─────────────────────────────────────────────────────

/**
 * Returns the accumulated effective growth in milliseconds for a plant.
 * If `growthMs` is stored on the plant, extrapolates from that checkpoint
 * using the CURRENT multiplier for the delta since lastTickAt.
 * This means the progress bar can never snap by more than ~1 tick of error
 * (as long as stampStageTransitions runs every ~1 s to refresh checkpoints).
 */
/**
 * Returns the combined growth multiplier from sprinklers and grow lamps
 * affecting the cell at (row, col). Pass sprinklerMult=1.0 when no grid context.
 */
export function getPassiveGrowthMultiplier(
  grid: Plot[][],
  row: number,
  col: number,
  now: number
): number {
  const night = isNighttime();
  let bestSprinkler = 1.0;
  let bestLamp      = 1.0;

  const sources = getGearAffectingCell(grid, row, col, now);
  let balanceScaleBoostMult = 1.0;
  let balanceScaleSlowMult  = 1.0;
  for (const { def, sourceRow: _sourceRow, sourceCol, placedGear } of sources) {
    // Regular sprinkler / Aqueduct: take the highest multiplier across all covering sources
    if ((isRegularSprinkler(def) || isAqueduct(def)) && def.growthMultiplier) {
      bestSprinkler = Math.max(bestSprinkler, def.growthMultiplier);
    }
    // Grow lamp: only active at night — stacks multiplicatively with the sprinkler
    if (isGrowLamp(def) && night && def.nightMultiplier) {
      bestLamp = Math.max(bestLamp, def.nightMultiplier);
    }
    // Balance scale: always operates on the left/right axis.
    // Phase 0 = left arm (dc < 0) boosted 3×; right arm (dc > 0) slowed 0.5×.
    // Phase 1 = flipped.
    if (isBalanceScale(def) && def.fanRange) {
      const phase     = Math.floor((now - placedGear.placedAt) / 3_600_000) % 2;
      const dc        = col - sourceCol;
      const inLeft    = dc < 0;
      const isBoosted = phase === 0 ? inLeft : !inLeft;
      if (isBoosted) {
        balanceScaleBoostMult = Math.max(balanceScaleBoostMult, def.scaleBoostMult ?? 4.0);
      } else {
        balanceScaleSlowMult = Math.min(balanceScaleSlowMult, def.scaleSlowMult ?? 0.5);
      }
    }
  }
  // Sprinkler and grow lamp multiply together; balance scale applies on top
  return bestSprinkler * bestLamp * balanceScaleBoostMult * balanceScaleSlowMult;
}

/**
 * Returns the gear growth multiplier for the time window [from, to], correctly
 * handling the case where a gear expires mid-window.
 *
 * Without this, removing or expiring a gear causes a visible progress-bar jump:
 *   computeGrowthMs = growthMs + delta × currentMult
 * If the multiplier drops from 4× to 1× but delta is still "since last stamp"
 * (~1 s), the whole second suddenly counts at 1× instead of 4× — regression.
 *
 * This function detects any gear that was active at `from` but expires before
 * `to`, then splits the delta at that boundary:
 *   effective = (preMult × activeTime + postMult × expiredTime) / totalTime
 *
 * Both the stamp (stampStageTransitions) and the live display (PlotTile) use
 * this so the progress bar never snaps on gear removal or expiry.
 */
export function getEffectiveGrowthMultiplier(
  grid: Plot[][],
  row: number,
  col: number,
  from: number,
  to: number,
): number {
  // Zero-width window — no growth to attribute, avoid divide-by-zero
  if (from >= to) return 1.0;

  // Ask: which gears were affecting this cell at the START of the window?
  // getGearAffectingCell already skips expired gear, so passing `from` (not
  // `to`) gives us gears that were alive when the window opened.
  const activeSources = getGearAffectingCell(grid, row, col, from);

  // Find the earliest expiry that falls strictly inside (from, to]
  // — that's the moment the multiplier changes mid-delta.
  let earliestExpiry = Infinity;
  for (const { def, placedGear } of activeSources) {
    if (!def.durationMs) continue;                        // permanent gear, never expires
    const tExpire = placedGear.placedAt + def.durationMs;
    if (tExpire > from && tExpire <= to) {
      earliestExpiry = Math.min(earliestExpiry, tExpire);
    }
  }

  // No gear expires mid-window — fall back to the existing single-point lookup
  if (earliestExpiry === Infinity) {
    return getPassiveGrowthMultiplier(grid, row, col, to);
  }

  // A gear expires at `earliestExpiry`. Split the delta there:
  //   [from … earliestExpiry]  — gear active, use preMult
  //   [earliestExpiry … to]    — gear gone,   use postMult
  // Passing `from` to getPassiveGrowthMultiplier sees the gear as alive;
  // passing `earliestExpiry` sees it as just-expired (isGearExpired returns
  // true at that exact ms), so we get the correct post-removal multiplier.
  const span     = to - from;
  const preMult  = getPassiveGrowthMultiplier(grid, row, col, from);
  const postMult = getPassiveGrowthMultiplier(grid, row, col, earliestExpiry);
  return (preMult * (earliestExpiry - from) + postMult * (to - earliestExpiry)) / span;
}

function computeGrowthMs(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType,
  gearMultiplier = 1.0
): number {
  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  if (plant.bloomedAt) {
    return species.growthTime.seed + species.growthTime.sprout; // fully grown
  }

  const fertMultiplier     = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1.0;
  const weatherMultiplier  = WEATHER[weatherType].growthMultiplier;
  const masteredMultiplier = plant.masteredBonus ?? 1.0;
  const multiplier         = fertMultiplier * weatherMultiplier * masteredMultiplier * gearMultiplier;

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
  weatherType: WeatherType = "clear",
  gearMultiplier = 1.0
): GrowthStage {
  if (plant.bloomedAt && now >= plant.bloomedAt) return "bloom";

  const species = getFlower(plant.speciesId);
  if (!species) return "seed";

  const gMs    = computeGrowthMs(plant, now, weatherType, gearMultiplier);
  const seedMs = species.growthTime.seed;

  if (gMs >= seedMs + species.growthTime.sprout) return "bloom";
  if (gMs >= seedMs)                              return "sprout";
  // sproutedAt is a permanent timestamp — once stamped the plant has already
  // crossed the seed→sprout threshold and must never appear to revert.
  if (plant.sproutedAt !== undefined)             return "sprout";
  return "seed";
}

export function getStageProgress(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType = "clear",
  gearMultiplier = 1.0
): number {
  if (plant.bloomedAt && now >= plant.bloomedAt) return 1;

  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const gMs      = computeGrowthMs(plant, now, weatherType, gearMultiplier);
  const seedMs   = species.growthTime.seed;
  const sproutMs = species.growthTime.sprout;

  if (gMs >= seedMs + sproutMs) return 1;
  if (gMs >= seedMs) return Math.min(1, (gMs - seedMs) / sproutMs);
  return Math.min(1, gMs / seedMs);
}

export function getMsUntilNextStage(
  plant: PlantedFlower,
  now: number,
  weatherType: WeatherType = "clear",
  gearMultiplier = 1.0
): number {
  if (plant.bloomedAt && now >= plant.bloomedAt) return 0;

  const species = getFlower(plant.speciesId);
  if (!species) return 0;

  const fertMultiplier     = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1.0;
  const weatherMultiplier  = WEATHER[weatherType].growthMultiplier;
  const masteredMultiplier = plant.masteredBonus ?? 1.0;
  const multiplier         = fertMultiplier * weatherMultiplier * masteredMultiplier * gearMultiplier;

  const gMs      = computeGrowthMs(plant, now, weatherType, gearMultiplier);
  const seedMs   = species.growthTime.seed;
  const sproutMs = species.growthTime.sprout;

  if (gMs >= seedMs + sproutMs) return 0;
  if (gMs >= seedMs) {
    const remainingBase = (seedMs + sproutMs) - gMs;
    return Math.max(0, Math.ceil(remainingBase / multiplier));
  }
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
  if (!plot || plot.plant || plot.gear) return null;

  const invItem = state.inventory.find(
    (i) => i.speciesId === speciesId && i.isSeed
  );
  if (!invItem || invItem.quantity < 1) return null;

  const mastered = isSpeciesMastered(state.discovered, speciesId);

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col)
        return {
          ...p,
          plant: {
            speciesId,
            timePlanted: Date.now(),
            fertilizer: null,
            ...(mastered ? { masteredBonus: 1.25 } : {}),
          },
        };
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

/** Optimistically place a bloom from inventory directly onto a plot at bloom stage. */
export function plantBloom(
  state: GameState,
  row: number,
  col: number,
  speciesId: string,
  mutation?: string,
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot || plot.plant || plot.gear) return null;

  const invItem = state.inventory.find(
    (i) => i.speciesId === speciesId && !i.isSeed && (i.mutation ?? undefined) === mutation
  );
  if (!invItem || invItem.quantity < 1) return null;

  const mastered = isSpeciesMastered(state.discovered, speciesId);

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col)
        return {
          ...p,
          plant: {
            speciesId,
            timePlanted: 0,   // epoch → always past bloom threshold
            bloomedAt: Date.now(), // placed blooms are immediately at bloom stage
            fertilizer: null,
            ...(mutation ? { mutation: mutation as MutationType } : {}),
            ...(mastered ? { masteredBonus: 1.25 } : {}),
          },
        };
      return p;
    })
  );

  const newInventory = state.inventory
    .map((i) =>
      i.speciesId === speciesId && !i.isSeed && (i.mutation ?? undefined) === mutation
        ? { ...i, quantity: i.quantity - 1 }
        : i
    )
    .filter((i) => i.quantity > 0);

  return { ...state, grid: newGrid, inventory: newInventory };
}

/** Optimistically remove a growing (non-bloomed) plant and return its seed to inventory. */
export function removePlant(
  state: GameState,
  row: number,
  col: number,
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot?.plant) return null;
  // Pinned plants are protected — pin must be removed first
  if (plot.plant.pinned) return null;
  // Bloomed plants must be harvested, not removed
  if (plot.plant.bloomedAt) return null;
  // Shovel required — bail early if none available
  const shovelIdx = (state.consumables ?? []).findIndex((c) => c.id === "shovel" && c.quantity > 0);
  if (shovelIdx === -1) return null;

  const { speciesId } = plot.plant;

  // Clear the plot
  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) =>
      ri === row && ci === col ? { ...p, plant: null } : p
    )
  );

  // Return seed to inventory
  const existing = state.inventory.find((i) => i.speciesId === speciesId && i.isSeed);
  const newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId && i.isSeed ? { ...i, quantity: i.quantity + 1 } : i
      )
    : [...state.inventory, { speciesId, quantity: 1, isSeed: true }];

  // Deduct 1 shovel
  const newConsumables = (state.consumables ?? [])
    .map((c, i) => i === shovelIdx ? { ...c, quantity: c.quantity - 1 } : c)
    .filter((c) => c.quantity > 0);

  return { ...state, grid: newGrid, inventory: newInventory, consumables: newConsumables };
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
  weatherType: WeatherType = "clear",
  /** Bypass the 100 ms anti-loop guard — use when force-stamping before a
   *  gear change so in-progress bloom transitions are permanently recorded
   *  at the current multipliers before they can change. */
  force = false,
): GameState {
  const MIN_TICK_MS = 100;
  let changed = false;
  const newlyBloomedCells: [number, number][] = [];

  // Verdant Rush — global 2× growth while active
  const boostMult = getBoostMultiplier(state.activeBoosts, "growth", now);

  let newGrid = state.grid.map((row, ri) =>
    row.map((plot, ci) => {
      if (!plot.plant || plot.plant.bloomedAt) return plot; // fully grown — nothing to do

      const plant   = plot.plant;
      const species = getFlower(plant.speciesId);
      if (!species) return plot;

      // Time-weighted multiplier: if a gear expired between lastTickAt and now,
      // only the active portion of the delta is boosted — prevents the progress
      // bar from snapping when a gear expires mid-checkpoint.
      const gearMult           = getEffectiveGrowthMultiplier(
        state.grid, ri, ci,
        plant.lastTickAt ?? now,  // from: start of the un-stamped window
        now,                       // to:   current moment
      );
      const fertMultiplier     = plant.fertilizer ? FERTILIZERS[plant.fertilizer].speedMultiplier : 1.0;
      const weatherMultiplier  = WEATHER[weatherType].growthMultiplier;
      const masteredMultiplier = plant.masteredBonus ?? 1.0;
      const multiplier         = fertMultiplier * weatherMultiplier * masteredMultiplier * gearMult * boostMult;

      const seedMs   = species.growthTime.seed;
      const sproutMs = species.growthTime.sprout;

      // ── Step 1: compute new growthMs ──────────────────────────────────────
      let newGrowthMs: number;
      const newLastTickAt = now;

      if (plant.growthMs !== undefined && plant.lastTickAt !== undefined) {
        const delta = Math.max(0, now - plant.lastTickAt);
        if (!force && delta < MIN_TICK_MS) return plot; // too soon — skip to prevent render loop
        newGrowthMs = plant.growthMs + delta * multiplier;
      } else {
        if (plant.sproutedAt !== undefined) {
          newGrowthMs = seedMs + Math.max(0, now - plant.sproutedAt) * multiplier;
        } else {
          newGrowthMs = Math.max(0, now - plant.timePlanted) * multiplier;
        }
      }

      let updated: PlantedFlower = { ...plant, growthMs: newGrowthMs, lastTickAt: newLastTickAt };

      // ── Step 2: stamp sproutedAt ──────────────────────────────────────────
      if (!plant.sproutedAt && newGrowthMs >= seedMs) {
        updated = { ...updated, sproutedAt: now };
      }

      // ── Step 3: stamp bloomedAt ───────────────────────────────────────────
      if (!plant.bloomedAt && newGrowthMs >= seedMs + sproutMs) {
        updated = { ...updated, bloomedAt: now };
        newlyBloomedCells.push([ri, ci]);
      }

      changed = true;
      return { ...plot, plant: updated };
    })
  );

  // ── Feed composters from newly bloomed plants ──────────────────────────
  if (newlyBloomedCells.length > 0) {
    const gridRows = newGrid.length;
    const gridCols = newGrid[0]?.length ?? 0;

    for (const [bloomRow, bloomCol] of newlyBloomedCells) {
      const bloomedPlant = newGrid[bloomRow][bloomCol].plant;
      if (!bloomedPlant) continue;
      const bloomedSpecies = getFlower(bloomedPlant.speciesId);
      if (!bloomedSpecies) continue;

      // Check all 3×3 neighbours for active composters
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const cr = bloomRow + dr;
          const cc = bloomCol + dc;
          if (cr < 0 || cr >= gridRows || cc < 0 || cc >= gridCols) continue;

          const compPlot = newGrid[cr][cc];
          if (!compPlot.gear) continue;
          const gDef = GEAR[compPlot.gear.gearType];
          if (!isComposter(gDef)) continue;
          if (isGearExpired(compPlot.gear, now)) continue;

          const stored    = compPlot.gear.storedFertilizers ?? [];
          const maxStore  = gDef.maxStorage ?? 10;
          if (stored.length >= maxStore) continue;

          const fertType = rollComposterFertilizer(bloomedSpecies.rarity);
          const updatedGear: PlacedGear = {
            ...compPlot.gear,
            storedFertilizers: [...stored, fertType],
          };
          newGrid = newGrid.map((r, ri2) =>
            r.map((p, ci2) =>
              ri2 === cr && ci2 === cc ? { ...p, gear: updatedGear } : p
            )
          );
          changed = true;
        }
      }
    }
  }

  return changed ? { ...state, grid: newGrid } : state;
}

const WEATHER_MUTATION_CHANCE = WEATHER_MUT_CHANCE_PER_TICK as Partial<Record<WeatherType, number>>;

const WEATHER_MUTATION_TYPE: Partial<Record<WeatherType, MutationType>> = {
  rain:            "wet",
  heatwave:        "scorched",
  cold_front:      "frozen",
  star_shower:     "moonlit",
  prismatic_skies: "rainbow",
  golden_hour:     "golden",
  tornado:         "windstruck",
  // thunderstorm is handled via a two-step chain (wet → shocked) below, not a direct shocked roll
};

const MOONLIT_NIGHT_CHANCE = MOONLIT_NIGHT_CHANCE_PER_TICK;

// Dev-only runtime multiplier for weather mutation chances.
// Default 1 (no change). Set higher via DevWeatherPanel to test mutations instantly.
let _devMutationMultiplier = 1;
export function setDevMutationMultiplier(x: number) { _devMutationMultiplier = Math.max(0, x); }
export function getDevMutationMultiplier() { return _devMutationMultiplier; }

let _devShowGrowthDebug = false;
export function setDevShowGrowthDebug(v: boolean) {
  _devShowGrowthDebug = v;
  window.dispatchEvent(new CustomEvent("devGrowthDebugToggle", { detail: v }));
}
export function getDevShowGrowthDebug() { return _devShowGrowthDebug; }
const GIANT_BLOOM_CHANCE   = 0.0533; // ~5.3% flat, only at bloom transition

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

  const newGrid = state.grid.map((row, ri) =>
    row.map((plot, ci) => {
      if (!plot.plant) return plot;

      // Weather mutations only apply at bloom — the plant must be at peak to be affected
      const stage = getCurrentStage(plot.plant, now, weatherType);
      if (stage !== "bloom") return plot;

      // Purity Vial blocks all weather mutations
      if (plot.plant.mutationBlocked) return plot;

      // Scarecrow OR Aegis fully blocks weather mutation rolls on covered plants.
      // Both are weather shields; the difference is gear-mutation handling
      // (Scarecrow blocks gear mutations too, Aegis does not — see tickSprinklerMutations).
      const shieldSources = getGearAffectingCell(state.grid, ri, ci, now);
      const hasShield = shieldSources.some(({ def }) => isScarecrow(def) || isAegis(def));
      if (hasShield) return plot;

      const m = _devMutationMultiplier;
      const boostFor = (mt: string): number =>
        plot.plant!.mutationBoost?.mutation === mt
          ? (plot.plant!.mutationBoost!.multiplier ?? 1)
          : 1;

      // Thunderstorm combo: wet flowers have a ~50% chance to become shocked
      if (weatherType === "thunderstorm" && plot.plant.mutation === "wet") {
        const chance = Math.min(1, THUNDERSTORM_SHOCKED_CHANCE_PER_TICK * m * boostFor("shocked"));
        if (Math.random() < chance) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: "shocked" as MutationType } };
        }
        return plot;
      }

      // Skip if already has any other mutation (string); allow null and undefined
      if (typeof plot.plant.mutation === "string") return plot;

      // Thunderstorm: unmutated (undefined or null) plants can become wet
      if (weatherType === "thunderstorm" && plot.plant.mutation == null) {
        const chance = Math.min(1, THUNDERSTORM_WET_CHANCE_PER_TICK * m * boostFor("wet"));
        if (Math.random() < chance) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: "wet" as MutationType } };
        }
      }

      // Roll weather mutation
      if (weatherMut && weatherChance > 0) {
        const chance = Math.min(1, weatherChance * m * boostFor(weatherMut));
        if (Math.random() < chance) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: weatherMut } };
        }
      }

      // Moonlit at night (outside star_shower)
      if (night && weatherType !== "star_shower") {
        const chance = Math.min(1, MOONLIT_NIGHT_CHANCE * m * boostFor("moonlit"));
        if (Math.random() < chance) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: "moonlit" as MutationType } };
        }
      }

      return plot;
    })
  );

  return changed ? { ...state, grid: newGrid } : state;
}

/**
 * Called every tick. Rolls mutation chances from active mutation sprinklers
 * and wet chances from regular sprinklers for all bloomed, unmutated plants.
 * Stacks additively with weather mutations (sprinklers are not blocked by scarecrows).
 */
export function tickSprinklerMutations(
  state: GameState,
  weatherType: WeatherType = "clear"
): GameState {
  const now     = Date.now();
  let changed   = false;

  const newGrid = state.grid.map((row, ri) =>
    row.map((plot, ci) => {
      if (!plot.plant) return plot;

      const stage = getCurrentStage(plot.plant, now, weatherType);
      if (stage !== "bloom") return plot;

      // Purity Vial blocks all sprinkler mutations
      if (plot.plant.mutationBlocked) return plot;

      const sources = getGearAffectingCell(state.grid, ri, ci, now);

      // Scarecrow blocks gear-based mutations too (sprinklers, mutation sprinklers,
      // generator wet→shocked). Aegis is weather-only and does NOT block here.
      if (sources.some(({ def }) => isScarecrow(def))) return plot;

      const boostFor = (mt: string): number =>
        plot.plant!.mutationBoost?.mutation === mt
          ? (plot.plant!.mutationBoost!.multiplier ?? 1)
          : 1;

      // Generator sprinkler (shocked) converts wet → shocked.
      // Must run before the "skip already-mutated" guard because wet is a string mutation.
      if (plot.plant.mutation === "wet") {
        for (const { def } of sources) {
          if (!isMutationSprinkler(def) || def.mutationType !== "shocked" || !def.mutationChancePerTick) continue;
          const chance = Math.min(1, def.mutationChancePerTick * boostFor("shocked"));
          if (Math.random() < chance) {
            changed = true;
            return { ...plot, plant: { ...plot.plant, mutation: "shocked" as MutationType } };
          }
        }
        return plot; // wet plant — no other sprinkler mutation applies
      }

      // Only roll for unmutated plants (mutation === undefined or null)
      if (typeof plot.plant.mutation === "string") return plot;

      // Regular sprinklers — wet mutation chance
      for (const { def } of sources) {
        if (!isRegularSprinkler(def) || !def.wetChancePerTick) continue;
        const chance = Math.min(1, def.wetChancePerTick * boostFor("wet"));
        if (Math.random() < chance) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: "wet" as MutationType } };
        }
      }

      // Mutation sprinklers (all types except shocked, which is handled above for wet plants)
      for (const { def } of sources) {
        if (!isMutationSprinkler(def) || !def.mutationType || !def.mutationChancePerTick) continue;
        if (def.mutationType === "shocked") continue; // Generator only applies to wet plants (handled above)
        const chance = Math.min(1, def.mutationChancePerTick * boostFor(def.mutationType));
        if (Math.random() < chance) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: def.mutationType } };
        }
      }

      return plot;
    })
  );

  return changed ? { ...state, grid: newGrid } : state;
}

/**
 * Called every tick. For each bloomed plant covered by an active Scarecrow,
 * rolls the highest covering Scarecrow's `mutationStripChancePerTick`. On hit,
 * sets `plant.mutation = null` (matches Fan strip convention — Giant tried-and-failed
 * marker, weather can no longer assign).
 *
 * Skipped when:
 *   - plant has Magnifying Glass reveal lock
 *   - plant is not bloomed
 *   - plant has no string mutation (nothing to strip)
 *   - plant has no covering Scarecrow
 */
export function tickScarecrowStrip(
  state: GameState,
  weatherType: WeatherType = "clear",
): GameState {
  const now   = Date.now();
  let changed = false;

  const newGrid = state.grid.map((row, ri) =>
    row.map((plot, ci) => {
      if (!plot.plant) return plot;
      if (typeof plot.plant.mutation !== "string") return plot;

      const stage = getCurrentStage(plot.plant, now, weatherType);
      if (stage !== "bloom") return plot;

      // Pick the strongest scarecrow covering this cell (higher-tier scarecrow wins)
      const sources = getGearAffectingCell(state.grid, ri, ci, now);
      let bestChance = 0;
      for (const { def } of sources) {
        if (!isScarecrow(def)) continue;
        const c = def.mutationStripChancePerTick ?? 0;
        if (c > bestChance) bestChance = c;
      }
      if (bestChance <= 0) return plot;

      if (Math.random() < Math.min(1, bestChance)) {
        changed = true;
        return { ...plot, plant: { ...plot.plant, mutation: null } };
      }
      return plot;
    }),
  );

  return changed ? { ...state, grid: newGrid } : state;
}

/** Called every tick. Fans either strip existing mutations from bloomed plants, or apply
 *  Windstruck to bloomed plants that have no mutation. Each covered cell rolls independently. */
export function tickFanMutations(
  state: GameState,
  weatherType: WeatherType = "clear"
): GameState {
  const now = Date.now();
  let changed = false;

  const newGrid = state.grid.map((row, ri) =>
    row.map((plot, ci) => {
      if (!plot.plant) return plot;

      const stage = getCurrentStage(plot.plant, now, weatherType);
      if (stage !== "bloom") return plot;

      // Purity Vial blocks windstruck; fans can still strip existing mutations
      // but if plant has no mutation (or already windstruck) and is blocked,
      // skip windstruck application.
      const sources = getGearAffectingCell(state.grid, ri, ci, now);

      for (const { def } of sources) {
        if (!isFan(def) || !def.fanStripChancePerTick) continue;
        const mut = plot.plant.mutation;
        if (mut === "wet" && def.fanStripChancePerTick && Math.random() < def.fanStripChancePerTick) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: null } };
        } else if (!mut && !plot.plant.mutationBlocked && def.fanWindstruckChancePerTick && Math.random() < def.fanWindstruckChancePerTick) {
          changed = true;
          return { ...plot, plant: { ...plot.plant, mutation: "windstruck" as MutationType } };
        }
      }

      return plot;
    })
  );

  return changed ? { ...state, grid: newGrid } : state;
}

/** Scans for active Harvest Bells and auto-harvests any bloomed plants in range.
 *  Called both in the live tick and in applyOfflineTick for offline progress. */
export function tickHarvestBells(
  state: GameState,
  weatherType: WeatherType = "clear",
): GameState {
  const now     = Date.now();
  let   updated = state;

  for (let ri = 0; ri < state.grid.length; ri++) {
    for (let ci = 0; ci < state.grid[ri].length; ci++) {
      const bellPlot = updated.grid[ri][ci];
      if (!bellPlot.gear) continue;

      const def = GEAR[bellPlot.gear.gearType];
      if (!isHarvestBell(def) && !isLawnmower(def)) continue;
      if (isGearExpired(bellPlot.gear, now)) continue;

      const gridRows = updated.grid.length;
      const gridCols = updated.grid[0]?.length ?? 0;
      const affected = getAffectedCells(bellPlot.gear.gearType, ri, ci, gridRows, gridCols, bellPlot.gear.direction);

      for (const [ar, ac] of affected) {
        if (ar === ri && ac === ci) continue; // never process bell's own cell
        const targetPlot = updated.grid[ar]?.[ac];
        if (!targetPlot?.plant) continue;
        // Garden Pin shields the plant from auto-harvest
        if (targetPlot.plant.pinned) continue;
        const stage = getCurrentStage(targetPlot.plant, now, weatherType);
        if (stage !== "bloom") continue;
        // Skip plants that bloomed less than 5 s ago — prevents same-render-tick harvesting
        if (!targetPlot.plant.bloomedAt || now - targetPlot.plant.bloomedAt < 5_000) continue;

        const result = harvestPlant(updated, ar, ac, weatherType);
        if (result) updated = result.state;
      }
    }
  }

  return updated;
}

/** Pure read — returns the grid cells that an active Harvest Bell should harvest right now.
 *  Does NOT mutate state. Used by the live garden tick so each harvest goes through
 *  perform() + edgeHarvest() and the server stays in sync. */
export function findHarvestBellTargets(
  state: GameState,
  weatherType: WeatherType = "clear"
): Array<{ row: number; col: number }> {
  const now = Date.now();
  const targets: Array<{ row: number; col: number }> = [];

  for (let ri = 0; ri < state.grid.length; ri++) {
    for (let ci = 0; ci < state.grid[ri].length; ci++) {
      const bellPlot = state.grid[ri][ci];
      if (!bellPlot.gear) continue;
      const def = GEAR[bellPlot.gear.gearType];
      if (!isHarvestBell(def) && !isLawnmower(def)) continue;
      if (isGearExpired(bellPlot.gear, now)) continue;

      const gridRows = state.grid.length;
      const gridCols = state.grid[0]?.length ?? 0;
      const affected = getAffectedCells(bellPlot.gear.gearType, ri, ci, gridRows, gridCols, bellPlot.gear.direction);

      for (const [ar, ac] of affected) {
        if (ar === ri && ac === ci) continue;
        const targetPlot = state.grid[ar]?.[ac];
        if (!targetPlot?.plant) continue;
        // Garden Pin shields the plant from auto-harvest
        if (targetPlot.plant.pinned) continue;
        const stage = getCurrentStage(targetPlot.plant, now, weatherType);
        if (stage !== "bloom") continue;
        // Grace period: skip plants that bloomed < 5 s ago (avoids same-tick self-harvest)
        if (!targetPlot.plant.bloomedAt || now - targetPlot.plant.bloomedAt < 5_000) continue;
        targets.push({ row: ar, col: ac });
      }
    }
  }

  return targets;
}

// ── Auto-Planter ──────────────────────────────────────────────────────────

/** Picks the seed with the highest quantity from the current inventory.
 *  Returns null if the player has no seeds. */
function pickBestSeed(inventory: GameState["inventory"]): string | null {
  const best = inventory
    .filter((i) => i.isSeed && i.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)[0];
  return best?.speciesId ?? null;
}

/** Scans for active Auto-Planters and plants seeds into every empty covered cell.
 *  Called from applyOfflineTick — mutates state in-place via plantSeed chaining. */
export function tickAutoPlanter(state: GameState): GameState {
  const now = Date.now();
  let updated = state;

  for (let ri = 0; ri < state.grid.length; ri++) {
    for (let ci = 0; ci < state.grid[ri].length; ci++) {
      const planterPlot = updated.grid[ri][ci];
      if (!planterPlot.gear) continue;
      const def = GEAR[planterPlot.gear.gearType];
      if (!isAutoPlanter(def)) continue;
      if (isGearExpired(planterPlot.gear, now)) continue;

      const gridRows = updated.grid.length;
      const gridCols = updated.grid[0]?.length ?? 0;
      const affected = getAffectedCells(planterPlot.gear.gearType, ri, ci, gridRows, gridCols);

      for (const [ar, ac] of affected) {
        const targetPlot = updated.grid[ar]?.[ac];
        if (!targetPlot || targetPlot.plant || targetPlot.gear) continue;

        const speciesId = pickBestSeed(updated.inventory);
        if (!speciesId) return updated; // no more seeds — stop

        const result = plantSeed(updated, ar, ac, speciesId);
        if (result) updated = result;
      }
    }
  }

  return updated;
}

/** Pure read — returns the cells an Auto-Planter should fill right now, with the
 *  seed to use in each. Simulates inventory depletion to avoid double-spending.
 *  Used by the live garden tick so each plant goes through perform() + edgePlantSeed(). */
export function findAutoPlantTargets(
  state: GameState
): Array<{ row: number; col: number; speciesId: string }> {
  const now = Date.now();
  const targets: Array<{ row: number; col: number; speciesId: string }> = [];

  // Shallow-copy quantities so we can simulate depletion without touching real state
  const simQty = new Map<string, number>(
    state.inventory.filter((i) => i.isSeed && i.quantity > 0).map((i) => [i.speciesId, i.quantity])
  );

  function pickSeed(): string | null {
    let best: string | null = null;
    let bestQty = 0;
    simQty.forEach((qty, id) => {
      if (qty > bestQty) { best = id; bestQty = qty; }
    });
    if (!best) return null;
    simQty.set(best, (simQty.get(best) ?? 0) - 1);
    if ((simQty.get(best) ?? 0) <= 0) simQty.delete(best);
    return best;
  }

  for (let ri = 0; ri < state.grid.length; ri++) {
    for (let ci = 0; ci < state.grid[ri].length; ci++) {
      const planterPlot = state.grid[ri][ci];
      if (!planterPlot.gear) continue;
      const def = GEAR[planterPlot.gear.gearType];
      if (!isAutoPlanter(def)) continue;
      if (isGearExpired(planterPlot.gear, now)) continue;

      const gridRows = state.grid.length;
      const gridCols = state.grid[0]?.length ?? 0;
      const affected = getAffectedCells(planterPlot.gear.gearType, ri, ci, gridRows, gridCols);

      for (const [ar, ac] of affected) {
        const targetPlot = state.grid[ar]?.[ac];
        if (!targetPlot || targetPlot.plant || targetPlot.gear) continue;

        const speciesId = pickSeed();
        if (!speciesId) return targets; // no seeds left

        targets.push({ row: ar, col: ac, speciesId });
      }
    }
  }

  return targets;
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

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === row && ci === col) return { ...p, plant: null };
      return p;
    })
  );

  // Update inventory — normalise null/undefined so DB-loaded items (mutation: null)
  // and fresh optimistic items (mutation: undefined) are treated as the same slot.
  const normMut = mutation ?? null;
  const existing = state.inventory.find(
    (i) => i.speciesId === speciesId && (i.mutation ?? null) === normMut && !i.isSeed
  );
  let newInventory = existing
    ? state.inventory.map((i) =>
        i.speciesId === speciesId && (i.mutation ?? null) === normMut && !i.isSeed
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
    : [...state.inventory, { speciesId, quantity: 1, mutation, isSeed: false }];

  // Heirloom Charm: also return the seed (mirrors server logic; edgeHarvest strips
  // inventory from the response so this must be handled optimistically).
  if (plot.plant.heirloomActive) {
    const seedIdx = newInventory.findIndex((i) => i.speciesId === speciesId && i.isSeed && (i.mutation ?? null) === null);
    newInventory = seedIdx >= 0
      ? newInventory.map((i, idx) => idx === seedIdx ? { ...i, quantity: i.quantity + 1 } : i)
      : [...newInventory, { speciesId, quantity: 1, isSeed: true }];
  }

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
      if (current.grid[row][col].plant || current.grid[row][col].gear) continue;

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

// ── Server result merge ──────────────────────────────────────────────────────

/**
 * Merges the result of an edge function into the current GameState. Used by
 * `perform()` to apply server responses on success.
 *
 * Three behaviors:
 *
 * 1. **Plain field merge** — any field on `result` overwrites the corresponding
 *    field on `cur` (`coins`, `inventory`, `fertilizers`, `serverUpdatedAt`,
 *    etc.). This is just `{ ...cur, ...result }`.
 *
 * 2. **Empty result preserves state** — when `result === {}`, no fields change.
 *    This is the contract that callers like the auto-planter, `handlePlantAll`,
 *    and `handleSeedSelect` rely on: returning `{}` from `serverFn` after the
 *    `await` keeps optimistic state intact, preventing concurrent in-flight
 *    plants/harvests from clobbering each other's optimistic grid/inventory.
 *
 * 3. **Grid replacement preserves client mutations** — when `result.grid` is
 *    set, the server's grid wins, but client-side mutations (weather/sprinkler/
 *    fan rolls applied locally and not yet written to the DB) are preserved
 *    on plants that match by speciesId + timePlanted. Without this, every
 *    server response would erase locally-rolled mutations until the next
 *    server tick re-rolled them.
 */
export function mergeServerResult<T extends Partial<GameState>>(
  cur: GameState,
  result: T,
): GameState {
  const merged = { ...cur, ...result, ok: undefined } as GameState;

  // Never let shop/supply reset timestamps or shop lists roll backwards.
  // A stale server response (read from DB before an in-flight edgeSyncShop/
  // edgeSyncSupplyShop write completes) would otherwise clobber the client's
  // new shop list with the old one — causing the visible flicker back to the
  // pre-restock inventory.
  const r = result as Partial<GameState>;
  merged.lastShopReset   = Math.max(cur.lastShopReset,        r.lastShopReset   ?? 0);
  merged.lastSupplyReset = Math.max(cur.lastSupplyReset ?? 0, r.lastSupplyReset ?? 0);
  if ((r.lastShopReset   ?? 0) < cur.lastShopReset)          merged.shop        = cur.shop;
  if ((r.lastSupplyReset ?? 0) < (cur.lastSupplyReset ?? 0)) merged.supplyShop  = cur.supplyShop;

  // discovered and codexAcked are monotonically growing — union both sides so
  // concurrent harvests don't clobber each other's new entries client-side.
  if (r.discovered) {
    merged.discovered = [...new Set([...(cur.discovered ?? []), ...r.discovered])];
  }
  if (r.codexAcked) {
    merged.codexAcked = [...new Set([...(cur.codexAcked ?? []), ...r.codexAcked])];
  }

  if (result.grid) {
    // Identify the same plant by speciesId + timePlanted so we never copy a
    // mutation onto a different plant (e.g. after a harvest + re-plant).
    merged.grid = result.grid.map((row, ri) =>
      row.map((plot, ci) => {
        if (!plot.plant) return plot;
        const curPlot = cur.grid[ri]?.[ci];
        if (!curPlot?.plant) return plot;
        if (
          plot.plant.speciesId === curPlot.plant.speciesId &&
          plot.plant.timePlanted === curPlot.plant.timePlanted
        ) {
          return {
            ...plot,
            plant: {
              ...plot.plant,
              // Client-side mutation rolls are not in the DB yet — preserve them.
              mutation:   curPlot.plant.mutation,
              // masteredBonus is set at plant time by plant-seed using DB's discovered.
              // Prefer client value (set during optimistic update) so the icon and
              // multiplier survive a server grid replacement even if the DB row was
              // written before discovered was fully persisted (e.g. dev-panel fillCodex
              // before saveToCloud included discovered).  Server value is the fallback.
              masteredBonus: curPlot.plant.masteredBonus ?? (plot.plant as PlantedFlower).masteredBonus,
              // Client-computed progress fields — the server grid never carries these,
              // so the merge must copy them over or gear changes wipe all growth progress
              // (stampStageTransitions stamps bloomedAt before a removal, but the stamp
              // would be discarded without this copy).
              growthMs:   curPlot.plant.growthMs,
              lastTickAt: curPlot.plant.lastTickAt,
              // Prefer client's stamp (force-stamped before gear change); fall back to
              // server's (may be set by tick-offline-gardens on an offline plant).
              bloomedAt:  curPlot.plant.bloomedAt  ?? (plot.plant as PlantedFlower).bloomedAt,
              sproutedAt: curPlot.plant.sproutedAt ?? (plot.plant as PlantedFlower).sproutedAt,
            },
          };
        }
        return plot;
      }),
    );
  }
  return merged;
}

// ── Surgical rollbacks ───────────────────────────────────────────────────────
// These are pure functions used by perform()'s rollback path to undo only the
// specific delta a failed action introduced — without clobbering any concurrent
// state changes that landed during the server roundtrip (e.g. a harvest the
// user did mid-sell). Snapshot rollbacks (capturing `state` at action-start)
// would erase that concurrent work; these incremental rollbacks don't.

/**
 * Rollback for a successful Sell-All optimistic update.
 *
 * Adds each sold bloom back into `state.inventory` (matching on speciesId +
 * mutation + isSeed=false) and subtracts `earned` coins. If a sold species
 * is no longer present in inventory at rollback time (e.g. the optimistic
 * filter removed it), pushes a new entry so nothing is silently lost.
 */
export function rollbackSellAll(
  state: GameState,
  soldItems: { speciesId: string; mutation?: string; quantity: number }[],
  earned: number,
): GameState {
  let inv = state.inventory;
  for (const sold of soldItems) {
    const mut = sold.mutation as MutationType | undefined;
    const idx = inv.findIndex(
      (i) => i.speciesId === sold.speciesId && i.mutation === mut && !i.isSeed,
    );
    if (idx >= 0) {
      inv = inv.map((i, j) => (j === idx ? { ...i, quantity: i.quantity + sold.quantity } : i));
    } else {
      inv = [...inv, { speciesId: sold.speciesId, mutation: mut, quantity: sold.quantity, isSeed: false }];
    }
  }
  return { ...state, coins: state.coins - earned, inventory: inv };
}

/**
 * Rollback for a single plot's Plant-All optimistic update.
 *
 * Clears the plant from `(row, col)` and increments the seed count for
 * `speciesId` by 1. If the seed entry has been removed from inventory at
 * rollback time, pushes a new entry so the seed is never lost.
 */
export function rollbackPlantOne(
  state: GameState,
  row: number,
  col: number,
  speciesId: string,
): GameState {
  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) => (ri === row && ci === col ? { ...p, plant: null } : p)),
  );

  const seedIdx = state.inventory.findIndex(
    (i) => i.speciesId === speciesId && i.isSeed,
  );
  const newInventory = seedIdx >= 0
    ? state.inventory.map((i, j) => (j === seedIdx ? { ...i, quantity: i.quantity + 1 } : i))
    : [...state.inventory, { speciesId, quantity: 1, isSeed: true }];

  return { ...state, grid: newGrid, inventory: newInventory };
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

export function buyAllSeeds(state: GameState): GameState | null {
  const slots = state.shop.filter(
    (s) => !s.isFertilizer && !s.isEmpty && s.quantity > 0 && state.coins >= s.price
  );
  if (slots.length === 0) return null;
  let next: GameState = state;
  let bought = false;
  for (const slot of slots) {
    const after = buyAllFromShop(next, slot.speciesId!);
    if (after) { next = after; bought = true; }
  }
  return bought ? next : null;
}

export function buyAllSupply(state: GameState): GameState | null {
  const slots = (state.supplyShop ?? []).filter((s) => !s.isEmpty && s.quantity > 0);
  if (slots.length === 0) return null;
  let next: GameState = state;
  let bought = false;
  for (const slot of slots) {
    if (next.coins < slot.price) continue;
    const after = buyFromSupplyShop(next, slot.speciesId!);
    if (after) { next = after; bought = true; }
  }
  return bought ? next : null;
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

export function upgradeMarketplaceSlots(state: GameState): GameState | null {
  const next = getNextMarketplaceSlotUpgrade(state.marketplaceSlots);
  if (!next) return null;
  if (state.coins < next.cost) return null;

  return {
    ...state,
    coins:            state.coins - next.cost,
    marketplaceSlots: next.slots,
  };
}

// ── Gear actions ───────────────────────────────────────────────────────────

export function placeGear(
  state: GameState,
  row: number,
  col: number,
  gearType: GearType,
  direction?: FanDirection
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot || plot.plant || plot.gear) return null;

  const invItem = state.gearInventory.find((g) => g.gearType === gearType);
  if (!invItem || invItem.quantity < 1) return null;

  const now = Date.now();
  const placedGear: PlacedGear = direction
    ? { gearType, placedAt: now, direction }
    : { gearType, placedAt: now };

  let newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) =>
      ri === row && ci === col ? { ...p, gear: placedGear } : p
    )
  );

  // When placing cropsticks, immediately start the cycle if any adjacent pair
  // of infused+bloomed plants matches a recipe — mirrors what apply-infuser does
  // when infusing the second plant while cropsticks are already present.
  if (gearType === "cropsticks") {
    const OFFSETS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of OFFSETS) {
      const nr = row + dr;
      const nc = col + dc;
      const nPlant = newGrid[nr]?.[nc]?.plant;
      if (nPlant?.infused && (nPlant.bloomedAt || nPlant.timePlanted === 0)) {
        // Call stampCropsticksCycles from the adjacent plant's position —
        // it will scan back to find the cropsticks we just placed and start it.
        newGrid = stampCropsticksCycles(newGrid, nr, nc, now);
        break; // stampCropsticksCycles already considers all 4 neighbours of the cropsticks
      }
    }
  }

  const newGearInv = state.gearInventory
    .map((g) => g.gearType === gearType ? { ...g, quantity: g.quantity - 1 } : g)
    .filter((g) => g.quantity > 0);

  return { ...state, grid: newGrid, gearInventory: newGearInv };
}

/** Updates the direction of a directional gear (fan, aegis, lawnmower, aqueduct) placed at (row, col). */
export function setFanDirection(
  state: GameState,
  row: number,
  col: number,
  direction: FanDirection
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot?.gear) return null;
  const def = GEAR[plot.gear.gearType];
  if (def.passiveSubtype !== "fan" && def.passiveSubtype !== "aegis" && def.passiveSubtype !== "lawnmower" && def.passiveSubtype !== "aqueduct") return null;

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) =>
      ri === row && ci === col
        ? { ...p, gear: { ...p.gear!, direction } }
        : p
    )
  );
  return { ...state, grid: newGrid };
}

export function removeGear(
  state: GameState,
  row: number,
  col: number
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot?.gear) return null;

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) =>
      ri === row && ci === col ? { ...p, gear: null } : p
    )
  );

  // Removal destroys the gear (no refund). Stored fertilizers from composters
  // are still returned since the player earned them.
  const stored = plot.gear.storedFertilizers ?? [];
  let newFertilizers = state.fertilizers;
  for (const fertType of stored) {
    const fert = newFertilizers.find((f) => f.type === fertType);
    newFertilizers = fert
      ? newFertilizers.map((f) => f.type === fertType ? { ...f, quantity: f.quantity + 1 } : f)
      : [...newFertilizers, { type: fertType, quantity: 1 }];
  }

  return { ...state, grid: newGrid, fertilizers: newFertilizers };
}

/** Collect all fertilizers stored in a composter and add them to player inventory. */
export function collectFromComposter(
  state: GameState,
  row: number,
  col: number
): GameState | null {
  const plot = state.grid[row]?.[col];
  if (!plot?.gear) return null;

  const gDef = GEAR[plot.gear.gearType];
  if (!isComposter(gDef)) return null;

  const stored = plot.gear.storedFertilizers ?? [];
  if (stored.length === 0) return null;

  let newFertilizers = state.fertilizers;
  for (const fertType of stored) {
    const fert = newFertilizers.find((f) => f.type === fertType);
    newFertilizers = fert
      ? newFertilizers.map((f) => f.type === fertType ? { ...f, quantity: f.quantity + 1 } : f)
      : [...newFertilizers, { type: fertType, quantity: 1 }];
  }

  const newGrid = state.grid.map((r, ri) =>
    r.map((p, ci) =>
      ri === row && ci === col
        ? { ...p, gear: { ...p.gear!, storedFertilizers: [] } }
        : p
    )
  );

  return { ...state, grid: newGrid, fertilizers: newFertilizers };
}

export function buyFromSupplyShop(
  state: GameState,
  slotSpeciesId: string
): GameState | null {
  const slot = state.supplyShop.find((s) => s.speciesId === slotSpeciesId);
  if (!slot || slot.quantity < 1) return null;
  if (state.coins < slot.price) return null;

  const newSupplyShop = state.supplyShop.map((s) =>
    s.speciesId === slotSpeciesId ? { ...s, quantity: s.quantity - 1 } : s
  );

  if (slot.isFertilizer && slot.fertilizerType) {
    const existing = state.fertilizers.find((f) => f.type === slot.fertilizerType);
    const newFertilizers = existing
      ? state.fertilizers.map((f) =>
          f.type === slot.fertilizerType ? { ...f, quantity: f.quantity + 1 } : f
        )
      : [...state.fertilizers, { type: slot.fertilizerType, quantity: 1 }];

    return {
      ...state,
      coins:       state.coins - slot.price,
      supplyShop:  newSupplyShop,
      fertilizers: newFertilizers,
    };
  }

  if (slot.isGear && slot.gearType) {
    const existing = state.gearInventory.find((g) => g.gearType === slot.gearType);
    const newGearInv = existing
      ? state.gearInventory.map((g) =>
          g.gearType === slot.gearType ? { ...g, quantity: g.quantity + 1 } : g
        )
      : [...state.gearInventory, { gearType: slot.gearType!, quantity: 1 }];

    return {
      ...state,
      coins:        state.coins - slot.price,
      supplyShop:   newSupplyShop,
      gearInventory: newGearInv,
    };
  }

  if (slot.isConsumable && slot.consumableId) {
    const consumables = state.consumables ?? [];
    const existing    = consumables.find((c) => c.id === slot.consumableId);
    const newConsumables = existing
      ? consumables.map((c) =>
          c.id === slot.consumableId ? { ...c, quantity: c.quantity + 1 } : c
        )
      : [...consumables, { id: slot.consumableId as ConsumableId, quantity: 1 }];

    return {
      ...state,
      coins:       state.coins - slot.price,
      supplyShop:  newSupplyShop,
      consumables: newConsumables,
    };
  }

  return null;
}

export function upgradeSupplySlots(state: GameState): GameState | null {
  const next = getNextSupplySlotUpgrade(state.supplySlots);
  if (!next) return null;
  if (state.coins < next.cost) return null;

  const newSlotCount  = next.slots - state.supplySlots;
  const emptySlots: ShopSlot[] = Array.from({ length: newSlotCount }, (_, i) => ({
    speciesId: `supply_empty_${Date.now()}_${i}`,
    price:     0,
    quantity:  0,
    isEmpty:   true,
  }));

  return {
    ...state,
    coins:       state.coins - next.cost,
    supplySlots: next.slots,
    supplyShop:  [...(state.supplyShop ?? []), ...emptySlots],
  };
}

// ── Alchemy — sacrifice ────────────────────────────────────────────────────

export interface SacrificeEntry {
  speciesId: string;
  mutation?: MutationType;
  quantity: number;
}

/**
 * Optimistically consumes flowers and adds essences.
 * The edge function mirrors this logic server-side.
 * Returns null if any sacrifice entry is invalid (wrong species / not enough stock).
 */
export function sacrificeFlowers(
  state: GameState,
  sacrifices: SacrificeEntry[],
): GameState | null {
  if (sacrifices.length === 0) return null;

  // Validate every entry first
  for (const { speciesId, mutation, quantity } of sacrifices) {
    if (quantity < 1) return null;
    const species = getFlower(speciesId);
    if (!species) return null;
    const invItem = state.inventory.find(
      (i) => i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
    );
    if (!invItem || invItem.quantity < quantity) return null;
  }

  // Consume flowers
  let newInventory = [...state.inventory];
  for (const { speciesId, mutation, quantity } of sacrifices) {
    newInventory = newInventory
      .map((i) =>
        i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
          ? { ...i, quantity: i.quantity - quantity }
          : i
      )
      .filter((i) => i.quantity > 0);
  }

  // Accumulate essence deltas
  let newEssences = [...state.essences];
  for (const { speciesId, mutation: _mut, quantity } of sacrifices) {
    const species = getFlower(speciesId)!;
    const yields  = calculateEssenceYield(species.types, species.rarity, quantity);
    newEssences   = mergeEssences(newEssences, yields);
  }

  return { ...state, inventory: newInventory, essences: newEssences };
}

// ── Consumable use helpers ─────────────────────────────────────────────────

/**
 * Optimistically deduct one consumable from inventory.
 * Returns null if the player doesn't own that consumable.
 */
function deductConsumable(
  state: GameState,
  consumableId: string,
): GameState | null {
  const idx = state.consumables.findIndex((c) => c.id === consumableId && c.quantity > 0);
  if (idx < 0) return null;
  return {
    ...state,
    consumables: state.consumables
      .map((c, i) => i === idx ? { ...c, quantity: c.quantity - 1 } : c)
      .filter((c) => c.quantity > 0),
  };
}

/**
 * Optimistically apply a plant-targeting consumable at (row, col).
 * Handles Bloom Burst, Heirloom Charm, Purity Vial, Giant Vial, mutation-boost vials.
 * Returns null if the plant or consumable doesn't exist.
 */
export function applyPlantConsumable(
  state:        GameState,
  row:          number,
  col:          number,
  consumableId: string,
): GameState | null {
  const plot  = state.grid[row]?.[col];
  const plant = plot?.plant;
  if (!plant) return null;

  const after = deductConsumable(state, consumableId);
  if (!after) return null;

  let updatedPlant: PlantedFlower = { ...plant };

  if (consumableId.startsWith("bloom_burst_")) {
    const now     = Date.now();
    const stage   = getCurrentStage(plant, now);
    const species = getFlower(plant.speciesId);
    // Bloom Burst: skip part of the remaining time in the plant's CURRENT stage.
    //   - Seed stage   → halve remaining seed time   (advance by remaining/2)
    //   - Sprout stage → quarter remaining sprout time (advance by remaining/4)
    //                    half as effective because sprout is 2× as long as seed
    //   - Bloom stage  → no-op (already done)
    // We write directly to growthMs + lastTickAt so the optimistic update is
    // independent of growth multipliers. Server mirrors this exact logic.
    if (species && stage !== "bloom") {
      const seedMs   = species.growthTime.seed;
      const sproutMs = species.growthTime.sprout;
      // Inline current growthMs — same fallback chain as the server's getStage.
      // Avoid computeGrowthMs() which requires weather/gear context that this
      // helper doesn't have access to.
      const currentGm =
        plant.growthMs !== undefined
          ? plant.growthMs + Math.max(0, now - (plant.lastTickAt ?? now))
          : plant.sproutedAt != null
            ? seedMs + Math.max(0, now - plant.sproutedAt)
            : Math.max(0, now - plant.timePlanted);
      const stageEnd = stage === "seed" ? seedMs : seedMs + sproutMs;
      const divisor  = stage === "seed" ? 2 : 4;
      const remaining = Math.max(0, stageEnd - currentGm);
      const newGm     = currentGm + Math.floor(remaining / divisor);
      updatedPlant = { ...updatedPlant, growthMs: newGm, lastTickAt: now };
      // Also stamp sproutedAt if we crossed the seed → sprout boundary so
      // legacy code paths (and the codex/UI fallbacks) stay consistent.
      if (newGm >= seedMs && !updatedPlant.sproutedAt) {
        updatedPlant = { ...updatedPlant, sproutedAt: now };
      }
    }
  } else if (consumableId.startsWith("heirloom_charm_")) {
    updatedPlant = { ...updatedPlant, heirloomActive: true };
  } else if (consumableId.startsWith("purity_vial_")) {
    // Purity Vial: removes the current mutation. Requires one to be present.
    if (!plant.mutation) return null;
    updatedPlant = { ...updatedPlant, mutation: undefined };
  } else if (
    consumableId.startsWith("giant_vial_")   ||
    consumableId.startsWith("frost_vial_")   ||
    consumableId.startsWith("ember_vial_")   ||
    consumableId.startsWith("storm_vial_")   ||
    consumableId.startsWith("moon_vial_")    ||
    consumableId.startsWith("golden_vial_")  ||
    consumableId.startsWith("rainbow_vial_")
  ) {
    // Guard: mutation vials cannot overwrite an existing mutation on a bloom.
    // The player must use a Purity Vial to clear the mutation first.
    if (plant.bloomedAt && typeof plant.mutation === "string") return null;

    if (consumableId.startsWith("giant_vial_")) {
      updatedPlant = { ...updatedPlant, forcedMutation: "giant", mutationBlocked: undefined };
    } else if (consumableId.startsWith("frost_vial_"))   {
      updatedPlant = { ...updatedPlant, mutation: "frozen"   };
    } else if (consumableId.startsWith("ember_vial_"))   {
      updatedPlant = { ...updatedPlant, mutation: "scorched" };
    } else if (consumableId.startsWith("storm_vial_"))   {
      updatedPlant = { ...updatedPlant, mutation: "shocked"  };
    } else if (consumableId.startsWith("moon_vial_"))    {
      updatedPlant = { ...updatedPlant, mutation: "moonlit"  };
    } else if (consumableId.startsWith("golden_vial_"))  {
      updatedPlant = { ...updatedPlant, mutation: "golden"   };
    } else if (consumableId.startsWith("rainbow_vial_")) {
      updatedPlant = { ...updatedPlant, mutation: "rainbow"  };
    }
  } else if (consumableId === "magnifying_glass") {
    // Reveal the species growing in this tile (seed/sprout only).
    if (plant.revealed) return null;
    if (plant.bloomedAt || plant.timePlanted === 0) return null; // already bloomed
    updatedPlant = { ...updatedPlant, revealed: true };
  } else if (consumableId === "garden_pin") {
    // Shield the plot from auto-harvest (Harvest Bell, Auto-Planter).
    if (plant.pinned) return null;
    updatedPlant = { ...updatedPlant, pinned: true };
  } else if (consumableId === "ruler") {
    // Permanently show the live gear growth multiplier badge on this tile.
    if (plant.showMultiplier) return null;
    if (plant.bloomedAt) return null; // already bloomed — no multiplier meaningful
    updatedPlant = { ...updatedPlant, showMultiplier: true };
  }

  const newGrid = after.grid.map((r, ri) =>
    r.map((p, ci) => ri === row && ci === col ? { ...p, plant: updatedPlant } : p)
  );

  return { ...after, grid: newGrid };
}

/**
 * Optimistically apply Eclipse Tonic — advances all plant timePlanted stamps
 * backward by advanceHours hours and records the use date.
 */
export function applyEclipseTonic(
  state:        GameState,
  consumableId: string,
  advanceHours: number,
): GameState | null {
  const after = deductConsumable(state, consumableId);
  if (!after) return null;

  const advanceMs = advanceHours * 60 * 60 * 1_000;
  const today     = new Date().toISOString().slice(0, 10);

  const newGrid = after.grid.map((row) =>
    row.map((plot) => {
      // Advance gear timestamps — placedAt drives expiry and Balance Scale phase;
      // crossbreedStartedAt drives cropsticks breeding progress.
      const g = plot.gear;
      const newGear = g ? {
        ...g,
        placedAt: g.placedAt - advanceMs,
        ...(g.crossbreedStartedAt != null ? { crossbreedStartedAt: g.crossbreedStartedAt - advanceMs } : {}),
      } : g;

      if (!plot.plant) return newGear !== g ? { ...plot, gear: newGear } : plot;
      const p = plot.plant;
      if (p.timePlanted === 0) return { ...plot, gear: newGear }; // bloom-placed sentinel — skip plant
      return {
        ...plot,
        gear: newGear,
        plant: {
          ...p,
          timePlanted: p.timePlanted - advanceMs,
          sproutedAt:  p.sproutedAt  != null ? p.sproutedAt  - advanceMs : undefined,
          bloomedAt:   p.bloomedAt   != null ? p.bloomedAt   - advanceMs : undefined,
          lastTickAt:  p.lastTickAt  != null ? p.lastTickAt  - advanceMs : undefined,
        },
      };
    })
  );

  return { ...after, grid: newGrid, lastEclipseTonic: today };
}

/**
 * Optimistically apply Wind Shear — deducts consumable, records timestamp,
 * and immediately regenerates the supply shop.
 */
export function applyWindShear(state: GameState): GameState | null {
  const after = deductConsumable(state, "wind_shear");
  if (!after) return null;
  const now = Date.now();
  // Also regenerate the supply shop (the whole point of Wind Shear)
  return forceRefreshSupplyShop({ ...after, lastWindShearUsed: now });
}

/**
 * Optimistically apply Slot Lock — deducts consumable and marks the slot as locked.
 */
export function applySlotLock(state: GameState, slotSpeciesId: string): GameState | null {
  const after = deductConsumable(state, "slot_lock");
  if (!after) return null;
  const slot = (after.supplyShop ?? []).find((s) => s.speciesId === slotSpeciesId);
  if (!slot || slot.isEmpty || slot.locked) return null;
  return {
    ...after,
    supplyShop: (after.supplyShop ?? []).map((s) =>
      s.speciesId === slotSpeciesId ? { ...s, locked: true } : s
    ),
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