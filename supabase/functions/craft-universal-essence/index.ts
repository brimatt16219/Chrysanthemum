import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { awardXp } from "../_shared/gardenerLevel.ts";

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

// ── Constants ─────────────────────────────────────────────────────────────────

/** All 12 elemental types — must match ALL_FLOWER_TYPES in src/data/essences.ts */
const ALL_FLOWER_TYPES = [
  "blaze", "tide", "grove", "frost", "storm", "lunar",
  "solar", "fairy", "shadow", "arcane", "stellar", "zephyr",
] as const;

/** Cost per type per Universal Essence crafted — mirrors UNIVERSAL_ESSENCE_COST_PER_TYPE */
const COST_PER_TYPE = 1;

// ── Types ─────────────────────────────────────────────────────────────────────

type EssenceItem = { type: string; amount: number };

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

    const { quantity } = await req.json() as { quantity: number };

    if (typeof quantity !== "number" || quantity < 1 || !Number.isInteger(quantity)) {
      return err("quantity must be a positive integer");
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
        .select("essences, gardener_level, gardener_xp, updated_at")
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
    const gardenerLevel  = (save.gardener_level as number) ?? 1;
    const gardenerXp     = (save.gardener_xp    as number) ?? 0;
    const essences       = (save.essences ?? []) as EssenceItem[];

    // ── Validate — must have enough of each type ──────────────────────────────

    const totalCost = COST_PER_TYPE * quantity;

    for (const type of ALL_FLOWER_TYPES) {
      const have = essences.find((e) => e.type === type)?.amount ?? 0;
      if (have < totalCost) {
        return err(`Not enough ${type} essence (have ${have}, need ${totalCost})`);
      }
    }

    // ── Apply changes ─────────────────────────────────────────────────────────

    // Build a mutable map
    const map = new Map<string, number>(essences.map((e) => [e.type, e.amount]));

    // Deduct from each elemental type
    for (const type of ALL_FLOWER_TYPES) {
      map.set(type, (map.get(type) ?? 0) - totalCost);
    }

    // Add to universal
    map.set("universal", (map.get("universal") ?? 0) + quantity);

    // Serialise back to array, drop zeroes
    const newEssences: EssenceItem[] = Array.from(map.entries())
      .map(([type, amount]) => ({ type, amount }))
      .filter((e) => e.amount > 0);

    const xpGained = 250 * quantity;
    const { level: newLevel, xp: newXp, leveledUp, levelsGained } = awardXp(gardenerLevel, gardenerXp, xpGained);
    // ── CAS write ─────────────────────────────────────────────────────────────

    const { data: ud, error: ue } = await supabaseAdmin
      .from("game_saves")
      .update({
        essences:       newEssences,
        gardener_level: newLevel,
        gardener_xp:    newXp,
        updated_at:     new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (ue || !ud) return err("Save conflict — please retry", 409);

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "craft_universal_essence",
      payload: { quantity },
      result:  { newUniversalTotal: map.get("universal") ?? 0 },
    });

    return json({
      ok:              true,
      essences:        newEssences,
      xpGained,
      gardenerLevel:   newLevel,
      gardenerXp:      newXp,
      leveledUp,
      levelsGained,
      serverUpdatedAt: ud.updated_at,
    });

  } catch (e) {
    console.error("craft-universal-essence error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
