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

// ── Mutation value multipliers (mirrors src/data/flowers.ts) ─────────────────
const MUTATION_MULTIPLIERS: Record<string, number> = {
  golden: 4.0, rainbow: 3.0, giant: 2.0, moonlit: 2.5, frozen: 2.0,
  scorched: 2.0, wet: 1.5, windstruck: 1.1, shocked: 2.5,
};

// ── Flower sell values (mirrors src/data/flowers.ts) ─────────────────────────
const FLOWER_SELL_VALUES: Record<string, number> = {
  quickgrass: 10, dustweed: 10, sprig: 12, dewdrop: 12, pebblebloom: 12,
  ember_moss: 12, dandelion: 13, clover: 13, violet: 14, lemongrass: 14,
  daisy: 14, honeywort: 14, buttercup: 14, dawnpetal: 15, poppy: 15,
  chamomile: 15, marigold: 16, sunflower: 17, coppercup: 17, ivybell: 17,
  thornberry: 18, saltmoss: 19, ashpetal: 19, snowdrift: 20,
  swiftbloom: 42, shortcress: 44, thornwhistle: 48, starwort: 50, mintleaf: 50,
  tulip: 50, inkbloom: 52, hyacinth: 53, snapdragon: 55, beebalm: 57,
  candleflower: 57, carnation: 59, ribbonweed: 60, hibiscus: 62, wildberry: 64,
  frostbell: 63, bluebell: 64, cherry_blossom: 66, rose: 67, peacockflower: 69,
  bamboo_bloom: 70, hummingbloom: 70, water_lily: 71, lanternflower: 73,
  dovebloom: 76, coral_bells: 78, sundew: 81, bubblebloom: 84,
  flashpetal: 250, rushwillow: 260, sweetheart_lily: 280, glassbell: 285,
  stormcaller: 290, lavender: 300, amber_crown: 300, peach_blossom: 300,
  foxglove: 320, butterbloom: 330, peony: 340, tidebloom: 350, starweave: 350,
  wisteria: 360, dreamcup: 360, coralbell: 370, foxfire: 375,
  bird_of_paradise: 380, solarbell: 380, moonpetal: 390, orchid: 400,
  duskrose: 410, passionflower: 420, glasswing: 435, mirror_orchid: 450,
  stargazer_lily: 460, prism_lily: 480, dusk_orchid: 500,
  firstbloom: 3_600, haste_lily: 3_800, verdant_crown: 4_200, ironwood_bloom: 4_300,
  sundial: 4_400, lotus: 4_500, candy_blossom: 4_700, prismbark: 4_700,
  dolphinia: 4_800, ghost_orchid: 4_800, nestbloom: 5_000, black_rose: 5_100,
  pumpkin_blossom: 5_100, starburst_lily: 5_100, sporebloom: 5_300, fire_lily: 5_400,
  stargazer: 5_600, fullmoon_bloom: 5_700, ice_crown: 5_700, diamond_bloom: 6_000,
  oracle_eye: 6_300, halfmoon_bloom: 6_600, aurora_bloom: 6_700, mirrorpetal: 6_900,
  emberspark: 7_200,
  blink_rose: 50_000, dawnfire: 53_000, moonflower: 58_000, jellybloom: 59_000,
  celestial_bloom: 63_000, void_blossom: 69_000, seraph_wing: 77_000,
  solar_rose: 79_000, nebula_drift: 84_000, superbloom: 90_000,
  wanderbloom: 90_000, chrysanthemum: 100_000,
  umbral_bloom: 250_000, obsidian_rose: 285_000, duskmantle: 310_000,
  graveweb: 355_000, nightwing: 430_000, ashenveil: 465_000, voidfire: 500_000,
  dreambloom: 1_000_000, fairy_blossom: 1_200_000, lovebind: 1_350_000,
  eternal_heart: 1_550_000, nova_bloom: 1_800_000, princess_blossom: 2_000_000,
};

type Action = "buy" | "buy_all" | "sell" | "sync";
interface ShopSlot { speciesId: string; price: number; quantity: number; isFertilizer?: boolean; fertilizerType?: string; isEmpty?: boolean; }
interface InventoryItem { speciesId: string; quantity: number; mutation?: string; isSeed?: boolean; }
interface FertilizerItem { type: string; quantity: number; }

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

    const body = await req.json() as {
      action: Action; speciesId?: string; fertType?: string; quantity?: number; mutation?: string;
      shop?: ShopSlot[]; lastShopReset?: number;
    };

    if (!["buy", "buy_all", "sell", "sync"].includes(body.action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── sync: write restocked shop to DB, no save read needed ────────────────
    if (body.action === "sync") {
      const authResult = await supabaseAdmin.auth.getUser(token);
      if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!body.shop || typeof body.lastShopReset !== "number") {
        return new Response(JSON.stringify({ error: "shop and lastShopReset required for sync" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: syncError } = await supabaseAdmin
        .from("game_saves")
        .update({ shop: body.shop, last_shop_reset: body.lastShopReset, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (syncError) {
        return new Response(JSON.stringify({ error: "Failed to sync shop" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin.from("game_saves").select("coins, shop, inventory, fertilizers").eq("user_id", userId).single(),
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

    const save        = saveResult.data;
    let coins         = save.coins as number;
    let newShop        = [...(save.shop        ?? []) as ShopSlot[]];
    let newInventory   = [...(save.inventory   ?? []) as InventoryItem[]];
    let newFertilizers = [...(save.fertilizers ?? []) as FertilizerItem[]];
    let logResult: Record<string, unknown> = {};

    const { action } = body;

    // ── buy / buy_all ─────────────────────────────────────────────────────────
    if (action === "buy" || action === "buy_all") {
      if (body.fertType) {
        const slot = newShop.find((s) => s.isFertilizer && s.fertilizerType === body.fertType);
        if (!slot || slot.quantity < 1) {
          return new Response(JSON.stringify({ error: "Fertilizer not in stock" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const qty = action === "buy_all" ? Math.min(slot.quantity, Math.floor(coins / slot.price)) : 1;
        if (qty < 1 || coins < slot.price) {
          return new Response(JSON.stringify({ error: "Cannot afford fertilizer" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        coins -= slot.price * qty;
        newShop = newShop.map((s) => s.isFertilizer && s.fertilizerType === body.fertType ? { ...s, quantity: s.quantity - qty } : s);
        const ef = newFertilizers.find((f) => f.type === body.fertType);
        newFertilizers = ef
          ? newFertilizers.map((f) => f.type === body.fertType ? { ...f, quantity: f.quantity + qty } : f)
          : [...newFertilizers, { type: body.fertType!, quantity: qty }];
        logResult = { fertType: body.fertType, qty, coins };

      } else {
        if (!body.speciesId) {
          return new Response(JSON.stringify({ error: "speciesId required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const slot = newShop.find((s) => s.speciesId === body.speciesId && !s.isFertilizer);
        if (!slot || slot.quantity < 1) {
          return new Response(JSON.stringify({ error: "Flower not in stock" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const qty = action === "buy_all" ? Math.min(slot.quantity, Math.floor(coins / slot.price)) : 1;
        if (qty < 1 || coins < slot.price) {
          return new Response(JSON.stringify({ error: "Cannot afford seed" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        coins -= slot.price * qty;
        newShop = newShop.map((s) => s.speciesId === body.speciesId && !s.isFertilizer ? { ...s, quantity: s.quantity - qty } : s);
        const es = newInventory.find((i) => i.speciesId === body.speciesId && i.isSeed);
        newInventory = es
          ? newInventory.map((i) => i.speciesId === body.speciesId && i.isSeed ? { ...i, quantity: i.quantity + qty } : i)
          : [...newInventory, { speciesId: body.speciesId, quantity: qty, isSeed: true }];
        logResult = { speciesId: body.speciesId, qty, coins };
      }
    }

    // ── sell ──────────────────────────────────────────────────────────────────
    if (action === "sell") {
      if (!body.speciesId) {
        return new Response(JSON.stringify({ error: "speciesId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const qty  = body.quantity ?? 1;
      const item = newInventory.find((i) => i.speciesId === body.speciesId && i.mutation === body.mutation && !i.isSeed);
      if (!item || item.quantity < qty) {
        // Idempotent: item already sold or race-depleted — return current state as
        // a no-op success so the client doesn't roll back and re-queue the same sell.
        return new Response(
          JSON.stringify({ ok: true, coins, shop: newShop, inventory: newInventory, fertilizers: newFertilizers }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const earned = Math.floor((FLOWER_SELL_VALUES[body.speciesId] ?? 0) * (body.mutation ? (MUTATION_MULTIPLIERS[body.mutation] ?? 1) : 1)) * qty;
      coins += earned;
      newInventory = newInventory
        .map((i) => i.speciesId === body.speciesId && i.mutation === body.mutation && !i.isSeed ? { ...i, quantity: i.quantity - qty } : i)
        .filter((i) => i.quantity > 0);
      logResult = { speciesId: body.speciesId, mutation: body.mutation, qty, earned, coins };
    }

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({ coins, shop: newShop, inventory: newInventory, fertilizers: newFertilizers, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({ user_id: userId, action, payload: body, result: logResult });

    return new Response(
      JSON.stringify({ ok: true, coins, shop: newShop, inventory: newInventory, fertilizers: newFertilizers }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("shop-action error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
