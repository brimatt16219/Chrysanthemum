import React from "react";
import type { InventoryItem } from "../src/types/Inventory";

interface InventoryProps {
  inventory: InventoryItem[];
}

const Inventory: React.FC<InventoryProps> = ({ inventory }) => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">🌻 Inventory</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {inventory.map((item, index) => (
          <div
            key={index}
            className="border rounded p-2 flex flex-col items-center"
          >
            <div className="text-2xl">🌼</div>
            <div className="text-sm">
              {item.type} ({item.traits.color}, {item.traits.shape})
            </div>
            <div className="text-sm">x{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Inventory;
