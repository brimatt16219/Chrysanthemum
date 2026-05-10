import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { awardXp } from "../_shared/gardenerLevel.ts";
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

interface QuestDef {
  id:              string;
  name:            string;
  rarity:          string;
  type:            string;
  mutation:        string | null;
  gems:            number;
  xp:              number;
  validSpeciesIds: string[];
}

interface InventoryItem {
  speciesId: string;
  isSeed:    boolean;
  mutation:  string | null;
  quantity:  number;
}

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
    const { eventId, questId, speciesId, mutation } =
      await req.json() as { eventId?: string; questId?: string; speciesId?: string; mutation?: string | null };
    if (!eventId)   return err("eventId is required");
    if (!questId)   return err("questId is required");
    if (!speciesId) return err("speciesId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verify auth ───────────────────────────────────────────────────────────
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user || user.id !== userId) return err("Unauthorized", 401);

    // ── Load + validate event ─────────────────────────────────────────────────
    const event = await loadEvent(supabase, eventId);
    if (event.type !== "collection") return err("Event is not a collection event");

    // ── Resolve quest ─────────────────────────────────────────────────────────
    const quests     = event.config.quests as QuestDef[];
    const questIndex = quests.findIndex((q) => q.id === questId);
    if (questIndex < 0) return err("Quest not found");
    const quest = quests[questIndex];

    // ── Load progress + enforce sequential order ───────────────────────────────
    const progress        = await loadProgress(supabase, userId, eventId);
    const completedQuests = progress.completedQuests ?? [];
    const claimedRewards  = progress.claimedRewards  ?? [];

    if (completedQuests.includes(questId)) return err("Quest already completed", 409);

    const prevIncomplete = quests
      .slice(0, questIndex)
      .some((q) => !completedQuests.includes(q.id));
    if (prevIncomplete) return err("Complete previous quests first", 409);

    // ── Load game_saves ───────────────────────────────────────────────────────
    const { data: save, error: se } = await supabase
      .from("game_saves")
      .select("inventory, gems, gardener_level, gardener_xp, updated_at")
      .eq("user_id", userId)
      .single();
    if (se || !save) return err("Save not found", 404);

    const inventory      = [...((save.inventory      as InventoryItem[]) ?? [])];
    const priorUpdatedAt = save.updated_at    as string;
    const gems           = (save.gems         as number) ?? 0;
    const gardenerLevel  = (save.gardener_level as number) ?? 1;
    const gardenerXp     = (save.gardener_xp   as number) ?? 0;

    // ── Validate submitted flower ─────────────────────────────────────────────
    // speciesId must be in the quest's allow-list (validates rarity + type server-side)
    if (!quest.validSpeciesIds.includes(speciesId)) {
      return err("This flower does not meet the quest requirement");
    }

    // mutation must match quest requirement (null = any mutation accepted)
    const submittedMutation = mutation ?? null;
    if (quest.mutation !== null && submittedMutation !== quest.mutation) {
      return err("Flower mutation does not match quest requirement");
    }

    // Player must have at least 1 matching bloom in inventory
    const itemIdx = inventory.findIndex((i) =>
      !i.isSeed &&
      i.speciesId === speciesId &&
      i.mutation  === submittedMutation &&
      i.quantity  > 0,
    );
    if (itemIdx < 0) return err("Matching flower not found in inventory", 409);

    // ── Deduct flower ─────────────────────────────────────────────────────────
    const item = inventory[itemIdx];
    if (item.quantity === 1) {
      inventory.splice(itemIdx, 1);
    } else {
      inventory[itemIdx] = { ...item, quantity: item.quantity - 1 };
    }

    // ── Award XP + gems ───────────────────────────────────────────────────────
    const { level: newLevel, xp: newXp } = awardXp(gardenerLevel, gardenerXp, quest.xp);
    const newGems = gems + quest.gems;

    // ── Final reward — deliver exclusive seed if this is the last quest ────────
    const isLastQuest           = questIndex === quests.length - 1;
    let   finalRewardDelivered  = false;

    if (isLastQuest) {
      const finalReward = event.config.finalReward as { speciesId: string };
      const seedIdx     = inventory.findIndex((i) => i.isSeed && i.speciesId === finalReward.speciesId);
      if (seedIdx >= 0) {
        inventory[seedIdx] = { ...inventory[seedIdx], quantity: inventory[seedIdx].quantity + 1 };
      } else {
        inventory.push({ speciesId: finalReward.speciesId, isSeed: true, mutation: null, quantity: 1 });
      }
      finalRewardDelivered = true;
    }

    // ── CAS write to game_saves ───────────────────────────────────────────────
    const { data: ud, error: ue } = await supabase
      .from("game_saves")
      .update({
        inventory:      inventory,
        gems:           newGems,
        gardener_level: newLevel,
        gardener_xp:    newXp,
        updated_at:     new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();
    if (ue || !ud) return err("Save conflict — please retry", 409);

    // ── Persist progress ──────────────────────────────────────────────────────
    const newProgress = {
      ...progress,
      completedQuests: [...completedQuests, questId],
      claimedRewards:  [...claimedRewards,  questId],
    };
    await saveProgress(supabase, userId, eventId, newProgress);

    // ── Audit log ─────────────────────────────────────────────────────────────
    void supabase.from("action_log").insert({
      user_id: userId, action: "event_quest_submit",
      payload: { eventId, questId, speciesId, mutation: submittedMutation, gemsGained: quest.gems, xpGained: quest.xp, finalRewardDelivered },
    });

    return json({
      ok:                   true,
      questId,
      gemsGained:           quest.gems,
      xpGained:             quest.xp,
      finalRewardDelivered,
      inventory,
      progress:             newProgress,
      gardenerLevel:        newLevel,
      gardenerXp:           newXp,
      gems:                 newGems,
      serverUpdatedAt:      ud.updated_at,
    });

  } catch (e) {
    if (typeof e === "string") return err(e);
    console.error("event-quest-submit error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});