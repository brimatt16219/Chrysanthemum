import React, { useState, useEffect } from "react";
import type { FlowerPrefab } from '../src/data/prefabs';
import type { InventoryItem } from "../src/types/Inventory";
import { flowerPrefabs } from "../src/data/prefabs";

interface ShopItem {
  prefab: FlowerPrefab;
  count: number;
}

interface ShopProps {
  gold: number;
  spendGold: (amount: number) => void;
  addToInventory: (item: InventoryItem) => void;
}

const SHOP_MIN_SLOTS = 3;
const SHOP_MAX_SLOTS = 6;

/** Pick one FlowerPrefab at random according to its rarity weight */
function pickWeighted(prefabs: FlowerPrefab[]): FlowerPrefab {
  const totalWeight = prefabs.reduce((sum, p) => sum + p.rarity, 0);
  let r = Math.random() * totalWeight;
  for (const p of prefabs) {
    if (r < p.rarity) return p;
    r -= p.rarity;
  }
  return prefabs[0];
}

const Shop: React.FC<ShopProps> = ({ gold, spendGold, addToInventory }) => {
  const [items, setItems] = useState<ShopItem[]>([]);

  useEffect(() => {
    function generateShop() {
      const allPrefabs = Object.values(flowerPrefabs);
      const slotCount =
        SHOP_MIN_SLOTS +
        Math.floor(Math.random() * (SHOP_MAX_SLOTS - SHOP_MIN_SLOTS + 1));

      const picks: ShopItem[] = [];
      const used = new Set<string>();

      while (picks.length < slotCount) {
        const prefab = pickWeighted(allPrefabs);
        if (used.has(prefab.type)) continue;
        used.add(prefab.type);

        const [minQ, maxQ] = prefab.quantity;
        const count = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));

        picks.push({ prefab, count });
      }

      setItems(picks);
    }

    // initial load + refresh every 3 minutes
    generateShop();
    const intervalId = setInterval(generateShop, 3 * 60_000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="p-4 bg-white rounded shadow mb-6">
      <h2 className="text-xl font-semibold mb-2">🌼 Flower Shop</h2>
      <div className="flex gap-4 overflow-x-auto">
        {items.map((item, idx) => {
          const totalCost = item.prefab.price * item.count;
          return (
            <div key={idx} className="border p-2 rounded w-32 text-center">
              <img
                src={item.prefab.icons.bloom}
                alt={item.prefab.type}
                className="w-12 h-12 mx-auto"
              />
              <div className="mt-1">{item.prefab.type}</div>
              <div className="text-sm text-gray-600">
                {item.prefab.price}🪙 each × {item.count}
              </div>
              <div className="text-sm font-bold">{totalCost}🪙 total</div>
              <button
                className={`mt-2 px-2 py-1 rounded ${
                  gold >= totalCost
                    ? "bg-green-500 text-white"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
                disabled={gold < totalCost}
                onClick={() => {
                  spendGold(totalCost);
                  addToInventory({
                    type: item.prefab.type,
                    traits: item.prefab.traits,
                    count: item.count,
                  });
                }}
              >
                Buy
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-right text-sm text-gray-500">
        Refreshes every 3 minutes
      </div>
    </div>
  );
};

export default Shop;
