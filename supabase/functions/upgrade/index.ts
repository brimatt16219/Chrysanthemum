import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ── Local JWT verification — no network round trip ────────────────────────────
async function verifyJWT(token: string): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(Deno.env.get("SUPABASE_JWT_SECRET")!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sig = Uint8Array.from(
      atob(b64url(sigB64)),
      (c) => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      "HMAC", key, sig,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(b64url(payloadB64)));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload.sub as string;
  } catch {
    return null;
  }
}

// ── Farm upgrade tiers (mirrors src/data/upgrades.ts) ────────────────────────
const FARM_UPGRADES = [
  { rows: 3, cols: 3, cost: 0       },
  { rows: 4, cols: 4, cost: 1_000   },
  { rows: 5, cols: 5, cost: 5_000   },
  { rows: 6, cols: 6, cost: 30_000  },
  { rows: 7, cols: 6, cost: 100_000 },
  { rows: 8, cols: 6, cost: 350_000 },
  { rows: 9, cols: 6, cost: 750_000 },
];

// ── Shop slot upgrades (mirrors src/data/upgrades.ts) ────────────────────────
const SHOP_SLOT_UPGRADES = [
  { slots: 5,  cost: 500     },
  { slots: 6,  cost: 3_000   },
  { slots: 7,  cost: 8_000   },
  { slots: 8,  cost: 25_000  },
  { slots: 9,  cost: 75_000  },
  { slots: 10, cost: 200_000 },
  { slots: 11, cost: 450_000 },
  { slots: 12, cost: 750_000 },
];

function getNextFarmUpgrade(rows: number, cols: number) {
  return FARM_UPGRADES.find((u) => u.rows > rows || (u.rows === rows && u.cols > cols)) ?? null;
}
function getNextShopSlotUpgrade(currentSlots: number) {
  return SHOP_SLOT_UPGRADES.find((u) => u.slots > currentSlots) ?? null;
}

function resizeGrid(old: { id: string; plant: unknown }[][], newRows: number, newCols: number) {
  return Array.from({ length: newRows }, (_, row) =>
    Array.from({ length: newCols }, (_, col) =>
      old[row]?.[col] ?? { id: `${row}-${col}`, plant: null }
    )
  );
}

Deno.serve(async (req: Request) => {
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
    const { action } = await req.json() as { action: "farm" | "shop_slots" };

    if (action !== "farm" && action !== "shop_slots") {
      return new Response(JSON.stringify({ error: "Invalid action — use 'farm' or 'shop_slots'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const selectCols = action === "farm"
      ? "coins, farm_rows, farm_size, grid"
      : "coins, shop_slots, shop";

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [verifiedId, saveResult] = await Promise.all([
      verifyJWT(token),
      supabaseAdmin.from("game_saves").select(selectCols).eq("user_id", userId).single(),
    ]);

    if (!verifiedId || verifiedId !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (saveResult.error || !saveResult.data) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const save = saveResult.data;
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

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({
      user_id: userId, action: `upgrade_${action}`,
      payload: { action }, result: logResult,
    });

    return new Response(
      JSON.stringify({ ok: true, ...updatePayload }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("upgrade error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
