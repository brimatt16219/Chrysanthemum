import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// base64url → base64 with proper padding for Deno's strict atob()
function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

// ── Farm upgrade tiers (mirrors src/data/upgrades.ts) ────────────────────────
const FARM_UPGRADES = [
  { rows: 3, cols: 3, cost: 0,       minLevel: 1  },
  { rows: 4, cols: 4, cost: 1_000,   minLevel: 3  },
  { rows: 5, cols: 5, cost: 5_000,   minLevel: 6  },
  { rows: 6, cols: 6, cost: 30_000,  minLevel: 10 },
  { rows: 7, cols: 6, cost: 100_000, minLevel: 14 },
  { rows: 8, cols: 6, cost: 350_000, minLevel: 18 },
  { rows: 9, cols: 6, cost: 750_000, minLevel: 22 },
];

// ── Shop slot upgrades (mirrors src/data/upgrades.ts) ────────────────────────
const SHOP_SLOT_UPGRADES = [
  { slots: 5,  cost: 500,     minLevel: 1  },
  { slots: 6,  cost: 3_000,   minLevel: 3  },
  { slots: 7,  cost: 8_000,   minLevel: 5  },
  { slots: 8,  cost: 25_000,  minLevel: 8  },
  { slots: 9,  cost: 75_000,  minLevel: 11 },
  { slots: 10, cost: 200_000, minLevel: 14 },
  { slots: 11, cost: 450_000, minLevel: 18 },
  { slots: 12, cost: 750_000, minLevel: 22 },
];

// ── Supply slot upgrades (mirrors src/data/upgrades.ts) ──────────────────────
const SUPPLY_SLOT_UPGRADES = [
  { slots: 3, cost: 15_000,    minLevel: 8  },
  { slots: 4, cost: 50_000,    minLevel: 12 },
  { slots: 5, cost: 150_000,   minLevel: 16 },
  { slots: 6, cost: 350_000,   minLevel: 20 },
  { slots: 7, cost: 800_000,   minLevel: 24 },
  { slots: 8, cost: 2_000_000, minLevel: 28 },
];

// ── Crafting slot upgrades (mirrors src/data/gear-recipes.ts) ─────────────────
const CRAFTING_SLOT_UPGRADES = [
  { slots: 2, cost: 5_000,   minLevel: 5  },
  { slots: 3, cost: 25_000,  minLevel: 9  },
  { slots: 4, cost: 100_000, minLevel: 14 },
  { slots: 5, cost: 300_000, minLevel: 19 },
  { slots: 6, cost: 700_000, minLevel: 24 },
];

// ── Alchemy attunement slot upgrades (mirrors src/data/gear-recipes.ts) ───────
// Player starts at 0 slots. Each unlock = one more concurrent attunement.
const ATTUNEMENT_SLOT_UPGRADES = [
  { slots: 1, cost: 50_000,  minLevel: 10 },
  { slots: 2, cost: 150_000, minLevel: 15 },
  { slots: 3, cost: 350_000, minLevel: 20 },
  { slots: 4, cost: 700_000, minLevel: 25 },
];

function getNextFarmUpgrade(rows: number, cols: number) {
  return FARM_UPGRADES.find((u) => u.rows > rows || (u.rows === rows && u.cols > cols)) ?? null;
}
function getNextShopSlotUpgrade(currentSlots: number) {
  return SHOP_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;
}
function getNextSupplySlotUpgrade(currentSlots: number) {
  return SUPPLY_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;
}
function getNextCraftingSlotUpgrade(currentSlots: number) {
  return CRAFTING_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;
}
function getNextAttunementSlotUpgrade(currentSlots: number) {
  return ATTUNEMENT_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;
}

function resizeGrid(old: { id: string; plant: unknown }[][], newRows: number, newCols: number) {
  return Array.from({ length: newRows }, (_, row) =>
    Array.from({ length: newCols }, (_, col) =>
      old[row]?.[col] ?? { id: `${row}-${col}`, plant: null }
    )
  );
}

Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse action first so we can target the right columns ─────────────────
    const { action } = await req.json() as { action: "farm" | "shop_slots" | "supply_slots" | "crafting_slots" | "attunement_slots" };

    if (action !== "farm" && action !== "shop_slots" && action !== "supply_slots" && action !== "crafting_slots" && action !== "attunement_slots") {
      return new Response(JSON.stringify({ error: "Invalid action — use 'farm', 'shop_slots', 'supply_slots', 'crafting_slots', or 'attunement_slots'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const selectCols =
      action === "farm"             ? "coins, farm_rows, farm_size, grid, gardener_level"     :
      action === "shop_slots"       ? "coins, shop_slots, shop, gardener_level"               :
      action === "supply_slots"     ? "coins, supply_slots, supply_shop, gardener_level"      :
      action === "crafting_slots"   ? "coins, crafting_slot_count, gardener_level"            :
                                      "coins, attunement_slots, gardener_level";

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves").select(selectCols).eq("user_id", userId).single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (saveResult.error || !saveResult.data) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const save          = saveResult.data;
    const gardenerLevel = (save.gardener_level as number) ?? 1;
    let coins     = save.coins as number;
    let updatePayload: Record<string, unknown> = {};
    let logResult: Record<string, unknown>     = {};

    // ── Upgrade farm ──────────────────────────────────────────────────────────
    if (action === "farm") {
      const farmRows = save.farm_rows as number;
      const farmSize = save.farm_size as number;
      const next     = getNextFarmUpgrade(farmRows, farmSize);

      if (!next) {
        return new Response(JSON.stringify({ error: "Farm is already at max size" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gardenerLevel < next.minLevel) {
        return new Response(JSON.stringify({ error: `Requires Gardener Level ${next.minLevel}` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (coins < next.cost) {
        return new Response(JSON.stringify({ error: "Not enough coins" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      coins -= next.cost;
      const newGrid = resizeGrid(save.grid as { id: string; plant: unknown }[][], next.rows, next.cols);
      updatePayload = { coins, farm_size: next.cols, farm_rows: next.rows, grid: newGrid };
      logResult = { from: { rows: farmRows, cols: farmSize }, to: { rows: next.rows, cols: next.cols }, cost: next.cost };
    }

    // ── Upgrade shop slots ────────────────────────────────────────────────────
    if (action === "shop_slots") {
      const currentSlots = save.shop_slots as number;
      const next         = getNextShopSlotUpgrade(currentSlots);

      if (!next) {
        return new Response(JSON.stringify({ error: "Shop slots already at maximum" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gardenerLevel < next.minLevel) {
        return new Response(JSON.stringify({ error: `Requires Gardener Level ${next.minLevel}` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (coins < next.cost) {
        return new Response(JSON.stringify({ error: "Not enough coins" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      coins -= next.cost;
      const newSlotCount = next.slots - currentSlots;
      const shop         = (save.shop ?? []) as { isFertilizer?: boolean }[];
      const emptySlots   = Array.from({ length: newSlotCount }, (_, i) => ({
        speciesId: `empty_${Date.now()}_${i}`, price: 0, quantity: 0, isEmpty: true,
      }));

      updatePayload = {
        coins, shop_slots: next.slots,
        shop: [...shop.filter((s) => !s.isFertilizer), ...emptySlots, ...shop.filter((s) => s.isFertilizer)],
      };
      logResult = { from: currentSlots, to: next.slots, cost: next.cost };
    }

    // ── Upgrade supply slots ──────────────────────────────────────────────────
    if (action === "supply_slots") {
      const currentSlots = (save.supply_slots ?? 2) as number;
      const next         = getNextSupplySlotUpgrade(currentSlots);

      if (!next) {
        return new Response(JSON.stringify({ error: "Supply slots already at maximum" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gardenerLevel < next.minLevel) {
        return new Response(JSON.stringify({ error: `Requires Gardener Level ${next.minLevel}` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (coins < next.cost) {
        return new Response(JSON.stringify({ error: "Not enough coins" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      coins -= next.cost;
      const newSlotCount  = next.slots - currentSlots;
      const supplyShop    = (save.supply_shop ?? []) as { isEmpty?: boolean }[];
      const emptySlots    = Array.from({ length: newSlotCount }, (_, i) => ({
        speciesId: `supply_empty_${Date.now()}_${i}`,
        price: 0, quantity: 0, isEmpty: true,
      }));

      updatePayload = {
        coins,
        supply_slots: next.slots,
        supply_shop:  [...supplyShop, ...emptySlots],
      };
      logResult = { from: currentSlots, to: next.slots, cost: next.cost };
    }

    // ── Upgrade crafting slots ────────────────────────────────────────────────
    if (action === "crafting_slots") {
      const currentSlots = (save.crafting_slot_count ?? 1) as number;
      const next         = getNextCraftingSlotUpgrade(currentSlots);

      if (!next) {
        return new Response(JSON.stringify({ error: "Crafting slots already at maximum" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gardenerLevel < next.minLevel) {
        return new Response(JSON.stringify({ error: `Requires Gardener Level ${next.minLevel}` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (coins < next.cost) {
        return new Response(JSON.stringify({ error: "Not enough coins" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      coins -= next.cost;
      updatePayload = { coins, crafting_slot_count: next.slots };
      logResult = { from: currentSlots, to: next.slots, cost: next.cost };
    }

    // ── Upgrade attunement slots (alchemy attune queue) ──────────────────────
    if (action === "attunement_slots") {
      const currentSlots = (save.attunement_slots ?? 0) as number;
      const next         = getNextAttunementSlotUpgrade(currentSlots);

      if (!next) {
        return new Response(JSON.stringify({ error: "Attunement slots already at maximum" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gardenerLevel < next.minLevel) {
        return new Response(JSON.stringify({ error: `Requires Gardener Level ${next.minLevel}` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (coins < next.cost) {
        return new Response(JSON.stringify({ error: "Not enough coins" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      coins -= next.cost;
      updatePayload = { coins, attunement_slots: next.slots };
      logResult = { from: currentSlots, to: next.slots, cost: next.cost };
    }

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select("updated_at")
      .single();

    if (updateError || !updateData) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: `upgrade_${action}`,
      payload: { action }, result: logResult,
    });

    return new Response(
      JSON.stringify({ ok: true, ...updatePayload, serverUpdatedAt: updateData.updated_at }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("upgrade error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
