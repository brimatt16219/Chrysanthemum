import React, { useState } from "react";
import type { Plant } from "../src/types/Plant";
import type { InventoryItem } from "../src/types/Inventory";
import { getNextStage } from "../src/utils/growth.ts";
import { flowerPrefabs } from "../src/data/prefabs.ts";

const GRID_SIZE = 5;

type Plot = {
  id: string;
  plant: Plant | null;
};

interface GardenProps {
  inventory: InventoryItem[];
  addToInventory: (item: InventoryItem) => void;
  removeFromInventory: (item: InventoryItem) => void;
}

const Garden: React.FC<GardenProps> = ({
  inventory,
  addToInventory,
  removeFromInventory,
}) => {
  const [grid, setGrid] = useState<Plot[][]>(
    Array.from({ length: GRID_SIZE }, (_, row) =>
      Array.from({ length: GRID_SIZE }, (_, col) => ({
        id: `${row}-${col}`,
        plant: null,
      }))
    )
  );

  // Track selected flower to plant
  const [selectedToPlant, setSelectedToPlant] = useState<InventoryItem | null>(
    null
  );

  // for testing, give all flowers
  React.useEffect(() => {
    Object.values(flowerPrefabs).forEach((prefab) => {
      addToInventory({
        type: prefab.type,
        traits: prefab.traits,
        count: 1,
      });
    });
  }, []); // Empty array = run once on first render only
  

  const handleClick = (row: number, col: number) => {
    const plot = grid[row][col];

    // 1. Harvest if fully grown
    if (plot.plant?.growthStage === "bloom") {
      const harvestedPlant = plot.plant;
      const newGrid = [...grid];
      newGrid[row][col].plant = null;
      setGrid(newGrid);

      addToInventory({
        type: harvestedPlant.type,
        traits: harvestedPlant.traits!,
        count: 1,
      });

      return;
    }

    // 2. Plant from selected inventory
    if (!plot.plant && selectedToPlant && selectedToPlant.count > 1) {
      const newGrid = [...grid];
      newGrid[row][col].plant = {
        id: crypto.randomUUID(),
        type: selectedToPlant.type,
        growthStage: "seed",
        timePlanted: Date.now(),
        traits: selectedToPlant.traits,
      };
      setGrid(newGrid);

      const updated = inventory.find(
        (i) =>
          i.type === selectedToPlant.type &&
          i.traits.color === selectedToPlant.traits.color &&
          i.traits.shape === selectedToPlant.traits.shape
      );
      
      setSelectedToPlant(updated || null);

      removeFromInventory(selectedToPlant);
      return;
    }

    // 3. Water if not fully grown
    waterPlant(row, col);
  };

  const waterPlant = (row: number, col: number) => {
    const plot = grid[row][col];
    const plant = plot.plant;
    if (!plant) return;

    if (plant.growthStage === "bloom") return;

    setTimeout(() => {
      const newGrid = [...grid];
      const nextStage = getNextStage(plant.growthStage);

      if (nextStage) {
        newGrid[row][col].plant = {
          ...plant,
          growthStage: nextStage,
        };
        setGrid(newGrid);
      }
    }, 5000);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Inventory Selector */}
      <div className="mb-4 text-center">
        <h2 className="font-bold mb-2">Select a Flower to Plant:</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {inventory.map((item, i) => {
            const prefab = flowerPrefabs[item.type];
            if (!prefab) return null;
            return (
              <button
                disabled={item.count === 0}
                key={i}
                onClick={() => setSelectedToPlant(item)}
                className={`border px-3 py-2 rounded ${
                  selectedToPlant?.type === item.type &&
                  selectedToPlant?.traits.color === item.traits.color
                    ? "bg-green-200 border-green-600"
                    : "bg-white"
                }`}
              >
                <img
                  src={prefab.icons.bloom}
                  alt={item.type}
                  className="w-6 h-6 mx-auto mb-1"
                />
                <div className="text-sm">{item.type}</div>
                <div className="text-xs text-gray-600">
                  ({item.traits.color}, {item.traits.shape}) x{item.count}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Garden Grid */}
      {grid.map((row, rowIndex) => (
        <div className="flex gap-2" key={rowIndex}>
          {row.map((plot, colIndex) => (
            <div
              key={plot.id}
              onClick={() => handleClick(rowIndex, colIndex)}
              className={`w-16 h-16 border rounded flex items-center justify-center cursor-pointer ${
                plot.plant ? "bg-green-300" : "bg-gray-200"
              }`}
            >
              {plot.plant &&
                (() => {
                  const prefab = flowerPrefabs[plot.plant.type];
                  if (!prefab) return null;

                  switch (plot.plant.growthStage) {
                    case "seed":
                      return (
                        <img
                          src={prefab.icons.seed}
                          alt="seed"
                          className="w-6 h-6"
                        />
                      );
                    case "sprout":
                      return (
                        <img
                          src={prefab.icons.sprout}
                          alt="sprout"
                          className="w-6 h-6"
                        />
                      );
                    case "bloom":
                      return (
                        <img
                          src={prefab.icons.bloom}
                          alt="bloom"
                          className="w-8 h-8"
                        />
                      );
                    default:
                      return null;
                  }
                })()}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Garden;
