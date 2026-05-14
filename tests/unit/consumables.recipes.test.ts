import { describe, expect, it } from "vitest";
import { CONSUMABLE_RECIPES, ATTUNEMENT_RECIPES } from "../../src/data/consumables";

/**
 * Regression tests for crafting recipe quantities (v2.4.0 balance nerfs).
 *
 * Seed pouches (generic + typed), Heirloom Charms, and Infusers were changed
 * from quantity: 2 → quantity: 3. These tests fail if someone reverts the nerf
 * or adds a new tier with the wrong quantity.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function consumableRecipes(idPrefix: string) {
  return CONSUMABLE_RECIPES.filter((r) => r.id.startsWith(idPrefix));
}

function tieredCost(r: (typeof CONSUMABLE_RECIPES)[number]) {
  if (r.cost.kind !== "consumable") return null;
  return r.cost;
}

// ── Heirloom Charm (II–V) ─────────────────────────────────────────────────────

describe("Heirloom Charm recipe quantities (v2.4.0 nerf)", () => {
  const charms = consumableRecipes("heirloom_charm_").filter((r) => r.tier > 1);

  it("has 4 tiered recipes (II–V)", () => {
    expect(charms).toHaveLength(4);
  });

  for (const r of charms) {
    it(`${r.name} costs quantity: 3`, () => {
      const cost = tieredCost(r);
      expect(cost).not.toBeNull();
      expect(cost!.quantity).toBe(3);
    });
  }
});

// ── Generic Seed Pouch (II–V) ─────────────────────────────────────────────────

describe("Generic Seed Pouch recipe quantities (v2.4.0 nerf)", () => {
  // Only exact "seed_pouch_N" ids — not the typed variants
  const pouches = CONSUMABLE_RECIPES.filter((r) =>
    /^seed_pouch_\d$/.test(r.id) && r.tier > 1
  );

  it("has 4 tiered recipes (II–V)", () => {
    expect(pouches).toHaveLength(4);
  });

  for (const r of pouches) {
    it(`${r.name} costs quantity: 3`, () => {
      const cost = tieredCost(r);
      expect(cost).not.toBeNull();
      expect(cost!.quantity).toBe(3);
    });
  }
});

// ── Typed Seed Pouches (all 12 types, tiers II–V) ─────────────────────────────

describe("Typed Seed Pouch recipe quantities (v2.4.0 nerf)", () => {
  const typedPouches = CONSUMABLE_RECIPES.filter((r) =>
    /^seed_pouch_[a-z]+_[2-5]$/.test(r.id)
  );

  it("has 48 tiered typed-pouch recipes (12 types × 4 tiers)", () => {
    expect(typedPouches).toHaveLength(48);
  });

  it("every tiered typed pouch costs quantity: 3", () => {
    for (const r of typedPouches) {
      const cost = tieredCost(r);
      expect(cost, `${r.id} should have consumable cost`).not.toBeNull();
      expect(cost!.quantity, `${r.id} quantity`).toBe(3);
    }
  });
});

// ── Infuser (II–V via ATTUNEMENT_RECIPES) ────────────────────────────────────

describe("Infuser recipe quantities (v2.4.0 nerf)", () => {
  const infusers = ATTUNEMENT_RECIPES.filter((r) => r.cost.kind === "attunement");

  it("has 4 tiered Infuser recipes (II–V)", () => {
    expect(infusers).toHaveLength(4);
  });

  for (const r of infusers) {
    it(`${r.name} costs quantity: 3`, () => {
      if (r.cost.kind !== "attunement") throw new Error("unexpected cost kind");
      expect(r.cost.quantity).toBe(3);
    });
  }
});
