import { useState } from "react";
import {
  type PlantedFlower,
  getCurrentStage,
  getMsUntilNextStage,
  applyFertilizer,
} from "../store/gameStore";
import { getFlower, RARITY_CONFIG } from "../data/flowers";
import { FERTILIZERS, type FertilizerType } from "../data/upgrades";
import { useGame } from "../store/GameContext";

interface Props {
  plant: PlantedFlower;
  row: number;
  col: number;
  onClose?: () => void;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

export function PlotTooltip({ plant, row, col, onClose }: Props) {
  const { state, update, activeWeather } = useGame();
  const [showFertPicker, setShowFertPicker] = useState(false);

  const now     = Date.now();
  const species = getFlower(plant.speciesId);
  if (!species) return null;

  const stage         = getCurrentStage(plant, now, activeWeather);
  const msLeft        = getMsUntilNextStage(plant, now, activeWeather);
  const rarity        = RARITY_CONFIG[species.rarity];
  const isBloomed     = stage === "bloom";
  const hasFertilizer = !!plant.fertilizer;
  const availableFerts = state.fertilizers.filter((f) => f.quantity > 0);

  function handleApplyFertilizer(type: FertilizerType) {
    const next = applyFertilizer(state, row, col, type);
    if (next) update(next);
    setShowFertPicker(false);
    onClose?.(); // close tooltip after applying fertilizer
  }

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 pointer-events-none">
      <div className="pointer-events-auto bg-card border border-border rounded-xl p-3 shadow-xl w-48 space-y-2">

        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-xl">{species.emoji[stage]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-tight">{species.name}</p>
            <p className={`text-[10px] font-mono ${rarity.color}`}>{rarity.label}</p>
          </div>
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs flex-shrink-0 leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Stage: <span className="text-foreground capitalize">{stage}</span>
          </p>
          {!isBloomed && (
            <p>
              Next stage in:{" "}
              <span className="text-primary font-mono">{formatMs(msLeft)}</span>
            </p>
          )}
          {isBloomed && (
            <p className="text-primary font-semibold">Ready to harvest!</p>
          )}
        </div>

        {/* Fertilizer section */}
        {!isBloomed && (
          <div className="pt-1 border-t border-border">
            {hasFertilizer ? (
              <p className="text-[10px] text-green-400 font-mono">
                {FERTILIZERS[plant.fertilizer!].emoji}{" "}
                {FERTILIZERS[plant.fertilizer!].name} applied
              </p>
            ) : availableFerts.length > 0 ? (
              <>
                <button
                  onClick={() => setShowFertPicker((v) => !v)}
                  className="text-[10px] text-primary hover:underline w-full text-left"
                >
                  + Apply fertilizer
                </button>
                {showFertPicker && (
                  <div className="mt-1.5 space-y-1">
                    {availableFerts.map((f) => (
                      <button
                        key={f.type}
                        onClick={() => handleApplyFertilizer(f.type)}
                        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                      >
                        <span>{FERTILIZERS[f.type].emoji}</span>
                        <span className="text-[10px] text-foreground">
                          {FERTILIZERS[f.type].name}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          ×{f.quantity}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">No fertilizer available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
