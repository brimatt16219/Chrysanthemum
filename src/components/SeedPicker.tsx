import { useState } from "react";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import { ItemSprite } from "./ItemSprite";
import { FlowerSprite } from "./FlowerSprite";
import type { MutationType } from "../data/flowers";
import { FlowerTypeBadges } from "./FlowerTypeBadges";
import { GEAR } from "../data/gear";
import { useGame } from "../store/GameContext";
import { isSpeciesMastered } from "../store/gameStore";
import type { GearType } from "../data/gear";

interface Props {
  onSelect:      (speciesId: string) => void;
  onBloomSelect: (speciesId: string, mutation?: string) => void;
  onGearSelect:  (gearType: GearType) => void;
  onClose:       () => void;
}

type Tab = "seeds" | "blooms" | "gear";

export function SeedPicker({ onSelect, onBloomSelect, onGearSelect, onClose }: Props) {
  const { state } = useGame();

  const seeds  = state.inventory.filter((i) => i.quantity > 0 && i.isSeed);
  const blooms = state.inventory.filter((i) => i.quantity > 0 && !i.isSeed);
  const gear   = (state.gearInventory ?? []).filter((i) => i.quantity > 0);

  // Default to whichever tab has items; prefer seeds
  const defaultTab: Tab = seeds.length > 0 ? "seeds" : blooms.length > 0 ? "blooms" : "gear";
  const [tab, setTab] = useState<Tab>(defaultTab);

  const hasAnything = seeds.length > 0 || blooms.length > 0 || gear.length > 0;

  if (!hasAnything) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center space-y-2 w-80 shadow-xl z-50">
        <p className="text-sm text-muted-foreground">Nothing to place.</p>
        <p className="text-xs text-muted-foreground">Buy seeds or gear from the Shop tab.</p>
        <button onClick={onClose} className="text-xs text-primary hover:underline">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-3 w-80 shadow-xl z-50">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Select what to place</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1 mb-3">
        <button
          onClick={() => setTab("seeds")}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all
            ${tab === "seeds"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground"
            }
          `}
        >
          <ItemSprite emoji="🌱" sprite="/sprites/flowers/seed.png" name="🌱" textSize="text-sm" imgSize="w-4 h-4" />
          Seeds
          {seeds.length > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              tab === "seeds" ? "bg-primary/20 text-primary" : "bg-border text-muted-foreground"
            }`}>
              {seeds.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("blooms")}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all
            ${tab === "blooms"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground"
            }
          `}
        >
          <ItemSprite emoji="🌸" sprite="/sprites/flowers/bloom.png" name="🌸" textSize="text-sm" imgSize="w-4 h-4" />
          Blooms
          {blooms.length > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              tab === "blooms" ? "bg-primary/20 text-primary" : "bg-border text-muted-foreground"
            }`}>
              {blooms.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("gear")}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all
            ${tab === "gear"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground"
            }
          `}
        >
          <ItemSprite emoji="⚙️" sprite="/sprites/ui/gear.png" name="⚙️" textSize="text-sm" imgSize="w-4 h-4" />
          Gear
          {gear.length > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              tab === "gear" ? "bg-primary/20 text-primary" : "bg-border text-muted-foreground"
            }`}>
              {gear.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">

        {/* ── Seeds ── */}
        {tab === "seeds" && (
          seeds.length > 0 ? (
            seeds.map((item) => {
              const species = getFlower(item.speciesId);
              if (!species) return null;
              const rarity   = RARITY_CONFIG[species.rarity];
              const isNew    = !state.discovered.includes(item.speciesId);
              const mastered = !isNew && isSpeciesMastered(state.discovered, item.speciesId);
              return (
                <button
                  key={item.speciesId}
                  onClick={() => onSelect(item.speciesId)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all text-left"
                >
                  {isNew
                    ? <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-xl" imgSize="w-6 h-6" />
                    : <FlowerSprite species={species} stage="seed" textSize="text-xl" imgSize="w-6 h-6" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{isNew ? "???" : species.name}</p>
                      {mastered && (
                        <span className="text-yellow-400 text-xs leading-none flex-shrink-0" title="Mastered — grows 20% faster">
                          ⚡
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${rarity.color}`}>{rarity.label}</p>
                    {!isNew && <FlowerTypeBadges types={species.types} className="mt-0.5" />}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">×{item.quantity}</span>
                </button>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No seeds in inventory.</p>
          )
        )}

        {/* ── Blooms ── */}
        {tab === "blooms" && (
          blooms.length > 0 ? (
            blooms.map((item) => {
              const species = getFlower(item.speciesId);
              if (!species) return null;
              const rarity   = RARITY_CONFIG[species.rarity];
              const mastered = isSpeciesMastered(state.discovered, item.speciesId);
              const mut      = item.mutation as MutationType | undefined;
              return (
                <button
                  key={`${item.speciesId}:${item.mutation ?? ""}`}
                  onClick={() => onBloomSelect(item.speciesId, mut)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all text-left"
                >
                  <FlowerSprite
                    species={species}
                    stage="bloom"
                    textSize="text-xl"
                    imgSize="w-6 h-6"
                    className={mut ? MUTATIONS[mut].vfxClass : ""}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{species.name}</p>
                      {mastered && (
                        <span className="text-yellow-400 text-xs leading-none flex-shrink-0" title="Mastered">
                          ⚡
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${rarity.color}`}>{rarity.label}</p>
                    {mut && (
                      <p className={`text-xs ${MUTATIONS[mut].color} inline-flex items-center gap-1`}>
                        <ItemSprite emoji={MUTATIONS[mut].emoji} sprite={MUTATIONS[mut].sprite} name={MUTATIONS[mut].emoji} textSize="text-xs" imgSize="w-3.5 h-3.5" />
                        {MUTATIONS[mut].name}
                      </p>
                    )}
                    <FlowerTypeBadges types={species.types} className="mt-0.5" />
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">×{item.quantity}</span>
                </button>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No blooms in inventory.</p>
          )
        )}

        {/* ── Gear ── */}
        {tab === "gear" && (
          gear.length > 0 ? (
            gear.map((item) => {
              const def    = GEAR[item.gearType];
              if (!def) return null; // orphan from a removed gear type (cleaned up on next applyOfflineTick)
              const rarity = RARITY_CONFIG[def.rarity];
              return (
                <button
                  key={item.gearType}
                  onClick={() => onGearSelect(item.gearType)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all text-left"
                >
                  <span className="text-xl relative">
                    <ItemSprite emoji={def.emoji} sprite={def.sprite} name={def.name} textSize="text-xl" imgSize="w-6 h-6" />
                    {def.category === "sprinkler_mutation" && def.mutationType && (
                      <span className="absolute -bottom-0.5 -right-1 leading-none">
                        <ItemSprite emoji={MUTATIONS[def.mutationType].emoji} sprite={MUTATIONS[def.mutationType].sprite} name={MUTATIONS[def.mutationType].emoji} textSize="text-[10px]" imgSize="w-3 h-3" />
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{def.name}</p>
                    <p className={`text-xs ${rarity.color}`}>{rarity.label}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">×{item.quantity}</span>
                </button>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No gear in inventory.</p>
          )
        )}

      </div>
    </div>
  );
}
