import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Static-source regression tests for Supabase edge functions.
 *
 * These do NOT execute the Deno runtime — they read each function's index.ts
 * and assert that critical security + protocol concerns are still in place.
 * The goal is to fail CI if a refactor accidentally drops:
 *   - the OPTIONS / CORS preflight branch
 *   - the Authorization header check
 *   - JSON-shaped error responses
 *   - the service-role client (admin DB access path)
 *
 * Add new requirements here as the contract evolves.
 */

const FUNCTIONS_DIR = join(__dirname, "..", "..", "supabase", "functions");

function listEdgeFunctions(): string[] {
  return readdirSync(FUNCTIONS_DIR).filter((entry) => {
    if (entry.startsWith("_")) return false;
    const full = join(FUNCTIONS_DIR, entry);
    if (!statSync(full).isDirectory()) return false;
    try {
      statSync(join(full, "index.ts"));
      return true;
    } catch {
      return false;
    }
  });
}

const fns = listEdgeFunctions();

/**
 * Functions that use an alternative auth scheme (e.g. x-admin-secret or
 * CRON_SECRET) instead of the standard Bearer / Authorization header.
 * They are excluded from the Authorization-header assertion only.
 */
const ADMIN_AUTH_FUNCTIONS = new Set(["admin-broadcast", "marketplace-expire"]);

describe("Supabase edge function contract (regression)", () => {
  it("discovers at least one edge function", () => {
    expect(fns.length).toBeGreaterThan(0);
  });

  // ── apply-fertilizer-specific contract (v2.3.0) ───────────────────────────
  describe("apply-fertilizer — v2.3.0 bloom guard", () => {
    const fertSrc = readFileSync(join(FUNCTIONS_DIR, "apply-fertilizer", "index.ts"), "utf8");

    it("rejects fertilizer on a bloomed plant (checks bloomedAt field)", () => {
      // The edge function must guard against fertilizing a bloom — the client
      // also hides the button, but the server is the authoritative gate.
      expect(fertSrc).toMatch(/bloomedAt/);
    });

    it("returns a 400 with a descriptive error for bloomed plants", () => {
      expect(fertSrc).toMatch(/Cannot apply fertilizer to a bloomed plant/);
    });
  });

  // ── harvest-specific contract ──────────────────────────────────────────────
  describe("harvest — v2.2.4 coin-policy contract", () => {
    const harvestSrc = readFileSync(join(FUNCTIONS_DIR, "harvest", "index.ts"), "utf8");

    it("does NOT write coins to the DB during harvest (coins come from selling only)", () => {
      // This assertion fails if someone re-introduces 'coins: newCoins' in the
      // Supabase update() call inside the harvest function.
      expect(harvestSrc).not.toMatch(/coins:\s*newCoins/);
    });

    it("does NOT return bonusCoins in the response payload", () => {
      expect(harvestSrc).not.toMatch(/bonusCoins/);
    });

    it("does NOT compute sellValue or mutMultiplier (no server-side coin calculation)", () => {
      expect(harvestSrc).not.toMatch(/sellValue|mutMultiplier/);
    });
  });

  for (const name of fns) {
    describe(name, () => {
      const src = readFileSync(join(FUNCTIONS_DIR, name, "index.ts"), "utf8");

      it("handles CORS preflight (OPTIONS)", () => {
        expect(src).toMatch(/req\.method\s*===\s*["']OPTIONS["']/);
        expect(src).toMatch(/Access-Control-Allow-Origin/);
      });

      it("checks the Authorization header", () => {
        if (ADMIN_AUTH_FUNCTIONS.has(name)) {
          // Admin functions use a custom secret header instead of Bearer auth
          expect(src).toMatch(/x-admin-secret|CRON_SECRET/);
          return;
        }
        expect(src).toMatch(/Authorization/);
        // Either an explicit header check or auth.getUser must run.
        const hasHeaderCheck = /headers\.get\(\s*["']Authorization["']\s*\)/.test(src);
        const usesGetUser = /auth\.getUser\(/.test(src);
        expect(hasHeaderCheck || usesGetUser).toBe(true);
      });

      it("returns a structured 401 on unauthorized requests", () => {
        expect(src).toMatch(/Unauthorized/);
        // Accept both inline `status: 401` and helper-call patterns like err("...", 401)
        const hasInlineStatus = /status:\s*401/.test(src);
        const hasHelperStatus = /\bUnauthorized\b.*401|401.*\bUnauthorized\b/s.test(src);
        expect(hasInlineStatus || hasHelperStatus).toBe(true);
      });

      it("uses Deno.serve as the entrypoint", () => {
        expect(src).toMatch(/Deno\.serve\(/);
      });

      it("returns Content-Type application/json on error responses", () => {
        expect(src).toMatch(/application\/json/);
      });
    });
  }
});

// ── alchemy-sacrifice — v2.3.0 flower catalogue parity ───────────────────────

describe("alchemy-sacrifice — v2.3.0 new flowers present in FLOWERS array", () => {
  const serverSrc = readFileSync(join(FUNCTIONS_DIR, "alchemy-sacrifice", "index.ts"), "utf8");

  // These 10 species were added in v2.3.0 but were initially missing from the
  // edge function's FLOWERS catalogue, causing "Unknown species" 400 errors.
  const newFlowers = [
    "stormcap", "stardust",          // common
    "moonstrike",                    // uncommon
    "winterwood",                    // rare
    "deeproot", "rimestorm", "solglow", // exalted
    "islebloom", "moonrime", "shadowgale", // prismatic
  ];

  for (const id of newFlowers) {
    it(`includes ${id} in the FLOWERS catalogue`, () => {
      expect(serverSrc).toMatch(new RegExp(`id:\\s*["']${id}["']`));
    });
  }
});

// ── alchemy-sacrifice — yield rate parity (v2.3.1 regression) ───────────────

describe("alchemy-sacrifice — ESSENCE_YIELD parity with client (v2.3.1 regression)", () => {
  const serverSrc = readFileSync(join(FUNCTIONS_DIR, "alchemy-sacrifice", "index.ts"), "utf8");

  // Extract the server-side ESSENCE_YIELD block and assert the doubled rates are
  // present. This test will fail if someone updates src/data/essences.ts without
  // also updating the edge function (or vice-versa), preventing a silent divergence.
  it("server has the current doubled yield rates (common=2, rare=8, prismatic=128)", () => {
    expect(serverSrc).toMatch(/common:\s*2/);
    expect(serverSrc).toMatch(/rare:\s*8/);
    expect(serverSrc).toMatch(/prismatic:\s*128/);
  });

  it("does not contain the old halved rates (common=1, rare=4, prismatic=64)", () => {
    // These are the pre-v2.3.0 values that caused the X/2 bug
    expect(serverSrc).not.toMatch(/common:\s*1[,\s]/);
    expect(serverSrc).not.toMatch(/rare:\s*4[,\s]/);
    expect(serverSrc).not.toMatch(/prismatic:\s*64[,\s]/);
  });
});

// ── use-consumable — v2.3.0 mutation vial guard ──────────────────────────────

describe("use-consumable — v2.3.0 mutation vial guard", () => {
  const src = readFileSync(join(FUNCTIONS_DIR, "use-consumable", "index.ts"), "utf8");

  it("checks for an existing mutation before applying a mutation vial", () => {
    expect(src).toMatch(/plant\.mutation/);
  });

  it("returns a descriptive error message when the bloom already has a mutation", () => {
    expect(src).toMatch(/Purity Vial/);
  });
});

// ── daily-complete — v2.4.0 reward structure (no seed pouches) ───────────────

describe("daily-complete — v2.4.0 reward contract", () => {
  const src = readFileSync(join(FUNCTIONS_DIR, "daily-complete", "index.ts"), "utf8");

  it("DAILY_REWARDS contains only xp and gems (no pouch field)", () => {
    // Regression: seed-pouch rewards were removed in v2.4.0.
    // If 'pouch' appears in DAILY_REWARDS, reward delivery is broken.
    expect(src).not.toMatch(/pouch:/);
  });

  it("does not write consumables to the DB on task completion", () => {
    // The edge function must not touch the consumables column — inventory
    // management was removed when seed pouches were dropped from rewards.
    expect(src).not.toMatch(/consumables:/);
  });

  it("response payload does not include rewardPouch or consumables fields", () => {
    expect(src).not.toMatch(/rewardPouch/);
  });

  it("grants xp and gems on tier completion", () => {
    expect(src).toMatch(/xpGained/);
    expect(src).toMatch(/gemsGained/);
  });
});

// ── sakura_blossom — spring_sakura event flower registered everywhere ──────────
//
// sakura_blossom was added as an event-only flower but was initially missing
// from the hardcoded species tables inside every edge function, causing
// "Unknown species" 400 errors on vial use, harvest, alchemy, etc.
// These tests assert the flower is now present in each affected function.

describe("sakura_blossom — event flower registered in edge functions (regression)", () => {
  const functions: Array<{ name: string; file: string }> = [
    { name: "use-consumable",   file: "use-consumable/index.ts" },
    { name: "apply-infuser",    file: "apply-infuser/index.ts" },
    { name: "harvest",          file: "harvest/index.ts" },
    { name: "harvest-all",      file: "harvest-all/index.ts" },
    { name: "alchemy-sacrifice",file: "alchemy-sacrifice/index.ts" },
    { name: "alchemy-craft-seed",file: "alchemy-craft-seed/index.ts" },
    { name: "alchemy-infuse",   file: "alchemy-infuse/index.ts" },
    { name: "alchemy-sacrifice",file: "alchemy-sacrifice/index.ts" },
    { name: "botany-convert",   file: "botany-convert/index.ts" },
    { name: "gear-action",      file: "gear-action/index.ts" },
    { name: "marketplace-list", file: "marketplace-list/index.ts" },
    { name: "shop-action",      file: "shop-action/index.ts" },
    { name: "tick-offline-gardens", file: "tick-offline-gardens/index.ts" },
  ];

  for (const { name, file } of functions) {
    it(`${name} contains sakura_blossom`, () => {
      const src = readFileSync(join(FUNCTIONS_DIR, file), "utf8");
      expect(src, `${name} is missing sakura_blossom`).toMatch(/sakura_blossom/);
    });
  }
});

// ── achievement-claim — species_discovered uses base-species-only count ───────
//
// Bug #275: achievement-claim was counting all discovered entries (including
// mutation variants like "rose:golden") instead of only base species.
// This caused the "Species Discovered" achievement to require far more
// discoveries than intended. The fix filters to entries without a colon.

describe("achievement-claim — species_discovered base-species-only filter (Bug #275 regression)", () => {
  const src = readFileSync(join(FUNCTIONS_DIR, "achievement-claim", "index.ts"), "utf8");

  it("filters discovered entries to base species (no colon) before counting", () => {
    // The function must contain logic that strips mutation variants from the count.
    // A bare discovered.length would count both "rose" and "rose:golden" as 2,
    // inflating the progress number. The correct pattern filters out ":" entries.
    expect(src).toMatch(/includes\s*\(\s*["']:["']\s*\)/);
  });

  it("does not use raw discovered.length for species_discovered target check", () => {
    // If this assertion fails, someone re-introduced the bare length check.
    // The variable holding the base count must be intermediate (not discovered.length directly).
    expect(src).not.toMatch(/met\s*=\s*discovered\.length\s*>=\s*target/);
  });
});
