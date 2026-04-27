import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type Rarity = "common" | "uncommon" | "rare" | "legendary" | "mythic" | "exalted" | "prismatic";

const FLOWERS: { id: string; rarity: Rarity }[] = [
  { id: "quickgrass", rarity: "common" }, { id: "dustweed", rarity: "common" },
  { id: "sprig", rarity: "common" }, { id: "dewdrop", rarity: "common" },
  { id: "pebblebloom", rarity: "common" }, { id: "ember_moss", rarity: "common" },
  { id: "dandelion", rarity: "common" }, { id: "clover", rarity: "common" },
  { id: "violet", rarity: "common" }, { id: "lemongrass", rarity: "common" },
  { id: "daisy", rarity: "common" }, { id: "honeywort", rarity: "common" },
  { id: "buttercup", rarity: "common" }, { id: "dawnpetal", rarity: "common" },
  { id: "poppy", rarity: "common" }, { id: "chamomile", rarity: "common" },
  { id: "marigold", rarity: "common" }, { id: "sunflower", rarity: "common" },
  { id: "coppercup", rarity: "common" }, { id: "ivybell", rarity: "common" },
  { id: "thornberry", rarity: "common" }, { id: "saltmoss", rarity: "common" },
  { id: "ashpetal", rarity: "common" }, { id: "snowdrift", rarity: "common" },
  { id: "swiftbloom", rarity: "uncommon" }, { id: "shortcress", rarity: "uncommon" },
  { id: "thornwhistle", rarity: "uncommon" }, { id: "starwort", rarity: "uncommon" },
  { id: "mintleaf", rarity: "uncommon" }, { id: "tulip", rarity: "uncommon" },
  { id: "inkbloom", rarity: "uncommon" }, { id: "hyacinth", rarity: "uncommon" },
  { id: "snapdragon", rarity: "uncommon" }, { id: "beebalm", rarity: "uncommon" },
  { id: "candleflower", rarity: "uncommon" }, { id: "carnation", rarity: "uncommon" },
  { id: "ribbonweed", rarity: "uncommon" }, { id: "hibiscus", rarity: "uncommon" },
  { id: "wildberry", rarity: "uncommon" }, { id: "frostbell", rarity: "uncommon" },
  { id: "bluebell", rarity: "uncommon" }, { id: "cherry_blossom", rarity: "uncommon" },
  { id: "rose", rarity: "uncommon" }, { id: "peacockflower", rarity: "uncommon" },
  { id: "bamboo_bloom", rarity: "uncommon" }, { id: "hummingbloom", rarity: "uncommon" },
  { id: "water_lily", rarity: "uncommon" }, { id: "lanternflower", rarity: "uncommon" },
  { id: "dovebloom", rarity: "uncommon" }, { id: "coral_bells", rarity: "uncommon" },
  { id: "sundew", rarity: "uncommon" }, { id: "bubblebloom", rarity: "uncommon" },
  { id: "flashpetal", rarity: "rare" }, { id: "rushwillow", rarity: "rare" },
  { id: "sweetheart_lily", rarity: "rare" }, { id: "glassbell", rarity: "rare" },
  { id: "stormcaller", rarity: "rare" }, { id: "lavender", rarity: "rare" },
  { id: "amber_crown", rarity: "rare" }, { id: "peach_blossom", rarity: "rare" },
  { id: "foxglove", rarity: "rare" }, { id: "butterbloom", rarity: "rare" },
  { id: "peony", rarity: "rare" }, { id: "tidebloom", rarity: "rare" },
  { id: "starweave", rarity: "rare" }, { id: "wisteria", rarity: "rare" },
  { id: "dreamcup", rarity: "rare" }, { id: "coralbell", rarity: "rare" },
  { id: "foxfire", rarity: "rare" }, { id: "bird_of_paradise", rarity: "rare" },
  { id: "solarbell", rarity: "rare" }, { id: "moonpetal", rarity: "rare" },
  { id: "orchid", rarity: "rare" }, { id: "duskrose", rarity: "rare" },
  { id: "passionflower", rarity: "rare" }, { id: "glasswing", rarity: "rare" },
  { id: "mirror_orchid", rarity: "rare" }, { id: "stargazer_lily", rarity: "rare" },
  { id: "prism_lily", rarity: "rare" }, { id: "dusk_orchid", rarity: "rare" },
  { id: "firstbloom", rarity: "legendary" }, { id: "haste_lily", rarity: "legendary" },
  { id: "verdant_crown", rarity: "legendary" }, { id: "ironwood_bloom", rarity: "legendary" },
  { id: "sundial", rarity: "legendary" }, { id: "lotus", rarity: "legendary" },
  { id: "candy_blossom", rarity: "legendary" }, { id: "prismbark", rarity: "legendary" },
  { id: "dolphinia", rarity: "legendary" }, { id: "ghost_orchid", rarity: "legendary" },
  { id: "nestbloom", rarity: "legendary" }, { id: "black_rose", rarity: "legendary" },
  { id: "pumpkin_blossom", rarity: "legendary" }, { id: "starburst_lily", rarity: "legendary" },
  { id: "sporebloom", rarity: "legendary" }, { id: "fire_lily", rarity: "legendary" },
  { id: "stargazer", rarity: "legendary" }, { id: "fullmoon_bloom", rarity: "legendary" },
  { id: "ice_crown", rarity: "legendary" }, { id: "diamond_bloom", rarity: "legendary" },
  { id: "oracle_eye", rarity: "legendary" }, { id: "halfmoon_bloom", rarity: "legendary" },
  { id: "aurora_bloom", rarity: "legendary" }, { id: "mirrorpetal", rarity: "legendary" },
  { id: "emberspark", rarity: "legendary" },
  { id: "blink_rose", rarity: "mythic" }, { id: "dawnfire", rarity: "mythic" },
  { id: "moonflower", rarity: "mythic" }, { id: "jellybloom", rarity: "mythic" },
  { id: "celestial_bloom", rarity: "mythic" }, { id: "void_blossom", rarity: "mythic" },
  { id: "seraph_wing", rarity: "mythic" }, { id: "solar_rose", rarity: "mythic" },
  { id: "nebula_drift", rarity: "mythic" }, { id: "superbloom", rarity: "mythic" },
  { id: "wanderbloom", rarity: "mythic" }, { id: "chrysanthemum", rarity: "mythic" },
  { id: "umbral_bloom", rarity: "exalted" }, { id: "obsidian_rose", rarity: "exalted" },
  { id: "duskmantle", rarity: "exalted" }, { id: "graveweb", rarity: "exalted" },
  { id: "nightwing", rarity: "exalted" }, { id: "ashenveil", rarity: "exalted" },
  { id: "voidfire", rarity: "exalted" },
  { id: "dreambloom", rarity: "prismatic" }, { id: "fairy_blossom", rarity: "prismatic" },
  { id: "lovebind", rarity: "prismatic" }, { id: "eternal_heart", rarity: "prismatic" },
  { id: "nova_bloom", rarity: "prismatic" }, { id: "princess_blossom", rarity: "prismatic" },
];

const BOTANY_REQUIREMENTS: Partial<Record<Rarity, number>> = {
  common: 5, uncommon: 5, rare: 5, legendary: 5, mythic: 5, exalted: 5,
};
const NEXT_RARITY: Partial<Record<Rarity, Rarity>> = {
  common: "uncommon", uncommon: "rare", rare: "legendary",
  legendary: "mythic", mythic: "exalted", exalted: "prismatic",
};

interface InventoryItem { speciesId: string; quantity: number; mutation?: string; isSeed?: boolean; }
interface Selection { speciesId: string; mutation?: string; }

function convertOnce(
  inventory: InventoryItem[], discovered: string[], selections: Selection[]
): { inventory: InventoryItem[]; outputSpeciesId: string } | { error: string } {
  if (selections.length === 0) return { error: "No selections provided" };

  const firstFlower = FLOWERS.find((f) => f.id === selections[0].speciesId);
  if (!firstFlower) return { error: "Unknown species" };
  const rarity   = firstFlower.rarity;
  const required = BOTANY_REQUIREMENTS[rarity];
  if (!required) return { error: "This rarity cannot be converted" };
  if (selections.length !== required) return { error: `Expected ${required} selections for ${rarity}` };
  if (!selections.every((s) => FLOWERS.find((f) => f.id === s.speciesId)?.rarity === rarity)) {
    return { error: "All selections must be the same rarity" };
  }

  const consumeCounts = new Map<string, number>();
  for (const sel of selections) {
    const key = `${sel.speciesId}||${sel.mutation ?? ""}`;
    consumeCounts.set(key, (consumeCounts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of consumeCounts) {
    const [speciesId, mutStr] = key.split("||");
    const mutation = mutStr || undefined;
    const item = inventory.find((i) => i.speciesId === speciesId && i.mutation === mutation && !i.isSeed);
    if (!item || item.quantity < count) return { error: "Insufficient inventory" };
  }

  const nextRarity   = NEXT_RARITY[rarity];
  if (!nextRarity) return { error: "No next rarity available" };
  const pool         = FLOWERS.filter((f) => f.rarity === nextRarity);
  const undiscovered = pool.filter((f) => !discovered.includes(f.id));
  const outputPool   = undiscovered.length > 0 ? undiscovered : pool;
  const outputSpecies = outputPool[Math.floor(Math.random() * outputPool.length)];

  let newInventory = [...inventory];
  for (const [key, count] of consumeCounts) {
    const [speciesId, mutStr] = key.split("||");
    const mutation = mutStr || undefined;
    newInventory = newInventory
      .map((i) => i.speciesId === speciesId && i.mutation === mutation && !i.isSeed ? { ...i, quantity: i.quantity - count } : i)
      .filter((i) => i.quantity > 0);
  }

  const existingSeed = newInventory.find((i) => i.speciesId === outputSpecies.id && i.isSeed);
  if (existingSeed) {
    newInventory = newInventory.map((i) =>
      i.speciesId === outputSpecies.id && i.isSeed ? { ...i, quantity: i.quantity + 1 } : i
    );
  } else {
    newInventory.push({ speciesId: outputSpecies.id, quantity: 1, isSeed: true });
  }
  return { inventory: newInventory, outputSpeciesId: outputSpecies.id };
}

Deno.serve(async (req: Request) => {
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

    const body = await req.json() as {
      action: "convert" | "convert_all"; selections?: Selection[]; rarity?: Rarity;
    };

    if (body.action !== "convert" && body.action !== "convert_all") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves").select("inventory, discovered").eq("user_id", userId).single(),
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
    let inventory    = (save.inventory  ?? []) as InventoryItem[];
    const discovered = (save.discovered ?? []) as string[];
    const outputSpeciesIds: string[] = [];

    if (body.action === "convert") {
      if (!body.selections || body.selections.length === 0) {
        return new Response(JSON.stringify({ error: "selections required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = convertOnce(inventory, discovered, body.selections);
      if ("error" in result) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inventory = result.inventory;
      outputSpeciesIds.push(result.outputSpeciesId);
    }

    if (body.action === "convert_all") {
      const { rarity } = body;
      if (!rarity) {
        return new Response(JSON.stringify({ error: "rarity required for convert_all" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const required = BOTANY_REQUIREMENTS[rarity];
      if (!required) {
        return new Response(JSON.stringify({ error: "This rarity cannot be converted" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      while (true) {
        const eligible = inventory.filter((i) =>
          !i.isSeed && FLOWERS.find((f) => f.id === i.speciesId)?.rarity === rarity && i.quantity > 0
        );
        if (eligible.reduce((s, i) => s + i.quantity, 0) < required) break;

        const selections: Selection[] = [];
        const tempUsed = new Map<string, number>();
        for (const item of eligible) {
          const key  = `${item.speciesId}||${item.mutation ?? ""}`;
          const used = tempUsed.get(key) ?? 0;
          const take = Math.min(item.quantity - used, required - selections.length);
          for (let i = 0; i < take; i++) selections.push({ speciesId: item.speciesId, mutation: item.mutation });
          if (take > 0) tempUsed.set(key, used + take);
          if (selections.length === required) break;
        }
        if (selections.length < required) break;

        const result = convertOnce(inventory, discovered, selections);
        if ("error" in result) break;
        inventory = result.inventory;
        outputSpeciesIds.push(result.outputSpeciesId);
      }

      if (outputSpeciesIds.length === 0) {
        return new Response(JSON.stringify({ error: "Not enough blooms to convert" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({ inventory, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: `botany_${body.action}`,
      payload: { action: body.action, rarity: body.rarity, count: outputSpeciesIds.length },
      result:  { outputSpeciesIds },
    });

    return new Response(
      JSON.stringify({ ok: true, inventory, outputSpeciesIds }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("botany-convert error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
