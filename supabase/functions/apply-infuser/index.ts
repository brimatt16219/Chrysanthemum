import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// base64url → base64 with proper padding for Deno's strict atob()
function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

// ── Response helpers ──────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (msg: string, status = 400) => json({ error: msg }, status);

// ── Species data ─────────────────────────────────────────────────────────────
// Mirrors src/data/flowers.ts + recipe-only species.
// Rarity used for infuser matching; types used for cropsticks pair detection.

const SPECIES_RARITY: Record<string, string> = {
  // Common
  quickgrass: "common",    dustweed: "common",       sprig: "common",
  dewdrop: "common",       pebblebloom: "common",    ember_moss: "common",
  dandelion: "common",     clover: "common",          violet: "common",
  lemongrass: "common",    daisy: "common",           honeywort: "common",
  buttercup: "common",     dawnpetal: "common",       poppy: "common",
  chamomile: "common",     marigold: "common",        sunflower: "common",
  coppercup: "common",     ivybell: "common",         thornberry: "common",
  saltmoss: "common",      ashpetal: "common",        snowdrift: "common",
  // Uncommon
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
  // Rare
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
  // Legendary
  firstbloom: "legendary",    haste_lily: "legendary",     verdant_crown: "legendary",
  ironwood_bloom: "legendary",sundial: "legendary",         lotus: "legendary",
  candy_blossom: "legendary", prismbark: "legendary",       dolphinia: "legendary",
  ghost_orchid: "legendary",  nestbloom: "legendary",       black_rose: "legendary",
  pumpkin_blossom: "legendary",starburst_lily: "legendary",  sporebloom: "legendary",
  fire_lily: "legendary",     stargazer: "legendary",       fullmoon_bloom: "legendary",
  ice_crown: "legendary",     diamond_bloom: "legendary",   oracle_eye: "legendary",
  halfmoon_bloom: "legendary",aurora_bloom: "legendary",    mirrorpetal: "legendary",
  emberspark: "legendary",
  // Recipe-only Legendary (Tier 1)
  phoenix_lily: "legendary",  eclipse_bloom: "legendary",   tempest_orchid: "legendary",
  blightmantle: "legendary",  cosmosbloom: "legendary",     dreamgust: "legendary",
  // Mythic
  blink_rose: "mythic",    dawnfire: "mythic",        moonflower: "mythic",
  jellybloom: "mythic",    celestial_bloom: "mythic", void_blossom: "mythic",
  seraph_wing: "mythic",   solar_rose: "mythic",      nebula_drift: "mythic",
  superbloom: "mythic",    wanderbloom: "mythic",     chrysanthemum: "mythic",
  // Recipe-only Mythic (Tier 2)
  solarburst: "mythic",    tidalune: "mythic",        whisperleaf: "mythic",
  crystalmind: "mythic",
  // Exalted (standard + recipe-only Tier 3)
  umbral_bloom: "exalted",  obsidian_rose: "exalted", duskmantle: "exalted",
  graveweb: "exalted",      nightwing: "exalted",     ashenveil: "exalted",
  voidfire: "exalted",
  void_chrysalis: "exalted",starloom: "exalted",
  // Prismatic (standard + recipe-only Tier 4)
  dreambloom: "prismatic",  fairy_blossom: "prismatic", lovebind: "prismatic",
  eternal_heart: "prismatic",nova_bloom: "prismatic",   princess_blossom: "prismatic",
  the_first_bloom: "prismatic",
  // Event-exclusive
  sakura_blossom: "prismatic",
};

// ── Species → types (rare+ only — the species that can hold an infuser) ───────

const SPECIES_TYPES: Record<string, string[]> = {
  // Common
  quickgrass:    ["grove"],              dustweed:      ["zephyr","shadow"],
  sprig:         ["grove"],             dewdrop:       ["tide"],
  pebblebloom:   ["grove"],             ember_moss:    ["blaze","grove"],
  dandelion:     ["grove","zephyr"],    clover:        ["grove","fairy"],
  violet:        ["fairy","arcane"],    lemongrass:    ["grove","solar"],
  daisy:         ["grove","fairy"],     honeywort:     ["grove","solar"],
  buttercup:     ["fairy","solar"],     dawnpetal:     ["lunar","solar"],
  poppy:         ["blaze","grove"],     chamomile:     ["grove","solar"],
  marigold:      ["solar","grove"],     sunflower:     ["solar"],
  coppercup:     ["grove"],             ivybell:       ["grove","tide"],
  thornberry:    ["grove"],             saltmoss:      ["tide"],
  ashpetal:      ["shadow","zephyr"],   snowdrift:     ["frost"],
  // Uncommon
  swiftbloom:    ["zephyr"],            shortcress:    ["grove"],
  thornwhistle:  ["grove","blaze"],     starwort:      ["stellar"],
  mintleaf:      ["grove","frost"],     tulip:         ["fairy","grove"],
  inkbloom:      ["arcane","shadow"],   hyacinth:      ["blaze","fairy"],
  snapdragon:    ["blaze","arcane"],    beebalm:       ["grove","solar"],
  candleflower:  ["blaze","arcane"],    carnation:     ["fairy"],
  ribbonweed:    ["fairy"],             hibiscus:      ["solar","blaze"],
  wildberry:     ["grove"],             frostbell:     ["frost"],
  bluebell:      ["fairy","tide"],      cherry_blossom:["fairy","grove"],
  rose:          ["fairy"],             peacockflower: ["arcane","zephyr"],
  bamboo_bloom:  ["grove","zephyr"],    hummingbloom:  ["zephyr","fairy"],
  water_lily:    ["tide"],              lanternflower: ["blaze","arcane"],
  dovebloom:     ["zephyr","fairy"],    coral_bells:   ["tide","fairy"],
  sundew:        ["grove","shadow"],    bubblebloom:   ["tide","fairy"],
  // Rare
  flashpetal:      ["storm"],              rushwillow:      ["zephyr","tide"],
  sweetheart_lily: ["fairy"],              glassbell:       ["arcane","stellar"],
  stormcaller:     ["storm"],              lavender:        ["fairy","arcane"],
  amber_crown:     ["solar","blaze"],      peach_blossom:   ["grove","fairy"],
  foxglove:        ["shadow","arcane"],    butterbloom:     ["fairy","zephyr"],
  peony:           ["fairy"],              tidebloom:       ["tide"],
  starweave:       ["stellar","arcane"],   wisteria:        ["fairy","arcane"],
  dreamcup:        ["fairy","arcane"],     coralbell:       ["tide"],
  foxfire:         ["blaze","arcane"],     bird_of_paradise:["zephyr","solar"],
  solarbell:       ["solar"],              moonpetal:       ["lunar"],
  orchid:          ["fairy","arcane"],     duskrose:        ["lunar","shadow"],
  passionflower:   ["arcane","storm"],     glasswing:       ["arcane"],
  mirror_orchid:   ["arcane","stellar"],   stargazer_lily:  ["stellar"],
  prism_lily:      ["arcane","stellar"],   dusk_orchid:     ["lunar","solar"],
  // Legendary
  firstbloom:      ["solar","fairy"],      haste_lily:      ["zephyr","storm"],
  verdant_crown:   ["grove","fairy"],      ironwood_bloom:  ["grove"],
  sundial:         ["solar","arcane"],     lotus:           ["tide","arcane"],
  candy_blossom:   ["fairy"],              prismbark:       ["grove","arcane"],
  dolphinia:       ["tide"],               ghost_orchid:    ["shadow","arcane"],
  nestbloom:       ["grove","fairy"],      black_rose:      ["shadow"],
  pumpkin_blossom: ["shadow","grove"],     starburst_lily:  ["stellar","storm"],
  sporebloom:      ["grove","shadow"],     fire_lily:       ["blaze"],
  stargazer:       ["stellar"],            fullmoon_bloom:  ["lunar"],
  ice_crown:       ["frost"],              diamond_bloom:   ["frost","arcane"],
  oracle_eye:      ["arcane","shadow"],    halfmoon_bloom:  ["lunar"],
  aurora_bloom:    ["stellar","arcane"],   mirrorpetal:     ["arcane","stellar"],
  emberspark:      ["blaze","storm"],
  // Legendary recipe-only (Tier 1 outputs — can be Tier 2 inputs)
  phoenix_lily:    ["blaze","frost"],      eclipse_bloom:   ["lunar","solar"],
  tempest_orchid:  ["tide","storm"],       blightmantle:    ["grove","shadow"],
  cosmosbloom:     ["arcane","stellar"],   dreamgust:       ["fairy","zephyr"],
  // Mythic
  blink_rose:      ["arcane","shadow"],    dawnfire:        ["solar","blaze"],
  moonflower:      ["lunar"],              jellybloom:      ["tide","arcane"],
  celestial_bloom: ["stellar"],            void_blossom:    ["shadow","arcane"],
  seraph_wing:     ["zephyr","fairy"],     solar_rose:      ["solar"],
  nebula_drift:    ["stellar","arcane"],   superbloom:      ["storm","stellar"],
  wanderbloom:     ["zephyr","arcane"],    chrysanthemum:   ["arcane","stellar","fairy"],
  // Mythic recipe-only (Tier 2 outputs — can be Tier 3 inputs)
  solarburst:      ["blaze","solar"],      tidalune:        ["lunar","tide"],
  whisperleaf:     ["grove","zephyr"],     crystalmind:     ["frost","arcane"],
  // Exalted
  umbral_bloom:    ["shadow","lunar"],     obsidian_rose:   ["shadow"],
  duskmantle:      ["shadow","lunar"],     graveweb:        ["shadow"],
  nightwing:       ["shadow","zephyr"],    ashenveil:       ["shadow","blaze"],
  voidfire:        ["shadow","blaze"],
  // Exalted recipe-only (Tier 3 outputs — can be Tier 4 inputs)
  void_chrysalis:  ["arcane"],             starloom:        ["stellar"],
  // Prismatic
  dreambloom:      ["fairy","arcane"],     fairy_blossom:   ["fairy"],
  lovebind:        ["fairy","arcane"],     eternal_heart:   ["fairy","solar"],
  nova_bloom:      ["stellar","storm","blaze"],
  princess_blossom:["fairy","arcane"],     the_first_bloom: ["arcane","stellar"],
  // Event-exclusive
  sakura_blossom:  ["fairy","zephyr"],
};

// ── Cross-breed recipes + matching (mirrors tick-offline-gardens) ─────────────

const RARITY_IDX: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4, exalted: 5, prismatic: 6,
};

type Recipe = { id: string; tier: number; typeA: string; typeB: string; minRarity: string };
const RECIPES: Recipe[] = [
  { id: "blaze+frost",       tier: 1, typeA: "blaze",   typeB: "frost",   minRarity: "rare"      },
  { id: "lunar+solar",       tier: 1, typeA: "lunar",   typeB: "solar",   minRarity: "rare"      },
  { id: "tide+storm",        tier: 1, typeA: "tide",    typeB: "storm",   minRarity: "rare"      },
  { id: "grove+shadow",      tier: 1, typeA: "grove",   typeB: "shadow",  minRarity: "rare"      },
  { id: "arcane+stellar",    tier: 1, typeA: "arcane",  typeB: "stellar", minRarity: "rare"      },
  { id: "fairy+zephyr",      tier: 1, typeA: "fairy",   typeB: "zephyr",  minRarity: "rare"      },
  { id: "blaze+solar",       tier: 2, typeA: "blaze",   typeB: "solar",   minRarity: "legendary" },
  { id: "lunar+tide",        tier: 2, typeA: "lunar",   typeB: "tide",    minRarity: "legendary" },
  { id: "grove+zephyr",      tier: 2, typeA: "grove",   typeB: "zephyr",  minRarity: "legendary" },
  { id: "frost+arcane",      tier: 2, typeA: "frost",   typeB: "arcane",  minRarity: "legendary" },
  { id: "arcane+shadow-t3",  tier: 3, typeA: "arcane",  typeB: "shadow",  minRarity: "mythic"    },
  { id: "stellar+zephyr-t3", tier: 3, typeA: "stellar", typeB: "zephyr",  minRarity: "mythic"    },
  { id: "arcane+stellar-t4", tier: 4, typeA: "arcane",  typeB: "stellar", minRarity: "exalted"   },
];

function findBestRecipe(
  typesA: string[], rarityA: string,
  typesB: string[], rarityB: string,
): Recipe | null {
  let best: Recipe | null = null;
  for (const recipe of RECIPES) {
    if ((RARITY_IDX[rarityA] ?? -1) < RARITY_IDX[recipe.minRarity]) continue;
    if ((RARITY_IDX[rarityB] ?? -1) < RARITY_IDX[recipe.minRarity]) continue;
    const fwd = typesA.includes(recipe.typeA) && typesB.includes(recipe.typeB);
    const rev = typesA.includes(recipe.typeB) && typesB.includes(recipe.typeA);
    if (!fwd && !rev) continue;
    if (!best || recipe.tier > best.tier) best = recipe;
  }
  return best;
}

const OFFSETS_CROSS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** After infusing (row, col), scan its 4 neighbours for cropsticks gear.
 *  For each idle cropsticks, check all its cardinal neighbours for a valid
 *  infused+bloomed pair. If found:
 *    - Stamp crossbreedStartedAt so the progress bar appears immediately.
 *    - Store crossbreedSourceA/B coordinates so the tick can find the plants
 *      at completion time without relying on the infused flag.
 *    - Clear plant.infused on both source plants immediately (they no longer
 *      need to be visually marked as "waiting"). */
function tryStartCropsticksCycles(
  workingGrid: GridCell[][],
  plantRow: number,
  plantCol: number,
  now: number,
): GridCell[][] {
  let g = workingGrid;
  for (const [dr, dc] of OFFSETS_CROSS) {
    const cr = plantRow + dr;
    const cc = plantCol + dc;
    const cropCell = g[cr]?.[cc];
    if (!cropCell?.gear) continue;
    const gear = cropCell.gear as { gearType: string; crossbreedStartedAt?: number };
    if (gear.gearType !== "cropsticks") continue;
    if (gear.crossbreedStartedAt != null) continue; // already running

    // Collect this cropsticks' infused+bloomed neighbours WITH coordinates
    type N = { r: number; c: number; types: string[]; rarity: string };
    const nbrs: N[] = [];
    for (const [or, oc] of OFFSETS_CROSS) {
      const nr = cr + or;
      const nc = cc + oc;
      const nCell = g[nr]?.[nc];
      if (!nCell?.plant || (!nCell.plant.bloomedAt && nCell.plant.timePlanted !== 0) || !nCell.plant.infused) continue;
      const nRarity = SPECIES_RARITY[nCell.plant.speciesId];
      const nTypes  = SPECIES_TYPES[nCell.plant.speciesId];
      if (!nRarity || !nTypes) continue;
      nbrs.push({ r: nr, c: nc, types: nTypes, rarity: nRarity });
    }

    // Need at least 2 infused neighbours to crossbreed
    if (nbrs.length < 2) continue;

    // Pick the highest-tier recipe pair; fall back to the first available pair
    // if no recipe matches (result will be the lower-rarity parent at completion).
    let bestPairTier = -1;
    let sourceA: N = nbrs[0];
    let sourceB: N = nbrs[1];
    for (let i = 0; i < nbrs.length; i++) {
      for (let j = i + 1; j < nbrs.length; j++) {
        const recipe = findBestRecipe(nbrs[i].types, nbrs[i].rarity, nbrs[j].types, nbrs[j].rarity);
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

// ── Types ─────────────────────────────────────────────────────────────────────

type InfuserItem = { rarity: string; quantity: number };
type PlantData   = { speciesId: string; timePlanted: number; bloomedAt?: number; infused?: boolean; [key: string]: unknown };
type GridCell    = { id: string; plant: PlantData | null; gear?: unknown };

// ── Handler ───────────────────────────────────────────────────────────────────

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

    // ── Parse input ───────────────────────────────────────────────────────────

    const { row, col } = await req.json() as { row: number; col: number };

    if (typeof row !== "number" || typeof col !== "number") {
      return err("row and col are required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Auth + load save in parallel ──────────────────────────────────────────

    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin
        .from("game_saves")
        .select("grid, infusers, updated_at")
        .eq("user_id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return err("Unauthorized", 401);
    }
    if (saveResult.error || !saveResult.data) {
      return err("Save not found", 404);
    }

    const save           = saveResult.data;
    const priorUpdatedAt = save.updated_at as string;
    const grid           = (save.grid     ?? []) as GridCell[][];
    const infusers       = (save.infusers ?? []) as InfuserItem[];

    // ── Validate plot ─────────────────────────────────────────────────────────

    const cell = grid[row]?.[col];
    if (!cell)       return err("Invalid cell coordinates");
    if (!cell.plant) return err("No plant in this cell");

    const plant = cell.plant;

    // Accept if tick has stamped bloomedAt (grown plants), or timePlanted === 0
    // (blooms placed directly from inventory — old records may lack bloomedAt).
    if (!plant.bloomedAt && plant.timePlanted !== 0) return err("Plant has not bloomed yet");
    if (plant.infused)     return err("Plant is already infused");

    // ── Rarity match ──────────────────────────────────────────────────────────

    const rarity = SPECIES_RARITY[plant.speciesId];
    if (!rarity) return err("Unknown species");

    // Backwards-tier matching: any infuser with tier ≥ flower's rarity tier works.
    // Use the lowest matching tier to conserve higher-tier infusers.
    const RARITY_TIER_ORDER: Record<string, number> = {
      common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4, exalted: 5, prismatic: 6,
    };
    const flowerTierOrder = RARITY_TIER_ORDER[rarity] ?? -1;
    if (flowerTierOrder < 0) return err("Unknown species rarity");

    const sortedCandidates = infusers
      .filter((i) => (RARITY_TIER_ORDER[i.rarity] ?? -1) >= flowerTierOrder && i.quantity > 0)
      .sort((a, b) => (RARITY_TIER_ORDER[a.rarity] ?? 0) - (RARITY_TIER_ORDER[b.rarity] ?? 0));

    const infuserItem = sortedCandidates[0] ?? null;
    if (!infuserItem) return err("No matching Flower Infuser in inventory");

    const usedRarity = infuserItem.rarity;

    // ── Apply changes ─────────────────────────────────────────────────────────

    const newGrid = grid.map((r, ri) =>
      r.map((p, ci) =>
        ri === row && ci === col
          ? { ...p, plant: { ...p.plant!, infused: true } }
          : p
      )
    );

    const newInfusers = infusers
      .map((i) => i.rarity === usedRarity ? { ...i, quantity: i.quantity - 1 } : i)
      .filter((i) => i.quantity > 0);

    // Immediately start any adjacent cropsticks that now have a valid infused pair,
    // so the client sees the progress bar right away without waiting for the cron.
    const activeGrid = tryStartCropsticksCycles(newGrid, row, col, Date.now());

    // ── CAS write ─────────────────────────────────────────────────────────────

    const { data: ud, error: ue } = await supabaseAdmin
      .from("game_saves")
      .update({ grid: activeGrid, infusers: newInfusers, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (ue || !ud) return err("Save conflict — please retry", 409);

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "apply_infuser",
      payload: { row, col, flowerRarity: rarity, infuserRarity: usedRarity },
      result:  { remainingInfusers: infuserItem.quantity - 1 },
    });

    return json({ ok: true, grid: activeGrid, infusers: newInfusers, serverUpdatedAt: ud.updated_at });

  } catch (e) {
    console.error("apply-infuser error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
