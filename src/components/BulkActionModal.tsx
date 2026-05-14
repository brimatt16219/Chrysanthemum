import { useState, useMemo } from "react";
import {
  RARITY_CONFIG, FLOWER_TYPES,
  type Rarity, type FlowerType, type FlowerSpecies,
} from "../data/flowers";
import { ItemSprite } from "./ItemSprite";

export interface BulkPoolItem {
  speciesId: string;
  flower:    FlowerSpecies;
  /** Total count in the relevant pool (bloomed plots or seed inventory). */
  count:     number;
}

interface Props {
  mode:        "plant" | "harvest";
  items:       BulkPoolItem[];
  /** For "plant" mode: how many empty plots are available (caps the plant count). */
  emptyPlots?: number;
  onClose:     () => void;
  /** Fires with the user's chosen filters — empty arrays mean "all". */
  onExecute:   (rarities: Rarity[], types: FlowerType[]) => void;
}

const RARITY_ORDER: Rarity[] = [
  "common", "uncommon", "rare", "legendary", "mythic", "exalted", "prismatic",
];

export function BulkActionModal({ mode, items, emptyPlots, onClose, onExecute }: Props) {
  const [activeRarities, setActiveRarities] = useState<Rarity[]>([]);
  const [activeTypes,    setActiveTypes]    = useState<FlowerType[]>([]);

  // Which rarities/types are actually present in the pool
  const availableRarities = useMemo(() => {
    const s = new Set<Rarity>();
    for (const it of items) s.add(it.flower.rarity);
    return s;
  }, [items]);

  // After rarity filter, which types remain?
  const rarityFiltered = useMemo(
    () => activeRarities.length === 0
      ? items
      : items.filter((it) => activeRarities.includes(it.flower.rarity)),
    [items, activeRarities],
  );

  const availableTypes = useMemo(() => {
    const s = new Set<FlowerType>();
    for (const it of rarityFiltered) it.flower.types.forEach((t) => s.add(t));
    return s;
  }, [rarityFiltered]);

  // Final filtered set
  const matching = useMemo(() => {
    if (activeTypes.length === 0) return rarityFiltered;
    return rarityFiltered.filter((it) => it.flower.types.some((t) => activeTypes.includes(t)));
  }, [rarityFiltered, activeTypes]);

  const matchingCount = useMemo(
    () => matching.reduce((s, it) => s + it.count, 0),
    [matching],
  );

  const plantCount = mode === "plant" && emptyPlots !== undefined
    ? Math.min(matchingCount, emptyPlots)
    : matchingCount;

  const title        = mode === "plant"   ? "Plant Seeds"      : "Collect Flowers";
  const actionLabel  = mode === "plant"
    ? `Plant ${plantCount} Seed${plantCount !== 1 ? "s" : ""}`
    : `Collect ${matchingCount} Flower${matchingCount !== 1 ? "s" : ""}`;

  const typeOrder = Object.keys(FLOWER_TYPES) as FlowerType[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Rarity filter */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Filter by rarity
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveRarities([])}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                ${activeRarities.length === 0
                  ? "bg-primary/20 border border-primary/50 text-primary"
                  : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                }
              `}
            >
              All
            </button>
            {RARITY_ORDER.map((rarity) => {
              const cfg      = RARITY_CONFIG[rarity];
              const hasAny   = availableRarities.has(rarity);
              const isActive = activeRarities.includes(rarity);
              return (
                <button
                  key={rarity}
                  disabled={!hasAny}
                  onClick={() =>
                    setActiveRarities((prev) =>
                      isActive ? prev.filter((r) => r !== rarity) : [...prev, rarity]
                    )
                  }
                  className={`
                    px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all
                    ${isActive
                      ? `bg-primary/20 border border-primary/50 ${cfg.color}`
                      : hasAny
                        ? "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                        : "bg-card/60 border border-border/30 text-muted-foreground/30 cursor-not-allowed"
                    }
                  `}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type filter */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Filter by type
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTypes([])}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                ${activeTypes.length === 0
                  ? "bg-foreground/10 border border-foreground/40 text-foreground"
                  : "bg-card/60 border border-border text-muted-foreground hover:border-foreground/30"
                }
              `}
            >
              All types
            </button>
            {typeOrder.map((type) => {
              const tc      = FLOWER_TYPES[type];
              const hasAny  = availableTypes.has(type);
              const isActive = activeTypes.includes(type);
              return (
                <button
                  key={type}
                  disabled={!hasAny}
                  onClick={() =>
                    setActiveTypes((prev) =>
                      isActive ? prev.filter((t) => t !== type) : [...prev, type]
                    )
                  }
                  className={`
                    inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                    ${isActive
                      ? `${tc.bgColor} ${tc.borderColor} ${tc.color} border`
                      : hasAny
                        ? "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                        : "bg-card/60 border border-border/30 text-muted-foreground/30 cursor-not-allowed"
                    }
                  `}
                >
                  <ItemSprite
                    emoji={tc.emoji}
                    sprite={tc.sprite}
                    name={tc.name}
                    textSize="text-xs"
                    imgSize="w-3.5 h-3.5"
                  />
                  {tc.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview note for plant mode when seeds exceed available plots */}
        {mode === "plant" && emptyPlots !== undefined && matchingCount > emptyPlots && (
          <p className="text-[11px] text-muted-foreground text-center">
            {matchingCount} seed{matchingCount !== 1 ? "s" : ""} match
            {" — "}only {emptyPlots} empty plot{emptyPlots !== 1 ? "s" : ""} available
          </p>
        )}

        {/* Action row */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-center"
          >
            Cancel
          </button>
          <button
            disabled={matchingCount === 0}
            onClick={() => onExecute(activeRarities, activeTypes)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-center"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
