import { useState, useEffect, useMemo } from "react";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import { ItemSprite } from "./ItemSprite";
import { FlowerSprite } from "./FlowerSprite";
import type { MutationType, Rarity } from "../data/flowers";
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

// Highest rarity first (matches RARITY_PRIORITY from gameStore)
const RARITY_SORT: Rarity[] = [
  "prismatic", "exalted", "mythic", "legendary", "rare", "uncommon", "common",
];

function rarityRank(r: Rarity) { return RARITY_SORT.indexOf(r); }

export function SeedPicker({ onSelect, onBloomSelect, onGearSelect, onClose }: Props) {
  const { state } = useGame();

  const seeds  = state.inventory.filter((i) => i.quantity > 0 && i.isSeed);
  const blooms = state.inventory.filter((i) => i.quantity > 0 && !i.isSeed);
  const gear   = (state.gearInventory ?? []).filter((i) => i.quantity > 0);

  // Default to whichever tab has items; prefer seeds
  const defaultTab: Tab = seeds.length > 0 ? "seeds" : blooms.length > 0 ? "blooms" : "gear";
  const [tab, setTab]               = useState<Tab>(defaultTab);
  const [activeRarities, setActiveRarities] = useState<Rarity[]>([]);

  // Clear filter whenever the tab changes
  useEffect(() => { setActiveRarities([]); }, [tab]);

  const hasAnything = seeds.length > 0 || blooms.length > 0 || gear.length > 0;

  // ── Sorted + enriched item lists ─────────────────────────────────────────

  const allSeeds = useMemo(() =>
    seeds
      .flatMap((item) => {
        const species = getFlower(item.speciesId);
        return species ? [{ item, species }] : [];
      })
      .sort((a, b) => {
        const rd = rarityRank(a.species.rarity) - rarityRank(b.species.rarity);
        return rd !== 0 ? rd : a.species.name.localeCompare(b.species.name);
      }),
    [seeds],
  );

  const allBlooms = useMemo(() =>
    blooms
      .flatMap((item) => {
        const species = getFlower(item.speciesId);
        return species ? [{ item, species }] : [];
      })
      .sort((a, b) => {
        const rd = rarityRank(a.species.rarity) - rarityRank(b.species.rarity);
        return rd !== 0 ? rd : a.species.name.localeCompare(b.species.name);
      }),
    [blooms],
  );

  const allGear = useMemo(() =>
    gear
      .flatMap((item) => {
        const def = GEAR[item.gearType];
        return def ? [{ item, def }] : [];
      })
      .sort((a, b) => {
        const rd = rarityRank(a.def.rarity) - rarityRank(b.def.rarity);
        return rd !== 0 ? rd : a.def.name.localeCompare(b.def.name);
      }),
    [gear],
  );

  // ── Available rarities per tab (for filter chips) ─────────────────────────

  const availableRarities = useMemo((): Rarity[] => {
    const set = new Set<Rarity>();
    if (tab === "seeds")  allSeeds.forEach(({ species }) => set.add(species.rarity));
    if (tab === "blooms") allBlooms.forEach(({ species }) => set.add(species.rarity));
    if (tab === "gear")   allGear.forEach(({ def }) => set.add(def.rarity));
    return RARITY_SORT.filter((r) => set.has(r));
  }, [tab, allSeeds, allBlooms, allGear]);

  const showFilter = availableRarities.length > 1;

  // ── Filtered views ────────────────────────────────────────────────────────

  const filteredSeeds = useMemo(() =>
    activeRarities.length === 0
      ? allSeeds
      : allSeeds.filter(({ species }) => activeRarities.includes(species.rarity)),
    [allSeeds, activeRarities],
  );

  const filteredBlooms = useMemo(() =>
    activeRarities.length === 0
      ? allBlooms
      : allBlooms.filter(({ species }) => activeRarities.includes(species.rarity)),
    [allBlooms, activeRarities],
  );

  const filteredGear = useMemo(() =>
    activeRarities.length === 0
      ? allGear
      : allGear.filter(({ def }) => activeRarities.includes(def.rarity)),
    [allGear, activeRarities],
  );

  // ─────────────────────────────────────────────────────────────────────────

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

      {/* Rarity filter — only shown when 2+ rarities are present in the tab */}
      {showFilter && (
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            onClick={() => setActiveRarities([])}
            className={`
              px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all
              ${activeRarities.length === 0
                ? "bg-primary/20 border border-primary/50 text-primary"
                : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
              }
            `}
          >
            All
          </button>
          {availableRarities.map((rarity) => {
            const cfg      = RARITY_CONFIG[rarity];
            const isActive = activeRarities.includes(rarity);
            return (
              <button
                key={rarity}
                onClick={() =>
                  setActiveRarities((prev) =>
                    isActive ? prev.filter((r) => r !== rarity) : [...prev, rarity]
                  )
                }
                className={`
                  px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize transition-all
                  ${isActive
                    ? `bg-primary/20 border border-primary/50 ${cfg.color}`
                    : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                  }
                `}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">

        {/* ── Seeds ── */}
        {tab === "seeds" && (
          filteredSeeds.length > 0 ? (
            filteredSeeds.map(({ item, species }) => {
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
                        <span className="text-yellow-400 leading-none flex-shrink-0" title="Mastered — grows 20% faster">
                          <ItemSprite emoji="⚡" sprite="/sprites/ui/mastery.png" name="Mastered" textSize="text-xs" imgSize="w-3.5 h-3.5" />
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
            <p className="text-xs text-muted-foreground text-center py-8">
              {seeds.length > 0 ? "No seeds match the filter." : "No seeds in inventory."}
            </p>
          )
        )}

        {/* ── Blooms ── */}
        {tab === "blooms" && (
          filteredBlooms.length > 0 ? (
            filteredBlooms.map(({ item, species }) => {
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
                        <ItemSprite emoji="⚡" sprite="/sprites/ui/mastery.png" name="Mastered" textSize="text-xs" imgSize="w-3.5 h-3.5" className="flex-shrink-0" />
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
            <p className="text-xs text-muted-foreground text-center py-8">
              {blooms.length > 0 ? "No blooms match the filter." : "No blooms in inventory."}
            </p>
          )
        )}

        {/* ── Gear ── */}
        {tab === "gear" && (
          filteredGear.length > 0 ? (
            filteredGear.map(({ item, def }) => {
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
            <p className="text-xs text-muted-foreground text-center py-8">
              {gear.length > 0 ? "No gear matches the filter." : "No gear in inventory."}
            </p>
          )
        )}

      </div>
    </div>
  );
}
