import { useState, useMemo } from "react";
import { useGame } from "../../store/GameContext";
import type { EventEntry } from "../../store/gameStore";
import { FLOWERS } from "../../data/flowers";
import { edgeQuestSubmit } from "../../lib/edgeFunctions";
import { audioManager } from "../../lib/audioManager";
import { ItemSprite } from "../ItemSprite";
import { FlowerSprite } from "../FlowerSprite";

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

interface CollectionConfig {
  quests:      QuestDef[];
  finalReward: { speciesId: string };
}

interface Props { event: EventEntry; }

export function CollectionEventCard({ event }: Props) {
  const { state, getState, update, pushGenericToast } = useGame();

  const config          = event.config as CollectionConfig;
  const completedQuests = event.progress?.completedQuests ?? [];

  // First quest whose id isn't in completedQuests
  const activeQuestIdx = config.quests.findIndex((q) => !completedQuests.includes(q.id));
  const activeQuest    = activeQuestIdx >= 0 ? config.quests[activeQuestIdx] : null;
  const allDone        = activeQuestIdx < 0;

  // Blooms in inventory that satisfy the active quest's requirements
  const eligibleBlooms = useMemo(() => {
    if (!activeQuest) return [];
    return state.inventory.filter((i) =>
      !i.isSeed &&
      activeQuest.validSpeciesIds.includes(i.speciesId) &&
      (activeQuest.mutation === null || i.mutation === activeQuest.mutation) &&
      i.quantity > 0,
    );
  }, [state.inventory, activeQuestIdx]);

  const [selectedBloom, setSelectedBloom] = useState<{ speciesId: string; mutation: string | null } | null>(null);
  const [submitting,    setSubmitting]    = useState(false);

  async function handleSubmit() {
    if (!activeQuest || !selectedBloom || submitting) return;
    setSubmitting(true);
    try {
      const result = await edgeQuestSubmit(
        event.id,
        activeQuest.id,
        selectedBloom.speciesId,
        selectedBloom.mutation,
      );
      const cur = getState();
      update({
        ...cur,
        gems:            result.gems,
        inventory:       result.inventory,
        serverUpdatedAt: result.serverUpdatedAt,
        events:          cur.events.map((e) =>
          e.id === event.id ? { ...e, progress: result.progress } : e
        ),
      });
      setSelectedBloom(null);
      if (result.finalRewardDelivered) {
        pushGenericToast("quest_final", "🌸", "Sakura seed delivered!", undefined, "gain", 1);
      } else {
        pushGenericToast("quest_submit", "💎", `Quest complete! +${result.gemsGained}`, undefined, "gain", result.gemsGained, "/sprites/ui/gems.png");
      }
      audioManager.playSfx("questComplete");
    } catch (e) {
      console.error("quest submit failed:", e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 flex flex-col gap-4">

      {/* Header */}
      <div>
        <h3 className="font-bold text-sm">{event.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
      </div>

      {/* Quest list */}
      <div className="flex flex-col gap-2">
        {config.quests.map((quest, idx) => {
          const done   = completedQuests.includes(quest.id);
          const active = quest.id === activeQuest?.id;
          const locked = !done && !active;
          return (
            <div
              key={quest.id}
              className={`
                rounded-xl border p-3 flex flex-col gap-2
                ${done   ? "border-primary/30 bg-primary/10"     : ""}
                ${active ? "border-primary/60 bg-card"           : ""}
                ${locked ? "border-border bg-card/30 opacity-50" : ""}
              `}
            >
              {/* Quest header row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {done ? "✓ " : `${idx + 1}. `}{quest.name}
                </span>
                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                  {quest.gems}<ItemSprite emoji="💎" sprite="/sprites/ui/gems.png" textSize="text-[10px]" imgSize="w-3 h-3" name="gems" />
                </span>
              </div>

              {/* Requirement */}
              <span className="text-[10px] text-muted-foreground">
                {quest.rarity} · {quest.type}
                {quest.mutation ? ` · ${quest.mutation}` : ""}
              </span>

              {/* Bloom picker — only shown on active quest */}
              {active && (
                <>
                  {eligibleBlooms.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">
                      No matching flowers in inventory.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {eligibleBlooms.map((item) => {
                        const flower     = FLOWERS.find((f) => f.id === item.speciesId);
                        const isSelected =
                          selectedBloom?.speciesId === item.speciesId &&
                          selectedBloom?.mutation  === item.mutation;
                        return (
                          <button
                            key={`${item.speciesId}:${item.mutation ?? "none"}`}
                            onClick={() => setSelectedBloom({ speciesId: item.speciesId, mutation: item.mutation })}
                            className={`
                              text-[10px] px-2 py-1 rounded-lg border transition-all
                              ${isSelected
                                ? "bg-primary/20 border-primary/60 text-primary"
                                : "bg-card border-border hover:border-primary/40"
                              }
                            `}
                          >
                            {flower
                              ? <FlowerSprite species={flower} stage="bloom" textSize="text-[10px]" imgSize="w-4 h-4" />
                              : <span>🌸</span>
                            } {flower?.name ?? item.speciesId}
                            {item.mutation ? ` (${item.mutation})` : ""}
                            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!selectedBloom || submitting}
                    className={`
                      w-full py-2 rounded-xl text-xs font-semibold transition-all mt-1
                      ${selectedBloom && !submitting
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                      }
                    `}
                  >
                    {submitting ? "Submitting…" : "Submit Flower"}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Final reward preview */}
      {(() => {
        const rewardFlower = FLOWERS.find((f) => f.id === config.finalReward.speciesId);
        return (
          <div className={`
            rounded-xl border p-3 flex items-center gap-3
            ${allDone ? "border-primary/50 bg-primary/10" : "border-border bg-card/30 opacity-60"}
          `}>
            {rewardFlower
              ? <FlowerSprite species={rewardFlower} stage="seed" textSize="text-2xl" imgSize="w-8 h-8" />
              : <span className="text-2xl">🌱</span>
            }
            <div>
              <p className="text-xs font-semibold">{rewardFlower?.name ?? "Exclusive Seed"}</p>
              <p className="text-[10px] text-muted-foreground">
                {allDone ? "Delivered to your inventory!" : "Final reward — complete all quests to unlock"}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
