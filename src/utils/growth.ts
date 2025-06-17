import type { GrowthStage } from "../types/Plant";

export const growthStageOrder: GrowthStage[] = ["seed", "sprout", "bloom"];

export function getNextStage(current: GrowthStage): GrowthStage | null {
  const index = growthStageOrder.indexOf(current);
  return index < growthStageOrder.length - 1 ? growthStageOrder[index + 1] : null;
}
