import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addOrIncrement, rollMutation, type InvItem } from "../_shared/alchemyAttuneData.ts";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { awardXp } from "../_shared/gardenerLevel.ts";

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

interface AttunementQueueEntry {
  id:           string;
  speciesId:    string;
  // Mutation field is intentionally absent — rolled at collect time so the
  // player doesn't know the outcome until the attunement finishes. Older
  // entries (created before this change) may carry a `mutation` field; we
  // honor it as a fallback so in-flight queues at deploy time still resolve.
  mutation?:    string;
  tier:         number;
  startedAt:    string;
  durationMs:   number;
  flowerCount:  number;
  flowerSourceMutation?: string;
}

Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      userId = JSON.parse(atob(b64url(token.split(".")[1]))).sub;
    } catch {
      return err("Unauthorized", 401);
    }

    const { attunementId } = await req.json() as { attunementId?: string };
    if (!attunementId) return err("attunementId is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves")
        .select("inventory, discovered, attunement_queue, gardener_level, gardener_xp, updated_at")
        .eq("user_id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return err("Unauthorized", 401);
    }
    if (saveResult.error || !saveResult.data) return err("Save not found", 404);

    const save           = saveResult.data;
    const priorUpdatedAt = save.updated_at as string;
    const gardenerLevel  = (save.gardener_level as number) ?? 1;
    const gardenerXp     = (save.gardener_xp    as number) ?? 0;
    const inventory      = (save.inventory  ?? []) as InvItem[];
    const discovered     = (save.discovered ?? []) as string[];
    const queue          = (save.attunement_queue ?? []) as AttunementQueueEntry[];

    const entry = queue.find((e) => e.id === attunementId);
    if (!entry) return err("Attunement not found", 404);

    // ── Validate completion ────────────────────────────────────────────────
    const finishedAt = new Date(entry.startedAt).getTime() + entry.durationMs;
    if (Date.now() < finishedAt) {
      const remainingMs = finishedAt - Date.now();
      return err(`Attunement not finished yet (${Math.ceil(remainingMs / 1000)}s remaining)`);
    }

    // ── Roll the mutation NOW (deferred from start so the outcome stays
    //    a surprise until the player actually collects). Legacy entries
    //    may have it pre-rolled — use that to be safe.
    const mutation = entry.mutation ?? rollMutation(entry.tier as 1 | 2 | 3 | 4);

    // ── Deliver mutated bloom(s) ───────────────────────────────────────────
    let newInventory = inventory;
    for (let i = 0; i < entry.flowerCount; i++) {
      newInventory = addOrIncrement(newInventory, entry.speciesId, mutation);
    }

    // ── Update discovered ──────────────────────────────────────────────────
    const mutKey = `${entry.speciesId}::${mutation}`;
    const newDiscovered = discovered.includes(mutKey)
      ? discovered
      : [...discovered, mutKey];

    // ── Remove from queue ──────────────────────────────────────────────────
    const newQueue = queue.filter((e) => e.id !== attunementId);

    const ATTUNE_XP: Record<number, number> = { 1: 50, 2: 100, 3: 200, 4: 500 };
    const xpGained = ATTUNE_XP[entry.tier] ?? 0;
    const { level: newLevel, xp: newXp, leveledUp, levelsGained } = awardXp(gardenerLevel, gardenerXp, xpGained);

    // ── CAS write ──────────────────────────────────────────────────────────
    const { data: ud, error: ue } = await supabaseAdmin
      .from("game_saves")
      .update({
        inventory:        newInventory,
        discovered:       newDiscovered,
        attunement_queue: newQueue,
        gardener_level:   newLevel,
        gardener_xp:      newXp,
        updated_at:       new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (ue || !ud) return err("Save was modified by another action — please retry", 409);

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "attune_collect",
      payload: { attunementId, speciesId: entry.speciesId, mutation, flowerCount: entry.flowerCount },
    });

    return json({
      ok:               true,
      inventory:        newInventory,
      discovered:       newDiscovered,
      attunementQueue:  newQueue,
      mutation,
      tier:             entry.tier,
      xpGained,
      gardenerLevel:   newLevel,
      gardenerXp:      newXp,
      leveledUp,
      levelsGained,
      serverUpdatedAt:  ud.updated_at,
    });

  } catch (e) {
    console.error("attune-collect error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
