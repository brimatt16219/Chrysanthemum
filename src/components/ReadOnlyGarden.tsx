import { getCurrentStage, getStageProgress } from "../store/gameStore";
import type { Plot } from "../store/gameStore";
import { getFlower, RARITY_CONFIG } from "../data/flowers";

interface Props {
  grid: Plot[][];
  farmSize: number;
}

export function ReadOnlyGarden({ grid, farmSize }: Props) {
  const now = Date.now();

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-mono text-muted-foreground tracking-wide uppercase">
        {farmSize}×{farmSize} Garden
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${farmSize}, minmax(0, 1fr))` }}
      >
        {grid.flat().map((plot) => {
          const plant   = plot.plant;
          const species = plant ? getFlower(plant.speciesId) : null;
          const stage   = plant ? getCurrentStage(plant, now) : null;
          const progress = plant ? getStageProgress(plant, now) : 0;
          const rarity  = species ? RARITY_CONFIG[species.rarity] : null;
          const isBloomed = stage === "bloom";

          if (!plant) {
            return (
              <div
                key={plot.id}
                className="w-14 h-14 rounded-xl border-2 border-border bg-card/40 flex items-center justify-center"
              >
                <span className="text-xl opacity-20">·</span>
              </div>
            );
          }

          return (
            <div
              key={plot.id}
              className={`
                relative w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center
                ${isBloomed
                  ? `border-primary/50 bg-primary/10 ${rarity?.glow}`
                  : "border-border/60 bg-card/60"
                }
              `}
              title={`${species?.name} — ${stage}`}
            >
              <span className="text-xl leading-none">
                {species?.emoji[stage!] ?? "🌱"}
              </span>
              {!isBloomed && (
                <div className="absolute bottom-1 left-2 right-2 h-0.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
              {isBloomed && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}