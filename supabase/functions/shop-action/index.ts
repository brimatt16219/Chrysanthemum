import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mutation value multipliers (mirrors src/data/flowers.ts)
const MUTATION_MULTIPLIERS: Record<string, number> = {
  giant:      1.5,
  wet:        1.3,
  scorched:   1.4,
  frosted:    1.4,
  stellar:    2.0,
  prismatic:  3.0,
  gilded:     2.5,
  moonlit:    1.8,
  shocked:    1.6,
  windstruck: 1.5,
};

// Flower sell values (mirrors src/data/flowers.ts)
const FLOWER_SELL_VALUES: Record<string, number> = {
  daisy:          10,
  sunflower:      13,
  marigold:       16,
  lavender:       18,
  petunia:        20,
  pearlwort:      42,
  snapdragon:     52,
  foxglove:       63,
  cosmos:         73,
  carnation:      84,
  tulip:          84,
  iris:          250,
  orchid:        310,
  peony:         370,
  water_lily:    430,
  bird_of_paradise: 500,
  lotus:        3600,
  moonflower:   4500,
  dragonfruit_blossom: 5400,
  fire_lily:    6300,
  black_rose:   7200,
  nebula_drift:    50000,
  aurora_bloom:    62500,
  void_orchid:     75000,
  celestial_rose:  87500,
  chrysanthemum:  100000,
  starweave:      250000,
  eclipse_lily:   312500,
  solarburst:     375000,
  duskpetal:      437500,
  aether_bloom:   500000,
  rainbow_daisy:      1000000,
  prism_lotus:        1200000,
  kaleidoscope_rose:  1400000,
  aurora_orchid:      1600000,
  cosmic_sunflower:   1800000,
  princess_blossom:   2000000,
};

type Action = "buy" | "buy_all" | "sell";

interface ShopSlot {
  speciesId:      string;
  price:          number;
  quantity:       number;
  isFertilizer?:  boolean;
  fertilizerType?: string;
  isEmpty?:       boolean;
}

interface InventoryItem {
  speciesId:  string;
  quantity:   number;
  mutation?:  string;
  isSeed?:    boolean;
}

interface FertilizerItem {
  type:     string;
  quantity: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse input ───────────────────────────────────────────────────────────
    const body = await req.json() as {
      action:     Action;
      speciesId?: string;       // flower buy / sell
      fertType?:  string;       // fertilizer buy
      quantity?:  number;       // sell quantity (default 1)
      mutation?:  string;       // sell — which mutation variant
    };

    const { action } = body;
    if (!["buy", "buy_all", "sell"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load save ─────────────────────────────────────────────────────────────
    const { data: save, error: saveError } = await supabaseAdmin
      .from("game_saves")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (saveError || !save) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shop        = (save.shop        ?? []) as ShopSlot[];
    const inventory   = (save.inventory   ?? []) as InventoryItem[];
    const fertilizers = (save.fertilizers ?? []) as FertilizerItem[];
    let coins         = save.coins as number;

    let newShop        = [...shop];
    let newInventory   = [...inventory];
    let newFertilizers = [...fertilizers];
    let logResult: Record<string, unknown> = {};

    // ── buy / buy_all ─────────────────────────────────────────────────────────
    if (action === "buy" || action === "buy_all") {
      const isFert = !!body.fertType;

      if (isFert) {
        // ── Buy fertilizer ───────────────────────────────────────────────────
        const { fertType } = body;
        const slot = newShop.find((s) => s.isFertilizer && s.fertilizerType === fertType);
        if (!slot || slot.quantity < 1) {
          return new Response(JSON.stringify({ error: "Fertilizer not in stock" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const qty = action === "buy_all"
          ? Math.min(slot.quantity, Math.floor(coins / slot.price))
          : 1;

        if (qty < 1 || coins < slot.price) {
          return new Response(JSON.stringify({ error: "Cannot afford fertilizer" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        coins -= slot.price * qty;
        newShop = newShop.map((s) =>
          s.isFertilizer && s.fertilizerType === fertType
            ? { ...s, quantity: s.quantity - qty }
            : s
        );

        const existingFert = newFertilizers.find((f) => f.type === fertType);
        newFertilizers = existingFert
          ? newFertilizers.map((f) => f.type === fertType ? { ...f, quantity: f.quantity + qty } : f)
          : [...newFertilizers, { type: fertType!, quantity: qty }];

        logResult = { fertType, qty, coins };

      } else {
        // ── Buy flower seed ──────────────────────────────────────────────────
        const { speciesId } = body;
        if (!speciesId) {
          return new Response(JSON.stringify({ error: "speciesId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const slot = newShop.find((s) => s.speciesId === speciesId && !s.isFertilizer);
        if (!slot || slot.quantity < 1) {
          return new Response(JSON.stringify({ error: "Flower not in stock" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const qty = action === "buy_all"
          ? Math.min(slot.quantity, Math.floor(coins / slot.price))
          : 1;

        if (qty < 1 || coins < slot.price) {
          return new Response(JSON.stringify({ error: "Cannot afford seed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        coins -= slot.price * qty;
        newShop = newShop.map((s) =>
          s.speciesId === speciesId && !s.isFertilizer
            ? { ...s, quantity: s.quantity - qty }
            : s
        );

        const existingSeed = newInventory.find((i) => i.speciesId === speciesId && i.isSeed);
        newInventory = existingSeed
          ? newInventory.map((i) =>
              i.speciesId === speciesId && i.isSeed
                ? { ...i, quantity: i.quantity + qty }
                : i
            )
          : [...newInventory, { speciesId, quantity: qty, isSeed: true }];

        logResult = { speciesId, qty, coins };
      }
    }

    // ── sell ──────────────────────────────────────────────────────────────────
    if (action === "sell") {
      const { speciesId, mutation } = body;
      const qty = body.quantity ?? 1;

      if (!speciesId) {
        return new Response(JSON.stringify({ error: "speciesId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const item = newInventory.find(
        (i) => i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
      );

      if (!item || item.quantity < qty) {
        return new Response(JSON.stringify({ error: "Item not in inventory or insufficient quantity" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sellValue  = FLOWER_SELL_VALUES[speciesId] ?? 0;
      const multiplier = mutation ? (MUTATION_MULTIPLIERS[mutation] ?? 1) : 1;
      const earned     = Math.floor(sellValue * multiplier) * qty;

      coins += earned;

      newInventory = newInventory
        .map((i) =>
          i.speciesId === speciesId && i.mutation === mutation && !i.isSeed
            ? { ...i, quantity: i.quantity - qty }
            : i
        )
        .filter((i) => i.quantity > 0);

      logResult = { speciesId, mutation, qty, earned, coins };
    }

    // ── Write to DB ───────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("game_saves")
      .update({
        coins:       coins,
        shop:        newShop,
        inventory:   newInventory,
        fertilizers: newFertilizers,
        updated_at:  new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Log action ────────────────────────────────────────────────────────────
    await supabaseAdmin.from("action_log").insert({
      user_id: user.id,
      action,
      payload: body,
      result:  logResult,
    });

    // ── Return delta ──────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        ok:          true,
        coins,
        shop:        newShop,
        inventory:   newInventory,
        fertilizers: newFertilizers,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("shop-action error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
