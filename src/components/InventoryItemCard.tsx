import { getFlower, RARITY_CONFIG } from "../data/flowers";
import { useGame } from "../store/GameContext";
import { sellFlower } from "../store/gameStore";
import type { InventoryItem } from "../store/gameStore";

interface Props {
  item: InventoryItem;
}

export function InventoryItemCard({ item }: Props) {
  const { state, update } = useGame();
  const species = getFlower(item.speciesId);
  if (!species) return null;

  const rarity = RARITY_CONFIG[species.rarity];
  const totalValue = species.sellValue * item.quantity;

  function handleSellOne() {
    const next = sellFlower(state, item.speciesId, 1);
    if (next) update(next);
  }

  function handleSellAll() {
    const next = sellFlower(state, item.speciesId, item.quantity);
    if (next) update(next);
  }

  return (
    <div
      className={`
        flex items-center gap-4 bg-card/60 border border-border rounded-xl px-4 py-3
        hover:border-primary/30 transition-all duration-200 ${rarity.glow}
      `}
    >
      {/* Emoji */}
      <span className="text-3xl flex-shrink-0">{species.emoji.bloom}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm truncate">{species.name}</h3>
          <span className={`text-xs font-mono ${rarity.color}`}>
            {rarity.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.quantity}× · {species.sellValue} 🪙 each · {totalValue} 🪙 total
        </p>
      </div>

      {/* Sell buttons */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          onClick={handleSellOne}
          className="px-3 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
        >
          Sell 1
        </button>
        {item.quantity > 1 && (
          <button
            onClick={handleSellAll}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 transition-colors"
          >
            Sell All
          </button>
        )}
      </div>
    </div>
  );
}