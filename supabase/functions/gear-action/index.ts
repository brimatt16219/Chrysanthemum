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

// ── Types (mirror src/data/gear.ts + src/store/gameStore.ts) ─────────────────

type PlacedGear = {
  gearType:             string;
  placedAt:             number;
  direction?:           string;
  storedFertilizers?:   string[];
  crossbreedStartedAt?: number;
  crossbreedSourceA?:   { r: number; c: number };
  crossbreedSourceB?:   { r: number; c: number };
  paused?:              boolean;
};

type PlantData = {
  speciesId:   string;
  timePlanted: number;
  bloomedAt?:  number;
  infused?:    boolean;
  [key: string]: unknown;
};

type GridCell = {
  id:     string;
  plant:  PlantData | null;
  gear?:  PlacedGear | null;
};

// ── Cropsticks activation (mirrors apply-infuser/index.ts) ───────────────────
// When cropsticks are placed next to infused+bloomed plants, immediately start
// the cross-breed cycle so the progress bar appears without waiting for the cron.

const OFFSETS_CROSS_G: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const RARITY_IDX_G: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4, exalted: 5, prismatic: 6,
};

type RecipeG = { id: string; tier: number; typeA: string; typeB: string; minRarity: string };
const RECIPES_G: RecipeG[] = [
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

const SPECIES_TYPES_G: Record<string, string[]> = {
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
  // Mythic recipe-only (Tier 2 outputs)
  solarburst:      ["blaze","solar"],      tidalune:        ["lunar","tide"],
  whisperleaf:     ["grove","zephyr"],     crystalmind:     ["frost","arcane"],
  // Exalted
  umbral_bloom:    ["shadow","lunar"],     obsidian_rose:   ["shadow"],
  duskmantle:      ["shadow","lunar"],     graveweb:        ["shadow"],
  nightwing:       ["shadow","zephyr"],    ashenveil:       ["shadow","blaze"],
  voidfire:        ["shadow","blaze"],
  // Exalted recipe-only (Tier 3 outputs)
  void_chrysalis:  ["arcane"],             starloom:        ["stellar"],
  // Prismatic
  dreambloom:      ["fairy","arcane"],     fairy_blossom:   ["fairy"],
  lovebind:        ["fairy","arcane"],     eternal_heart:   ["fairy","solar"],
  nova_bloom:      ["stellar","storm","blaze"],
  princess_blossom:["fairy","arcane"],     the_first_bloom: ["arcane","stellar"],
  // Event-exclusive
  sakura_blossom:  ["fairy","zephyr"],
  // v2.3.1 — new flowers
  cloudveil:    ["storm"],              pepperbloom:   ["blaze"],
  flurrysprig:  ["frost"],              showerbloom:   ["storm","tide"],
  creamcap:     ["frost","fairy"],      duskling:      ["lunar"],
  moongrass:    ["lunar"],              owlsage:       ["shadow","arcane"],
  brewleaf:     ["arcane","grove"],     hexblossom:    ["arcane"],
  starfleck:    ["stellar"],            cometail:      ["stellar"],
  glacierbud:   ["frost"],              cloudgrass:    ["storm"],
  chimebloom:   ["storm","arcane"],     evenfall:      ["lunar","shadow"],
  sundrift:     ["solar","zephyr"],     moonspan:      ["lunar","tide"],
  tanglewort:   ["shadow"],             medalwort:     ["stellar"],
  topazbloom:   ["stellar"],
  blazecrown:   ["blaze"],              terracotta:    ["grove","blaze"],
  frostmark:    ["frost"],              coldsnap:      ["frost","storm"],
  voidpetal:    ["shadow","arcane"],
  galebloom:    ["zephyr"],
  infernopetal: ["blaze"],              anchorweed:    ["tide","shadow"],
  worldroot:    ["grove","arcane"],     clearingbloom: ["grove","solar"],
  permafrost:   ["frost"],              frostspine:    ["frost","storm"],
  tempest_eye:  ["storm"],              thundercrown:  ["storm"],
  moonsmile:    ["lunar","fairy"],      dreamshade:    ["fairy","arcane"],
  gravewilt:    ["shadow"],
};

const SPECIES_RARITY_G: Record<string, string> = {
  // Common
  quickgrass:"common",dustweed:"common",sprig:"common",dewdrop:"common",pebblebloom:"common",
  ember_moss:"common",dandelion:"common",clover:"common",violet:"common",lemongrass:"common",
  daisy:"common",honeywort:"common",buttercup:"common",dawnpetal:"common",poppy:"common",
  chamomile:"common",marigold:"common",sunflower:"common",coppercup:"common",ivybell:"common",
  thornberry:"common",saltmoss:"common",ashpetal:"common",snowdrift:"common",
  // Uncommon
  swiftbloom:"uncommon",shortcress:"uncommon",thornwhistle:"uncommon",starwort:"uncommon",
  mintleaf:"uncommon",tulip:"uncommon",inkbloom:"uncommon",hyacinth:"uncommon",
  snapdragon:"uncommon",beebalm:"uncommon",candleflower:"uncommon",carnation:"uncommon",
  ribbonweed:"uncommon",hibiscus:"uncommon",wildberry:"uncommon",frostbell:"uncommon",
  bluebell:"uncommon",cherry_blossom:"uncommon",rose:"uncommon",peacockflower:"uncommon",
  bamboo_bloom:"uncommon",hummingbloom:"uncommon",water_lily:"uncommon",lanternflower:"uncommon",
  dovebloom:"uncommon",coral_bells:"uncommon",sundew:"uncommon",bubblebloom:"uncommon",
  // Rare
  flashpetal:"rare",rushwillow:"rare",sweetheart_lily:"rare",glassbell:"rare",
  stormcaller:"rare",lavender:"rare",amber_crown:"rare",peach_blossom:"rare",
  foxglove:"rare",butterbloom:"rare",peony:"rare",tidebloom:"rare",starweave:"rare",
  wisteria:"rare",dreamcup:"rare",coralbell:"rare",foxfire:"rare",bird_of_paradise:"rare",
  solarbell:"rare",moonpetal:"rare",orchid:"rare",duskrose:"rare",passionflower:"rare",
  glasswing:"rare",mirror_orchid:"rare",stargazer_lily:"rare",prism_lily:"rare",dusk_orchid:"rare",
  // Legendary
  firstbloom:"legendary",haste_lily:"legendary",verdant_crown:"legendary",ironwood_bloom:"legendary",
  sundial:"legendary",lotus:"legendary",candy_blossom:"legendary",prismbark:"legendary",
  dolphinia:"legendary",ghost_orchid:"legendary",nestbloom:"legendary",black_rose:"legendary",
  pumpkin_blossom:"legendary",starburst_lily:"legendary",sporebloom:"legendary",
  fire_lily:"legendary",stargazer:"legendary",fullmoon_bloom:"legendary",ice_crown:"legendary",
  diamond_bloom:"legendary",oracle_eye:"legendary",halfmoon_bloom:"legendary",
  aurora_bloom:"legendary",mirrorpetal:"legendary",emberspark:"legendary",
  phoenix_lily:"legendary",eclipse_bloom:"legendary",tempest_orchid:"legendary",
  blightmantle:"legendary",cosmosbloom:"legendary",dreamgust:"legendary",
  // Mythic
  blink_rose:"mythic",dawnfire:"mythic",moonflower:"mythic",jellybloom:"mythic",
  celestial_bloom:"mythic",void_blossom:"mythic",seraph_wing:"mythic",solar_rose:"mythic",
  nebula_drift:"mythic",superbloom:"mythic",wanderbloom:"mythic",chrysanthemum:"mythic",
  solarburst:"mythic",tidalune:"mythic",whisperleaf:"mythic",crystalmind:"mythic",
  // Exalted
  umbral_bloom:"exalted",obsidian_rose:"exalted",duskmantle:"exalted",graveweb:"exalted",
  nightwing:"exalted",ashenveil:"exalted",voidfire:"exalted",void_chrysalis:"exalted",starloom:"exalted",
  // Prismatic
  dreambloom:"prismatic",fairy_blossom:"prismatic",lovebind:"prismatic",eternal_heart:"prismatic",
  nova_bloom:"prismatic",princess_blossom:"prismatic",the_first_bloom:"prismatic",
  // Event-exclusive
  sakura_blossom:"prismatic",
  // v2.3.1 — new flowers
  cloudveil:"common",pepperbloom:"common",flurrysprig:"common",showerbloom:"common",
  creamcap:"common",duskling:"common",moongrass:"common",owlsage:"common",
  brewleaf:"common",hexblossom:"common",starfleck:"common",cometail:"common",
  glacierbud:"uncommon",cloudgrass:"uncommon",chimebloom:"uncommon",evenfall:"uncommon",
  sundrift:"uncommon",moonspan:"uncommon",tanglewort:"uncommon",medalwort:"uncommon",topazbloom:"uncommon",
  blazecrown:"rare",terracotta:"rare",frostmark:"rare",coldsnap:"rare",voidpetal:"rare",
  galebloom:"legendary",
  infernopetal:"mythic",anchorweed:"mythic",worldroot:"mythic",clearingbloom:"mythic",
  permafrost:"mythic",frostspine:"mythic",tempest_eye:"mythic",thundercrown:"mythic",
  moonsmile:"mythic",dreamshade:"mythic",gravewilt:"mythic",
};

function findBestRecipeG(tA: string[], rA: string, tB: string[], rB: string): RecipeG | null {
  let best: RecipeG | null = null;
  for (const r of RECIPES_G) {
    if ((RARITY_IDX_G[rA] ?? -1) < RARITY_IDX_G[r.minRarity]) continue;
    if ((RARITY_IDX_G[rB] ?? -1) < RARITY_IDX_G[r.minRarity]) continue;
    const fwd = tA.includes(r.typeA) && tB.includes(r.typeB);
    const rev = tA.includes(r.typeB) && tB.includes(r.typeA);
    if (!fwd && !rev) continue;
    if (!best || r.tier > best.tier) best = r;
  }
  return best;
}

/** When cropsticks are placed at (cropRow, cropCol), scan adjacent cells for
 *  infused+bloomed plants and start a cycle if a valid recipe pair is found.
 *  Mirrors tryStartCropsticksCycles in apply-infuser/index.ts (from the other direction). */
function tryActivateCropsticks(grid: GridCell[][], cropRow: number, cropCol: number, now: number): GridCell[][] {
  const cropCell = grid[cropRow]?.[cropCol];
  if (!cropCell?.gear || cropCell.gear.gearType !== "cropsticks") return grid;
  if ((cropCell.gear as PlacedGear).crossbreedStartedAt != null) return grid; // already running

  type N = { r: number; c: number; types: string[]; rarity: string };
  const nbrs: N[] = [];
  for (const [dr, dc] of OFFSETS_CROSS_G) {
    const nr = cropRow + dr;
    const nc = cropCol + dc;
    const nCell = grid[nr]?.[nc];
    if (!nCell?.plant || (!nCell.plant.bloomedAt && nCell.plant.timePlanted !== 0) || !nCell.plant.infused) continue;
    const nRarity = SPECIES_RARITY_G[nCell.plant.speciesId];
    const nTypes  = SPECIES_TYPES_G[nCell.plant.speciesId];
    if (!nRarity || !nTypes) continue;
    nbrs.push({ r: nr, c: nc, types: nTypes, rarity: nRarity });
  }

  // Need at least 2 infused neighbours to crossbreed
  if (nbrs.length < 2) return grid;

  // Pick highest-tier recipe pair; fall back to first available pair when no recipe.
  let bestPairTier = -1;
  let sourceA: N = nbrs[0];
  let sourceB: N = nbrs[1];
  for (let i = 0; i < nbrs.length; i++) {
    for (let j = i + 1; j < nbrs.length; j++) {
      const recipe = findBestRecipeG(nbrs[i].types, nbrs[i].rarity, nbrs[j].types, nbrs[j].rarity);
      if (recipe && recipe.tier > bestPairTier) {
        bestPairTier = recipe.tier;
        sourceA = nbrs[i];
        sourceB = nbrs[j];
      }
    }
  }

  return grid.map((r, ri) =>
    r.map((p, ci) => {
      if (ri === cropRow && ci === cropCol && p.gear) {
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

type GearInvItem   = { gearType: string; quantity: number };
type FertItem      = { type: string;     quantity: number };

// Composter gear types (mirrors src/data/gear.ts)
const COMPOSTER_TYPES = new Set(["composter_uncommon", "composter_rare"]);

// ── Response helpers ─────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (msg: string, status = 400) => json({ error: msg }, status);

// ── Main handler ─────────────────────────────────────────────────────────────

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
      action:     "place" | "remove" | "collect" | "set_direction";
      row:        number;
      col:        number;
      gearType?:  string;
      direction?: string;
    };

    const { action, row, col } = body;
    if (!["place", "remove", "collect", "set_direction", "toggle_pause"].includes(action)) {
      return err("Invalid action — use place | remove | collect | set_direction | toggle_pause");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Select only the columns each action needs
    const selectCols =
      action === "collect" ? "grid, fertilizers, updated_at"       :
      action === "remove"  ? "grid, gear_inventory, fertilizers, updated_at" :
                             "grid, gear_inventory, updated_at";

    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves").select(selectCols).eq("user_id", userId).single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return err("Unauthorized", 401);
    }
    if (saveResult.error || !saveResult.data) {
      return err("Save not found", 404);
    }

    const save = saveResult.data;
    const priorUpdatedAt = save.updated_at as string;
    let grid          = (save.grid          ?? []) as GridCell[][];
    let gearInventory = (save.gear_inventory ?? []) as GearInvItem[];
    let fertilizers   = (save.fertilizers   ?? []) as FertItem[];

    const cell = grid[row]?.[col];
    if (!cell) return err("Invalid cell coordinates");

    // ── place ─────────────────────────────────────────────────────────────────
    if (action === "place") {
      const { gearType, direction } = body;
      if (!gearType)              return err("gearType required");
      if (cell.plant)             return err("Cell has a plant");
      if (cell.gear)              return err("Cell already has gear");

      const invItem = gearInventory.find((g) => g.gearType === gearType);
      if (!invItem || invItem.quantity < 1) return err("Gear not in inventory");

      const placedAt = Date.now();
      const placedGear: PlacedGear = direction
        ? { gearType, placedAt, direction }
        : { gearType, placedAt };
      grid = grid.map((r, ri) =>
        r.map((p, ci) =>
          ri === row && ci === col
            ? { ...p, gear: placedGear }
            : p
        )
      );
      // When placing cropsticks, immediately start a cycle if adjacent infused+bloomed
      // plants form a valid recipe pair — mirrors what apply-infuser does when the
      // second plant is infused while cropsticks are already present.
      if (gearType === "cropsticks") {
        grid = tryActivateCropsticks(grid, row, col, placedAt);
      }
      gearInventory = gearInventory
        .map((g) => g.gearType === gearType ? { ...g, quantity: g.quantity - 1 } : g)
        .filter((g) => g.quantity > 0);

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({ grid, gear_inventory: gearInventory, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) {
        // CAS failed — the offline tick likely wrote to DB between our read and write.
        // Retry once with a fresh DB read so gear placement survives the race.
        const { data: fresh, error: freshErr } = await supabaseAdmin
          .from("game_saves")
          .select("grid, gear_inventory, updated_at")
          .eq("user_id", userId)
          .single();
        if (freshErr || !fresh) return err("Save was modified by another action", 409);

        const freshCell = (fresh.grid as GridCell[][])[row]?.[col];
        if (!freshCell || freshCell.plant || freshCell.gear) {
          return err("Cell is now occupied", 409);
        }
        const freshInv = (fresh.gear_inventory as GearInvItem[]).find((g) => g.gearType === gearType);
        if (!freshInv || freshInv.quantity < 1) return err("Gear not in inventory", 409);

        const retryPlacedAt = Date.now();
        const retryGear: PlacedGear = direction
          ? { gearType, placedAt: retryPlacedAt, direction }
          : { gearType, placedAt: retryPlacedAt };
        let retryGrid = (fresh.grid as GridCell[][]).map((r, ri) =>
          r.map((p, ci) => ri === row && ci === col ? { ...p, gear: retryGear } : p)
        );
        if (gearType === "cropsticks") {
          retryGrid = tryActivateCropsticks(retryGrid, row, col, retryPlacedAt);
        }
        const retryGearInv = (fresh.gear_inventory as GearInvItem[])
          .map((g) => g.gearType === gearType ? { ...g, quantity: g.quantity - 1 } : g)
          .filter((g) => g.quantity > 0);

        const { data: retryUd, error: retryUe } = await supabaseAdmin
          .from("game_saves")
          .update({ grid: retryGrid, gear_inventory: retryGearInv, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("updated_at", fresh.updated_at as string)
          .select("updated_at")
          .single();
        if (retryUe || !retryUd) return err("Save was modified by another action", 409);

        void supabaseAdmin.from("action_log").insert({
          user_id: userId, action: "gear_place",
          payload: { gearType, row, col }, result: { placedAt: retryPlacedAt, retried: true },
        });
        return json({ ok: true, grid: retryGrid, gearInventory: retryGearInv, serverUpdatedAt: retryUd.updated_at });
      }

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "gear_place",
        payload: { gearType, row, col }, result: { placedAt },
      });

      return json({ ok: true, grid, gearInventory, serverUpdatedAt: ud.updated_at });
    }

    // ── remove ────────────────────────────────────────────────────────────────
    // Removal destroys the gear (no refund) — closes the duration-reset exploit
    // where players could remove near-expiry gear and re-place it fresh.
    // Stored fertilizers from composters are still returned since the player earned them.
    if (action === "remove") {
      if (!cell.gear) return err("No gear at this cell");

      const { gearType } = cell.gear;
      const stored      = cell.gear.storedFertilizers ?? [];

      grid = grid.map((r, ri) =>
        r.map((p, ci) => ri === row && ci === col ? { ...p, gear: null } : p)
      );

      // Return any stored fertilizers (composter)
      for (const fertType of stored) {
        const fert = fertilizers.find((f) => f.type === fertType);
        fertilizers = fert
          ? fertilizers.map((f) => f.type === fertType ? { ...f, quantity: f.quantity + 1 } : f)
          : [...fertilizers, { type: fertType, quantity: 1 }];
      }

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({ grid, fertilizers, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) {
        // CAS miss — a concurrent write (cloud-save, sprinkler mutation, etc.)
        // bumped updated_at between our read and this write.  Re-read the latest
        // save and retry once so rapid remove → place sequences don't dead-lock.
        const { data: fresh, error: freshErr } = await supabaseAdmin
          .from("game_saves")
          .select("grid, gear_inventory, fertilizers, updated_at")
          .eq("user_id", userId)
          .single();
        if (freshErr || !fresh) return err("Failed to reload save", 500);

        const freshGrid = fresh.grid as GridCell[][];
        const freshCell = freshGrid[row]?.[col];

        // Another action already removed this gear — treat as success so the
        // client's optimistic state stays consistent.
        if (!freshCell?.gear || freshCell.gear.gearType !== gearType) {
          return json({
            ok: true, grid: freshGrid,
            gearInventory: fresh.gear_inventory as GearInvItem[],
            fertilizers:   fresh.fertilizers   as FertItem[],
            serverUpdatedAt: fresh.updated_at as string,
          });
        }

        // Gear is still there — recompute from the fresh state and retry.
        const retryStored = freshCell.gear.storedFertilizers ?? [];
        let retryFertilizers = (fresh.fertilizers ?? []) as FertItem[];
        for (const fertType of retryStored) {
          const fert = retryFertilizers.find((f) => f.type === fertType);
          retryFertilizers = fert
            ? retryFertilizers.map((f) => f.type === fertType ? { ...f, quantity: f.quantity + 1 } : f)
            : [...retryFertilizers, { type: fertType, quantity: 1 }];
        }
        const retryGrid = freshGrid.map((r, ri) =>
          r.map((p, ci) => ri === row && ci === col ? { ...p, gear: null } : p)
        );

        const { data: retryUd, error: retryUe } = await supabaseAdmin
          .from("game_saves")
          .update({ grid: retryGrid, fertilizers: retryFertilizers, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("updated_at", fresh.updated_at as string)
          .select("updated_at")
          .single();
        if (retryUe || !retryUd) return err("Save was modified by another action", 409);

        void supabaseAdmin.from("action_log").insert({
          user_id: userId, action: "gear_remove",
          payload: { gearType, row, col }, result: { storedReturned: retryStored.length, gearDestroyed: true, retried: true },
        });
        return json({ ok: true, grid: retryGrid, gearInventory, fertilizers: retryFertilizers, serverUpdatedAt: retryUd.updated_at });
      }

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "gear_remove",
        payload: { gearType, row, col }, result: { storedReturned: stored.length, gearDestroyed: true },
      });

      return json({ ok: true, grid, gearInventory, fertilizers, serverUpdatedAt: ud.updated_at });
    }

    // ── toggle_pause (auto-planter) ───────────────────────────────────────────
    if (action === "toggle_pause") {
      if (!cell.gear) return err("No gear at this cell");

      const AUTO_PLANTER_TYPES = new Set(["auto_planter_prismatic"]);
      if (!AUTO_PLANTER_TYPES.has(cell.gear.gearType)) return err("Not an auto-planter");

      const nowPaused = !cell.gear.paused;
      grid = grid.map((r, ri) =>
        r.map((p, ci) =>
          ri === row && ci === col
            ? { ...p, gear: { ...p.gear!, paused: nowPaused } }
            : p
        )
      );

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({ grid, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) return err("Save was modified by another action", 409);

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "gear_toggle_pause",
        payload: { row, col }, result: { paused: nowPaused },
      });

      return json({ ok: true, grid, gearInventory, fertilizers, serverUpdatedAt: ud.updated_at });
    }

    // ── collect (composter) ───────────────────────────────────────────────────
    if (action === "collect") {
      if (!cell.gear)                                   return err("No gear at this cell");
      if (!COMPOSTER_TYPES.has(cell.gear.gearType))     return err("Not a composter");

      const stored = cell.gear.storedFertilizers ?? [];
      if (stored.length === 0)                          return err("Nothing to collect");

      grid = grid.map((r, ri) =>
        r.map((p, ci) =>
          ri === row && ci === col
            ? { ...p, gear: { ...p.gear!, storedFertilizers: [] } }
            : p
        )
      );

      for (const fertType of stored) {
        const fert = fertilizers.find((f) => f.type === fertType);
        fertilizers = fert
          ? fertilizers.map((f) => f.type === fertType ? { ...f, quantity: f.quantity + 1 } : f)
          : [...fertilizers, { type: fertType, quantity: 1 }];
      }

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({ grid, fertilizers, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) return err("Save was modified by another action", 409);

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "gear_collect",
        payload: { row, col }, result: { collected: stored.length },
      });

      return json({ ok: true, grid, fertilizers, serverUpdatedAt: ud.updated_at });
    }

    // ── set_direction (fan / aegis / lawnmower) ──────────────────────────────
    if (action === "set_direction") {
      const { direction } = body;
      if (!direction) return err("direction required");
      if (!cell.gear)  return err("No gear at this cell");

      grid = grid.map((r, ri) =>
        r.map((p, ci) =>
          ri === row && ci === col
            ? { ...p, gear: { ...p.gear!, direction } }
            : p
        )
      );

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({ grid, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) return err("Save was modified by another action", 409);

      return json({ ok: true, grid, serverUpdatedAt: ud.updated_at });
    }

    return err("Unhandled action");

  } catch (e) {
    console.error("gear-action error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
