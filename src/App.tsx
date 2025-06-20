import { useState } from "react";
import type { InventoryItem } from "./types/Inventory";
import Garden from '../components/Garden';
import Inventory from '../components/Inventory';

function App() {
  const [inventory, setInventory] = useState<InventoryItem[]>([
    {
      type: "daisy",
      traits: { color: "white", shape: "round" },
      count: 3,
    },
  ]);

  const addToInventory = (item: InventoryItem) => {
    setInventory((prev) => {
      const match = prev.find(
        (i) =>
          i.type === item.type &&
          i.traits.color === item.traits.color &&
          i.traits.shape === item.traits.shape
      );
      if (match) {
        return prev.map((i) =>
          i === match ? { ...i, count: i.count + 1 } : i
        );
      }
      return [...prev, { ...item, count: 1 }];
    });
  };

  const removeFromInventory = (item: InventoryItem) => {
    setInventory((prev) =>
      prev
        .map((i) => {
          if (
            i.type === item.type &&
            i.traits.color === item.traits.color &&
            i.traits.shape === item.traits.shape
          ) {
            return { ...i, count: i.count - 1 };
          }
          return i;
        })
        .filter((i) => i.count > 0)
    );
  };

  return (
    <div className="min-h-screen">
      <h1 className="text-center text-3xl font-bold mt-4">🌼 Chrysanthemum</h1>
      <Inventory inventory={inventory} />
      <Garden
        inventory={inventory}
        removeFromInventory={removeFromInventory}
        addToInventory={addToInventory}
      />
    </div>
  );
}

export default App;
