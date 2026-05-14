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

// ── Flower catalogue (id → rarity + types) ────────────────────────────────

type Rarity = "common" | "uncommon" | "rare" | "legendary" | "mythic" | "exalted" | "prismatic";
type FlowerType = "blaze" | "tide" | "grove" | "frost" | "storm" | "lunar" | "solar" | "fairy" | "shadow" | "arcane" | "stellar" | "zephyr";

const FLOWERS: { id: string; rarity: Rarity; types: FlowerType[] }[] = [
  // COMMON
  { id: "quickgrass",   rarity: "common",   types: ["grove"] },
  { id: "dustweed",     rarity: "common",   types: ["zephyr", "shadow"] },
  { id: "sprig",        rarity: "common",   types: ["grove"] },
  { id: "dewdrop",      rarity: "common",   types: ["tide"] },
  { id: "pebblebloom",  rarity: "common",   types: ["grove"] },
  { id: "ember_moss",   rarity: "common",   types: ["blaze", "grove"] },
  { id: "dandelion",    rarity: "common",   types: ["grove", "zephyr"] },
  { id: "clover",       rarity: "common",   types: ["grove", "fairy"] },
  { id: "violet",       rarity: "common",   types: ["fairy", "arcane"] },
  { id: "lemongrass",   rarity: "common",   types: ["grove", "solar"] },
  { id: "daisy",        rarity: "common",   types: ["grove", "fairy"] },
  { id: "honeywort",    rarity: "common",   types: ["grove", "solar"] },
  { id: "buttercup",    rarity: "common",   types: ["fairy", "solar"] },
  { id: "dawnpetal",    rarity: "common",   types: ["lunar", "solar"] },
  { id: "poppy",        rarity: "common",   types: ["blaze", "grove"] },
  { id: "chamomile",    rarity: "common",   types: ["grove", "solar"] },
  { id: "marigold",     rarity: "common",   types: ["solar", "grove"] },
  { id: "sunflower",    rarity: "common",   types: ["solar"] },
  { id: "coppercup",    rarity: "common",   types: ["grove"] },
  { id: "ivybell",      rarity: "common",   types: ["grove", "tide"] },
  { id: "thornberry",   rarity: "common",   types: ["grove"] },
  { id: "saltmoss",     rarity: "common",   types: ["tide"] },
  { id: "ashpetal",     rarity: "common",   types: ["shadow", "zephyr"] },
  { id: "snowdrift",    rarity: "common",   types: ["frost"] },
  // COMMON — v2.3.0
  { id: "stormcap",     rarity: "common",   types: ["storm"] },
  { id: "stardust",     rarity: "common",   types: ["stellar"] },
  // UNCOMMON
  { id: "swiftbloom",     rarity: "uncommon", types: ["zephyr"] },
  { id: "shortcress",     rarity: "uncommon", types: ["grove"] },
  { id: "thornwhistle",   rarity: "uncommon", types: ["grove", "blaze"] },
  { id: "starwort",       rarity: "uncommon", types: ["stellar"] },
  { id: "mintleaf",       rarity: "uncommon", types: ["grove", "frost"] },
  { id: "tulip",          rarity: "uncommon", types: ["fairy", "grove"] },
  { id: "inkbloom",       rarity: "uncommon", types: ["arcane", "shadow"] },
  { id: "hyacinth",       rarity: "uncommon", types: ["blaze", "fairy"] },
  { id: "snapdragon",     rarity: "uncommon", types: ["blaze", "arcane"] },
  { id: "beebalm",        rarity: "uncommon", types: ["grove", "solar"] },
  { id: "candleflower",   rarity: "uncommon", types: ["blaze", "arcane"] },
  { id: "carnation",      rarity: "uncommon", types: ["fairy"] },
  { id: "ribbonweed",     rarity: "uncommon", types: ["fairy"] },
  { id: "hibiscus",       rarity: "uncommon", types: ["solar", "blaze"] },
  { id: "wildberry",      rarity: "uncommon", types: ["grove"] },
  { id: "frostbell",      rarity: "uncommon", types: ["frost"] },
  { id: "bluebell",       rarity: "uncommon", types: ["fairy", "tide"] },
  { id: "cherry_blossom", rarity: "uncommon", types: ["fairy", "grove"] },
  { id: "rose",           rarity: "uncommon", types: ["fairy"] },
  { id: "peacockflower",  rarity: "uncommon", types: ["arcane", "zephyr"] },
  { id: "bamboo_bloom",   rarity: "uncommon", types: ["grove", "zephyr"] },
  { id: "hummingbloom",   rarity: "uncommon", types: ["zephyr", "fairy"] },
  { id: "water_lily",     rarity: "uncommon", types: ["tide"] },
  { id: "lanternflower",  rarity: "uncommon", types: ["blaze", "arcane"] },
  { id: "dovebloom",      rarity: "uncommon", types: ["zephyr", "fairy"] },
  { id: "coral_bells",    rarity: "uncommon", types: ["tide", "fairy"] },
  { id: "sundew",         rarity: "uncommon", types: ["grove", "shadow"] },
  { id: "bubblebloom",    rarity: "uncommon", types: ["tide", "fairy"] },
  // UNCOMMON — v2.3.0
  { id: "moonstrike",    rarity: "uncommon", types: ["storm", "lunar"] },
  // RARE
  { id: "flashpetal",        rarity: "rare", types: ["storm"] },
  { id: "rushwillow",        rarity: "rare", types: ["zephyr", "tide"] },
  { id: "sweetheart_lily",   rarity: "rare", types: ["fairy"] },
  { id: "glassbell",         rarity: "rare", types: ["arcane", "stellar"] },
  { id: "stormcaller",       rarity: "rare", types: ["storm"] },
  { id: "lavender",          rarity: "rare", types: ["fairy", "arcane"] },
  { id: "amber_crown",       rarity: "rare", types: ["solar", "blaze"] },
  { id: "peach_blossom",     rarity: "rare", types: ["grove", "fairy"] },
  { id: "foxglove",          rarity: "rare", types: ["shadow", "arcane"] },
  { id: "butterbloom",       rarity: "rare", types: ["fairy", "zephyr"] },
  { id: "peony",             rarity: "rare", types: ["fairy"] },
  { id: "tidebloom",         rarity: "rare", types: ["tide"] },
  { id: "starweave",         rarity: "rare", types: ["stellar", "arcane"] },
  { id: "wisteria",          rarity: "rare", types: ["fairy", "arcane"] },
  { id: "dreamcup",          rarity: "rare", types: ["fairy", "arcane"] },
  { id: "coralbell",         rarity: "rare", types: ["tide"] },
  { id: "foxfire",           rarity: "rare", types: ["blaze", "arcane"] },
  { id: "bird_of_paradise",  rarity: "rare", types: ["zephyr", "solar"] },
  { id: "solarbell",         rarity: "rare", types: ["solar"] },
  { id: "moonpetal",         rarity: "rare", types: ["lunar"] },
  { id: "orchid",            rarity: "rare", types: ["fairy", "arcane"] },
  { id: "duskrose",          rarity: "rare", types: ["lunar", "shadow"] },
  { id: "passionflower",     rarity: "rare", types: ["arcane", "storm"] },
  { id: "glasswing",         rarity: "rare", types: ["arcane"] },
  { id: "mirror_orchid",     rarity: "rare", types: ["arcane", "stellar"] },
  { id: "stargazer_lily",    rarity: "rare", types: ["stellar"] },
  { id: "prism_lily",        rarity: "rare", types: ["arcane", "stellar"] },
  { id: "dusk_orchid",       rarity: "rare", types: ["lunar", "solar"] },
  // RARE — v2.3.0
  { id: "winterwood",        rarity: "rare",      types: ["grove", "frost"] },
  // LEGENDARY
  { id: "firstbloom",       rarity: "legendary", types: ["solar", "fairy"] },
  { id: "haste_lily",       rarity: "legendary", types: ["zephyr", "storm"] },
  { id: "verdant_crown",    rarity: "legendary", types: ["grove", "fairy"] },
  { id: "ironwood_bloom",   rarity: "legendary", types: ["grove"] },
  { id: "sundial",          rarity: "legendary", types: ["solar", "arcane"] },
  { id: "lotus",            rarity: "legendary", types: ["tide", "arcane"] },
  { id: "candy_blossom",    rarity: "legendary", types: ["fairy"] },
  { id: "prismbark",        rarity: "legendary", types: ["grove", "arcane"] },
  { id: "dolphinia",        rarity: "legendary", types: ["tide"] },
  { id: "ghost_orchid",     rarity: "legendary", types: ["shadow", "arcane"] },
  { id: "nestbloom",        rarity: "legendary", types: ["grove", "fairy"] },
  { id: "black_rose",       rarity: "legendary", types: ["shadow"] },
  { id: "pumpkin_blossom",  rarity: "legendary", types: ["shadow", "grove"] },
  { id: "starburst_lily",   rarity: "legendary", types: ["stellar", "storm"] },
  { id: "sporebloom",       rarity: "legendary", types: ["grove", "shadow"] },
  { id: "fire_lily",        rarity: "legendary", types: ["blaze"] },
  { id: "stargazer",        rarity: "legendary", types: ["stellar"] },
  { id: "fullmoon_bloom",   rarity: "legendary", types: ["lunar"] },
  { id: "ice_crown",        rarity: "legendary", types: ["frost"] },
  { id: "diamond_bloom",    rarity: "legendary", types: ["frost", "arcane"] },
  { id: "oracle_eye",       rarity: "legendary", types: ["arcane", "shadow"] },
  { id: "halfmoon_bloom",   rarity: "legendary", types: ["lunar"] },
  { id: "aurora_bloom",     rarity: "legendary", types: ["stellar", "arcane"] },
  { id: "mirrorpetal",      rarity: "legendary", types: ["arcane", "stellar"] },
  { id: "emberspark",       rarity: "legendary", types: ["blaze", "storm"] },
  // LEGENDARY — Cropsticks recipe outputs (Tier 1)
  { id: "phoenix_lily",   rarity: "legendary", types: ["blaze", "frost"]    },
  { id: "eclipse_bloom",  rarity: "legendary", types: ["lunar", "solar"]    },
  { id: "tempest_orchid", rarity: "legendary", types: ["tide",  "storm"]    },
  { id: "blightmantle",   rarity: "legendary", types: ["grove", "shadow"]   },
  { id: "cosmosbloom",    rarity: "legendary", types: ["arcane","stellar"]  },
  { id: "dreamgust",      rarity: "legendary", types: ["fairy", "zephyr"]   },
  // MYTHIC
  { id: "blink_rose",      rarity: "mythic", types: ["arcane", "shadow"] },
  { id: "dawnfire",        rarity: "mythic", types: ["solar", "blaze"] },
  { id: "moonflower",      rarity: "mythic", types: ["lunar"] },
  { id: "jellybloom",      rarity: "mythic", types: ["tide", "arcane"] },
  { id: "celestial_bloom", rarity: "mythic", types: ["stellar"] },
  { id: "void_blossom",    rarity: "mythic", types: ["shadow", "arcane"] },
  { id: "seraph_wing",     rarity: "mythic", types: ["zephyr", "fairy"] },
  { id: "solar_rose",      rarity: "mythic", types: ["solar"] },
  { id: "nebula_drift",    rarity: "mythic", types: ["stellar", "arcane"] },
  { id: "superbloom",      rarity: "mythic", types: ["storm", "stellar"] },
  { id: "wanderbloom",     rarity: "mythic", types: ["zephyr", "arcane"] },
  { id: "chrysanthemum",   rarity: "mythic", types: ["arcane", "stellar", "fairy"] },
  // MYTHIC — Cropsticks recipe outputs (Tier 2)
  { id: "solarburst",  rarity: "mythic", types: ["blaze", "solar"]  },
  { id: "tidalune",    rarity: "mythic", types: ["lunar", "tide"]   },
  { id: "whisperleaf", rarity: "mythic", types: ["grove", "zephyr"] },
  { id: "crystalmind", rarity: "mythic", types: ["frost", "arcane"] },
  // EXALTED
  { id: "umbral_bloom",   rarity: "exalted", types: ["shadow", "lunar"] },
  { id: "obsidian_rose",  rarity: "exalted", types: ["shadow"] },
  { id: "duskmantle",     rarity: "exalted", types: ["shadow", "lunar"] },
  { id: "graveweb",       rarity: "exalted", types: ["shadow"] },
  { id: "nightwing",      rarity: "exalted", types: ["shadow", "zephyr"] },
  { id: "ashenveil",      rarity: "exalted", types: ["shadow", "blaze"] },
  { id: "voidfire",       rarity: "exalted", types: ["shadow", "blaze"] },
  // EXALTED — Cropsticks recipe outputs (Tier 3)
  { id: "void_chrysalis", rarity: "exalted", types: ["arcane"]   },
  { id: "starloom",       rarity: "exalted", types: ["stellar"]  },
  // EXALTED — v2.3.0
  { id: "deeproot",       rarity: "exalted", types: ["tide",  "grove"]  },
  { id: "rimestorm",      rarity: "exalted", types: ["frost", "storm"]  },
  { id: "solglow",        rarity: "exalted", types: ["solar", "fairy"]  },
  // PRISMATIC
  { id: "dreambloom",        rarity: "prismatic", types: ["fairy", "arcane"] },
  { id: "fairy_blossom",     rarity: "prismatic", types: ["fairy"] },
  { id: "lovebind",          rarity: "prismatic", types: ["fairy", "arcane"] },
  { id: "eternal_heart",     rarity: "prismatic", types: ["fairy", "solar"] },
  { id: "nova_bloom",        rarity: "prismatic", types: ["stellar", "storm", "blaze"] },
  { id: "princess_blossom",  rarity: "prismatic", types: ["fairy", "arcane"] },
  // PRISMATIC — Cropsticks recipe output (Tier 4)
  { id: "the_first_bloom", rarity: "prismatic", types: ["arcane", "stellar"] },
  // Event-exclusive
  { id: "sakura_blossom",  rarity: "prismatic", types: ["fairy", "zephyr"] },
  // PRISMATIC — v2.3.0
  { id: "islebloom",       rarity: "prismatic", types: ["tide",   "grove"]  },
  { id: "moonrime",        rarity: "prismatic", types: ["frost",  "lunar"]  },
  { id: "shadowgale",      rarity: "prismatic", types: ["shadow", "zephyr"] },
  // ── v2.3.1 — new flowers ─────────────────────────────────────────────────
  // Common
  { id: "cloudveil",    rarity: "common",    types: ["storm"] },
  { id: "pepperbloom",  rarity: "common",    types: ["blaze"] },
  { id: "flurrysprig",  rarity: "common",    types: ["frost"] },
  { id: "showerbloom",  rarity: "common",    types: ["storm", "tide"] },
  { id: "creamcap",     rarity: "common",    types: ["frost", "fairy"] },
  { id: "duskling",     rarity: "common",    types: ["lunar"] },
  { id: "moongrass",    rarity: "common",    types: ["lunar"] },
  { id: "owlsage",      rarity: "common",    types: ["shadow", "arcane"] },
  { id: "brewleaf",     rarity: "common",    types: ["arcane", "grove"] },
  { id: "hexblossom",   rarity: "common",    types: ["arcane"] },
  { id: "starfleck",    rarity: "common",    types: ["stellar"] },
  { id: "cometail",     rarity: "common",    types: ["stellar"] },
  // Uncommon
  { id: "glacierbud",   rarity: "uncommon",  types: ["frost"] },
  { id: "cloudgrass",   rarity: "uncommon",  types: ["storm"] },
  { id: "chimebloom",   rarity: "uncommon",  types: ["storm", "arcane"] },
  { id: "evenfall",     rarity: "uncommon",  types: ["lunar", "shadow"] },
  { id: "sundrift",     rarity: "uncommon",  types: ["solar", "zephyr"] },
  { id: "moonspan",     rarity: "uncommon",  types: ["lunar", "tide"] },
  { id: "tanglewort",   rarity: "uncommon",  types: ["shadow"] },
  { id: "medalwort",    rarity: "uncommon",  types: ["stellar"] },
  { id: "topazbloom",   rarity: "uncommon",  types: ["stellar"] },
  // Rare
  { id: "blazecrown",   rarity: "rare",      types: ["blaze"] },
  { id: "terracotta",   rarity: "rare",      types: ["grove", "blaze"] },
  { id: "frostmark",    rarity: "rare",      types: ["frost"] },
  { id: "coldsnap",     rarity: "rare",      types: ["frost", "storm"] },
  { id: "voidpetal",    rarity: "rare",      types: ["shadow", "arcane"] },
  // Legendary
  { id: "galebloom",    rarity: "legendary", types: ["zephyr"] },
  // Mythic
  { id: "infernopetal", rarity: "mythic",    types: ["blaze"] },
  { id: "anchorweed",   rarity: "mythic",    types: ["tide", "shadow"] },
  { id: "worldroot",    rarity: "mythic",    types: ["grove", "arcane"] },
  { id: "clearingbloom",rarity: "mythic",    types: ["grove", "solar"] },
  { id: "permafrost",   rarity: "mythic",    types: ["frost"] },
  { id: "frostspine",   rarity: "mythic",    types: ["frost", "storm"] },
  { id: "tempest_eye",  rarity: "mythic",    types: ["storm"] },
  { id: "thundercrown", rarity: "mythic",    types: ["storm"] },
  { id: "moonsmile",    rarity: "mythic",    types: ["lunar", "fairy"] },
  { id: "dreamshade",   rarity: "mythic",    types: ["fairy", "arcane"] },
  { id: "gravewilt",    rarity: "mythic",    types: ["shadow"] },
];

const FLOWER_MAP = new Map(FLOWERS.map((f) => [f.id, f]));

// ── Essence yield table ────────────────────────────────────────────────────

const ESSENCE_YIELD: Record<Rarity, number> = {
  common:    2,
  uncommon:  4,
  rare:      8,
  legendary: 16,
  mythic:    32,
  exalted:   64,
  prismatic: 128,
};

// ── Helpers ────────────────────────────────────────────────────────────────

interface EssenceItem { type: FlowerType; amount: number; }
interface InventoryItem { speciesId: string; quantity: number; mutation?: string; isSeed?: boolean; }

/**
 * Deterministic even-split — same algorithm as calculateEssenceYield() on the client.
 * The preview and the actual result will always match.
 */
function calculateYield(types: FlowerType[], rarity: Rarity, quantity: number): EssenceItem[] {
  if (types.length === 0 || quantity === 0) return [];
  const total   = ESSENCE_YIELD[rarity] * quantity;
  const perType = Math.floor(total / types.length);
  const rem     = total % types.length;
  return types
    .map((type, i) => ({ type, amount: perType + (i < rem ? 1 : 0) }))
    .filter((e) => e.amount > 0);
}

function mergeEssences(current: EssenceItem[], additions: EssenceItem[]): EssenceItem[] {
  const map = new Map<FlowerType, number>(current.map((e) => [e.type, e.amount]));
  for (const { type, amount } of additions) {
    map.set(type, (map.get(type) ?? 0) + amount);
  }
  return Array.from(map.entries())
    .map(([type, amount]) => ({ type, amount }))
    .filter((e) => e.amount > 0);
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

    // Decode userId from JWT payload without full verification (parallel load)
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

    // ── Parse input ───────────────────────────────────────────────────────────
    const { sacrifices } = await req.json() as {
      sacrifices: { speciesId: string; mutation?: string; quantity: number }[];
    };

    if (!Array.isArray(sacrifices) || sacrifices.length === 0) {
      return new Response(JSON.stringify({ error: "sacrifices array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify JWT (once — tokens don't rotate mid-request) ───────────────────
    const authResult = await supabaseAdmin.auth.getUser(token);
    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CAS retry loop ────────────────────────────────────────────────────────
    // Each attempt re-reads the save to get a fresh updated_at cursor.
    // If a concurrent write (e.g. sell) wins the CAS race we retry rather than
    // immediately surfacing a 409 to the user.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const saveResult = await supabaseAdmin
        .from("game_saves")
        .select("inventory, essences, updated_at")
        .eq("user_id", userId)
        .single();

      if (saveResult.error || !saveResult.data) {
        return new Response(JSON.stringify({ error: "Save not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const save          = saveResult.data;
      const priorUpdatedAt = save.updated_at as string;

      // Consolidate duplicate inventory entries (same speciesId + mutation + isSeed)
      // that can accumulate due to null/undefined mutation mismatches in harvest.
      // Without this, inventory.find() hits only the first entry and reports
      // "insufficient inventory" even when the combined quantity is sufficient.
      const rawInventory = (save.inventory ?? []) as InventoryItem[];
      const dedupMap = new Map<string, InventoryItem>();
      for (const item of rawInventory) {
        const key = `${item.speciesId}:${item.mutation ?? ""}:${item.isSeed ? "1" : "0"}`;
        const existing = dedupMap.get(key);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          dedupMap.set(key, { ...item, mutation: item.mutation ?? null });
        }
      }
      let inventory = Array.from(dedupMap.values());
      let essences  = (save.essences ?? []) as EssenceItem[];

      // ── Validate each sacrifice entry ─────────────────────────────────────────
      // Use a running working copy so multiple entries for the same species are
      // cross-validated against the true remaining quantity, not the original stock.
      const workingInventory = inventory.map((i) => ({ ...i }));
      for (const { speciesId, mutation, quantity } of sacrifices) {
        if (!Number.isInteger(quantity) || quantity < 1) {
          return new Response(JSON.stringify({ error: `Invalid quantity for ${speciesId}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const flower = FLOWER_MAP.get(speciesId);
        if (!flower) {
          return new Response(JSON.stringify({ error: `Unknown species: ${speciesId}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const invItem = workingInventory.find(
          (i) => i.speciesId === speciesId && (i.mutation ?? null) === (mutation ?? null) && !i.isSeed
        );
        if (!invItem || invItem.quantity < quantity) {
          return new Response(JSON.stringify({ error: `Insufficient inventory for ${speciesId}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Deduct from working copy so subsequent entries for the same species
        // see the reduced quantity.
        invItem.quantity -= quantity;
      }

      // ── Apply sacrifices ──────────────────────────────────────────────────────
      for (const { speciesId, mutation, quantity } of sacrifices) {
        const flower = FLOWER_MAP.get(speciesId)!;

        // Consume flowers from inventory
        inventory = inventory
          .map((i) =>
            i.speciesId === speciesId && (i.mutation ?? null) === (mutation ?? null) && !i.isSeed
              ? { ...i, quantity: i.quantity - quantity }
              : i
          )
          .filter((i) => i.quantity > 0);

        // Calculate and merge essence yield
        const yields = calculateYield(flower.types, flower.rarity, quantity);
        essences     = mergeEssences(essences, yields);
      }

      // ── Write to DB (optimistic-concurrency guard on updated_at) ─────────────
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from("game_saves")
        .update({ inventory, essences, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (updateError || !updateData) {
        if (attempt < MAX_ATTEMPTS - 1) continue;   // retry with fresh read
        return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      void supabaseAdmin.from("action_log").insert({
        user_id: userId,
        action:  "alchemy_sacrifice",
        payload: { sacrifices },
        result:  { essencesAdded: essences },
      });

      return new Response(
        JSON.stringify({ ok: true, inventory, essences, serverUpdatedAt: updateData.updated_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unreachable — loop always returns or continues to exhaustion
    return new Response(JSON.stringify({ error: "Unexpected retry exhaustion" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("alchemy-sacrifice error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
