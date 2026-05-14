import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { awardXp } from "../_shared/gardenerLevel.ts";
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const err = (msg: string, status = 400) => json({ error: msg }, status);

// ── Reward tiers (indexed 0–3 by completion count) ───────────────────────────
const DAILY_REWARDS = [
  { xp:  50, gems: 10 },
  { xp:  75, gems: 15 },
  { xp: 100, gems: 20 },
  { xp: 200, gems: 35 },
] as const;

const TASKS_REQUIRED = 4;

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DailyTask {
  type:      string;
  target:    number;
  progress:  number;
  completed: boolean;
}

interface DailyTaskState {
  date:             string;
  tasks:            DailyTask[];
  rewardsCollected: boolean[];
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

    const { taskType } = await req.json() as { taskType?: string };
    if (!taskType) return err("taskType is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves")
        .select("daily_tasks, gems, gardener_level, gardener_xp, updated_at")
        .eq("user_id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return err("Unauthorized", 401);
    }
    if (saveResult.error || !saveResult.data) return err("Save not found", 404);

    const save           = saveResult.data;
    const priorUpdatedAt = save.updated_at      as string;
    const gardenerLevel  = (save.gardener_level as number) ?? 1;
    const gardenerXp     = (save.gardener_xp    as number) ?? 0;
    const dailyTasks     = (save.daily_tasks     ?? {})  as Partial<DailyTaskState>;
    const gems           = (save.gems            as number) ?? 0;

    // ── Validate daily state is fresh ─────────────────────────────────────────
    const today = utcDateString();
    if (!dailyTasks.date || dailyTasks.date !== today) {
      return err("Daily tasks are stale — refresh your tasks first", 409);
    }

    const tasks            = dailyTasks.tasks            ?? [];
    const rewardsCollected = dailyTasks.rewardsCollected ?? [false, false, false, false];

    // ── Find and validate the task ────────────────────────────────────────────
    const taskIdx = tasks.findIndex((t) => t.type === taskType);
    if (taskIdx < 0)              return err("Task not found in today's daily tasks");
    if (tasks[taskIdx].completed) return err("Task already completed");

    // ── Mark task complete ────────────────────────────────────────────────────
    const newTasks    = [...tasks];
    newTasks[taskIdx] = { ...newTasks[taskIdx], progress: newTasks[taskIdx].target, completed: true };

    const completedCount = newTasks.filter((t) => t.completed).length;

    // ── No new reward tier crossed — save progress only ───────────────────────
    const tierIdx = completedCount - 1;
    if (tierIdx >= TASKS_REQUIRED || rewardsCollected[tierIdx]) {
      const newDailyTasks: DailyTaskState = { date: today, tasks: newTasks, rewardsCollected };
      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({ daily_tasks: newDailyTasks, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();
      if (ue || !ud) return err("Save conflict — please retry", 409);
      return json({ ok: true, dailyTasks: newDailyTasks, serverUpdatedAt: ud.updated_at });
    }

    // ── Grant tier reward ─────────────────────────────────────────────────────
    const reward              = DAILY_REWARDS[tierIdx];
    const newRewardsCollected = [...rewardsCollected] as boolean[];
    newRewardsCollected[tierIdx] = true;

    const { level: newLevel, xp: newXp, leveledUp, levelsGained } = awardXp(gardenerLevel, gardenerXp, reward.xp);
    const newGems = gems + reward.gems;
    const newDailyTasks: DailyTaskState = { date: today, tasks: newTasks, rewardsCollected: newRewardsCollected };

    // ── CAS write ─────────────────────────────────────────────────────────────
    const { data: ud, error: ue } = await supabaseAdmin
      .from("game_saves")
      .update({
        daily_tasks:    newDailyTasks,
        gardener_level: newLevel,
        gardener_xp:    newXp,
        gems:           newGems,
        updated_at:     new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (ue || !ud) return err("Save conflict — please retry", 409);

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: "daily_complete",
      payload: { taskType, tier: tierIdx + 1, xpGained: reward.xp, gemsGained: reward.gems },
    });

    return json({
      ok:              true,
      dailyTasks:      newDailyTasks,
      xpGained:        reward.xp,
      gardenerLevel:   newLevel,
      gardenerXp:      newXp,
      leveledUp,
      levelsGained,
      gemsGained:      reward.gems,
      gems:            newGems,
      serverUpdatedAt: ud.updated_at,
    });

  } catch (e) {
    console.error("daily-complete error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
