import { useState, useMemo } from "react";
import { useGame } from "../store/GameContext";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORY_META,
  type AchievementCategory,
  type Achievement,
} from "../data/achievements";
import { edgeAchievementClaim } from "../lib/edgeFunctions";
import { audioManager } from "../lib/audioManager";

// ── Category display order ─────────────────────────────────────────────────────

const CATEGORY_ORDER: AchievementCategory[] = [
  "harvest", "seeds", "sacrifice", "attunement",
  "shopping", "crafting_consumable", "crafting_gear",
  "pouches", "fertilizers", "consumables_used",
  "gear_placed", "daily", "discovery", "crossbreeding", "social",
];

// ── Component ──────────────────────────────────────────────────────────────────

export function AchievementsPanel() {
  const { state, update, getState, pushGenericToast, saveGridNow } = useGame();

  const [activeCategory, setActiveCategory] = useState<AchievementCategory>("harvest");
  const [claiming,       setClaiming]       = useState<string | null>(null);
  const [claimError,     setClaimError]     = useState<string | null>(null);

  // ── Derived values ───────────────────────────────────────────────────────────

  /** Unique non-seed species in inventory. */
  const speciesDiscovered = useMemo(() =>
    new Set(state.inventory.filter((i) => !i.isSeed).map((i) => i.speciesId)).size,
    [state.inventory],
  );

  /** IDs of all per-recipe crossbreed achievements (used to compute all_recipes progress). */
  const recipeAchIds = useMemo(() =>
    ACHIEVEMENTS
      .filter((a) => a.check.kind === "recipe_completed")
      .map((a) => a.id),
    [],
  );

  /** Pre-computed { current, target } for every achievement — drives both the
   *  list rows and the claimable badge counts on tabs. */
  const allProgress = useMemo(() => {
    const result: Record<string, { current: number; target: number }> = {};

    for (const a of ACHIEVEMENTS) {
      const target = a.target;
      let   current = 0;

      switch (a.check.kind) {
        case "stat":
          current = state.achievementStats[a.check.statKey] ?? 0;
          break;
        case "species_discovered":
          current = speciesDiscovered;
          break;
        case "friends_count":
          current = -1; // unknown locally — validated on the server at claim time
          break;
        case "recipe_completed":
          // We don't track recipe progress locally yet; treat as complete once claimed
          current = state.achievementsClaimed.includes(a.id) ? 1 : 0;
          break;
        case "all_recipes_completed":
          current = recipeAchIds.filter((id) => state.achievementsClaimed.includes(id)).length;
          break;
      }

      result[a.id] = { current, target };
    }

    return result;
  }, [state.achievementStats, state.achievementsClaimed, speciesDiscovered, recipeAchIds]);

  /** Per-category count of achievements that are complete but not yet claimed. */
  const claimableCounts = useMemo(() => {
    const counts: Partial<Record<AchievementCategory, number>> = {};
    for (const a of ACHIEVEMENTS) {
      if (state.achievementsClaimed.includes(a.id)) continue;
      if (a.check.kind === "friends_count" || a.check.kind === "recipe_completed") continue;
      const { current, target } = allProgress[a.id];
      if (current >= target) {
        counts[a.category] = (counts[a.category] ?? 0) + 1;
      }
    }
    return counts;
  }, [allProgress, state.achievementsClaimed]);

  // ── Claim handler ────────────────────────────────────────────────────────────

  async function handleClaim(achievementId: string) {
    setClaiming(achievementId);
    setClaimError(null);
    try {
      // Flush local state (achievement stats, etc.) to DB before the edge
      // function reads it — stats aren't written by edge functions, so we must
      // ensure the latest values are persisted before the progress check runs.
      await saveGridNow();
      const result = await edgeAchievementClaim(achievementId);
      const cur    = getState();
      update({
        ...cur,
        achievementsClaimed: result.achievementsClaimed,
        gardenerLevel:       result.gardenerLevel,
        gardenerXp:          result.gardenerXp,
        gems:                result.gems,
        serverUpdatedAt:     result.serverUpdatedAt,
      });
      pushGenericToast(
        "achievement_claim",
        "🏆",
        `Achievement unlocked! +${result.gemsGained} 💎`,
        undefined,
        "gain",
      );
      audioManager.playSfx("achievementClaim");
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Could not claim. Try again.");
    } finally {
      setClaiming(null);
    }
  }

  // ── Filtered list for active tab ─────────────────────────────────────────────

  const filtered = useMemo(
    () => ACHIEVEMENTS.filter((a) => a.category === activeCategory),
    [activeCategory],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ── Category tab strip ──────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1.5">
        {CATEGORY_ORDER.map((cat) => {
          const meta     = ACHIEVEMENT_CATEGORY_META[cat];
          const badge    = claimableCounts[cat] ?? 0;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setClaimError(null); }}
              className={`
                relative flex-shrink-0 flex flex-col items-center gap-0.5
                px-3 py-2 rounded-xl border text-xs font-semibold transition-all
                ${isActive
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-card/60 border-border text-muted-foreground hover:border-primary/30"
                }
              `}
            >
              <span className="text-base">{meta.emoji}</span>
              <span className="text-[10px] leading-none whitespace-nowrap">{meta.label}</span>
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {claimError && (
        <p className="text-xs text-red-400 font-mono px-1">{claimError}</p>
      )}

      {/* ── Achievement list ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {filtered.map((a) => {
          const claimed    = state.achievementsClaimed.includes(a.id);
          const { current, target } = allProgress[a.id];
          const friendsKind = a.check.kind === "friends_count";
          const recipeKind  = a.check.kind === "recipe_completed";
          const ready      = !claimed && !friendsKind && !recipeKind && current >= target;
          const canTryClaim = !claimed && (friendsKind || recipeKind || ready);
          const pct        = friendsKind || recipeKind
            ? 0
            : Math.min(100, Math.round((current / target) * 100));
          const isClaiming = claiming === a.id;

          return (
            <div
              key={a.id}
              className={`
                rounded-xl border p-3 transition-all
                ${claimed   ? "border-border/40 bg-card/30 opacity-60"
                : ready     ? "border-primary/50 bg-primary/5"
                :             "border-border bg-card/60"}
              `}
            >
              <div className="flex items-start gap-3">

                {/* Emoji */}
                <span className="text-xl flex-shrink-0 mt-0.5">{a.emoji}</span>

                {/* Name + description + progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold leading-snug">{a.name}</p>
                    {claimed && (
                      <span className="text-[10px] font-mono text-muted-foreground">✓ Claimed</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                    {a.description}
                  </p>

                  {/* Progress bar — hidden for claimed and for server-validated kinds */}
                  {!claimed && !friendsKind && !recipeKind && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${ready ? "bg-primary" : "bg-primary/40"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                        {current.toLocaleString()}/{target.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {!claimed && (friendsKind || recipeKind) && (
                    <p className="text-[10px] font-mono text-muted-foreground mt-1.5">
                      Verified at claim time
                    </p>
                  )}
                </div>

                {/* Reward pill + claim button */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                    <span>{a.gems}💎</span>
                  </div>
                  {!claimed && (
                    <button
                      onClick={() => handleClaim(a.id)}
                      disabled={(!ready && !canTryClaim) || isClaiming}
                      className={`
                        px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all
                        ${ready || canTryClaim
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                        }
                        ${isClaiming ? "opacity-70" : ""}
                      `}
                    >
                      {isClaiming ? "···" : (ready || canTryClaim) ? "Claim" : "Locked"}
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
