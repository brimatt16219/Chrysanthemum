import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { loadEvent, loadProgress, saveProgress } from "../_shared/eventHelpers.ts";

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
    const { eventId } = await req.json() as { eventId?: string };
    if (!eventId) return err("eventId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verify auth ───────────────────────────────────────────────────────────
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user || user.id !== userId) return err("Unauthorized", 401);

    // ── Load + validate event ─────────────────────────────────────────────────
    // loadEvent throws a plain string if event not found or not active —
    // caught below and returned as a 400.
    const event = await loadEvent(supabase, eventId);
    if (event.type !== "checkin") return err("Event is not a check-in event");

    // ── Load progress ─────────────────────────────────────────────────────────
    const progress    = await loadProgress(supabase, userId, eventId);
    const claimedDays = progress.claimedDays ?? [];

    // ── Guard: already claimed today (UTC date boundary) ──────────────────────
    const today = new Date().toISOString().slice(0, 10);
    if (progress.lastClaimedAt) {
      const lastDate = new Date(progress.lastClaimedAt).toISOString().slice(0, 10);
      if (lastDate === today) return err("Already claimed today — come back tomorrow", 409);
    }

    // ── Compute next day + reward ─────────────────────────────────────────────
    const days    = event.config.days as Array<{ day: number; gems: number }>;
    const nextDay = claimedDays.length + 1;
    if (nextDay > days.length) return err("All check-in rewards already claimed", 409);

    const reward = days[nextDay - 1];
    if (!reward) return err("Reward not found for this day");

    // ── Load game_saves ───────────────────────────────────────────────────────
    const { data: save, error: se } = await supabase
      .from("game_saves")
      .select("gems, updated_at")
      .eq("user_id", userId)
      .single();
    if (se || !save) return err("Save not found", 404);

    const priorUpdatedAt = save.updated_at as string;
    const newGems        = ((save.gems as number) ?? 0) + reward.gems;

    // ── CAS write to game_saves ───────────────────────────────────────────────
    const { data: ud, error: ue } = await supabase
      .from("game_saves")
      .update({ gems: newGems, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();
    if (ue || !ud) return err("Save conflict — please retry", 409);

    // ── Persist progress ──────────────────────────────────────────────────────
    const newProgress = {
      ...progress,
      claimedDays:   [...claimedDays, nextDay],
      lastClaimedAt: new Date().toISOString(),
    };
    await saveProgress(supabase, userId, eventId, newProgress);

    // ── Audit log ─────────────────────────────────────────────────────────────
    void supabase.from("action_log").insert({
      user_id: userId, action: "event_checkin_claim",
      payload: { eventId, day: nextDay, gemsGained: reward.gems },
    });

    return json({
      ok:              true,
      claimedDay:      nextDay,
      gemsGained:      reward.gems,
      gems:            newGems,
      progress:        newProgress,
      serverUpdatedAt: ud.updated_at,
    });

  } catch (e) {
    // loadEvent throws plain strings for known errors (event not found, not active)
    if (typeof e === "string") return err(e);
    console.error("event-checkin-claim error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});