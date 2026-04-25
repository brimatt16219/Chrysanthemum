import { useState } from "react";
import { useGame } from "../store/GameContext";
import { useGrowthTick } from "../hooks/useGrowthTick";
import { PlotTile } from "./PlotTile";
import { SeedPicker } from "./SeedPicker";
import { HarvestPopup } from "./HarvestPopup";
import { getCurrentStage, plantSeed, upgradeFarm, harvestAll } from "../store/gameStore";
import { getNextUpgrade, getCurrentTier } from "../data/upgrades";
import type { MutationType } from "../data/flowers";

export function Garden() {
  const { state, update, activeWeather } = useGame();
  useGrowthTick(5_000);

  const [selectedPlot, setSelectedPlot]     = useState<{ row: number; col: number } | null>(null);
  const [harvestPopup, setHarvestPopup]     = useState<{ speciesId: string; mutation?: MutationType } | null>(null);

  const nextUpgrade = getNextUpgrade(state.farmRows, state.farmSize);
  const currentTier = getCurrentTier(state.farmRows, state.farmSize);

  // Smaller cells on mobile for larger farm sizes
  const cellSize =
    state.farmSize <= 4 ? "w-16 h-16" :
    state.farmSize === 5 ? "w-15 h-15 sm:w-16 sm:h-16" :
    "w-11 h-11 sm:w-16 sm:h-16"; // 6+ cols: compact on mobile

  function handlePlotClick(row: number, col: number) {
    const plot = state.grid[row][col];
    if (!plot.plant) {
      setSelectedPlot({ row, col });
    }
  }

  function handleSeedSelect(speciesId: string) {
    if (!selectedPlot) return;
    const next = plantSeed(state, selectedPlot.row, selectedPlot.col, speciesId);
    if (next) update(next);
    setSelectedPlot(null);
  }

  function handleUpgrade() {
    const next = upgradeFarm(state);
    if (next) update(next);
  }

  function handleCollectAll() {
    update(harvestAll(state, activeWeather ?? "clear"));
  }

  const bloomedCount = state.grid
    .flat()
    .filter((p) => p.plant && getCurrentStage(p.plant, Date.now(), activeWeather) === "bloom").length;

  return (
    <div className="flex flex-col items-center gap-6">

      {/* Farm tier label */}
      <div className="text-center">
        <p className="text-sm font-mono text-muted-foreground tracking-wide uppercase">
          {currentTier.label} — {state.farmRows}×{state.farmSize}
        </p>
        {bloomedCount > 0 && (
          <div className="flex items-center justify-center gap-3 mt-1">
            <p className="text-xs text-primary animate-pulse">
              {bloomedCount} flower{bloomedCount > 1 ? "s" : ""} ready to harvest!
            </p>
            <button
              onClick={handleCollectAll}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-all"
            >
              Collect All
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="relative">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${state.farmSize}, minmax(0, 1fr))` }}
        >
          {state.grid.flat().map((plot, i) => {
            const row = Math.floor(i / state.farmSize); // farmSize = cols
            const col = i % state.farmSize;
            return (
              <PlotTile
                key={plot.id}
                plot={plot}
                row={row}
                col={col}
                onEmptyClick={() => handlePlotClick(row, col)}
                onHarvest={(speciesId, mutation) => setHarvestPopup({ speciesId, mutation })}
                isSelected={selectedPlot?.row === row && selectedPlot?.col === col}
                cellSize={cellSize}
              />
            );
          })}
        </div>

        {/* Seed picker modal */}
        {selectedPlot && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            onClick={() => setSelectedPlot(null)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <SeedPicker
                onSelect={handleSeedSelect}
                onClose={() => setSelectedPlot(null)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Farm upgrade */}
      {nextUpgrade && (
        <div className="text-center space-y-1">
          <button
            onClick={handleUpgrade}
            disabled={state.coins < nextUpgrade.cost}
            className={`
              px-5 py-2 rounded-full text-sm font-medium border transition-all duration-200
              ${state.coins >= nextUpgrade.cost
                ? "border-primary text-primary hover:bg-primary/10 hover:scale-105"
                : "border-border text-muted-foreground cursor-not-allowed opacity-50"
              }
            `}
          >
            Upgrade to {nextUpgrade.label} — {nextUpgrade.cost.toLocaleString()} 🟡
          </button>
          <p className="text-xs text-muted-foreground">{nextUpgrade.description}</p>
        </div>
      )}

      {nextUpgrade === null && (
        <p className="text-xs text-yellow-400 font-mono">✦ Max farm size reached</p>
      )}

      {/* Harvest popup rendered here, outside the grid, so it's never
          clipped by grid cell stacking contexts */}
      {harvestPopup && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
            <HarvestPopup
              speciesId={harvestPopup.speciesId}
              mutation={harvestPopup.mutation}
              onDone={() => setHarvestPopup(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
