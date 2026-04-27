import { useState, useRef, useEffect } from "react";
import {
  type PlantedFlower,
  getCurrentStage,
  getStageProgress,
  harvestPlant,
} from "../store/gameStore";
import { getFlower, RARITY_CONFIG, MUTATIONS, type MutationType } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import { PlotTooltip } from "./PlotTooltip";
import { useGame } from "../store/GameContext";
import { edgeHarvest } from "../lib/edgeFunctions";

interface Props {
  plot: { id: string; plant: PlantedFlower | null };
  row: number;
  col: number;
  onEmptyClick: () => void;
  onHarvest: (speciesId: string, mutation?: MutationType) => void;
  isSelected?: boolean;
  cellSize?: string;
}

export function PlotTile({ plot, row, col, onEmptyClick, onHarvest, isSelected, cellSize = "w-16 h-16" }: Props) {
  const { state, perform, activeWeather } = useGame();
  const now           = Date.now();
  const plant         = plot.plant;
  const species       = plant ? getFlower(plant.speciesId) : null;

  // Pass activeWeather into growth calculations so Rain speeds up display
  const stage         = plant ? getCurrentStage(plant, now, activeWeather) : null;
  const progress      = plant ? getStageProgress(plant, now, activeWeather) : 0;

  const rarity        = species ? RARITY_CONFIG[species.rarity] : null;
  const isBloomed     = stage === "bloom";
  const hasFertilizer = !!plant?.fertilizer;

  const [open, setOpen] = useState(false);
  const tileRef         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (tileRef.current && !tileRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!plant) setOpen(false);
  }, [plant]);

  function handleClick() {
    if (!plant) {
      onEmptyClick();
      return;
    }
    if (isBloomed) {
      const optimistic = harvestPlant(state, row, col, activeWeather);
      if (optimistic) {
        perform(optimistic.state, () => edgeHarvest(row, col), () => {
          onHarvest(plant.speciesId, optimistic.mutation);
        });
        setOpen(false);
      }
      return;
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={tileRef} className="relative">
      {!plant ? (
        <button
          onClick={onEmptyClick}
          className={`
            ${cellSize} rounded-xl border-2 transition-all duration-200
            flex items-center justify-center
            ${isSelected
              ? "border-primary bg-primary/20 scale-105"
              : "border-border bg-card/40 hover:bg-card/80 hover:border-primary/50 hover:scale-105"
            }
          `}
          title="Empty plot"
        >
          <span className="text-2xl opacity-30">＋</span>
        </button>
      ) : (
        <>
          {open && !isBloomed && (
            <PlotTooltip
              plant={plant}
              row={row}
              col={col}
              onClose={() => setOpen(false)}
            />
          )}

          <button
            onClick={handleClick}
            className={`
              relative ${cellSize} rounded-xl border-2 transition-all duration-200
              flex flex-col items-center justify-center gap-0.5
              ${isBloomed
                ? `${rarity?.borderBloom ?? "border-primary/60"} ${rarity?.bgBloom ?? "bg-primary/10"} hover:scale-110 hover:brightness-125 cursor-pointer ${rarity?.glow}`
                : open
                ? `${rarity?.borderGrowing ?? "border-border/60"} bg-card/80 scale-105`
                : `${rarity?.borderGrowing ?? "border-border/60"} bg-card/60 hover:bg-card/80 cursor-pointer`
              }
            `}
            title={
              isBloomed
                ? `${species?.name} — Tap to harvest!`
                : open
                ? "Click to close"
                : `${species?.name} — Click for options`
            }
          >
            <span className="text-2xl leading-none">
              {species?.emoji[stage!] ?? "🌱"}
            </span>

            {hasFertilizer && !isBloomed && (
              <span className="absolute top-0.5 left-0.5 text-[10px] leading-none">
                {FERTILIZERS[plant.fertilizer!].emoji}
              </span>
            )}

            {!isBloomed && (
              <div className="absolute bottom-1 left-2 right-2 h-1 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    hasFertilizer ? "bg-green-400" : "bg-primary"
                  }`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}

            {isBloomed && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
            )}

            {isBloomed && plant?.mutation && (
              <span className="absolute -bottom-1 -right-1 text-sm leading-none">
                {MUTATIONS[plant.mutation].emoji}
              </span>
            )}

            {open && !isBloomed && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary/60 rounded-full" />
            )}
          </button>
        </>
      )}
    </div>
  );
}
