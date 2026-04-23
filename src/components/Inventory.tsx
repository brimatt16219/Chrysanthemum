import { useGame } from "../store/GameContext";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { InventoryItemCard } from "./InventoryItemCard";
import { sellFlower, type InventoryItem } from "../store/gameStore";

export function Inventory() {
  const { state, update } = useGame();

  const items  = state.inventory.filter((i) => i.quantity > 0);
  const seeds  = items.filter((i) => i.isSeed);
  const blooms = items.filter((i) => !i.isSeed);

  const totalBloomValue = blooms.reduce((sum, item) => {
    const species = getFlower(item.speciesId);
    const mut     = item.mutation ? MUTATIONS[item.mutation as MutationType] : null;
    return sum + Math.floor((species?.sellValue ?? 0) * (mut?.valueMultiplier ?? 1)) * item.quantity;
  }, 0);

  function handleSellAll() {
    let current = state;
    for (const item of blooms) {
      const next = sellFlower(
        current,
        item.speciesId,
        item.quantity,
        item.mutation as MutationType | undefined
      );
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
            {seeds.reduce((s, i) => s + i.quantity, 0)} seeds ·{" "}
            {blooms.reduce((s, i) => s + i.quantity, 0)} blooms
          </p>
        </div>
        {blooms.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Bloom value</p>
            <p className="text-sm font-mono font-semibold text-primary">
              {totalBloomValue.toLocaleString()} 🟡
            </p>
          </div>
        )}
      </div>

      {/* Coins */}
      <div className="flex items-center gap-2 bg-card/40 border border-border rounded-lg px-4 py-2.5">
        <span className="text-lg">🟡</span>
        <span className="text-sm font-mono font-medium">
          {state.coins.toLocaleString()} coins
        </span>
      </div>

      {/* Sell all blooms */}
      {blooms.length > 0 && (
        <button
          onClick={handleSellAll}
          className="w-full py-2.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-colors text-center"
        >
          Sell All Blooms — {totalBloomValue.toLocaleString()} 🟡
        </button>
      )}

      {/* Seeds — can only be planted */}
      {seeds.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Seeds ({seeds.reduce((s, i) => s + i.quantity, 0)}) — Plant in garden
          </h3>
          {seeds.map((item, i) => (
            <SeedInventoryRow key={`seed-${item.speciesId}-${i}`} item={item} />
          ))}
        </div>
      )}

      {/* Blooms — can be sold */}
      {blooms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Harvested ({blooms.reduce((s, i) => s + i.quantity, 0)}) — Ready to sell
          </h3>
          {blooms.map((item, i) => (
            <InventoryItemCard
              key={`bloom-${item.speciesId}-${item.mutation ?? "none"}-${i}`}
              item={item}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SeedInventoryRow({ item }: { item: InventoryItem }) {
  const species = getFlower(item.speciesId);
  const rarity  = species ? RARITY_CONFIG[species.rarity] : null;
  if (!species) return null;

  return (
    <div className="flex items-center gap-4 bg-card/60 border border-border rounded-xl px-4 py-3">
      <span className="text-3xl flex-shrink-0">{species.emoji.seed}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{species.name} Seed</h3>
          <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          ×{item.quantity} · Plant in your garden to grow
        </p>
      </div>
    </div>
  );
}
