import { useState } from "react";
import {
  type PlantedFlower,
  getCurrentStage,
  getStageProgress,
  harvestPlant,
} from "../store/gameStore";
import { getFlower, RARITY_CONFIG, type MutationType } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import { HarvestPopup } from "./HarvestPopup";
import { PlotTooltip } from "./PlotTooltip";
import { useGame } from "../store/GameContext";

interface Props {
  plot: { id: string; plant: PlantedFlower | null };
  row: number;
  col: number;
  onEmptyClick: () => void;
  isSelected?: boolean;
}

export function PlotTile({ plot, row, col, onEmptyClick, isSelected }: Props) {
  const { state, update } = useGame();
  const now = Date.now();
  const plant = plot.plant;
  const species = plant ? getFlower(plant.speciesId) : null;
  const stage = plant ? getCurrentStage(plant, now) : null;
  const progress = plant ? getStageProgress(plant, now) : 0;
  const rarity = species ? RARITY_CONFIG[species.rarity] : null;
  const isBloomed = stage === "bloom";
  const hasFertilizer = !!plant?.fertilizer;

  const [popup, setPopup] = useState<{ speciesId: string; mutation?: MutationType } | null>(null);
  const [hovered, setHovered] = useState(false);

  function handleClick() {
    if (!plant) {
      onEmptyClick();
      return;
    }
    if (isBloomed) {
      const result = harvestPlant(state, row, col);
      if (result) {
        update(result.state);
        setPopup({ speciesId: plant.speciesId, mutation: result.mutation });
      }
    }
  }

  // Empty plot
  if (!plant) {
    return (
      <button
        onClick={onEmptyClick}
        className={`
          w-16 h-16 rounded-xl border-2 transition-all duration-200
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
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Harvest popup */}
      {popup && (
        <HarvestPopup
          speciesId={popup.speciesId}
          mutation={popup.mutation}
          onDone={() => setPopup(null)}
        />
      )}

      {/* Tooltip on hover when not bloomed */}
      {hovered && plant && (
        <PlotTooltip plant={plant} row={row} col={col} />
      )}

      <button
        onClick={handleClick}
        className={`
          relative w-16 h-16 rounded-xl border-2 transition-all duration-200
          flex flex-col items-center justify-center gap-0.5
          ${isBloomed
            ? `border-primary/60 bg-primary/10 hover:scale-110 hover:bg-primary/20 cursor-pointer ${rarity?.glow}`
            : "border-border/60 bg-card/60 cursor-default"
          }
        `}
        title={
          isBloomed
            ? `${species?.name} — Tap to harvest!`
            : species?.name
        }
      >
        <span className="text-2xl leading-none">
          {species?.emoji[stage!] ?? "🌱"}
        </span>

        {/* Fertilizer indicator */}
        {hasFertilizer && !isBloomed && (
          <span className="absolute top-0.5 left-0.5 text-[10px] leading-none">
            {FERTILIZERS[plant.fertilizer!].emoji}
          </span>
        )}

        {/* Progress bar */}
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

        {/* Bloom pulse indicator */}
        {isBloomed && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
        )}
      </button>
    </div>
  );
}
