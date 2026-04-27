import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import { useGame } from "../store/GameContext";
import { sellFlower } from "../store/gameStore";
import { edgeSellFlower } from "../lib/edgeFunctions";
import type { InventoryItem } from "../store/gameStore";

interface Props {
  item: InventoryItem;
}

export function InventoryItemCard({ item }: Props) {
  const { state, perform } = useGame();
  const species = getFlower(item.speciesId);
  if (!species) return null;

  const rarity = RARITY_CONFIG[species.rarity];
  const mut = item.mutation ? MUTATIONS[item.mutation] : null;
  const valuePerItem = Math.floor(species.sellValue * (mut?.valueMultiplier ?? 1));
  const totalValue = valuePerItem * item.quantity;

  function handleSellOne() {
    const optimistic = sellFlower(state, item.speciesId, 1, item.mutation);
    if (optimistic) perform(optimistic, () => edgeSellFlower(item.speciesId, item.mutation, 1));
  }

  function handleSellAll() {
    const optimistic = sellFlower(state, item.speciesId, item.quantity, item.mutation);
    if (optimistic) perform(optimistic, () => edgeSellFlower(item.speciesId, item.mutation, item.quantity));
  }

  return (
    <div
      className={`
        flex items-center gap-4 bg-card/60 border border-border rounded-xl px-4 py-3
        hover:border-primary/30 transition-all duration-200
        ${rarity.glow}
      `}
    >
      {/* Emoji */}
      <div className="relative flex-shrink-0">
        <span className="text-3xl">{species.emoji.bloom}</span>
        {mut && (
          <span className="absolute -top-1 -right-1 text-sm">{mut.emoji}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm truncate">{species.name}</h3>
          {mut && (
            <span className={`text-xs font-mono font-bold ${mut.color}`}>
              {mut.name}
            </span>
          )}
          <span className={`text-xs font-mono ${rarity.color}`}>
            {rarity.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.quantity}× · {valuePerItem} 🟡 each · {totalValue} 🟡 total
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
