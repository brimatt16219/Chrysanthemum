import { getFlower, RARITY_CONFIG } from "../data/flowers";
import { useGame } from "../store/GameContext";

interface Props {
  onSelect: (speciesId: string) => void;
  onClose: () => void;
}

export function SeedPicker({ onSelect, onClose }: Props) {
  const { state } = useGame();

  // Only show items without a mutation (those are seeds, not harvested blooms)
  const seeds = state.inventory.filter((i) => i.quantity > 0 && i.isSeed);

  if (seeds.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center space-y-2 w-80 shadow-xl z-50">
        <p className="text-sm text-muted-foreground">No seeds in inventory.</p>
        <p className="text-xs text-muted-foreground">Buy seeds from the Shop tab.</p>
        <button
          onClick={onClose}
          className="text-xs text-primary hover:underline"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-3 w-80 shadow-xl z-50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Select a seed to plant</p>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {seeds.map((item) => {
          const species = getFlower(item.speciesId);
          if (!species) return null;
          const rarity = RARITY_CONFIG[species.rarity];
          return (
            <button
              key={item.speciesId}
              onClick={() => onSelect(item.speciesId)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all text-left"
            >
              <span className="text-xl">{species.emoji.seed}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{species.name}</p>
                <p className={`text-xs ${rarity.color}`}>{rarity.label}</p>
              </div>
              <span className="text-xs text-muted-foreground">×{item.quantity}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
