// Allium
import allium_seed from "../assets/flowers/allium/allium_seed.png"
import allium_sprout from "../assets/flowers/allium/allium_sprout.png"
import allium_bloom from "../assets/flowers/allium/allium_bloom.png"

// Azure bluet
import azure_bluet_seed from "../assets/flowers/azure_bluet/azure_bluet_seed.png"
import azure_bluet_sprout from "../assets/flowers/azure_bluet/azure_bluet_sprout.png"
import azure_bluet_bloom from "../assets/flowers/azure_bluet/azure_bluet_bloom.png"


export interface FlowerPrefab {
  type: string;
  traits: {
    color: string;
    shape: string;
  };
  icons: {
    seed: string;
    sprout: string;
    bloom: string;
  };
}

export const flowerPrefabs: Record<string, FlowerPrefab> = {
  allium: {
    type: "allium",
    traits: { color: "white", shape: "round" },
    icons: {
      seed: allium_seed,
      sprout: allium_sprout,
      bloom: allium_bloom,
    },
  },
  azure_bluet: {
    type: "azure_bluet",
    traits: { color: "red", shape: "spiky" },
    icons: {
      seed: azure_bluet_seed,
      sprout: azure_bluet_sprout,
      bloom: azure_bluet_bloom,
    },
  },
  // Add more flower types here
};
