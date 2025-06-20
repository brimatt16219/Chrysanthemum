import React, { useState } from "react";
import type { Plant } from "../src/types/Plant";
import type { InventoryItem } from "../src/types/Inventory";
import { getNextStage } from "../src/utils/growth.ts";

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
  
    // 2. Plant if empty
    if (!plot.plant) {
      const newGrid = [...grid];
      newGrid[row][col].plant = {
        id: crypto.randomUUID(),
        type: "daisy",
        growthStage: "seed",
        timePlanted: Date.now(),
        traits: {
          color: "white",
          shape: "round",
        },
      };
      setGrid(newGrid);
    } else {
      // 3. Water if not fully grown
      waterPlant(row, col);
    }
  };
  

  

  const waterPlant = (row: number, col: number) => {
    const plot = grid[row][col];
    const plant = plot.plant;
    if (!plant) return;

    // Prevent watering if already at bloom
    if (plant.growthStage === "bloom") return;

    // Simulate growth after 5 seconds
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
    <div className="flex flex-col items-center gap-2 p-4">
      {grid.map((row, rowIndex) => (
        <div className="flex gap-2" key={rowIndex}>
          {row.map((plot, colIndex) => (
            <div
              key={plot.id}
              onClick={() => handleClick(rowIndex, colIndex)}
              className={`w-16 h-16 border rounded flex items-center justify-center cursor-pointer
                ${plot.plant ? "bg-green-300" : "bg-gray-200"}
              `}
            >
              {plot.plant?.growthStage === "seed" && "🌱"}
              {plot.plant?.growthStage === "sprout" && "🌿"}
              {plot.plant?.growthStage === "bloom" && "🌼"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Garden;
