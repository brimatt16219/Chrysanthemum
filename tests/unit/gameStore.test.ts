import { describe, expect, it } from "vitest";
import {
  applyPlantConsumable,
  buyWeatherForecastSlot,
  codexKey,
  defaultState,
  FORECAST_SLOT_COSTS,
  getCurrentStage,
  getSpeciesCompletion,
  getTotalCodexEntries,
  harvestPlant,
  isDiscovered,
  isSpeciesMastered,
  makeGrid,
  MAX_FORECAST_SLOTS,
  plantBloom,
  plantSeed,
  removePlant,
  resizeGrid,
  sellFlower,
  stampStageTransitions,
  type GameState,
  type PlantedFlower,
} from "../../src/store/gameStore";
import { FLOWERS, MUTATIONS } from "../../src/data/flowers";

// Pick a fast-growing common flower for deterministic tests.
const fastFlower = FLOWERS.find((f) => f.id === "quickgrass")!;

function bloomedPlant(speciesId: string, mutation?: keyof typeof MUTATIONS): PlantedFlower {
  return {
    speciesId,
    timePlanted: Date.now() - 10_000_000,
    fertilizer: null,
    bloomedAt: Date.now() - 1000,
    sproutedAt: Date.now() - 2000,
    growthMs: 9_999_999_999,
    lastTickAt: Date.now() - 1000,
    mutation: mutation as PlantedFlower["mutation"],
  };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  const state = defaultState();
  return { ...state, ...overrides };
}

describe("grid helpers (regression)", () => {
  it("makeGrid produces correct shape with empty plots", () => {
    const grid = makeGrid(3, 4);
    expect(grid.length).toBe(3);
    expect(grid[0].length).toBe(4);
    for (const row of grid) {
      for (const plot of row) {
        expect(plot.plant).toBeNull();
        expect(plot.id).toMatch(/^\d+-\d+$/);
      }
    }
  });

  it("resizeGrid preserves overlapping plots and adds empty new ones", () => {
    const old = makeGrid(2, 2);
    old[0][0].plant = { speciesId: fastFlower.id, timePlanted: 1, fertilizer: null };
    const resized = resizeGrid(old, 3, 3);
    expect(resized.length).toBe(3);
    expect(resized[0].length).toBe(3);
    expect(resized[0][0].plant?.speciesId).toBe(fastFlower.id);
    expect(resized[2][2].plant).toBeNull();
  });
});

describe("codex helpers (regression)", () => {
  it("codexKey formats base and mutation keys", () => {
    expect(codexKey("rose")).toBe("rose");
    expect(codexKey("rose", "golden")).toBe("rose:golden");
  });

  it("isDiscovered checks both base and mutation keys", () => {
    const discovered = ["rose", "rose:golden"];
    expect(isDiscovered(discovered, "rose")).toBe(true);
    expect(isDiscovered(discovered, "rose", "golden")).toBe(true);
    expect(isDiscovered(discovered, "rose", "frozen")).toBe(false);
    expect(isDiscovered(discovered, "tulip")).toBe(false);
  });

  it("getSpeciesCompletion counts base + mutations correctly", () => {
    const { found, total } = getSpeciesCompletion(["quickgrass", "quickgrass:golden"], "quickgrass");
    expect(total).toBe(10); // 1 base + 9 mutations
    expect(found).toBe(2);
  });

  it("isSpeciesMastered requires all 10 entries", () => {
    const allMutations = Object.keys(MUTATIONS);
    const partial = ["quickgrass", "quickgrass:golden"];
    expect(isSpeciesMastered(partial, "quickgrass")).toBe(false);

    const full = ["quickgrass", ...allMutations.map((m) => `quickgrass:${m}`)];
    expect(isSpeciesMastered(full, "quickgrass")).toBe(true);
  });

  it("getTotalCodexEntries equals FLOWERS.length * 10", () => {
    expect(getTotalCodexEntries()).toBe(FLOWERS.length * (1 + Object.keys(MUTATIONS).length));
  });
});

describe("defaultState (regression)", () => {
  it("returns a fresh 3x3 game with starter inventory", () => {
    const s = defaultState();
    expect(s.coins).toBe(100);
    expect(s.farmSize).toBe(3);
    expect(s.farmRows).toBe(3);
    expect(s.grid.length).toBe(3);
    expect(s.grid[0].length).toBe(3);
    expect(s.inventory).toEqual([]);
    expect(s.fertilizers).toEqual([{ type: "basic", quantity: 3 }]);
    expect(s.discovered).toEqual([]);
    expect(s.weatherForecastSlots).toBe(0);
    expect(s.marketplaceSlots).toBe(0);
    expect(s.shop.length).toBeGreaterThan(0);
  });
});

describe("weather forecast slot purchase (regression)", () => {
  it("deducts cost and increments slot count", () => {
    const s = baseState({ coins: 10_000, weatherForecastSlots: 0 });
    const next = buyWeatherForecastSlot(s);
    expect(next).not.toBeNull();
    expect(next!.weatherForecastSlots).toBe(1);
    expect(next!.coins).toBe(10_000 - FORECAST_SLOT_COSTS[0]);
  });

  it("returns null when player cannot afford", () => {
    const s = baseState({ coins: 0, weatherForecastSlots: 0 });
    expect(buyWeatherForecastSlot(s)).toBeNull();
  });

  it("returns null when already at the cap", () => {
    const s = baseState({ coins: 10_000_000, weatherForecastSlots: MAX_FORECAST_SLOTS });
    expect(buyWeatherForecastSlot(s)).toBeNull();
  });
});

describe("plantSeed (regression)", () => {
  it("plants when a seed is available and the plot is empty", () => {
    const s = baseState({
      inventory: [{ speciesId: fastFlower.id, quantity: 2, isSeed: true }],
    });
    const next = plantSeed(s, 0, 0, fastFlower.id);
    expect(next).not.toBeNull();
    expect(next!.grid[0][0].plant?.speciesId).toBe(fastFlower.id);
    expect(next!.inventory[0].quantity).toBe(1);
  });

  it("returns null when no seed is in inventory", () => {
    const s = baseState({ inventory: [] });
    expect(plantSeed(s, 0, 0, fastFlower.id)).toBeNull();
  });

  it("returns null when the plot is already occupied", () => {
    const s = baseState({
      inventory: [{ speciesId: fastFlower.id, quantity: 1, isSeed: true }],
    });
    const next = plantSeed(s, 0, 0, fastFlower.id)!;
    expect(plantSeed(next, 0, 0, fastFlower.id)).toBeNull();
  });

  it("removePlant returns seed to inventory and clears the plot", () => {
    // Shovel is required since v2.3.0 — include one in consumables.
    const s = baseState({
      inventory:   [{ speciesId: fastFlower.id, quantity: 1, isSeed: true }],
      consumables: [{ id: "shovel" as const, quantity: 1 }],
    });
    const planted = plantSeed(s, 0, 0, fastFlower.id)!;
    const removed = removePlant(planted, 0, 0)!;
    expect(removed.grid[0][0].plant).toBeNull();
    const seed = removed.inventory.find((i) => i.speciesId === fastFlower.id && i.isSeed);
    expect(seed?.quantity).toBe(1);
  });
});

describe("harvestPlant (regression)", () => {
  it("returns null when the plant is not yet bloomed", () => {
    const s = baseState();
    s.grid[0][0].plant = {
      speciesId: fastFlower.id,
      timePlanted: Date.now(),
      fertilizer: null,
    };
    expect(harvestPlant(s, 0, 0, "clear")).toBeNull();
  });

  it("harvests a bloom: clears plot, adds inventory, and discovers species", () => {
    const s = baseState();
    s.grid[0][0].plant = bloomedPlant(fastFlower.id);
    const result = harvestPlant(s, 0, 0, "clear");
    expect(result).not.toBeNull();
    expect(result!.state.grid[0][0].plant).toBeNull();
    expect(result!.state.inventory).toContainEqual({
      speciesId: fastFlower.id,
      quantity: 1,
      mutation: undefined,
      isSeed: false,
    });
    expect(result!.state.discovered).toContain(fastFlower.id);
    expect(result!.mutation).toBeUndefined();
  });

  it("harvesting a mutated bloom does NOT award coins — only discovers codex entry", () => {
    // Coins are awarded only at sell time, never at harvest (v2.2.4 fix).
    const s = baseState({ coins: 0 });
    s.grid[0][0].plant = bloomedPlant(fastFlower.id, "golden");
    const result = harvestPlant(s, 0, 0, "clear")!;
    expect(result.state.coins).toBe(0);   // no bonus at harvest
    expect(result.mutation).toBe("golden");
    expect(result.state.discovered).toContain(`${fastFlower.id}:golden`);
  });
});

describe("sellFlower (regression)", () => {
  it("computes earnings using mutation multiplier and removes inventory", () => {
    const s = baseState({
      coins: 0,
      inventory: [
        { speciesId: fastFlower.id, quantity: 2, mutation: "golden", isSeed: false },
      ],
    });
    const next = sellFlower(s, fastFlower.id, 1, "golden");
    expect(next).not.toBeNull();
    const expectedEarn = Math.floor(fastFlower.sellValue * MUTATIONS.golden.valueMultiplier);
    expect(next!.coins).toBe(expectedEarn);
    expect(
      next!.inventory.find((i) => i.speciesId === fastFlower.id && i.mutation === "golden")
        ?.quantity,
    ).toBe(1);
  });

  it("returns null when quantity exceeds owned amount", () => {
    const s = baseState({
      inventory: [{ speciesId: fastFlower.id, quantity: 1, isSeed: false }],
    });
    expect(sellFlower(s, fastFlower.id, 5)).toBeNull();
  });
});

// ── removePlant — shovel requirement (v2.3.0) ────────────────────────────────

describe("removePlant — shovel requirement (v2.3.0 regression)", () => {
  function plantedState(extraConsumables: { id: "shovel"; quantity: number }[] = []) {
    const s = baseState({
      inventory:   [{ speciesId: fastFlower.id, quantity: 1, isSeed: true }],
      consumables: extraConsumables,
    });
    return plantSeed(s, 0, 0, fastFlower.id)!;
  }

  it("returns null when the consumables list has no shovel", () => {
    const planted = plantedState([]); // no shovel
    expect(removePlant(planted, 0, 0)).toBeNull();
  });

  it("returns null when shovel quantity is zero", () => {
    const planted = plantedState([{ id: "shovel", quantity: 0 }]);
    expect(removePlant(planted, 0, 0)).toBeNull();
  });

  it("deducts exactly one shovel on success", () => {
    const planted = plantedState([{ id: "shovel", quantity: 3 }]);
    const removed = removePlant(planted, 0, 0)!;
    expect(removed.consumables.find((c) => c.id === "shovel")?.quantity).toBe(2);
  });

  it("removes the consumable entry entirely when the last shovel is used", () => {
    const planted = plantedState([{ id: "shovel", quantity: 1 }]);
    const removed = removePlant(planted, 0, 0)!;
    expect(removed.consumables.find((c) => c.id === "shovel")).toBeUndefined();
  });

  it("returns null for a pinned plant even with a shovel present", () => {
    const planted = plantedState([{ id: "shovel", quantity: 1 }]);
    planted.grid[0][0].plant!.pinned = true;
    expect(removePlant(planted, 0, 0)).toBeNull();
  });

  it("returns null for a bloomed plant even with a shovel present", () => {
    const s = baseState({ consumables: [{ id: "shovel" as const, quantity: 1 }] });
    s.grid[0][0].plant = bloomedPlant(fastFlower.id);
    expect(removePlant(s, 0, 0)).toBeNull();
  });
});

// ── getCurrentStage — sproutedAt floor (v2.3.0 regression) ──────────────────

describe("getCurrentStage — sproutedAt floor (v2.3.0 regression)", () => {
  it("returns 'sprout' when sproutedAt is stamped even if growthMs is below seedMs", () => {
    // This guards against stage reverting to 'seed' if growthMs is somehow
    // stale/below-threshold — once sproutedAt is permanently written the stage
    // must never go backwards.
    const species = fastFlower;
    const seedMs  = species.growthTime.seed;
    const now     = Date.now();
    const plant: PlantedFlower = {
      speciesId:  species.id,
      timePlanted: now - 1_000_000,
      fertilizer:  null,
      sproutedAt:  now - 5_000,
      // growthMs below seedMs and lastTickAt = now so delta = 0 → computeGrowthMs returns < seedMs
      growthMs:    seedMs - 1,
      lastTickAt:  now,
    };
    expect(getCurrentStage(plant, now)).toBe("sprout");
  });

  it("still returns 'bloom' when bloomedAt is stamped regardless of growthMs", () => {
    const now   = Date.now();
    const plant: PlantedFlower = {
      speciesId:   fastFlower.id,
      timePlanted: now - 1_000_000,
      fertilizer:  null,
      bloomedAt:   now - 1_000,
      growthMs:    0,   // deliberately wrong — bloomedAt flag takes priority
      lastTickAt:  now,
    };
    expect(getCurrentStage(plant, now)).toBe("bloom");
  });
});

// ── stampStageTransitions — force param (v2.3.0 regression) ─────────────────

describe("stampStageTransitions — force param (v2.3.0 regression)", () => {
  it("without force=true, skips stamping when delta < 100 ms (anti-loop guard)", () => {
    const species  = fastFlower;
    const totalMs  = species.growthTime.seed + species.growthTime.sprout;
    const now      = Date.now();
    const s        = baseState();
    s.grid[0][0].plant = {
      speciesId:   species.id,
      timePlanted: now - totalMs - 5_000,
      fertilizer:  null,
      sproutedAt:  now - 3_000,
      growthMs:    totalMs + 100,  // past bloom threshold
      lastTickAt:  now - 50,       // delta = ~50ms < 100ms guard
    };
    const s1 = stampStageTransitions(s, now, "clear", false);
    // Guard fires → bloomedAt NOT stamped
    expect(s1.grid[0][0].plant?.bloomedAt).toBeUndefined();
  });

  it("with force=true, bypasses the 100 ms guard and stamps bloomedAt immediately", () => {
    const species  = fastFlower;
    const totalMs  = species.growthTime.seed + species.growthTime.sprout;
    const now      = Date.now();
    const s        = baseState();
    s.grid[0][0].plant = {
      speciesId:   species.id,
      timePlanted: now - totalMs - 5_000,
      fertilizer:  null,
      sproutedAt:  now - 3_000,
      growthMs:    totalMs + 100,  // past bloom threshold
      lastTickAt:  now - 50,       // delta = ~50ms — would normally be skipped
    };
    const s2 = stampStageTransitions(s, now, "clear", true);
    // Guard bypassed → bloomedAt IS stamped
    expect(s2.grid[0][0].plant?.bloomedAt).toBeDefined();
  });
});

// ── applyPlantConsumable — mutation vial guard (v2.3.0 regression) ───────────

describe("applyPlantConsumable — mutation vial guard (v2.3.0 regression)", () => {
  const MUTATION_VIAL_IDS = [
    "frost_vial_1",
    "ember_vial_1",
    "storm_vial_1",
    "moon_vial_1",
    "golden_vial_1",
    "rainbow_vial_1",
    "giant_vial_1",
  ] as const;

  function stateWithBloomed(mutation: PlantedFlower["mutation"], vialId: string): GameState {
    const s = baseState({
      grid: [[{
        id: "0-0",
        plant: bloomedPlant(fastFlower.id, mutation as keyof typeof MUTATIONS | undefined),
        gear: null,
      }]],
      farmRows: 1,
      farmSize: 1,
      consumables: [{ id: vialId as never, quantity: 2 }],
    });
    return s;
  }

  it("blocks all mutation vials when the bloomed plant already has a mutation", () => {
    for (const vialId of MUTATION_VIAL_IDS) {
      const s = stateWithBloomed("frozen", vialId);
      expect(
        applyPlantConsumable(s, 0, 0, vialId),
        `${vialId} should return null when bloom has a mutation`,
      ).toBeNull();
    }
  });

  it("allows mutation vials on a bloomed plant with no mutation (mutation === undefined)", () => {
    // Unrolled bloom (mutation field not set) — vial should be permitted
    for (const vialId of MUTATION_VIAL_IDS) {
      const s = stateWithBloomed(undefined, vialId);
      const result = applyPlantConsumable(s, 0, 0, vialId);
      expect(result, `${vialId} should be allowed on bloom with no mutation`).not.toBeNull();
    }
  });

  it("allows mutation vials on a bloomed plant whose mutation rolled null (blocked by cron)", () => {
    // mutation === null means the cron rolled no mutation — vials may still apply
    for (const vialId of MUTATION_VIAL_IDS) {
      const s = stateWithBloomed(null as unknown as undefined, vialId);
      const result = applyPlantConsumable(s, 0, 0, vialId);
      expect(result, `${vialId} should be allowed when mutation is null`).not.toBeNull();
    }
  });

  it("purity vial is NOT blocked (it is the remedy, not subject to the guard)", () => {
    const s = baseState({
      grid: [[{
        id: "0-0",
        plant: bloomedPlant(fastFlower.id, "frozen"),
        gear: null,
      }]],
      farmRows: 1,
      farmSize: 1,
      consumables: [{ id: "purity_vial_1" as never, quantity: 1 }],
    });
    expect(applyPlantConsumable(s, 0, 0, "purity_vial_1")).not.toBeNull();
  });
});

// ── plantBloom — null/undefined mutation normalization (regression) ───────────
//
// Inventory items stored via the DB arrive with mutation === null for
// non-mutated blooms. plantBloom must treat null and undefined identically
// so that a "no-mutation" bloom can always be placed regardless of which
// sentinel the inventory record carries.

describe("plantBloom — null/undefined mutation normalization (regression)", () => {
  function stateWithBloom(mutation: null | undefined | string): GameState {
    return baseState({
      inventory: [
        {
          speciesId: fastFlower.id,
          quantity: 1,
          isSeed: false,
          mutation: mutation as PlantedFlower["mutation"],
        },
      ],
    });
  }

  it("places a bloom whose inventory mutation is null when called without a mutation arg", () => {
    // DB stores null for non-mutated blooms; plantBloom is called without the
    // mutation arg (undefined). Both sides must normalise to null so the item is found.
    const s = stateWithBloom(null);
    const next = plantBloom(s, 0, 0, fastFlower.id);
    expect(next).not.toBeNull();
    expect(next!.grid[0][0].plant?.speciesId).toBe(fastFlower.id);
    expect(next!.inventory).toHaveLength(0); // bloom consumed
  });

  it("places a bloom whose inventory mutation is undefined when called without a mutation arg", () => {
    const s = stateWithBloom(undefined);
    const next = plantBloom(s, 0, 0, fastFlower.id);
    expect(next).not.toBeNull();
    expect(next!.grid[0][0].plant?.speciesId).toBe(fastFlower.id);
  });

  it("places a mutated bloom when the mutation arg matches the inventory entry", () => {
    const s = stateWithBloom("golden");
    const next = plantBloom(s, 0, 0, fastFlower.id, "golden");
    expect(next).not.toBeNull();
    expect((next!.grid[0][0].plant as PlantedFlower).mutation).toBe("golden");
  });

  it("returns null when mutation arg is provided but inventory has no mutation", () => {
    const s = stateWithBloom(null); // no mutation in inventory
    expect(plantBloom(s, 0, 0, fastFlower.id, "golden")).toBeNull();
  });

  it("places a pre-bloomed plant (timePlanted === 0 sentinel)", () => {
    const s = stateWithBloom(null);
    const next = plantBloom(s, 0, 0, fastFlower.id)!;
    expect(next.grid[0][0].plant?.timePlanted).toBe(0);
    expect((next.grid[0][0].plant as PlantedFlower).bloomedAt).toBeDefined();
  });
});
