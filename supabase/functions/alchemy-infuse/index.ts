import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const err = (msg: string, status = 400) => json({ error: msg }, status);

// ── Species rarity (mirrors use-consumable/index.ts) ──────────────────────────

const SPECIES_RARITY: Record<string, string> = {
  quickgrass: "common",    dustweed: "common",       sprig: "common",
  dewdrop: "common",       pebblebloom: "common",    ember_moss: "common",
  dandelion: "common",     clover: "common",          violet: "common",
  lemongrass: "common",    daisy: "common",           honeywort: "common",
  buttercup: "common",     dawnpetal: "common",       poppy: "common",
  chamomile: "common",     marigold: "common",        sunflower: "common",
  coppercup: "common",     ivybell: "common",         thornberry: "common",
  saltmoss: "common",      ashpetal: "common",        snowdrift: "common",
  swiftbloom: "uncommon",  shortcress: "uncommon",    thornwhistle: "uncommon",
  starwort: "uncommon",    mintleaf: "uncommon",      tulip: "uncommon",
  inkbloom: "uncommon",    hyacinth: "uncommon",      snapdragon: "uncommon",
  beebalm: "uncommon",     candleflower: "uncommon",  carnation: "uncommon",
  ribbonweed: "uncommon",  hibiscus: "uncommon",      wildberry: "uncommon",
  frostbell: "uncommon",   bluebell: "uncommon",      cherry_blossom: "uncommon",
  rose: "uncommon",        peacockflower: "uncommon", bamboo_bloom: "uncommon",
  hummingbloom: "uncommon",water_lily: "uncommon",    lanternflower: "uncommon",
  dovebloom: "uncommon",   coral_bells: "uncommon",   sundew: "uncommon",
  bubblebloom: "uncommon",
  flashpetal: "rare",      rushwillow: "rare",        sweetheart_lily: "rare",
  glassbell: "rare",       stormcaller: "rare",       lavender: "rare",
  amber_crown: "rare",     peach_blossom: "rare",     foxglove: "rare",
  butterbloom: "rare",     peony: "rare",             tidebloom: "rare",
  starweave: "rare",       wisteria: "rare",          dreamcup: "rare",
  coralbell: "rare",       foxfire: "rare",           bird_of_paradise: "rare",
  solarbell: "rare",       moonpetal: "rare",         orchid: "rare",
  duskrose: "rare",        passionflower: "rare",     glasswing: "rare",
  mirror_orchid: "rare",   stargazer_lily: "rare",    prism_lily: "rare",
  dusk_orchid: "rare",
  firstbloom: "legendary",    haste_lily: "legendary",     verdant_crown: "legendary",
  ironwood_bloom: "legendary",sundial: "legendary",         lotus: "legendary",
  candy_blossom: "legendary", prismbark: "legendary",       dolphinia: "legendary",
  ghost_orchid: "legendary",  nestbloom: "legendary",       black_rose: "legendary",
  pumpkin_blossom: "legendary",starburst_lily: "legendary",  sporebloom: "legendary",
  fire_lily: "legendary",     stargazer: "legendary",       fullmoon_bloom: "legendary",
  ice_crown: "legendary",     diamond_bloom: "legendary",   oracle_eye: "legendary",
  halfmoon_bloom: "legendary",aurora_bloom: "legendary",    mirrorpetal: "legendary",
  emberspark: "legendary",
  phoenix_lily: "legendary",  eclipse_bloom: "legendary",   tempest_orchid: "legendary",
  blightmantle: "legendary",  cosmosbloom: "legendary",     dreamgust: "legendary",
  blink_rose: "mythic",    dawnfire: "mythic",        moonflower: "mythic",
  jellybloom: "mythic",    celestial_bloom: "mythic", void_blossom: "mythic",
  seraph_wing: "mythic",   solar_rose: "mythic",      nebula_drift: "mythic",
  superbloom: "mythic",    wanderbloom: "mythic",     chrysanthemum: "mythic",
  solarburst: "mythic",    tidalune: "mythic",        whisperleaf: "mythic",
  crystalmind: "mythic",
  umbral_bloom: "exalted",  obsidian_rose: "exalted", duskmantle: "exalted",
  graveweb: "exalted",      nightwing: "exalted",     ashenveil: "exalted",
  voidfire: "exalted",      void_chrysalis: "exalted",starloom: "exalted",
  dreambloom: "prismatic",  fairy_blossom: "prismatic", lovebind: "prismatic",
  eternal_heart: "prismatic",nova_bloom: "prismatic",  princess_blossom: "prismatic",
  the_first_bloom: "prismatic",
  // Event-exclusive
  sakura_blossom: "prismatic",
};

// ── Species types (mirrors src/data/flowers.ts) ───────────────────────────────

const SPECIES_TYPES: Record<string, string[]> = {
  quickgrass: ["grove"],             dustweed: ["zephyr","shadow"],       sprig: ["grove"],
  dewdrop: ["tide"],                 pebblebloom: ["grove"],              ember_moss: ["blaze","grove"],
  dandelion: ["grove","zephyr"],     clover: ["grove","fairy"],           violet: ["fairy","arcane"],
  lemongrass: ["grove","solar"],     daisy: ["grove","fairy"],            honeywort: ["grove","solar"],
  buttercup: ["fairy","solar"],      dawnpetal: ["lunar","solar"],        poppy: ["blaze","grove"],
  chamomile: ["grove","solar"],      marigold: ["solar","grove"],         sunflower: ["solar"],
  coppercup: ["grove"],              ivybell: ["grove","tide"],           thornberry: ["grove"],
  saltmoss: ["tide"],                ashpetal: ["shadow","zephyr"],       snowdrift: ["frost"],
  swiftbloom: ["zephyr"],            shortcress: ["grove"],               thornwhistle: ["grove","blaze"],
  starwort: ["stellar"],             mintleaf: ["grove","frost"],         tulip: ["fairy","grove"],
  inkbloom: ["arcane","shadow"],     hyacinth: ["blaze","fairy"],         snapdragon: ["blaze","arcane"],
  beebalm: ["grove","solar"],        candleflower: ["blaze","arcane"],    carnation: ["fairy"],
  ribbonweed: ["fairy"],             hibiscus: ["solar","blaze"],         wildberry: ["grove"],
  frostbell: ["frost"],              bluebell: ["fairy","tide"],          cherry_blossom: ["fairy","grove"],
  rose: ["fairy"],                   peacockflower: ["arcane","zephyr"],  bamboo_bloom: ["grove","zephyr"],
  hummingbloom: ["zephyr","fairy"],  water_lily: ["tide"],                lanternflower: ["blaze","arcane"],
  dovebloom: ["zephyr","fairy"],     coral_bells: ["tide","fairy"],       sundew: ["grove","shadow"],
  bubblebloom: ["tide","fairy"],
  flashpetal: ["storm"],             rushwillow: ["zephyr","tide"],       sweetheart_lily: ["fairy"],
  glassbell: ["arcane","stellar"],   stormcaller: ["storm"],              lavender: ["fairy","arcane"],
  amber_crown: ["solar","blaze"],    peach_blossom: ["grove","fairy"],    foxglove: ["shadow","arcane"],
  butterbloom: ["fairy","zephyr"],   peony: ["fairy"],                    tidebloom: ["tide"],
  starweave: ["stellar","arcane"],   wisteria: ["fairy","arcane"],        dreamcup: ["fairy","arcane"],
  coralbell: ["tide"],               foxfire: ["blaze","arcane"],         bird_of_paradise: ["zephyr","solar"],
  solarbell: ["solar"],              moonpetal: ["lunar"],                orchid: ["fairy","arcane"],
  duskrose: ["lunar","shadow"],      passionflower: ["arcane","storm"],   glasswing: ["arcane"],
  mirror_orchid: ["arcane","stellar"],stargazer_lily: ["stellar"],        prism_lily: ["arcane","stellar"],
  dusk_orchid: ["lunar","solar"],
  firstbloom: ["solar","fairy"],     haste_lily: ["zephyr","storm"],      verdant_crown: ["grove","fairy"],
  ironwood_bloom: ["grove"],         sundial: ["solar","arcane"],         lotus: ["tide","arcane"],
  candy_blossom: ["fairy"],          prismbark: ["grove","arcane"],       dolphinia: ["tide"],
  ghost_orchid: ["shadow","arcane"], nestbloom: ["grove","fairy"],        black_rose: ["shadow"],
  pumpkin_blossom: ["shadow","grove"],starburst_lily: ["stellar","storm"],sporebloom: ["grove","shadow"],
  fire_lily: ["blaze"],              stargazer: ["stellar"],              fullmoon_bloom: ["lunar"],
  ice_crown: ["frost"],              diamond_bloom: ["frost","arcane"],   oracle_eye: ["arcane","shadow"],
  halfmoon_bloom: ["lunar"],         aurora_bloom: ["stellar","arcane"],  mirrorpetal: ["arcane","stellar"],
  emberspark: ["blaze","storm"],
  phoenix_lily: ["blaze","frost"],   eclipse_bloom: ["lunar","solar"],    tempest_orchid: ["tide","storm"],
  blightmantle: ["grove","shadow"],  cosmosbloom: ["arcane","stellar"],   dreamgust: ["fairy","zephyr"],
  blink_rose: ["arcane","shadow"],   dawnfire: ["solar","blaze"],         moonflower: ["lunar"],
  jellybloom: ["tide","arcane"],     celestial_bloom: ["stellar"],        void_blossom: ["shadow","arcane"],
  seraph_wing: ["zephyr","fairy"],   solar_rose: ["solar"],               nebula_drift: ["stellar","arcane"],
  superbloom: ["storm","stellar"],   wanderbloom: ["zephyr","arcane"],    chrysanthemum: ["arcane","stellar","fairy"],
  solarburst: ["blaze","solar"],     tidalune: ["lunar","tide"],          whisperleaf: ["grove","zephyr"],
  crystalmind: ["frost","arcane"],
  umbral_bloom: ["shadow","lunar"],  obsidian_rose: ["shadow"],           duskmantle: ["shadow","lunar"],
  graveweb: ["shadow"],              nightwing: ["shadow","zephyr"],      ashenveil: ["shadow","blaze"],
  voidfire: ["shadow","blaze"],      void_chrysalis: ["arcane"],          starloom: ["stellar"],
  dreambloom: ["fairy","arcane"],    fairy_blossom: ["fairy"],            lovebind: ["fairy","arcane"],
  eternal_heart: ["fairy","solar"],  nova_bloom: ["stellar","storm","blaze"],princess_blossom: ["fairy","arcane"],
  the_first_bloom: ["arcane","stellar"],
  // Event-exclusive
  sakura_blossom:  ["fairy","zephyr"],
};

// ── Gold cost table [tier1, tier2, tier3, tier4] per rarity ──────────────────

const INFUSE_GOLD_COST: Record<string, [number, number, number, number]> = {
  common:    [     15,      60,      200,       700],
  uncommon:  [     75,     300,      900,     3_000],
  rare:      [    300,   1_200,    4_000,    14_000],
  legendary: [  1_200,   5_000,   16_000,    55_000],
  mythic:    [  5_000,  20_000,   70_000,   250_000],
  exalted:   [ 20_000,  80_000,  280_000, 1_000_000],
  prismatic: [ 80_000, 300_000,1_000_000, 3_500_000],
};

// ── Mutation value multipliers (for strip cost) ───────────────────────────────

const MUTATION_MULTIPLIERS: Record<string, number> = {
  golden: 4.0, rainbow: 5.0, giant: 2.0, moonlit: 2.5,
  frozen: 2.0, scorched: 2.0, wet: 1.25, windstruck: 0.7, shocked: 2.5,
};

// ── Tier thresholds (effective essence) ──────────────────────────────────────
// Matching essence (type matches flower's types, or "universal") counts ×2.
// Tier 1: 1–7   Tier 2: 8–19   Tier 3: 20–39   Tier 4: 40+

function computeTier(effectiveEssence: number): 1 | 2 | 3 | 4 {
  if (effectiveEssence >= 40) return 4;
  if (effectiveEssence >= 20) return 3;
  if (effectiveEssence >= 8)  return 2;
  return 1;
}

// ── Weighted mutation pool per tier ──────────────────────────────────────────

const TIER_MUTATION_WEIGHTS: [string, number][][] = [
  // Tier 1 — common mutations heavily weighted
  [["wet",25],["windstruck",22],["frozen",20],["scorched",20],["shocked",6],["giant",4],["moonlit",2],["golden",1],["rainbow",0]],
  // Tier 2 — balanced across all 9
  [["wet",13],["windstruck",9],["frozen",13],["scorched",13],["shocked",13],["giant",13],["moonlit",12],["golden",7],["rainbow",7]],
  // Tier 3 — rare mutations weighted, common diminished
  [["wet",3],["windstruck",1],["frozen",4],["scorched",4],["shocked",17],["giant",22],["moonlit",17],["golden",16],["rainbow",16]],
  // Tier 4 — rare mutations dominant, common excluded
  [["wet",0],["windstruck",0],["frozen",0],["scorched",0],["shocked",12],["giant",25],["moonlit",18],["golden",22],["rainbow",23]],
];

function rollMutation(tier: 1 | 2 | 3 | 4): string {
  const pool   = TIER_MUTATION_WEIGHTS[tier - 1];
  const total  = pool.reduce((s, [, w]) => s + w, 0);
  let   roll   = Math.random() * total;
  for (const [mutation, weight] of pool) {
    if (weight === 0) continue;
    roll -= weight;
    if (roll <= 0) return mutation;
  }
  return pool[pool.length - 1][0]; // fallback
}

// ── Inventory helpers ─────────────────────────────────────────────────────────

type InvItem = { speciesId: string; quantity: number; mutation?: string | null; isSeed?: boolean };

function addOrIncrement(inv: InvItem[], speciesId: string, mutation: string | undefined): InvItem[] {
  const idx = inv.findIndex(
    (i) => i.speciesId === speciesId && (i.mutation ?? undefined) === mutation && !i.isSeed
  );
  return idx >= 0
    ? inv.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i)
    : [...inv, { speciesId, quantity: 1, mutation, isSeed: false }];
}

function deductOne(inv: InvItem[], speciesId: string, mutation: string | undefined): InvItem[] | null {
  const idx = inv.findIndex(
    (i) => i.speciesId === speciesId && (i.mutation ?? undefined) === mutation && !i.isSeed && i.quantity > 0
  );
  if (idx < 0) return null;
  return inv
    .map((i, n) => n === idx ? { ...i, quantity: i.quantity - 1 } : i)
    .filter((i) => i.quantity > 0);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return err("Unauthorized", 401);
    }

    const body = await req.json() as {
      action:      string;
      speciesId:   string;
      essenceType?: string;
      quantity?:   number;
      mutation?:   string;
    };

    const { action, speciesId } = body;
    if (!action)    return err("action is required");
    if (!speciesId) return err("speciesId is required");

    const rarity = SPECIES_RARITY[speciesId];
    if (!rarity) return err("Unknown species");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves")
        .select("inventory, essences, coins, discovered, updated_at")
        .eq("user_id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return err("Unauthorized", 401);
    }
    if (saveResult.error || !saveResult.data) return err("Save not found", 404);

    const save           = saveResult.data;
    const priorUpdatedAt = save.updated_at as string;
    const inventory      = (save.inventory  ?? []) as InvItem[];
    const essences       = (save.essences   ?? []) as { type: string; amount: number }[];
    const coins          = (save.coins      ?? 0)  as number;
    const discovered     = (save.discovered ?? []) as string[];

    // ── Action: infuse ────────────────────────────────────────────────────────

    if (action === "infuse") {
      const { essenceType, quantity } = body;
      if (!essenceType)                    return err("essenceType is required");
      if (typeof quantity !== "number" || quantity < 1) return err("quantity must be a positive integer");

      // Verify player owns the essence
      const essenceBank = essences.find((e) => e.type === essenceType);
      if (!essenceBank || essenceBank.amount < quantity) {
        return err(`Not enough ${essenceType} essence`);
      }

      // Compute effective essence (matching types count ×2)
      const flowerTypes    = SPECIES_TYPES[speciesId] ?? [];
      const isMatching     = essenceType === "universal" || flowerTypes.includes(essenceType);
      const effectiveEssence = quantity * (isMatching ? 2 : 1);
      const tier           = computeTier(effectiveEssence);

      // Gold cost
      const costTable = INFUSE_GOLD_COST[rarity];
      const goldCost  = costTable ? costTable[tier - 1] : 0;
      if (coins < goldCost) return err(`Not enough coins (need ${goldCost})`);

      // Verify player owns an unmutated bloom of this species
      const newInventoryAfterDeduct = deductOne(inventory, speciesId, undefined);
      if (!newInventoryAfterDeduct) return err("No unmutated bloom of this species in inventory");

      // Roll the mutation
      const rolledMutation = rollMutation(tier);

      // Add the mutated bloom
      const newInventory = addOrIncrement(newInventoryAfterDeduct, speciesId, rolledMutation);

      // Deduct essence
      const newEssences = essences
        .map((e) => e.type === essenceType ? { ...e, amount: e.amount - quantity } : e)
        .filter((e) => e.amount > 0);

      // Update discovered
      const mutKey = `${speciesId}::${rolledMutation}`;
      const newDiscovered = discovered.includes(mutKey)
        ? discovered
        : [...discovered, mutKey];

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({
          inventory:  newInventory,
          essences:   newEssences,
          coins:      coins - goldCost,
          discovered: newDiscovered,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) return err("Save conflict — please retry", 409);

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "alchemy_infuse",
        payload: { speciesId, essenceType, quantity, tier, goldCost },
        result:  { mutation: rolledMutation },
      });

      return json({
        ok: true,
        inventory:   newInventory,
        essences:    newEssences,
        coins:       coins - goldCost,
        discovered:  newDiscovered,
        mutation:    rolledMutation,
        tier,
        serverUpdatedAt: ud.updated_at,
      });
    }

    // ── Action: strip ─────────────────────────────────────────────────────────

    if (action === "strip") {
      const { mutation } = body;
      if (!mutation) return err("mutation is required for strip");

      const multiplier = MUTATION_MULTIPLIERS[mutation] ?? 1;
      const costTable  = INFUSE_GOLD_COST[rarity];
      const goldCost   = costTable ? Math.floor(costTable[0] * multiplier) : 0;

      if (coins < goldCost) return err(`Not enough coins (need ${goldCost})`);

      const newInventoryAfterDeduct = deductOne(inventory, speciesId, mutation);
      if (!newInventoryAfterDeduct) return err("No bloom with that mutation in inventory");

      const newInventory = addOrIncrement(newInventoryAfterDeduct, speciesId, undefined);

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({
          inventory:  newInventory,
          coins:      coins - goldCost,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) return err("Save conflict — please retry", 409);

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "alchemy_strip",
        payload: { speciesId, mutation, goldCost },
      });

      return json({
        ok: true,
        inventory:   newInventory,
        coins:       coins - goldCost,
        serverUpdatedAt: ud.updated_at,
      });
    }

    return err(`Unknown action: ${action}`);

  } catch (e) {
    console.error("alchemy-infuse error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
