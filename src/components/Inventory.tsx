import { useGame } from "../store/GameContext";
import { getFlower } from "../data/flowers";
import { InventoryItemCard } from "./InventoryItemCard";
import { sellFlower } from "../store/gameStore";

export function Inventory() {
  const { state, update } = useGame();

  // Split inventory into seeds vs harvested blooms
  // Seeds are items you haven't grown yet — they came from the shop
  // For now all inventory items are treated the same way,
  // but we label them by what they are
  const items = state.inventory.filter((i) => i.quantity > 0);

  const totalValue = items.reduce((sum, item) => {
    const species = getFlower(item.speciesId);
    return sum + (species?.sellValue ?? 0) * item.quantity;
  }, 0);

  function handleSellAll() {
    let current = state;
    for (const item of items) {
      const next = sellFlower(current, item.speciesId, item.quantity);
      if (next) current = next;
    }
    update(current);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <span className="text-5xl">🎒</span>
        <p className="font-medium text-muted-foreground">Your inventory is empty</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Buy seeds from the Shop, plant them in your Garden, then harvest bloomed flowers here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Inventory</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} species · {items.reduce((s, i) => s + i.quantity, 0)} total items
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total value</p>
          <p className="text-sm font-mono font-semibold text-primary">
            {totalValue.toLocaleString()} 🪙
          </p>
        </div>
      </div>

      {/* Coins */}
      <div className="flex items-center gap-2 bg-card/40 border border-border rounded-lg px-4 py-2.5">
        <span className="text-lg">🪙</span>
        <span className="text-sm font-mono font-medium">
          {state.coins.toLocaleString()} coins
        </span>
      </div>

      {/* Sell all button */}
      {items.length > 1 && (
        <button
          onClick={handleSellAll}
          className="w-full py-2.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
        >
          Sell Everything — {totalValue.toLocaleString()} 🪙
        </button>
      )}

      {/* Item list */}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <InventoryItemCard key={item.speciesId} item={item} />
        ))}
      </div>
    </div>
  );
}