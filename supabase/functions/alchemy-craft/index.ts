import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { awardXp, DISCOVERY_XP_BY_RARITY } from "../_shared/gardenerLevel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

// ── Mirrored recipe data (mirrors src/data/consumables.ts) ───────────────
// Edge functions can't import from src/ — recipe costs are hardcoded here.

type EssenceCostEntry = { type: string; amount: number };
type CraftCost =
  | { kind: "essence";    amounts: EssenceCostEntry[] }
  | { kind: "consumable"; id: string; quantity: number };
type AttunementCost =
  | { kind: "essence";    amounts: EssenceCostEntry[] }
  | { kind: "attunement"; tier: number; quantity: number };

interface ConsumableRecipeDef  { id: string; cost: CraftCost }
interface AttunementRecipeDef  { tier: number; rarity: string; cost: AttunementCost }

const TIER_RARITIES: Record<number, string> = {
  1: "rare", 2: "legendary", 3: "mythic", 4: "exalted", 5: "prismatic",
};

const E = (amounts: EssenceCostEntry[]): CraftCost => ({ kind: "essence", amounts });
const U = (id: string, quantity: number): CraftCost => ({ kind: "consumable", id, quantity });

const CONSUMABLE_RECIPES: ConsumableRecipeDef[] = [
  // Bloom Burst
  { id: "bloom_burst_1", cost: E([{ type: "solar", amount: 4 }, { type: "zephyr", amount: 4 }]) },
  { id: "bloom_burst_2", cost: U("bloom_burst_1", 2) },
  { id: "bloom_burst_3", cost: U("bloom_burst_2", 2) },
  { id: "bloom_burst_4", cost: U("bloom_burst_3", 2) },
  { id: "bloom_burst_5", cost: U("bloom_burst_4", 2) },
  // Heirloom Charm
  { id: "heirloom_charm_1", cost: E([{ type: "fairy", amount: 8 }, { type: "stellar", amount: 4 }, { type: "arcane", amount: 4 }]) },
  { id: "heirloom_charm_2", cost: U("heirloom_charm_1", 3) },
  { id: "heirloom_charm_3", cost: U("heirloom_charm_2", 3) },
  { id: "heirloom_charm_4", cost: U("heirloom_charm_3", 3) },
  { id: "heirloom_charm_5", cost: U("heirloom_charm_4", 3) },
  // Eclipse Tonic
  { id: "eclipse_tonic_1", cost: E([{ type: "solar", amount: 4 }, { type: "lunar", amount: 4 }]) },
  { id: "eclipse_tonic_2", cost: U("eclipse_tonic_1", 2) },
  { id: "eclipse_tonic_3", cost: U("eclipse_tonic_2", 2) },
  { id: "eclipse_tonic_4", cost: U("eclipse_tonic_3", 2) },
  { id: "eclipse_tonic_5", cost: U("eclipse_tonic_4", 2) },
  // Purity Vial
  { id: "purity_vial_1", cost: E([{ type: "arcane", amount: 4 }, { type: "frost", amount: 4 }]) },
  { id: "purity_vial_2", cost: U("purity_vial_1", 2) },
  { id: "purity_vial_3", cost: U("purity_vial_2", 2) },
  { id: "purity_vial_4", cost: U("purity_vial_3", 2) },
  { id: "purity_vial_5", cost: U("purity_vial_4", 2) },
  // Giant Vial
  { id: "giant_vial_1", cost: E([{ type: "grove", amount: 4 }, { type: "storm", amount: 4 }]) },
  { id: "giant_vial_2", cost: U("giant_vial_1", 2) },
  { id: "giant_vial_3", cost: U("giant_vial_2", 2) },
  { id: "giant_vial_4", cost: U("giant_vial_3", 2) },
  { id: "giant_vial_5", cost: U("giant_vial_4", 2) },
  // Frost Vial
  { id: "frost_vial_1", cost: E([{ type: "frost", amount: 8 }]) },
  { id: "frost_vial_2", cost: U("frost_vial_1", 2) },
  { id: "frost_vial_3", cost: U("frost_vial_2", 2) },
  { id: "frost_vial_4", cost: U("frost_vial_3", 2) },
  { id: "frost_vial_5", cost: U("frost_vial_4", 2) },
  // Ember Vial
  { id: "ember_vial_1", cost: E([{ type: "blaze", amount: 8 }]) },
  { id: "ember_vial_2", cost: U("ember_vial_1", 2) },
  { id: "ember_vial_3", cost: U("ember_vial_2", 2) },
  { id: "ember_vial_4", cost: U("ember_vial_3", 2) },
  { id: "ember_vial_5", cost: U("ember_vial_4", 2) },
  // Storm Vial
  { id: "storm_vial_1", cost: E([{ type: "storm", amount: 8 }]) },
  { id: "storm_vial_2", cost: U("storm_vial_1", 2) },
  { id: "storm_vial_3", cost: U("storm_vial_2", 2) },
  { id: "storm_vial_4", cost: U("storm_vial_3", 2) },
  { id: "storm_vial_5", cost: U("storm_vial_4", 2) },
  // Moon Vial
  { id: "moon_vial_1", cost: E([{ type: "lunar", amount: 8 }, { type: "arcane", amount: 4 }]) },
  { id: "moon_vial_2", cost: U("moon_vial_1", 2) },
  { id: "moon_vial_3", cost: U("moon_vial_2", 2) },
  { id: "moon_vial_4", cost: U("moon_vial_3", 2) },
  { id: "moon_vial_5", cost: U("moon_vial_4", 2) },
  // Golden Vial
  { id: "golden_vial_1", cost: E([{ type: "solar", amount: 8 }, { type: "stellar", amount: 8 }]) },
  { id: "golden_vial_2", cost: U("golden_vial_1", 2) },
  { id: "golden_vial_3", cost: U("golden_vial_2", 2) },
  { id: "golden_vial_4", cost: U("golden_vial_3", 2) },
  { id: "golden_vial_5", cost: U("golden_vial_4", 2) },
  // Rainbow Vial
  { id: "rainbow_vial_1", cost: E([{ type: "universal", amount: 2 }]) },
  { id: "rainbow_vial_2", cost: U("rainbow_vial_1", 2) },
  { id: "rainbow_vial_3", cost: U("rainbow_vial_2", 2) },
  { id: "rainbow_vial_4", cost: U("rainbow_vial_3", 2) },
  { id: "rainbow_vial_5", cost: U("rainbow_vial_4", 2) },
  // Magnifying Glass
  { id: "magnifying_glass", cost: E([{ type: "arcane", amount: 1 }, { type: "stellar", amount: 1 }]) },
  // Verdant Rush
  { id: "verdant_rush_1", cost: E([{ type: "grove", amount: 4 }, { type: "zephyr", amount: 4 }]) },
  { id: "verdant_rush_2", cost: U("verdant_rush_1", 2) },
  { id: "verdant_rush_3", cost: U("verdant_rush_2", 2) },
  { id: "verdant_rush_4", cost: U("verdant_rush_3", 2) },
  { id: "verdant_rush_5", cost: U("verdant_rush_4", 2) },
  // Forge Haste
  { id: "forge_haste_1", cost: E([{ type: "blaze", amount: 4 }, { type: "storm", amount: 4 }]) },
  { id: "forge_haste_2", cost: U("forge_haste_1", 2) },
  { id: "forge_haste_3", cost: U("forge_haste_2", 2) },
  { id: "forge_haste_4", cost: U("forge_haste_3", 2) },
  { id: "forge_haste_5", cost: U("forge_haste_4", 2) },
  // Resonance Draft
  { id: "resonance_draft_1", cost: E([{ type: "stellar", amount: 4 }, { type: "arcane", amount: 4 }]) },
  { id: "resonance_draft_2", cost: U("resonance_draft_1", 2) },
  { id: "resonance_draft_3", cost: U("resonance_draft_2", 2) },
  { id: "resonance_draft_4", cost: U("resonance_draft_3", 2) },
  { id: "resonance_draft_5", cost: U("resonance_draft_4", 2) },
  // Wind Shear / Slot Lock / Garden Pin (non-tiered)
  { id: "wind_shear",      cost: E([{ type: "zephyr", amount: 16 }, { type: "storm", amount: 16 }]) },
  { id: "slot_lock",       cost: E([{ type: "arcane", amount: 4 }, { type: "stellar", amount: 4 }]) },
  { id: "garden_pin",      cost: E([{ type: "arcane", amount: 4 }, { type: "fairy",   amount: 4 }]) },
  // Generic Seed Pouches (I–V)
  { id: "seed_pouch_1", cost: E([{ type: "universal", amount: 1 }]) },
  { id: "seed_pouch_2", cost: U("seed_pouch_1", 3) },
  { id: "seed_pouch_3", cost: U("seed_pouch_2", 3) },
  { id: "seed_pouch_4", cost: U("seed_pouch_3", 3) },
  { id: "seed_pouch_5", cost: U("seed_pouch_4", 3) },
];

// Typed Seed Pouches (12 element types × 5 tiers = 60 recipes)
for (const t of ["blaze","tide","grove","frost","storm","lunar","solar","fairy","shadow","arcane","stellar","zephyr"]) {
  for (let tier = 1; tier <= 5; tier++) {
    CONSUMABLE_RECIPES.push({
      id: `seed_pouch_${t}_${tier}`,
      cost: tier === 1
        ? E([{ type: t, amount: 16 }])
        : U(`seed_pouch_${t}_${tier - 1}`, 3),
    });
  }
}

const CONSUMABLE_RECIPE_MAP = Object.fromEntries(CONSUMABLE_RECIPES.map((r) => [r.id, r]));

const ATTUNEMENT_RECIPES: AttunementRecipeDef[] = [
  { tier: 1, rarity: "rare",      cost: { kind: "essence",    amounts: [{ type: "universal", amount: 3 }] } },
  { tier: 2, rarity: "legendary", cost: { kind: "attunement", tier: 1, quantity: 3 } },
  { tier: 3, rarity: "mythic",    cost: { kind: "attunement", tier: 2, quantity: 3 } },
  { tier: 4, rarity: "exalted",   cost: { kind: "attunement", tier: 3, quantity: 3 } },
  { tier: 5, rarity: "prismatic", cost: { kind: "attunement", tier: 4, quantity: 3 } },
];

// ── Handlers ─────────────────────────────────────────────────────────────────

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

    const body = await req.json() as { craftType: string; id?: string };
    const { craftType, id } = body;

    if (!craftType || !["consumable", "attunement"].includes(craftType)) {
      return new Response(JSON.stringify({ error: "Invalid craftType" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin
        .from("game_saves")
        .select("essences, consumables, infusers, gardener_level, gardener_xp, updated_at") // "infusers" is the DB column name for attunements
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

    const save          = saveResult.data;
    const priorUpdatedAt = save.updated_at as string;
    const gardenerLevel = (save.gardener_level as number) ?? 1;
    const gardenerXp    = (save.gardener_xp    as number) ?? 0;

    let essences:    { type: string; amount: number }[]    = (save.essences    ?? []) as { type: string; amount: number }[];
    let consumables: { id: string;   quantity: number }[]  = (save.consumables ?? []) as { id: string;   quantity: number }[];
    // "infusers" DB column stores attunement crystals (renamed in app layer)
    let attunements: { rarity: string; quantity: number }[] = (save.infusers ?? []) as { rarity: string; quantity: number }[];

    // ── Craft consumable ────────────────────────────────────────────────────
    if (craftType === "consumable") {
      if (!id) {
        return new Response(JSON.stringify({ error: "id required for consumable craft" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const recipe = CONSUMABLE_RECIPE_MAP[id];
      if (!recipe) {
        return new Response(JSON.stringify({ error: `Unknown consumable: ${id}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { cost } = recipe;
      if (cost.kind === "essence") {
        for (const { type, amount } of cost.amounts) {
          const have = essences.find((e) => e.type === type)?.amount ?? 0;
          if (have < amount) {
            return new Response(JSON.stringify({ error: `Not enough ${type} essence` }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        for (const { type, amount } of cost.amounts) {
          essences = essences
            .map((e) => e.type === type ? { ...e, amount: e.amount - amount } : e)
            .filter((e) => e.amount > 0);
        }
      } else {
        const have = consumables.find((c) => c.id === cost.id)?.quantity ?? 0;
        if (have < cost.quantity) {
          return new Response(JSON.stringify({ error: `Not enough ${cost.id}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        consumables = consumables
          .map((c) => c.id === cost.id ? { ...c, quantity: c.quantity - cost.quantity } : c)
          .filter((c) => c.quantity > 0);
      }

      const existingIdx = consumables.findIndex((c) => c.id === id);
      consumables = existingIdx >= 0
        ? consumables.map((c, i) => i === existingIdx ? { ...c, quantity: c.quantity + 1 } : c)
        : [...consumables, { id, quantity: 1 }];
    }

    // ── Craft attunement crystal ────────────────────────────────────────────
    if (craftType === "attunement") {
      const tier = typeof id === "string" ? parseInt(id, 10) : NaN;
      const recipe = ATTUNEMENT_RECIPES.find((r) => r.tier === tier);
      if (!recipe) {
        return new Response(JSON.stringify({ error: `Unknown attunement tier: ${id}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { cost } = recipe;
      if (cost.kind === "essence") {
        for (const { type, amount } of cost.amounts) {
          const have = essences.find((e) => e.type === type)?.amount ?? 0;
          if (have < amount) {
            return new Response(JSON.stringify({ error: `Not enough ${type} essence` }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        for (const { type, amount } of cost.amounts) {
          essences = essences
            .map((e) => e.type === type ? { ...e, amount: e.amount - amount } : e)
            .filter((e) => e.amount > 0);
        }
      } else {
        const prevRarity = TIER_RARITIES[cost.tier];
        const have = attunements.find((i) => i.rarity === prevRarity)?.quantity ?? 0;
        if (have < cost.quantity) {
          return new Response(JSON.stringify({ error: `Not enough Attunement ${cost.tier}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        attunements = attunements
          .map((i) => i.rarity === prevRarity ? { ...i, quantity: i.quantity - cost.quantity } : i)
          .filter((i) => i.quantity > 0);
      }

      const existingIdx = attunements.findIndex((i) => i.rarity === recipe.rarity);
      attunements = existingIdx >= 0
        ? attunements.map((i, idx) => idx === existingIdx ? { ...i, quantity: i.quantity + 1 } : i)
        : [...attunements, { rarity: recipe.rarity, quantity: 1 }];
    }

    const xpGained = craftType === "attunement"
      ? (DISCOVERY_XP_BY_RARITY[ATTUNEMENT_RECIPES.find((r) => r.tier === parseInt(id!, 10))?.rarity ?? ""] ?? 0)
      : 25;
    const { level: newLevel, xp: newXp, leveledUp, levelsGained } = awardXp(gardenerLevel, gardenerXp, xpGained);

    // ── Write ────────────────────────────────────────────────────────────────
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({
        essences,
        consumables,
        infusers:       attunements,
        gardener_level: newLevel,
        gardener_xp:    newXp,
        updated_at:     new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (updateError || !updateData) {
      return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({
      user_id: userId,
      action:  "alchemy_craft",
      payload: { craftType, id },
      result:  { essences, consumables, attunements },
    });

    return new Response(
      JSON.stringify({
        ok:              true,
        essences,
        consumables,
        infusers:        attunements,
        xpGained,
        gardenerLevel:   newLevel,
        gardenerXp:      newXp,
        leveledUp,
        levelsGained,
        serverUpdatedAt: updateData.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("alchemy-craft error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
