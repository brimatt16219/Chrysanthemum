import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

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
  // Event-exclusive
  sakura_blossom: 1_500_000,
  // v2.3.0 & v2.3.1 additions
  stormcap: 14, stardust: 16, moonstrike: 56, winterwood: 325,
  galebloom: 4_000, infernopetal: 51_000, anchorweed: 55_000, worldroot: 60_000,
  clearingbloom: 65_000, permafrost: 71_000, frostspine: 75_000, tempest_eye: 79_000,
  thundercrown: 81_000, moonsmile: 84_000, dreamshade: 87_000, gravewilt: 93_000,
  deeproot: 320_000, rimestorm: 365_000, solglow: 440_000,
  islebloom: 1_400_000, moonrime: 1_650_000, shadowgale: 1_900_000,
  cloudveil: 14, pepperbloom: 14, flurrysprig: 14, showerbloom: 15, creamcap: 15,
  duskling: 16, moongrass: 16, owlsage: 17, brewleaf: 17, hexblossom: 18,
  starfleck: 18, cometail: 19, glacierbud: 45, cloudgrass: 48, chimebloom: 51,
  evenfall: 54, sundrift: 58, moonspan: 61, tanglewort: 66, medalwort: 74,
  topazbloom: 80, blazecrown: 265, terracotta: 275, frostmark: 310, coldsnap: 340,
  voidpetal: 430,
  // Cropsticks cross-breed outputs
  phoenix_lily: 22_000, eclipse_bloom: 24_000, tempest_orchid: 26_000,
  blightmantle: 28_000, cosmosbloom: 30_000, dreamgust: 32_000,
  solarburst: 130_000, tidalune: 150_000, whisperleaf: 170_000, crystalmind: 190_000,
  void_chrysalis: 700_000, starloom: 800_000, the_first_bloom: 5_000_000,
};

// ── Mutation sell multipliers (mirrors src/data/flowers.ts) ──────────────────
const MUTATION_MULTIPLIERS: Record<string, number> = {
  golden: 4.0, rainbow: 5.0, giant: 2.0, moonlit: 2.5,
  frozen: 2.0, scorched: 2.0, wet: 1.1, windstruck: 0.7, shocked: 2.5,
};

// ── Fertilizer shop prices (mirrors src/data/upgrades.ts) ────────────────────
const FERTILIZER_SHOP_PRICES: Record<string, number> = {
  basic:    10,
  advanced: 30,
  premium:  200,
  elite:    2_500,
  miracle:  35_000,
};
const VALID_FERTILIZER_TYPES = ["basic", "advanced", "premium", "elite", "miracle"];

// ── Gear shop prices (mirrors src/data/gear.ts) ───────────────────────────────
const GEAR_SHOP_PRICES: Record<string, number> = {
  sprinkler_rare:         500,
  sprinkler_legendary:    5_000,
  sprinkler_mythic:       25_000,
  sprinkler_exalted:      75_000,
  sprinkler_prismatic:    200_000,
  sprinkler_midas:        500_000,
  sprinkler_prism:        1_000_000,
  grow_lamp_uncommon:     200,
  grow_lamp_rare:         2_000,
  scarecrow_rare:         1_500,
  fan_uncommon:           300,
  fan_rare:               2_500,
  composter_uncommon:     400,
  composter_rare:         3_000,
  harvest_bell_rare:      5_000,
  harvest_bell_legendary: 30_000,
  auto_planter_prismatic: 500_000,
};

// ── Marketplace slot upgrade costs (mirrors src/data/upgrades.ts) ─────────────
const MARKETPLACE_SLOT_UPGRADES = [
  { slots: 1, cost: 10_000,  minLevel: 5  },
  { slots: 2, cost: 50_000,  minLevel: 10 },
  { slots: 3, cost: 150_000, minLevel: 15 },
  { slots: 4, cost: 350_000, minLevel: 20 },
  { slots: 5, cost: 650_000, minLevel: 25 },
];

const _MAX_MARKETPLACE_SLOTS = 5;
const MARKETPLACE_MIN_LEVEL  = 5;
const LISTING_FEE_PCT        = 0.05; // 5% listing fee, non-refundable
const LISTING_DURATION_MS    = 48 * 60 * 60 * 1_000; // 48 hours

interface InventoryItem  { speciesId: string; quantity: number; mutation?: string; isSeed?: boolean; }
interface FertilizerItem { type: string; quantity: number; }
interface GearItem       { gearType: string; quantity: number; }
interface ConsumableItem { id: string; quantity: number; }

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
      action:           "create_listing" | "upgrade_slots";
      speciesId?:       string;
      mutation?:        string;
      askPrice?:        number;
      isSeed?:          boolean;
      isFertilizer?:    boolean;
      fertilizerType?:  string;
      isGear?:          boolean;
      gearType?:        string;
      isConsumable?:    boolean;
      consumableId?:    string;
    };

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Verify JWT + load save in parallel ────────────────────────────────────
    const [authResult, saveResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin
        .from("game_saves")
        .select("coins, inventory, fertilizers, gear_inventory, consumables, marketplace_slots, gardener_level, updated_at")
        .eq("user_id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (saveResult.error || !saveResult.data) {
      console.error("save load failed:", saveResult.error);
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const save = saveResult.data;
    const priorUpdatedAt = save.updated_at as string;
    const gardenerLevel = (save.gardener_level as number) ?? 1;
    console.log("save loaded:", JSON.stringify({ coins: save.coins, marketplace_slots: save.marketplace_slots, action: body.action }));
    let coins             = save.coins as number;
    let newInventory      = [...(save.inventory ?? []) as InventoryItem[]];
    let newFertilizers    = [...(save.fertilizers ?? []) as FertilizerItem[]];
    let newGearInventory  = [...(save.gear_inventory ?? []) as GearItem[]];
    let newConsumables    = [...(save.consumables ?? []) as ConsumableItem[]];
    let marketplaceSlots  = (save.marketplace_slots ?? 0) as number;

    // ── upgrade_slots ─────────────────────────────────────────────────────────
    if (body.action === "upgrade_slots") {
      const next = MARKETPLACE_SLOT_UPGRADES.find((u) => u.slots > marketplaceSlots);
      if (!next) {
        return new Response(JSON.stringify({ error: "Already at max marketplace slots" }), {
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
      marketplaceSlots = next.slots;

      const { data: updateData, error: updateError } = await supabaseAdmin
        .from("game_saves")
        .update({ coins, marketplace_slots: marketplaceSlots, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (updateError || !updateData) {
        return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ ok: true, coins, marketplaceSlots, serverUpdatedAt: updateData.updated_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── create_listing ────────────────────────────────────────────────────────
    if (body.action === "create_listing") {
      if (gardenerLevel < MARKETPLACE_MIN_LEVEL) {
        return new Response(JSON.stringify({ error: `Requires Gardener Level ${MARKETPLACE_MIN_LEVEL} to use the Marketplace` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Number.isInteger(body.askPrice) || body.askPrice < 1) {
        return new Response(JSON.stringify({ error: "askPrice must be a positive integer" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check active listing count vs slot limit
      const { count: activeCount } = await supabaseAdmin
        .from("marketplace_listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", userId)
        .eq("status", "active");

      if ((activeCount ?? 0) >= marketplaceSlots) {
        return new Response(JSON.stringify({ error: "No listing slots available" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct listing fee
      const fee = Math.max(1, Math.floor(body.askPrice * LISTING_FEE_PCT));
      if (coins < fee) {
        return new Response(JSON.stringify({ error: "Not enough coins for listing fee" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      coins -= fee;

      const expiresAt = new Date(Date.now() + LISTING_DURATION_MS).toISOString();

      // ── Fertilizer listing ────────────────────────────────────────────────
      if (body.isFertilizer) {
        const fertType = body.fertilizerType;
        if (!fertType || !VALID_FERTILIZER_TYPES.includes(fertType)) {
          return new Response(JSON.stringify({ error: "Invalid fertilizer type" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const fertIdx = newFertilizers.findIndex((f) => f.type === fertType);
        if (fertIdx === -1 || newFertilizers[fertIdx].quantity < 1) {
          return new Response(JSON.stringify({ error: "Fertilizer not in inventory" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Deduct one fertilizer
        newFertilizers = newFertilizers
          .map((f, i) => i === fertIdx ? { ...f, quantity: f.quantity - 1 } : f)
          .filter((f) => f.quantity > 0);

        const baseValue = FERTILIZER_SHOP_PRICES[fertType] ?? 0;

        // Insert listing — encode fertilizer type as "fert:<type>" in species_id
        const { data: listing, error: insertError } = await supabaseAdmin
          .from("marketplace_listings")
          .insert({
            seller_id:  userId,
            species_id: `fert:${fertType}`,
            mutation:   null,
            is_seed:    false,
            ask_price:  body.askPrice,
            price:      body.askPrice,
            base_value: baseValue,
            fee_paid:   fee,
            status:     "active",
            expires_at: expiresAt,
          })
          .select("id")
          .single();

        if (insertError || !listing) {
          console.error("fertilizer listing insert failed:", insertError);
          return new Response(JSON.stringify({ error: "Failed to create listing" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: updateData, error: updateError } = await supabaseAdmin
          .from("game_saves")
          .update({ coins, fertilizers: newFertilizers, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("updated_at", priorUpdatedAt)
          .select("updated_at")
          .single();

        if (updateError || !updateData) {
          console.error("save update failed:", updateError);
          await supabaseAdmin.from("marketplace_listings").delete().eq("id", listing.id);
          return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ ok: true, coins, fertilizers: newFertilizers, inventory: newInventory, listingId: listing.id, serverUpdatedAt: updateData.updated_at }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Gear listing ──────────────────────────────────────────────────────
      if (body.isGear) {
        const gearType = body.gearType;
        if (!gearType || !(gearType in GEAR_SHOP_PRICES)) {
          return new Response(JSON.stringify({ error: "Invalid gear type" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const gearIdx = newGearInventory.findIndex((g) => g.gearType === gearType);
        if (gearIdx === -1 || newGearInventory[gearIdx].quantity < 1) {
          return new Response(JSON.stringify({ error: "Gear not in inventory" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Deduct one gear item
        newGearInventory = newGearInventory
          .map((g, i) => i === gearIdx ? { ...g, quantity: g.quantity - 1 } : g)
          .filter((g) => g.quantity > 0);

        const baseValue = GEAR_SHOP_PRICES[gearType] ?? 0;

        // Insert listing — encode gear type as "gear:<type>" in species_id
        const { data: listing, error: insertError } = await supabaseAdmin
          .from("marketplace_listings")
          .insert({
            seller_id:  userId,
            species_id: `gear:${gearType}`,
            mutation:   null,
            is_seed:    false,
            ask_price:  body.askPrice,
            price:      body.askPrice,
            base_value: baseValue,
            fee_paid:   fee,
            status:     "active",
            expires_at: expiresAt,
          })
          .select("id")
          .single();

        if (insertError || !listing) {
          console.error("gear listing insert failed:", insertError);
          return new Response(JSON.stringify({ error: "Failed to create listing" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: updateData2, error: updateError2 } = await supabaseAdmin
          .from("game_saves")
          .update({ coins, gear_inventory: newGearInventory, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("updated_at", priorUpdatedAt)
          .select("updated_at")
          .single();

        if (updateError2 || !updateData2) {
          console.error("save update failed:", updateError2);
          await supabaseAdmin.from("marketplace_listings").delete().eq("id", listing.id);
          return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ ok: true, coins, gearInventory: newGearInventory, inventory: newInventory, listingId: listing.id, serverUpdatedAt: updateData2.updated_at }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Consumable listing ───────────────────────────────────────────────
      if (body.isConsumable) {
        const consumableId = body.consumableId;
        if (!consumableId) {
          return new Response(JSON.stringify({ error: "consumableId required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const consumableIdx = newConsumables.findIndex((c) => c.id === consumableId);
        if (consumableIdx === -1 || newConsumables[consumableIdx].quantity < 1) {
          return new Response(JSON.stringify({ error: "Consumable not in inventory" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Deduct one consumable
        newConsumables = newConsumables
          .map((c, i) => i === consumableIdx ? { ...c, quantity: c.quantity - 1 } : c)
          .filter((c) => c.quantity > 0);

        // Insert listing — encode consumable id as "consumable:<id>" in species_id
        const { data: listing, error: insertError } = await supabaseAdmin
          .from("marketplace_listings")
          .insert({
            seller_id:  userId,
            species_id: `consumable:${consumableId}`,
            mutation:   null,
            is_seed:    false,
            ask_price:  body.askPrice,
            price:      body.askPrice,
            base_value: 0,
            fee_paid:   fee,
            status:     "active",
            expires_at: expiresAt,
          })
          .select("id")
          .single();

        if (insertError || !listing) {
          console.error("consumable listing insert failed:", insertError);
          return new Response(JSON.stringify({ error: "Failed to create listing" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: updateDataC, error: updateErrorC } = await supabaseAdmin
          .from("game_saves")
          .update({ coins, consumables: newConsumables, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("updated_at", priorUpdatedAt)
          .select("updated_at")
          .single();

        if (updateErrorC || !updateDataC) {
          console.error("save update failed:", updateErrorC);
          await supabaseAdmin.from("marketplace_listings").delete().eq("id", listing.id);
          return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ ok: true, coins, consumables: newConsumables, inventory: newInventory, listingId: listing.id, serverUpdatedAt: updateDataC.updated_at }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Flower / seed listing ─────────────────────────────────────────────
      if (!body.speciesId) {
        return new Response(JSON.stringify({ error: "speciesId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate item in inventory (match on speciesId + mutation + isSeed)
      const isSeed = body.isSeed ?? false;
      const itemIdx = newInventory.findIndex(
        (i) => i.speciesId === body.speciesId &&
               i.mutation === body.mutation &&
               (i.isSeed ?? false) === isSeed
      );
      if (itemIdx === -1 || newInventory[itemIdx].quantity < 1) {
        return new Response(JSON.stringify({ error: "Item not in inventory" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove one from inventory
      newInventory = newInventory
        .map((i, idx) => idx === itemIdx ? { ...i, quantity: i.quantity - 1 } : i)
        .filter((i) => i.quantity > 0);

      const mutMultiplier = body.mutation ? (MUTATION_MULTIPLIERS[body.mutation] ?? 1.0) : 1.0;
      const baseValue = Math.floor((FLOWER_SELL_VALUES[body.speciesId] ?? 0) * mutMultiplier);

      // Insert listing
      const { data: listing, error: insertError } = await supabaseAdmin
        .from("marketplace_listings")
        .insert({
          seller_id:  userId,
          species_id: body.speciesId,
          mutation:   body.mutation ?? null,
          is_seed:    isSeed,
          ask_price:  body.askPrice,
          price:      body.askPrice,
          base_value: baseValue,
          fee_paid:   fee,
          status:     "active",
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insertError || !listing) {
        console.error("insert failed:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create listing" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update save
      const { data: updateData3, error: updateError3 } = await supabaseAdmin
        .from("game_saves")
        .update({ coins, inventory: newInventory, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (updateError3 || !updateData3) {
        console.error("save update failed:", updateError3);
        await supabaseAdmin.from("marketplace_listings").delete().eq("id", listing.id);
        return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ ok: true, coins, inventory: newInventory, listingId: listing.id, serverUpdatedAt: updateData3.updated_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("marketplace-list error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
