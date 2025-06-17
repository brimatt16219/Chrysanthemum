export type GrowthStage = "seed" | "sprout" | "bloom";

export interface Plant {
  id: string;
  type: string;
  growthStage: GrowthStage;
  timePlanted: number;
  traits?: {
    color: string;
    shape: string;
  };
}
