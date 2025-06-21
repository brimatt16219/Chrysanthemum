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
    setInventory(prev =>
      prev.map(i => {
        if (
          i.type === item.type &&
          i.traits.color === item.traits.color &&
          i.traits.shape === item.traits.shape
        ) {
          return { ...i, count: Math.max(i.count - 1, 0) };
        }
        return i;
      })
    );
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center">
      <div className="w-full max-w-4xl rounded-lg p-6">
        <h1 className="text-center text-yellow-600">Chrysanthemum</h1>
        <Garden
          inventory={inventory}
          removeFromInventory={removeFromInventory}
          addToInventory={addToInventory}
        />
      </div>
    </div>
  );
}

export default App;
