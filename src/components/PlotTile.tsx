import { useState } from "react";
import { type PlantedFlower, getCurrentStage, getStageProgress } from "../store/gameStore";
import { getFlower, RARITY_CONFIG } from "../data/flowers";
import { HarvestPopup } from "./HarvestPopup";

interface Props {
  plot: { id: string; plant: PlantedFlower | null };
  onClick: () => void;
  isSelected?: boolean;
}

export function PlotTile({ plot, onClick, isSelected }: Props) {
  const now = Date.now();
  const plant = plot.plant;
  const species = plant ? getFlower(plant.speciesId) : null;
  const stage = plant ? getCurrentStage(plant, now) : null;
  const progress = plant ? getStageProgress(plant, now) : 0;
  const rarity = species ? RARITY_CONFIG[species.rarity] : null;
  const isBloomed = stage === "bloom";

  const [popup, setPopup] = useState<string | null>(null);

  function handleClick() {
    if (isBloomed && plant) {
      setPopup(plant.speciesId);
    }
    onClick();
  }

  // Empty plot
  if (!plant) {
    return (
      <button
        onClick={onClick}
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
    <div className="relative">
      {/* Harvest popup */}
      {popup && (
        <HarvestPopup
          speciesId={popup}
          onDone={() => setPopup(null)}
        />
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
            : `${species?.name} — ${stage}`
        }
      >
        <span className="text-2xl leading-none">
          {species?.emoji[stage!] ?? "🌱"}
        </span>

        {/* Progress bar */}
        {!isBloomed && (
          <div className="absolute bottom-1 left-2 right-2 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {/* Bloom pulse */}
        {isBloomed && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
        )}
      </button>
    </div>
  );
}