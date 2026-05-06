import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { awardXp, SELL_XP_PERCENT } from "../_shared/gardenerLevel.ts";

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
  golden: 4.0, rainbow: 5.0, giant: 2.0, moonlit: 2.5, frozen: 2.0,
  scorched: 2.0, wet: 1.1, windstruck: 0.7, shocked: 2.5,
};

// ── Flower sell values (mirrors src/data/flowers.ts) ─────────────────────────
const FLOWER_SELL_VALUES: Record<string, number> = {
  // ── Common ───────────────────────────────────────────────────────────────────
  quickgrass: 10, dustweed: 10, sprig: 12, dewdrop: 12, pebblebloom: 12,
  ember_moss: 12, dandelion: 13, clover: 13, violet: 14, lemongrass: 14,
  daisy: 14, honeywort: 14, buttercup: 14, dawnpetal: 15, poppy: 15,
  chamomile: 15, marigold: 16, sunflower: 17, coppercup: 17, ivybell: 17,
  thornberry: 18, saltmoss: 19, ashpetal: 19, snowdrift: 20,
  // v2.3.1 commons
  stormcap: 14, stardust: 16, cloudveil: 14, pepperbloom: 14, flurrysprig: 14,
  showerbloom: 15, creamcap: 15, duskling: 16, moongrass: 16, owlsage: 17,
  brewleaf: 17, hexblossom: 18, starfleck: 18, cometail: 19,
  // ── Uncommon ─────────────────────────────────────────────────────────────────
  swiftbloom: 42, shortcress: 44, thornwhistle: 48, starwort: 50, mintleaf: 50,
  tulip: 50, inkbloom: 52, hyacinth: 53, snapdragon: 55, beebalm: 57,
  candleflower: 57, carnation: 59, ribbonweed: 60, hibiscus: 62, wildberry: 64,
  frostbell: 63, bluebell: 64, cherry_blossom: 66, rose: 67, peacockflower: 69,
  bamboo_bloom: 70, hummingbloom: 70, water_lily: 71, lanternflower: 73,
  dovebloom: 76, coral_bells: 78, sundew: 81, bubblebloom: 84,
  // v2.3.1 uncommons
  moonstrike: 56, glacierbud: 45, cloudgrass: 48, chimebloom: 51, evenfall: 54,
  sundrift: 58, moonspan: 61, tanglewort: 66, medalwort: 74, topazbloom: 80,
  // ── Rare ─────────────────────────────────────────────────────────────────────
  flashpetal: 250, rushwillow: 260, sweetheart_lily: 280, glassbell: 285,
  stormcaller: 290, lavender: 300, amber_crown: 300, peach_blossom: 300,
  foxglove: 320, butterbloom: 330, peony: 340, tidebloom: 350, starweave: 350,
  wisteria: 360, dreamcup: 360, coralbell: 370, foxfire: 375,
  bird_of_paradise: 380, solarbell: 380, moonpetal: 390, orchid: 400,
  duskrose: 410, passionflower: 420, glasswing: 435, mirror_orchid: 450,
  stargazer_lily: 460, prism_lily: 480, dusk_orchid: 500,
  // v2.3.1 rares
  winterwood: 325, blazecrown: 265, terracotta: 275, frostmark: 310,
  coldsnap: 340, voidpetal: 430,
  // ── Legendary ────────────────────────────────────────────────────────────────
  firstbloom: 3_600, haste_lily: 3_800, verdant_crown: 4_200, ironwood_bloom: 4_300,
  sundial: 4_400, lotus: 4_500, candy_blossom: 4_700, prismbark: 4_700,
  dolphinia: 4_800, ghost_orchid: 4_800, nestbloom: 5_000, black_rose: 5_100,
  pumpkin_blossom: 5_100, starburst_lily: 5_100, sporebloom: 5_300, fire_lily: 5_400,
  stargazer: 5_600, fullmoon_bloom: 5_700, ice_crown: 5_700, diamond_bloom: 6_000,
  oracle_eye: 6_300, halfmoon_bloom: 6_600, aurora_bloom: 6_700, mirrorpetal: 6_900,
  emberspark: 7_200,
  // v2.3.1 legendaries
  galebloom: 4_000, phoenix_lily: 22_000, eclipse_bloom: 24_000,
  tempest_orchid: 26_000, blightmantle: 28_000, cosmosbloom: 30_000, dreamgust: 32_000,
  // ── Mythic ───────────────────────────────────────────────────────────────────
  blink_rose: 50_000, dawnfire: 53_000, moonflower: 58_000, jellybloom: 59_000,
  celestial_bloom: 63_000, void_blossom: 69_000, seraph_wing: 77_000,
  solar_rose: 79_000, nebula_drift: 84_000, superbloom: 90_000,
  wanderbloom: 90_000, chrysanthemum: 100_000,
  umbral_bloom: 250_000, obsidian_rose: 285_000, duskmantle: 310_000,
  graveweb: 355_000, nightwing: 430_000, ashenveil: 465_000, voidfire: 500_000,
  dreambloom: 1_000_000, fairy_blossom: 1_200_000, lovebind: 1_350_000,
  eternal_heart: 1_550_000, nova_bloom: 1_800_000, princess_blossom: 2_000_000,
  // v2.3.1 mythics
  infernopetal: 51_000, anchorweed: 55_000, worldroot: 60_000,
  clearingbloom: 65_000, permafrost: 71_000, frostspine: 75_000,
  tempest_eye: 79_000, thundercrown: 81_000, moonsmile: 84_000,
  dreamshade: 87_000, gravewilt: 93_000,
  deeproot: 320_000, rimestorm: 365_000, solglow: 440_000,
  islebloom: 1_400_000, moonrime: 1_650_000, shadowgale: 1_900_000,
  solarburst: 130_000, tidalune: 150_000, whisperleaf: 170_000,
  crystalmind: 190_000, void_chrysalis: 700_000, starloom: 800_000,
  the_first_bloom: 5_000_000,
};

type Action = "buy" | "buy_all" | "sell" | "sell_all" | "sync" | "buy_all_seeds";
interface ShopSlot { speciesId: string; price: number; quantity: number; isFertilizer?: boolean; fertilizerType?: string; isEmpty?: boolean; }
interface InventoryItem { speciesId: string; quantity: number; mutation?: string; isSeed?: boolean; }
interface FertilizerItem { type: string; quantity: number; }
interface SellAllItem  { speciesId: string; mutation?: string; quantity: number; }

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

    const body = await req.json() as {
      action: Action; speciesId?: string; fertType?: string; quantity?: number; mutation?: string;
      shop?: ShopSlot[]; lastShopReset?: number;
    };

    if (!["buy", "buy_all", "sell", "sell_all", "sync", "buy_all_seeds"].includes(body.action)) {
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
      supabaseAdmin.from("game_saves").select("coins, shop, inventory, fertilizers, gardener_level, gardener_xp, updated_at").eq("user_id", userId).single(),
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
    const priorUpdatedAt = save.updated_at as string;
    const gardenerLevel = (save.gardener_level as number) ?? 1;
    const gardenerXp    = (save.gardener_xp    as number) ?? 0;
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

    // ── buy_all_seeds: buy max affordable qty from every non-empty flower slot ─
    if (action === "buy_all_seeds") {
      const flowerSlots = newShop.filter((s) => !s.isFertilizer && !s.isEmpty && s.quantity > 0);
      let bought = false;
      for (const slot of flowerSlots) {
        if (!slot.speciesId) continue;
        const qty = Math.min(slot.quantity, Math.floor(coins / slot.price));
        if (qty < 1) continue;
        coins -= slot.price * qty;
        newShop = newShop.map((s) =>
          s.speciesId === slot.speciesId && !s.isFertilizer ? { ...s, quantity: s.quantity - qty } : s
        );
        const existing = newInventory.find((i) => i.speciesId === slot.speciesId && i.isSeed);
        newInventory = existing
          ? newInventory.map((i) =>
              i.speciesId === slot.speciesId && i.isSeed ? { ...i, quantity: i.quantity + qty } : i
            )
          : [...newInventory, { speciesId: slot.speciesId, quantity: qty, isSeed: true }];
        bought = true;
      }
      if (!bought) {
        return new Response(JSON.stringify({ error: "Cannot afford any seeds" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      logResult = { slotsProcessed: flowerSlots.length };
    }

    // ── sell ──────────────────────────────────────────────────────────────────
    let xpGained = 0;
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
      xpGained += Math.floor(earned * SELL_XP_PERCENT);
      newInventory = newInventory
        .map((i) => i.speciesId === body.speciesId && i.mutation === body.mutation && !i.isSeed ? { ...i, quantity: i.quantity - qty } : i)
        .filter((i) => i.quantity > 0);
      logResult = { speciesId: body.speciesId, mutation: body.mutation, qty, earned, coins };
    }

    // ── sell_all: atomically sell every bloom in the provided list ───────────
    if (action === "sell_all") {
      const items = (body as { items?: SellAllItem[] }).items ?? [];
      for (const item of items) {
        const { speciesId, mutation, quantity } = item;
        const invItem = newInventory.find(
          (i) => i.speciesId === speciesId && i.mutation === (mutation ?? undefined) && !i.isSeed
        );
        // Skip items that aren't in inventory (already sold / race) — never hard-fail
        if (!invItem || invItem.quantity < quantity) continue;
        const earned = Math.floor(
          (FLOWER_SELL_VALUES[speciesId] ?? 0) *
          (mutation ? (MUTATION_MULTIPLIERS[mutation] ?? 1) : 1)
        ) * quantity;
        coins += earned;
        xpGained += Math.floor(earned * SELL_XP_PERCENT);
        newInventory = newInventory
          .map((i) =>
            i.speciesId === speciesId && i.mutation === (mutation ?? undefined) && !i.isSeed
              ? { ...i, quantity: i.quantity - quantity }
              : i
          )
          .filter((i) => i.quantity > 0);
        logResult = { ...(logResult as object), [`${speciesId}:${mutation ?? ""}`]: earned };
      }
    }
    const { level: newLevel, xp: newXp, leveledUp, levelsGained } = awardXp(gardenerLevel, gardenerXp, xpGained);

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({
        coins,
        shop:           newShop,
        inventory:      newInventory,
        fertilizers:    newFertilizers,
        gardener_level: newLevel,
        gardener_xp:    newXp,
        updated_at:     new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    if (updateError || !updateData) {
      return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    void supabaseAdmin.from("action_log").insert({ user_id: userId, action, payload: body, result: logResult });

    return new Response(
      JSON.stringify({
        ok:              true,
        coins,
        shop:            newShop,
        inventory:       newInventory,
        fertilizers:     newFertilizers,
        xpGained,
        gardenerLevel:   newLevel,
        gardenerXp:      newXp,
        leveledUp,
        levelsGained,
        serverUpdatedAt: updateData.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("shop-action error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
