import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { awardXp, DISCOVERY_XP_BY_RARITY } from "../_shared/gardenerLevel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

// ── Types ──────────────────────────────────────────────────────────────────

type Rarity = "common" | "uncommon" | "rare" | "legendary" | "mythic" | "exalted" | "prismatic";

// ── Flower catalogue (id, rarity, types) ──────────────────────────────────

const FLOWERS: { id: string; rarity: Rarity; types: string[] }[] = [
  // Common
  { id: "quickgrass",      rarity: "common",    types: ["grove"] },
  { id: "dustweed",        rarity: "common",    types: ["zephyr", "shadow"] },
  { id: "sprig",           rarity: "common",    types: ["grove"] },
  { id: "dewdrop",         rarity: "common",    types: ["tide"] },
  { id: "pebblebloom",     rarity: "common",    types: ["grove"] },
  { id: "ember_moss",      rarity: "common",    types: ["blaze", "grove"] },
  { id: "dandelion",       rarity: "common",    types: ["grove", "zephyr"] },
  { id: "clover",          rarity: "common",    types: ["grove", "fairy"] },
  { id: "violet",          rarity: "common",    types: ["fairy", "arcane"] },
  { id: "lemongrass",      rarity: "common",    types: ["grove", "solar"] },
  { id: "daisy",           rarity: "common",    types: ["grove", "fairy"] },
  { id: "honeywort",       rarity: "common",    types: ["grove", "solar"] },
  { id: "buttercup",       rarity: "common",    types: ["fairy", "solar"] },
  { id: "dawnpetal",       rarity: "common",    types: ["lunar", "solar"] },
  { id: "poppy",           rarity: "common",    types: ["blaze", "grove"] },
  { id: "chamomile",       rarity: "common",    types: ["grove", "solar"] },
  { id: "marigold",        rarity: "common",    types: ["solar", "grove"] },
  { id: "sunflower",       rarity: "common",    types: ["solar"] },
  { id: "coppercup",       rarity: "common",    types: ["grove"] },
  { id: "ivybell",         rarity: "common",    types: ["grove", "tide"] },
  { id: "thornberry",      rarity: "common",    types: ["grove"] },
  { id: "saltmoss",        rarity: "common",    types: ["tide"] },
  { id: "ashpetal",        rarity: "common",    types: ["shadow", "zephyr"] },
  { id: "snowdrift",       rarity: "common",    types: ["frost"] },
  // Uncommon
  { id: "swiftbloom",      rarity: "uncommon",  types: ["zephyr"] },
  { id: "shortcress",      rarity: "uncommon",  types: ["grove"] },
  { id: "thornwhistle",    rarity: "uncommon",  types: ["grove", "blaze"] },
  { id: "starwort",        rarity: "uncommon",  types: ["stellar"] },
  { id: "mintleaf",        rarity: "uncommon",  types: ["grove", "frost"] },
  { id: "tulip",           rarity: "uncommon",  types: ["fairy", "grove"] },
  { id: "inkbloom",        rarity: "uncommon",  types: ["arcane", "shadow"] },
  { id: "hyacinth",        rarity: "uncommon",  types: ["blaze", "fairy"] },
  { id: "snapdragon",      rarity: "uncommon",  types: ["blaze", "arcane"] },
  { id: "beebalm",         rarity: "uncommon",  types: ["grove", "solar"] },
  { id: "candleflower",    rarity: "uncommon",  types: ["blaze", "arcane"] },
  { id: "carnation",       rarity: "uncommon",  types: ["fairy"] },
  { id: "ribbonweed",      rarity: "uncommon",  types: ["fairy"] },
  { id: "hibiscus",        rarity: "uncommon",  types: ["solar", "blaze"] },
  { id: "wildberry",       rarity: "uncommon",  types: ["grove"] },
  { id: "frostbell",       rarity: "uncommon",  types: ["frost"] },
  { id: "bluebell",        rarity: "uncommon",  types: ["fairy", "tide"] },
  { id: "cherry_blossom",  rarity: "uncommon",  types: ["fairy", "grove"] },
  { id: "rose",            rarity: "uncommon",  types: ["fairy"] },
  { id: "peacockflower",   rarity: "uncommon",  types: ["arcane", "zephyr"] },
  { id: "bamboo_bloom",    rarity: "uncommon",  types: ["grove", "zephyr"] },
  { id: "hummingbloom",    rarity: "uncommon",  types: ["zephyr", "fairy"] },
  { id: "water_lily",      rarity: "uncommon",  types: ["tide"] },
  { id: "lanternflower",   rarity: "uncommon",  types: ["blaze", "arcane"] },
  { id: "dovebloom",       rarity: "uncommon",  types: ["zephyr", "fairy"] },
  { id: "coral_bells",     rarity: "uncommon",  types: ["tide", "fairy"] },
  { id: "sundew",          rarity: "uncommon",  types: ["grove", "shadow"] },
  { id: "bubblebloom",     rarity: "uncommon",  types: ["tide", "fairy"] },
  // Rare
  { id: "flashpetal",      rarity: "rare",      types: ["storm"] },
  { id: "rushwillow",      rarity: "rare",      types: ["zephyr", "tide"] },
  { id: "sweetheart_lily", rarity: "rare",      types: ["fairy"] },
  { id: "glassbell",       rarity: "rare",      types: ["arcane", "stellar"] },
  { id: "stormcaller",     rarity: "rare",      types: ["storm"] },
  { id: "lavender",        rarity: "rare",      types: ["fairy", "arcane"] },
  { id: "amber_crown",     rarity: "rare",      types: ["solar", "blaze"] },
  { id: "peach_blossom",   rarity: "rare",      types: ["grove", "fairy"] },
  { id: "foxglove",        rarity: "rare",      types: ["shadow", "arcane"] },
  { id: "butterbloom",     rarity: "rare",      types: ["fairy", "zephyr"] },
  { id: "peony",           rarity: "rare",      types: ["fairy"] },
  { id: "tidebloom",       rarity: "rare",      types: ["tide"] },
  { id: "starweave",       rarity: "rare",      types: ["stellar", "arcane"] },
  { id: "wisteria",        rarity: "rare",      types: ["fairy", "arcane"] },
  { id: "dreamcup",        rarity: "rare",      types: ["fairy", "arcane"] },
  { id: "coralbell",       rarity: "rare",      types: ["tide"] },
  { id: "foxfire",         rarity: "rare",      types: ["blaze", "arcane"] },
  { id: "bird_of_paradise",rarity: "rare",      types: ["zephyr", "solar"] },
  { id: "solarbell",       rarity: "rare",      types: ["solar"] },
  { id: "moonpetal",       rarity: "rare",      types: ["lunar"] },
  { id: "orchid",          rarity: "rare",      types: ["fairy", "arcane"] },
  { id: "duskrose",        rarity: "rare",      types: ["lunar", "shadow"] },
  { id: "passionflower",   rarity: "rare",      types: ["arcane", "storm"] },
  { id: "glasswing",       rarity: "rare",      types: ["arcane"] },
  { id: "mirror_orchid",   rarity: "rare",      types: ["arcane", "stellar"] },
  { id: "stargazer_lily",  rarity: "rare",      types: ["stellar"] },
  { id: "prism_lily",      rarity: "rare",      types: ["arcane", "stellar"] },
  { id: "dusk_orchid",     rarity: "rare",      types: ["lunar", "solar"] },
  // Legendary
  { id: "firstbloom",      rarity: "legendary", types: ["solar", "fairy"] },
  { id: "haste_lily",      rarity: "legendary", types: ["zephyr", "storm"] },
  { id: "verdant_crown",   rarity: "legendary", types: ["grove", "fairy"] },
  { id: "ironwood_bloom",  rarity: "legendary", types: ["grove"] },
  { id: "sundial",         rarity: "legendary", types: ["solar", "arcane"] },
  { id: "lotus",           rarity: "legendary", types: ["tide", "arcane"] },
  { id: "candy_blossom",   rarity: "legendary", types: ["fairy"] },
  { id: "prismbark",       rarity: "legendary", types: ["grove", "arcane"] },
  { id: "dolphinia",       rarity: "legendary", types: ["tide"] },
  { id: "ghost_orchid",    rarity: "legendary", types: ["shadow", "arcane"] },
  { id: "nestbloom",       rarity: "legendary", types: ["grove", "fairy"] },
  { id: "black_rose",      rarity: "legendary", types: ["shadow"] },
  { id: "pumpkin_blossom", rarity: "legendary", types: ["shadow", "grove"] },
  { id: "starburst_lily",  rarity: "legendary", types: ["stellar", "storm"] },
  { id: "sporebloom",      rarity: "legendary", types: ["grove", "shadow"] },
  { id: "fire_lily",       rarity: "legendary", types: ["blaze"] },
  { id: "stargazer",       rarity: "legendary", types: ["stellar"] },
  { id: "fullmoon_bloom",  rarity: "legendary", types: ["lunar"] },
  { id: "ice_crown",       rarity: "legendary", types: ["frost"] },
  { id: "diamond_bloom",   rarity: "legendary", types: ["frost", "arcane"] },
  { id: "oracle_eye",      rarity: "legendary", types: ["arcane", "shadow"] },
  { id: "halfmoon_bloom",  rarity: "legendary", types: ["lunar"] },
  { id: "aurora_bloom",    rarity: "legendary", types: ["stellar", "arcane"] },
  { id: "mirrorpetal",     rarity: "legendary", types: ["arcane", "stellar"] },
  { id: "emberspark",      rarity: "legendary", types: ["blaze", "storm"] },
  { id: "phoenix_lily",    rarity: "legendary", types: ["blaze", "frost"] },
  { id: "eclipse_bloom",   rarity: "legendary", types: ["lunar", "solar"] },
  { id: "tempest_orchid",  rarity: "legendary", types: ["tide", "storm"] },
  { id: "blightmantle",    rarity: "legendary", types: ["grove", "shadow"] },
  { id: "cosmosbloom",     rarity: "legendary", types: ["arcane", "stellar"] },
  { id: "dreamgust",       rarity: "legendary", types: ["fairy", "zephyr"] },
  // Mythic
  { id: "blink_rose",      rarity: "mythic",    types: ["arcane", "shadow"] },
  { id: "dawnfire",        rarity: "mythic",    types: ["solar", "blaze"] },
  { id: "moonflower",      rarity: "mythic",    types: ["lunar"] },
  { id: "jellybloom",      rarity: "mythic",    types: ["tide", "arcane"] },
  { id: "celestial_bloom", rarity: "mythic",    types: ["stellar"] },
  { id: "void_blossom",    rarity: "mythic",    types: ["shadow", "arcane"] },
  { id: "seraph_wing",     rarity: "mythic",    types: ["zephyr", "fairy"] },
  { id: "solar_rose",      rarity: "mythic",    types: ["solar"] },
  { id: "nebula_drift",    rarity: "mythic",    types: ["stellar", "arcane"] },
  { id: "superbloom",      rarity: "mythic",    types: ["storm", "stellar"] },
  { id: "wanderbloom",     rarity: "mythic",    types: ["zephyr", "arcane"] },
  { id: "chrysanthemum",   rarity: "mythic",    types: ["arcane", "stellar", "fairy"] },
  { id: "solarburst",      rarity: "mythic",    types: ["blaze", "solar"] },
  { id: "tidalune",        rarity: "mythic",    types: ["lunar", "tide"] },
  { id: "whisperleaf",     rarity: "mythic",    types: ["grove", "zephyr"] },
  { id: "crystalmind",     rarity: "mythic",    types: ["frost", "arcane"] },
  // Exalted
  { id: "umbral_bloom",    rarity: "exalted",   types: ["shadow", "lunar"] },
  { id: "obsidian_rose",   rarity: "exalted",   types: ["shadow"] },
  { id: "duskmantle",      rarity: "exalted",   types: ["shadow", "lunar"] },
  { id: "graveweb",        rarity: "exalted",   types: ["shadow"] },
  { id: "nightwing",       rarity: "exalted",   types: ["shadow", "zephyr"] },
  { id: "ashenveil",       rarity: "exalted",   types: ["shadow", "blaze"] },
  { id: "voidfire",        rarity: "exalted",   types: ["shadow", "blaze"] },
  { id: "void_chrysalis",  rarity: "exalted",   types: ["arcane"] },
  { id: "starloom",        rarity: "exalted",   types: ["stellar"] },
  // Prismatic
  { id: "dreambloom",      rarity: "prismatic", types: ["fairy", "arcane"] },
  { id: "fairy_blossom",   rarity: "prismatic", types: ["fairy"] },
  { id: "lovebind",        rarity: "prismatic", types: ["fairy", "arcane"] },
  { id: "eternal_heart",   rarity: "prismatic", types: ["fairy", "solar"] },
  { id: "nova_bloom",      rarity: "prismatic", types: ["stellar", "storm", "blaze"] },
  { id: "princess_blossom",rarity: "prismatic", types: ["fairy", "arcane"] },
  { id: "the_first_bloom", rarity: "prismatic", types: ["arcane", "stellar"] },
  // Event-exclusive
  { id: "sakura_blossom",  rarity: "prismatic", types: ["fairy", "zephyr"] },
  // ── v2.3.1 — new flowers ─────────────────────────────────────────────────
  { id: "cloudveil",     rarity: "common",    types: ["storm"] },
  { id: "pepperbloom",   rarity: "common",    types: ["blaze"] },
  { id: "flurrysprig",   rarity: "common",    types: ["frost"] },
  { id: "showerbloom",   rarity: "common",    types: ["storm", "tide"] },
  { id: "creamcap",      rarity: "common",    types: ["frost", "fairy"] },
  { id: "duskling",      rarity: "common",    types: ["lunar"] },
  { id: "moongrass",     rarity: "common",    types: ["lunar"] },
  { id: "owlsage",       rarity: "common",    types: ["shadow", "arcane"] },
  { id: "brewleaf",      rarity: "common",    types: ["arcane", "grove"] },
  { id: "hexblossom",    rarity: "common",    types: ["arcane"] },
  { id: "starfleck",     rarity: "common",    types: ["stellar"] },
  { id: "cometail",      rarity: "common",    types: ["stellar"] },
  { id: "glacierbud",    rarity: "uncommon",  types: ["frost"] },
  { id: "cloudgrass",    rarity: "uncommon",  types: ["storm"] },
  { id: "chimebloom",    rarity: "uncommon",  types: ["storm", "arcane"] },
  { id: "evenfall",      rarity: "uncommon",  types: ["lunar", "shadow"] },
  { id: "sundrift",      rarity: "uncommon",  types: ["solar", "zephyr"] },
  { id: "moonspan",      rarity: "uncommon",  types: ["lunar", "tide"] },
  { id: "tanglewort",    rarity: "uncommon",  types: ["shadow"] },
  { id: "medalwort",     rarity: "uncommon",  types: ["stellar"] },
  { id: "topazbloom",    rarity: "uncommon",  types: ["stellar"] },
  { id: "blazecrown",    rarity: "rare",      types: ["blaze"] },
  { id: "terracotta",    rarity: "rare",      types: ["grove", "blaze"] },
  { id: "frostmark",     rarity: "rare",      types: ["frost"] },
  { id: "coldsnap",      rarity: "rare",      types: ["frost", "storm"] },
  { id: "voidpetal",     rarity: "rare",      types: ["shadow", "arcane"] },
  { id: "galebloom",     rarity: "legendary", types: ["zephyr"] },
  { id: "infernopetal",  rarity: "mythic",    types: ["blaze"] },
  { id: "anchorweed",    rarity: "mythic",    types: ["tide", "shadow"] },
  { id: "worldroot",     rarity: "mythic",    types: ["grove", "arcane"] },
  { id: "clearingbloom", rarity: "mythic",    types: ["grove", "solar"] },
  { id: "permafrost",    rarity: "mythic",    types: ["frost"] },
  { id: "frostspine",    rarity: "mythic",    types: ["frost", "storm"] },
  { id: "tempest_eye",   rarity: "mythic",    types: ["storm"] },
  { id: "thundercrown",  rarity: "mythic",    types: ["storm"] },
  { id: "moonsmile",     rarity: "mythic",    types: ["lunar", "fairy"] },
  { id: "dreamshade",    rarity: "mythic",    types: ["fairy", "arcane"] },
  { id: "gravewilt",     rarity: "mythic",    types: ["shadow"] },
];

// ── Rarity output weights per pouch tier (1-5) ────────────────────────────
// Weights within each tier sum to 100.

type RarityWeight = [Rarity, number];

const POUCH_RARITY_WEIGHTS: Record<number, RarityWeight[]> = {
  1: [["common", 40], ["uncommon", 30], ["rare", 20], ["legendary",  8], ["mythic",   2]],
  2: [["common", 15], ["uncommon", 25], ["rare", 30], ["legendary", 20], ["mythic",   8], ["exalted",  2]],
  3: [["common",  5], ["uncommon", 10], ["rare", 20], ["legendary", 30], ["mythic",  25], ["exalted",  8], ["prismatic", 2]],
  4: [["common",  1], ["uncommon",  4], ["rare", 10], ["legendary", 20], ["mythic",  30], ["exalted", 25], ["prismatic", 10]],
  5: [                ["uncommon",  1], ["rare",  4], ["legendary", 10], ["mythic",  20], ["exalted", 35], ["prismatic", 30]],
};

/** Validates generic (`seed_pouch_N`) and typed (`seed_pouch_TYPE_N`) pouch IDs. */
const VALID_POUCH_REGEX = /^seed_pouch_(?:(blaze|tide|grove|frost|storm|lunar|solar|fairy|shadow|arcane|stellar|zephyr)_)?([1-5])$/;

function parsePouchId(id: string): { tier: number; type: string | null } | null {
  const m = id.match(VALID_POUCH_REGEX);
  if (!m) return null;
  return { type: m[1] ?? null, tier: parseInt(m[2], 10) };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function weightedRandom<T>(items: [T, number][]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
}

/** Pick a species at the given rarity. If `type` is provided, only species with
 *  that element type are eligible. Falls back to any species of that rarity if
 *  the typed pool is somehow empty (shouldn't happen with current catalogue). */
function selectSpecies(rarity: Rarity, type: string | null): string {
  const all  = FLOWERS.filter((f) => f.rarity === rarity);
  const pool = type ? all.filter((f) => f.types.includes(type)) : all;
  const src  = pool.length > 0 ? pool : all;
  return src[Math.floor(Math.random() * src.length)].id;
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Parse + validate input ────────────────────────────────────────────────
    const { consumableId } = await req.json() as { consumableId: string };

    const pouchInfo = parsePouchId(consumableId);
    if (!pouchInfo) {
      return new Response(JSON.stringify({ error: "Invalid consumableId — must be a seed_pouch[_type]_N" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { tier: pouchTier, type: pouchType } = pouchInfo;

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin
        .from("game_saves")
        .select("inventory, consumables, gardener_level, gardener_xp, updated_at")
        .eq("user_id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (saveResult.error || !saveResult.data) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const save = saveResult.data;
    const priorUpdatedAt = save.updated_at as string;
    const gardenerLevel = (save.gardener_level as number) ?? 1;
    const gardenerXp    = (save.gardener_xp    as number) ?? 0;

    let inventory   = (save.inventory   ?? []) as { speciesId: string; quantity: number; isSeed?: boolean; mutation?: string }[];
    let consumables = (save.consumables ?? []) as { id: string; quantity: number }[];

    // ── Validate: player must own ≥1 of this pouch ───────────────────────────
    const pouchIdx = consumables.findIndex((c) => c.id === consumableId);
    if (pouchIdx < 0 || consumables[pouchIdx].quantity < 1) {
      return new Response(JSON.stringify({ error: "You don't own that pouch" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Roll output ───────────────────────────────────────────────────────────
    const outputRarity    = weightedRandom(POUCH_RARITY_WEIGHTS[pouchTier]);
    const outputSpeciesId = selectSpecies(outputRarity, pouchType);

    // ── Deduct 1 pouch from consumables ───────────────────────────────────────
    consumables = consumables
      .map((c, i) => i === pouchIdx ? { ...c, quantity: c.quantity - 1 } : c)
      .filter((c) => c.quantity > 0);

    // ── Add seed to inventory ─────────────────────────────────────────────────
    const seedIdx = inventory.findIndex(
      (i) => i.speciesId === outputSpeciesId && i.isSeed === true && !i.mutation
    );
    if (seedIdx >= 0) {
      inventory = inventory.map((i, idx) =>
        idx === seedIdx ? { ...i, quantity: i.quantity + 1 } : i
      );
    } else {
      inventory = [...inventory, { speciesId: outputSpeciesId, quantity: 1, isSeed: true }];
    }

    const POUCH_TIER_RARITIES: Record<number, string> = {
      1: "uncommon", 2: "rare", 3: "legendary", 4: "mythic", 5: "exalted",
    };
    const xpGained = DISCOVERY_XP_BY_RARITY[POUCH_TIER_RARITIES[pouchTier]] ?? 0;
    const { level: newLevel, xp: newXp, leveledUp, levelsGained } = awardXp(gardenerLevel, gardenerXp, xpGained);

    // ── CAS write ─────────────────────────────────────────────────────────────
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({
        inventory,
        consumables,
        gardener_level: newLevel,
        gardener_xp:    newXp,
        updated_at:     new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (updateError || !updateData) {
      return new Response(JSON.stringify({ error: "Save was modified by another action — please retry" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({
      user_id: userId,
      action:  "open_seed_pouch",
      payload: { consumableId },
      result:  { outputSpeciesId, outputRarity },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        inventory,
        consumables,
        outputSpeciesId,
        xpGained,
        gardenerLevel: newLevel,
        gardenerXp: newXp,
        leveledUp,
        levelsGained,
        serverUpdatedAt: updateData.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("alchemy-craft-seed error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
