import { supabase } from "./supabase";
import type { GameState } from "../store/gameStore";
import * as Sentry from "@sentry/react";
import type { DailyTaskState } from "./dailySeed";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// ── Base fetch wrapper ────────────────────────────────────────────────────────

async function callEdge<T>(name: string, body: unknown, isRetry = false): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${BASE_URL}/${name}`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  // Stale access token — refresh once and retry.
  if (res.status === 401 && !isRetry) {
    await supabase.auth.refreshSession();
    return callEdge(name, body, true);
  }

  const json = await res.json();
  if (!res.ok || !json.ok) {
    Sentry.captureException(new Error(json.error ?? "Edge function error"), {
      extra: { edgeFunction: name, status: res.status },
    });
    throw new Error(json.error ?? "Edge function error");
  }
  return json as T;
}

// ── Return types ──────────────────────────────────────────────────────────────
// Each function returns only the fields it modified — merged into state on reconcile.

export interface HarvestResult {
  ok:         true;
  // coins intentionally omitted — coins never change on harvest (only on sell).
  // grid intentionally omitted — client optimistic state owns the grid.
  inventory:  GameState["inventory"];
  discovered: GameState["discovered"];
  mutation:   string | undefined;
  serverUpdatedAt: string;
}

export interface HarvestAllResult {
  ok:         true;
  inventory:  GameState["inventory"];
  discovered: GameState["discovered"];
  serverUpdatedAt: string;
}

export interface PlantAllResult {
  ok:        true;
  // grid intentionally omitted — mutations live only in client state.
  // inventory intentionally omitted from merge delta — see edgePlantAll.
  serverUpdatedAt: string;
}

export interface SellAllResult {
  ok:          true;
  coins:       number;
  inventory:   GameState["inventory"];
  serverUpdatedAt: string;
}

export interface PlantSeedResult {
  ok:        true;
  grid:      GameState["grid"];
  inventory: GameState["inventory"];
  serverUpdatedAt: string;
}

export interface ShopActionResult {
  ok:          true;
  coins:       number;
  shop:        GameState["shop"];
  inventory:   GameState["inventory"];
  fertilizers: GameState["fertilizers"];
  serverUpdatedAt: string;
}

export interface ApplyFertilizerResult {
  ok:          true;
  grid:        GameState["grid"];
  fertilizers: GameState["fertilizers"];
  serverUpdatedAt: string;
}

export interface UpgradeResult {
  ok:         true;
  coins:      number;
  // farm upgrade fields
  farm_size?: number;
  farm_rows?: number;
  grid?:      GameState["grid"];
  // shop slot upgrade fields
  shop_slots?: number;
  shop?:       GameState["shop"];
  serverUpdatedAt: string;
}

// ── Typed callers ─────────────────────────────────────────────────────────────

export function edgeHarvestAll(plots: { row: number; col: number }[]) {
  return callEdge<HarvestAllResult>("harvest-all", { plots });
}

export async function edgePlantAll(plots: { row: number; col: number; speciesId: string }[]): Promise<PlantAllResult> {
  // Strip inventory from the merge delta. plant-all returns the full DB inventory
  // snapshot at the time it runs — if that snapshot pre-dates harvest-all's write
  // propagating, merging it would silently overwrite the client's just-harvested
  // blooms with a stale list. The client's optimistic plantAll() already consumed
  // the correct seeds; we only need serverUpdatedAt to keep the CAS cursor in sync.
  const { inventory: _omit, ...delta } = await callEdge<PlantAllResult & { inventory: unknown }>("plant-all", { plots });
  return delta as PlantAllResult;
}

export async function edgeHarvest(row: number, col: number): Promise<Omit<HarvestResult, "inventory">> {
  // Strip inventory from the merge delta. Each serialized harvest returns the DB
  // snapshot at that moment, which would overwrite optimistic flowers added by
  // subsequent harvests that haven't hit the server yet — causing the "count one
  // by one" effect. The client's optimistic inventory is correct; rollback handles
  // the failure case.
  const { inventory: _omit, ...delta } = await callEdge<HarvestResult>("harvest", { row, col });
  return delta;
}

export function edgeSyncShop(shop: GameState["shop"], lastShopReset: number) {
  return callEdge<{ ok: true }>("shop-action", { action: "sync", shop, lastShopReset });
}

export function edgePlantSeed(row: number, col: number, speciesId: string) {
  return callEdge<PlantSeedResult>("plant-seed", { row, col, speciesId });
}

export function edgePlantBloom(row: number, col: number, speciesId: string, mutation?: string) {
  return callEdge<PlantSeedResult>("plant-bloom", { row, col, speciesId, mutation });
}

export interface RemovePlantResult {
  ok:          true;
  grid:        GameState["grid"];
  inventory:   GameState["inventory"];
  consumables: GameState["consumables"];
  serverUpdatedAt: string;
}

export function edgeRemovePlant(row: number, col: number) {
  return callEdge<RemovePlantResult>("remove-plant", { row, col, consumableId: "shovel" });
}

export interface UnpinPlantResult {
  ok:              true;
  grid:            GameState["grid"];
  serverUpdatedAt: string;
}

/** Strip the Garden Pin flag from a plant — required before the bloom can be
 *  manually harvested. The pin is consumed (no refund). */
export function edgeUnpinPlant(row: number, col: number) {
  return callEdge<UnpinPlantResult>("unpin-plant", { row, col });
}

export function edgeBuyFlower(speciesId: string, buyAll = false) {
  return callEdge<ShopActionResult>("shop-action", {
    action: buyAll ? "buy_all" : "buy",
    speciesId,
  });
}

export function edgeBuyFertilizer(fertType: string, buyAll = false) {
  return callEdge<ShopActionResult>("shop-action", {
    action:   buyAll ? "buy_all" : "buy",
    fertType,
  });
}

export function edgeSellFlower(speciesId: string, mutation: string | undefined, quantity = 1) {
  return callEdge<ShopActionResult>("shop-action", {
    action: "sell",
    speciesId,
    mutation,
    quantity,
  });
}

/** Sell all blooms in a single atomic server write — avoids the partial-failure
 *  rollback bug from N sequential edgeSellFlower calls. */
export function edgeSellAll(items: { speciesId: string; mutation?: string; quantity: number }[]) {
  return callEdge<SellAllResult>("shop-action", { action: "sell_all", items });
}

export function edgeApplyFertilizer(row: number, col: number, fertType: string) {
  return callEdge<ApplyFertilizerResult>("apply-fertilizer", { row, col, fertType });
}

export function edgeUpgradeFarm() {
  return callEdge<UpgradeResult>("upgrade", { action: "farm" });
}

export function edgeUpgradeShopSlots() {
  return callEdge<UpgradeResult>("upgrade", { action: "shop_slots" });
}

export function edgeUpgradeSupplySlots() {
  return callEdge<UpgradeResult>("upgrade", { action: "supply_slots" });
}

// ── Gear actions ──────────────────────────────────────────────────────────────

export interface GearActionResult {
  ok:            true;
  grid:          GameState["grid"];
  gearInventory?: GameState["gearInventory"];
  fertilizers?:  GameState["fertilizers"];
  serverUpdatedAt: string;
}

export function edgePlaceGear(row: number, col: number, gearType: string, direction?: string) {
  return callEdge<GearActionResult>("gear-action", { action: "place", row, col, gearType, direction });
}

export function edgeRemoveGear(row: number, col: number) {
  return callEdge<GearActionResult>("gear-action", { action: "remove", row, col });
}

export function edgeSetFanDirection(row: number, col: number, direction: string) {
  return callEdge<GearActionResult>("gear-action", { action: "set_direction", row, col, direction });
}

export function edgeCollectFromComposter(row: number, col: number) {
  return callEdge<GearActionResult>("gear-action", { action: "collect", row, col });
}

// ── Supply shop actions ───────────────────────────────────────────────────────

export interface SupplyBuyResult {
  ok:            true;
  coins:         number;
  supplyShop:    GameState["supplyShop"];
  fertilizers:   GameState["fertilizers"];
  gearInventory: GameState["gearInventory"];
  consumables:   GameState["consumables"];
  serverUpdatedAt: string;
}

export function edgeBuyFromSupplyShop(slotId: string) {
  return callEdge<SupplyBuyResult>("supply-action", { action: "buy", slotId });
}

export function edgeBuyAllSeeds() {
  return callEdge<ShopActionResult>("shop-action", { action: "buy_all_seeds" });
}

export function edgeBuyAllFromSupplyShop() {
  return callEdge<SupplyBuyResult>("supply-action", { action: "buy_all" });
}

export function edgeSyncSupplyShop(supplyShop: GameState["supplyShop"], lastSupplyReset: number) {
  return callEdge<{ ok: true }>("supply-action", { action: "sync", supplyShop, lastSupplyReset });
}

// ── Gifting ───────────────────────────────────────────────────────────────────

export interface SendGiftResult {
  ok:        true;
  inventory: GameState["inventory"];
  serverUpdatedAt: string;
}

export interface ClaimGiftResult {
  ok:         true;
  inventory:  GameState["inventory"];
  discovered: GameState["discovered"];
  serverUpdatedAt: string;
}

export function edgeSendGift(
  receiverId: string,
  speciesId:  string,
  mutation:   string | undefined,
  message:    string | undefined,
) {
  return callEdge<SendGiftResult>("send-gift", { receiverId, speciesId, mutation, message });
}

export function edgeClaimGift(giftId: string) {
  return callEdge<ClaimGiftResult>("claim-gift", { giftId });
}

// ── Marketplace ───────────────────────────────────────────────────────────────

export interface MarketplaceListResult {
  ok:             true;
  coins:          number;
  inventory:      GameState["inventory"];
  fertilizers?:   GameState["fertilizers"];
  gearInventory?: GameState["gearInventory"];
  consumables?:   GameState["consumables"];
  listingId:      string;
  serverUpdatedAt: string;
}

export interface MarketplaceUpgradeSlotsResult {
  ok:               true;
  coins:            number;
  marketplaceSlots: number;
  serverUpdatedAt:  string;
}

export interface MarketplaceBuyResult {
  ok:    true;
  coins: number;
  // Item is delivered via mailbox — no direct inventory update
  serverUpdatedAt: string;
}

export interface ClaimMailResult {
  ok:             true;
  kind:           "coins" | "flower" | "seed" | "fertilizer" | "gear" | "consumable";
  coins:          number;
  inventory:      GameState["inventory"];
  fertilizers:    GameState["fertilizers"];
  gearInventory:  GameState["gearInventory"];
  consumables?:   GameState["consumables"];
  discovered:     GameState["discovered"];
  alreadyClaimed?: boolean;
  serverUpdatedAt: string;
}

export interface MarketplaceCancelResult {
  ok:             true;
  inventory:      GameState["inventory"];
  fertilizers?:   GameState["fertilizers"];
  gearInventory?: GameState["gearInventory"];
  consumables?:   GameState["consumables"];
  serverUpdatedAt: string;
}

export function edgeMarketplaceCreateListing(
  speciesId: string,
  mutation: string | undefined,
  askPrice: number,
  isSeed = false,
) {
  return callEdge<MarketplaceListResult>("marketplace-list", {
    action: "create_listing",
    speciesId,
    mutation,
    askPrice,
    isSeed,
  });
}

export function edgeMarketplaceCreateFertilizerListing(
  fertilizerType: string,
  askPrice: number,
) {
  return callEdge<MarketplaceListResult>("marketplace-list", {
    action:         "create_listing",
    isFertilizer:   true,
    fertilizerType,
    askPrice,
  });
}

export function edgeMarketplaceCreateGearListing(
  gearType: string,
  askPrice: number,
) {
  return callEdge<MarketplaceListResult>("marketplace-list", {
    action:   "create_listing",
    isGear:   true,
    gearType,
    askPrice,
  });
}

export function edgeMarketplaceCreateConsumableListing(
  consumableId: string,
  askPrice: number,
) {
  return callEdge<MarketplaceListResult>("marketplace-list", {
    action:       "create_listing",
    isConsumable: true,
    consumableId,
    askPrice,
  });
}

export function edgeMarketplaceUpgradeSlots() {
  return callEdge<MarketplaceUpgradeSlotsResult>("marketplace-list", {
    action: "upgrade_slots",
  });
}

export function edgeMarketplaceBuy(listingId: string) {
  return callEdge<MarketplaceBuyResult>("marketplace-buy", { listingId });
}

export function edgeMarketplaceCancel(listingId: string) {
  return callEdge<MarketplaceCancelResult>("marketplace-cancel", { listingId });
}

export function edgeClaimMail(mailId: string) {
  return callEdge<ClaimMailResult>("claim-mail", { mailId });
}

// ── Attunement ────────────────────────────────────────────────────────────────

export interface ApplyAttunementResult {
  ok:              true;
  grid:            GameState["grid"];
  infusers:        GameState["infusers"];
  serverUpdatedAt: string;
}

export function edgeApplyAttunement(row: number, col: number) {
  return callEdge<ApplyAttunementResult>("apply-infuser", { row, col });
}

// ── Gear crafting (Phase 3 — time-gated queue) ───────────────────────────────

export interface CraftStartResult {
  ok:              true;
  coins:           number;
  essences:        GameState["essences"];
  gearInventory:   GameState["gearInventory"];
  consumables:     GameState["consumables"];
  infusers:        GameState["infusers"];
  fertilizers?:    GameState["fertilizers"];
  craftingQueue:   GameState["craftingQueue"];
  serverUpdatedAt: string;
}

export interface CraftCollectResult {
  ok:              true;
  craftingQueue:   GameState["craftingQueue"];
  essences:        GameState["essences"];
  gearInventory:   GameState["gearInventory"];
  consumables:     GameState["consumables"];
  infusers:        GameState["infusers"];
  fertilizers?:    GameState["fertilizers"];
  serverUpdatedAt: string;
}

export interface CraftCancelResult {
  ok:              true;
  coins:           number;
  craftingQueue:   GameState["craftingQueue"];
  essences:        GameState["essences"];
  gearInventory:   GameState["gearInventory"];
  consumables:     GameState["consumables"];
  infusers:        GameState["infusers"];
  fertilizers?:    GameState["fertilizers"];
  serverUpdatedAt: string;
}

export interface UpgradeCraftingSlotsResult {
  ok:                  true;
  coins:               number;
  crafting_slot_count: number;
  serverUpdatedAt:     string;
}

export function edgeCraftStart(
  kind:        "gear" | "consumable" | "attunement" | "essence",
  outputId:    string,
  durationMs?: number,
  costs?: {
    essenceCosts?:    { type: string; amount: number }[];
    consumableCosts?: { id: string; quantity: number }[];
    attunementCosts?: { rarity: string; quantity: number }[];
  },
  quantity:    number = 1,
) {
  return callEdge<CraftStartResult>("craft-start", { kind, outputId, quantity, durationMs, costs });
}

export function edgeCraftCollect(craftId: string) {
  return callEdge<CraftCollectResult>("craft-collect", { craftId });
}

export function edgeCraftCancel(craftId: string) {
  return callEdge<CraftCancelResult>("craft-cancel", { craftId });
}

export function edgeUpgradeCraftingSlots() {
  return callEdge<UpgradeCraftingSlotsResult>("upgrade", { action: "crafting_slots" });
}

// ── Gear crafting (legacy — superseded by Phase 3 queue) ─────────────────────
/** @deprecated Use edgeCraftStart / edgeCraftCollect instead. */
export interface CraftGearResult {
  ok:            true;
  essences:      GameState["essences"];
  gearInventory: GameState["gearInventory"];
  consumables:   GameState["consumables"];
  serverUpdatedAt: string;
}

/** @deprecated Use edgeCraftStart / edgeCraftCollect instead. */
export function edgeCraftGear(outputGearType: string) {
  return callEdge<CraftGearResult>("craft-gear", { outputGearType });
}

// ── Seed pouches ──────────────────────────────────────────────────────────

export interface AlchemyCraftSeedResult {
  ok:              true;
  inventory:       GameState["inventory"];
  consumables:     GameState["consumables"];
  outputSpeciesId: string;
  serverUpdatedAt: string;
}

/** Open a crafted Seed Pouch (seed_pouch_1 … seed_pouch_5) from inventory.
 *  Deducts 1 pouch, rolls a random species at the appropriate rarity tier,
 *  and adds the seed to inventory. */
export function edgeAlchemyCraftSeed(consumableId: string) {
  return callEdge<AlchemyCraftSeedResult>("alchemy-craft-seed", { consumableId });
}

// ── Alchemy ───────────────────────────────────────────────────────────────────

export interface AlchemySacrificeResult {
  ok:              true;
  inventory:       GameState["inventory"];
  essences:        GameState["essences"];
  serverUpdatedAt: string;
}

export function edgeAlchemySacrifice(
  sacrifices: { speciesId: string; mutation?: string; quantity: number }[]
) {
  return callEdge<AlchemySacrificeResult>("alchemy-sacrifice", { sacrifices });
}

export interface CraftUniversalResult {
  ok:              true;
  essences:        GameState["essences"];
  serverUpdatedAt: string;
}

export function edgeCraftUniversalEssence(quantity: number) {
  return callEdge<CraftUniversalResult>("craft-universal-essence", { quantity });
}

export interface AlchemyCraftResult {
  ok:              true;
  essences:        GameState["essences"];
  consumables:     GameState["consumables"];
  infusers:        GameState["infusers"];
  serverUpdatedAt: string;
}

export function edgeAlchemyCraft(
  craftType: "consumable" | "attunement",
  id: string,
) {
  return callEdge<AlchemyCraftResult>("alchemy-craft", { craftType, id });
}

// ── Alchemy infuse ────────────────────────────────────────────────────────────

export interface AlchemyAttuneResult {
  ok:              true;
  inventory:       GameState["inventory"];
  essences:        GameState["essences"];
  coins:           number;
  discovered:      GameState["discovered"];
  mutation:        string;
  tier:            1 | 2 | 3 | 4;
  serverUpdatedAt: string;
}

export interface AlchemyStripResult {
  ok:              true;
  inventory:       GameState["inventory"];
  coins:           number;
  serverUpdatedAt: string;
}

/** @deprecated Replaced by edgeAttuneStart — kept as a compatibility shim until
 *  no client calls it. The new alchemy attunement flow is time-gated through
 *  the attune-start / attune-collect / attune-cancel edge functions. */
export function edgeAlchemyAttune(
  speciesId:   string,
  essenceType: string,
  quantity:    number,
) {
  return callEdge<AlchemyAttuneResult>("alchemy-infuse", {
    action: "infuse", speciesId, essenceType, quantity,
  });
}

/** Strip the mutation off a mutated bloom — spends coins, returns a base bloom. */
export function edgeAlchemyStrip(speciesId: string, mutation: string) {
  return callEdge<AlchemyStripResult>("alchemy-infuse", {
    action: "strip", speciesId, mutation,
  });
}

// ── Alchemy attunement queue (v2.3 — time-gated) ─────────────────────────────

export interface AttuneStartResult {
  ok:              true;
  coins:           number;
  inventory:       GameState["inventory"];
  essences:        GameState["essences"];
  attunementQueue: GameState["attunementQueue"];
  serverUpdatedAt: string;
}
export interface AttuneCollectResult {
  ok:              true;
  inventory:       GameState["inventory"];
  discovered:      GameState["discovered"];
  attunementQueue: GameState["attunementQueue"];
  mutation:        string;
  tier:            1 | 2 | 3 | 4;
  serverUpdatedAt: string;
}
export interface AttuneCancelResult {
  ok:              true;
  inventory:       GameState["inventory"];
  attunementQueue: GameState["attunementQueue"];
  serverUpdatedAt: string;
}
export interface UpgradeAttunementSlotsResult {
  ok:                true;
  coins:             number;
  attunement_slots:  number;
  serverUpdatedAt:   string;
}

/** Start a time-gated attunement on an unmutated bloom. Server rolls the
 *  mutation outcome at start and stores it on the queue entry. */
export function edgeAttuneStart(speciesId: string, essenceType: string, quantity: number) {
  return callEdge<AttuneStartResult>("attune-start", { speciesId, essenceType, quantity });
}
/** Collect a finished attunement — applies the rolled mutation to inventory. */
export function edgeAttuneCollect(attunementId: string) {
  return callEdge<AttuneCollectResult>("attune-collect", { attunementId });
}
/** Cancel an in-flight attunement — refunds the source bloom (essence is forfeit). */
export function edgeAttuneCancel(attunementId: string) {
  return callEdge<AttuneCancelResult>("attune-cancel", { attunementId });
}
/** Buy the next attunement slot upgrade. */
export function edgeUpgradeAttunementSlots() {
  return callEdge<UpgradeAttunementSlotsResult>("upgrade", { action: "attunement_slots" });
}

// ── Consumable usage ──────────────────────────────────────────────────────────

export interface UseConsumableResult {
  ok:              true;
  grid?:           GameState["grid"];
  consumables:     GameState["consumables"];
  inventory?:      GameState["inventory"];   // returned when supply shop refreshed
  supplyShop?:     GameState["supplyShop"];
  lastWindShearUsed?: number;
  lastEclipseTonic?:  string;
  serverUpdatedAt: string;
}

/** Apply a plant-targeting consumable (Bloom Burst, vials, Heirloom Charm) */
export function edgeApplyPlantConsumable(row: number, col: number, consumableId: string) {
  return callEdge<UseConsumableResult>("use-consumable", { action: "apply_to_plant", row, col, consumableId });
}

/** Use Eclipse Tonic — advances all garden plants by advanceHours */
export function edgeUseEclipseTonic(consumableId: string) {
  return callEdge<UseConsumableResult>("use-consumable", { action: "eclipse_tonic", consumableId });
}

/** Use Wind Shear — refreshes supply shop bypassing cooldown */
export function edgeUseWindShear() {
  return callEdge<UseConsumableResult>("use-consumable", { action: "wind_shear", consumableId: "wind_shear" });
}

/** Use Slot Lock — locks a supply shop slot through the next refresh */
export function edgeUseSlotLock(slotId: string) {
  return callEdge<UseConsumableResult>("use-consumable", { action: "slot_lock", consumableId: "slot_lock", slotId });
}

// ── Active speed-boost consumables (Phase 5a) ─────────────────────────────────

export interface ActivateBoostResult {
  ok:              true;
  consumables:     GameState["consumables"];
  activeBoosts:    GameState["activeBoosts"];
  craftingQueue:   GameState["craftingQueue"];
  serverUpdatedAt: string;
}

/** Activate a speed_boost consumable (Verdant Rush, Forge Haste, Resonance Draft).
 *  Server validates the consumable id, deducts one, and records the boost expiry. */
export function edgeActivateBoost(consumableId: string) {
  return callEdge<ActivateBoostResult>("use-consumable", { action: "activate_boost", consumableId });
}


// ── Daily tasks ───────────────────────────────────────────────────────────────

export interface DailyCompleteResult {
  ok:              true;
  dailyTasks:      DailyTaskState;
  consumables?:    GameState["consumables"];
  xpGained?:       number;
  gardenerLevel?:  number;
  gardenerXp?:     number;
  leveledUp?:      boolean;
  levelsGained?:   number;
  rewardPouch?:    string;
  gemsGained?:     number;
  gems?:           number;
  serverUpdatedAt: string;
}

export function edgeDailyComplete(taskType: string) {
  return callEdge<DailyCompleteResult>("daily-complete", { taskType });
}

// ── Achievements ──────────────────────────────────────────────────────────────

export interface AchievementClaimResult {
  ok:                  true;
  xpGained:            number;
  gemsGained:          number;
  gardenerLevel:       number;
  gardenerXp:          number;
  leveledUp:           boolean;
  levelsGained:        number;
  gems:                number;
  achievementsClaimed: string[];
  serverUpdatedAt:     string;
}

export function edgeAchievementClaim(achievementId: string) {
  return callEdge<AchievementClaimResult>("achievement-claim", { achievementId });
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface CheckinClaimResult {
  ok:              true;
  claimedDay:      number;
  gemsGained:      number;
  gems:            number;
  progress:        { claimedDays: number[]; lastClaimedAt: string };
  serverUpdatedAt: string;
}

export function edgeCheckinClaim(eventId: string) {
  return callEdge<CheckinClaimResult>("event-checkin-claim", { eventId });
}

export interface QuestSubmitResult {
  ok:                   true;
  questId:              string;
  gemsGained:           number;
  xpGained:             number;
  finalRewardDelivered: boolean;
  inventory:            GameState["inventory"];
  progress:             { completedQuests: string[]; claimedRewards: string[] };
  gardenerLevel:        number;
  gardenerXp:           number;
  gems:                 number;
  serverUpdatedAt:      string;
}

export function edgeQuestSubmit(
  eventId:   string,
  questId:   string,
  speciesId: string,
  mutation:  string | null,
) {
  return callEdge<QuestSubmitResult>("event-quest-submit", { eventId, questId, speciesId, mutation });
}