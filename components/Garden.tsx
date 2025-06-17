import React, { useState } from "react";
import type { Plant } from "../src/types/Plant";
import { getNextStage } from "../src/utils/growth.ts";


const GRID_SIZE = 5;

type Plot = {
  id: string;
  plant: Plant | null;
};

const Garden = () => {
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
  
    if (!plot.plant) {
      // Plant a seed
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
      // Water the plant
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
