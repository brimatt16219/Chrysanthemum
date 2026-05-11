import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { awardXp } from "../_shared/gardenerLevel.ts";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { ACHIEVEMENT_DATA, CROSSBREED_RECIPE_IDS } from "../_shared/achievementData.ts";

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
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const err = (msg: string, status = 400) => json({ error: msg }, status);

Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      userId = JSON.parse(atob(b64url(token.split(".")[1]))).sub;
    } catch {
      return err("Unauthorized", 401);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const { achievementId } = await req.json() as { achievementId?: string };
    if (!achievementId) return err("achievementId is required");

    // ── Look up achievement definition ────────────────────────────────────────
    const def = ACHIEVEMENT_DATA[achievementId];
    if (!def) return err("Achievement not found");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin
        .from("game_saves")
        .select("achievement_stats, achievements_claimed, gardener_level, gardener_xp, gems, discovered, discovered_recipes, updated_at")
        .eq("user_id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return err("Unauthorized", 401);
    }
    if (saveResult.error || !saveResult.data) return err("Save not found", 404);

    const save             = saveResult.data;
    const priorUpdatedAt   = save.updated_at         as string;
    const gardenerLevel    = (save.gardener_level     as number)           ?? 1;
    const gardenerXp       = (save.gardener_xp        as number)           ?? 0;
    const gems             = (save.gems               as number)           ?? 0;
    const achievementStats = (save.achievement_stats  as Record<string, number>) ?? {};
    const claimed          = (save.achievements_claimed as string[])       ?? [];
    const discovered       = (save.discovered          as string[])        ?? [];
    const discoveredRecipes= (save.discovered_recipes  as string[])        ?? [];

    // ── Guard: already claimed ────────────────────────────────────────────────
    if (claimed.includes(achievementId)) return err("Achievement already claimed", 409);

    // ── Validate progress ─────────────────────────────────────────────────────
    const { check, target } = def;
    let met = false;

    if (check.kind === "stat") {
      met = (achievementStats[check.statKey] ?? 0) >= target;

    } else if (check.kind === "species_discovered") {
      // discovered[] entries are "speciesId" or "speciesId:mutation" — each unique
      // entry counts as one species/variant discovered.
      met = discovered.length >= target;

    } else if (check.kind === "recipe_completed") {
      met = discoveredRecipes.includes(check.recipeId);

    } else if (check.kind === "all_recipes_completed") {
      met = CROSSBREED_RECIPE_IDS.every((id) => discoveredRecipes.includes(id));

    } else if (check.kind === "friends_count") {
      // Count accepted friendships where this user is either side.
      const { count } = await supabaseAdmin
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "accepted");
      met = (count ?? 0) >= target;
    }

    if (!met) return err("Achievement progress not met", 409);

    // ── Award XP + gems ───────────────────────────────────────────────────────
    const { level: newLevel, xp: newXp, leveledUp, levelsGained } =
      awardXp(gardenerLevel, gardenerXp, def.xp);
    const newGems    = gems + def.gems;
    const newClaimed = [...claimed, achievementId];

    // ── CAS write with retry ──────────────────────────────────────────────────
    // Auto-save can change updated_at between our SELECT and UPDATE, causing a
    // spurious 409. Retry up to 3 times: re-read the latest timestamp and try
    // again, aborting early if the achievement was already claimed concurrently.
    let ud: { updated_at: string } | null = null;
    let priorAt = priorUpdatedAt;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabaseAdmin
        .from("game_saves")
        .update({
          achievements_claimed: newClaimed,
          gardener_level:       newLevel,
          gardener_xp:          newXp,
          gems:                 newGems,
          updated_at:           new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("updated_at", priorAt)
        .select("updated_at")
        .single();

      if (!error && data) { ud = data; break; }

      // CAS failed — re-read the latest save before retrying
      if (attempt < 2) {
        const { data: fresh } = await supabaseAdmin
          .from("game_saves")
          .select("achievements_claimed, updated_at")
          .eq("user_id", userId)
          .single();
        if (!fresh) break;
        // A concurrent request already claimed this achievement
        if ((fresh.achievements_claimed as string[] ?? []).includes(achievementId)) {
          return err("Achievement already claimed", 409);
        }
        priorAt = fresh.updated_at as string;
      }
    }

    if (!ud) return err("Save conflict — please retry", 409);

    // ── Audit log ─────────────────────────────────────────────────────────────
    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "achievement_claim",
      payload: { achievementId, xpGained: def.xp, gemsGained: def.gems },
    });

    return json({
      ok:                  true,
      xpGained:            def.xp,
      gemsGained:          def.gems,
      gardenerLevel:       newLevel,
      gardenerXp:          newXp,
      leveledUp,
      levelsGained,
      gems:                newGems,
      achievementsClaimed: newClaimed,
      serverUpdatedAt:     ud.updated_at,
    });

  } catch (e) {
    console.error("achievement-claim error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
