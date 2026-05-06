import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, Sentry } from "../_shared/sentry.ts";
import { awardXp, SELL_XP_PERCENT } from "../_shared/gardenerLevel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - t.length % 4) % 4);
}

function buildItemLabel(speciesId: string, mutation: string | null, isSeed: boolean): string {
  const cap   = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const words = (s: string) => s.split("_").map(cap).join(" ");
  if (speciesId.startsWith("fert:"))       return words(speciesId.replace("fert:", "")) + " Fertilizer";
  if (speciesId.startsWith("gear:"))       return words(speciesId.replace("gear:", ""));
  if (speciesId.startsWith("consumable:")) return words(speciesId.replace("consumable:", ""));
  const base = words(speciesId);
  return (mutation ? cap(mutation) + " " : "") + base + (isSeed ? " Seed" : "");
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

    const body = await req.json() as { listingId: string };
    if (!body.listingId) {
      return new Response(JSON.stringify({ error: "listingId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Load buyer coins + listing + buyer profile in parallel ───────────────
    const [authResult, buyerCoinsResult, listingResult, buyerProfileResult] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      supabaseAdmin
        .from("game_saves")
        .select("coins, updated_at")
        .eq("user_id", userId)
        .single(),
      supabaseAdmin
        .from("marketplace_listings")
        .select("id, seller_id, species_id, mutation, is_seed, ask_price, base_value, status")
        .eq("id", body.listingId)
        .single(),
      supabaseAdmin
        .from("users")
        .select("username")
        .eq("id", userId)
        .single(),
    ]);

    if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (buyerCoinsResult.error || !buyerCoinsResult.data) {
      return new Response(JSON.stringify({ error: "Save not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (listingResult.error || !listingResult.data) {
      return new Response(JSON.stringify({ error: "Listing not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const listing = listingResult.data;

    if (listing.status !== "active") {
      return new Response(JSON.stringify({ error: "Listing is no longer available" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (listing.seller_id === userId) {
      return new Response(JSON.stringify({ error: "Cannot buy your own listing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buyerCoins = (buyerCoinsResult.data.coins as number);
    if (buyerCoins < listing.ask_price) {
      return new Response(JSON.stringify({ error: "Not enough coins" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priorUpdatedAt = buyerCoinsResult.data.updated_at as string;
    const newBuyerCoins = buyerCoins - listing.ask_price;

    const speciesId    = listing.species_id as string;
    const isFertilizer = speciesId.startsWith("fert:");
    const isGear       = speciesId.startsWith("gear:");
    const isSeed       = (listing.is_seed as boolean) ?? false;

    const isConsumable = speciesId.startsWith("consumable:");

    // Determine item kind for mailbox
    let itemKind: string;
    if (isFertilizer)      itemKind = "fertilizer";
    else if (isGear)       itemKind = "gear";
    else if (isConsumable) itemKind = "consumable";
    else if (isSeed)       itemKind = "seed";
    else                   itemKind = "flower";

    // ── Mark listing sold (optimistic lock prevents double-buy) ───────────────
    const { error: listingUpdateError } = await supabaseAdmin
      .from("marketplace_listings")
      .update({ status: "sold", buyer_id: userId, sold_at: new Date().toISOString() })
      .eq("id", listing.id)
      .eq("status", "active");

    if (listingUpdateError) {
      return new Response(JSON.stringify({ error: "Listing no longer available" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Deliver via mailbox + deduct buyer coins + record sale in parallel ────
    const now = new Date().toISOString();

    const buyerUsername = (buyerProfileResult.data as { username?: string } | null)?.username ?? "someone";
    const itemLabel     = buildItemLabel(speciesId, listing.mutation, isSeed);

    const buyerMailInsert = supabaseAdmin.from("mailbox").insert({
      user_id:    userId,
      subject:    "Marketplace Purchase",
      kind:       itemKind,
      species_id: speciesId,
      mutation:   listing.mutation ?? null,
      is_seed:    isSeed,
      message:    "",
      created_at: now,
    });

    const sellerMailInsert = supabaseAdmin.from("mailbox").insert({
      user_id:    listing.seller_id,
      subject:    "Listing Sold",
      kind:       "coins",
      amount:     listing.ask_price,
      message:    `${itemLabel} purchased by ${buyerUsername}.`,
      created_at: now,
    });

    const buyerCoinUpdate = supabaseAdmin
      .from("game_saves")
      .update({ coins: newBuyerCoins, updated_at: now })
      .eq("user_id", userId)
      .eq("updated_at", priorUpdatedAt)
      .select("updated_at")
      .single();

    const saleRecord = supabaseAdmin.from("marketplace_sales").insert({
      species_id: speciesId,
      mutation:   listing.mutation ?? null,
      item_type:  itemKind,
      price:      listing.ask_price,
      sold_at:    now,
    });

    const [buyerMailResult, sellerMailResult, coinResult, saleResult] = await Promise.all([
      buyerMailInsert,
      sellerMailInsert,
      buyerCoinUpdate,
      saleRecord,
    ]);

    if (buyerMailResult.error) {
      console.error("marketplace-buy: buyer mailbox insert failed", buyerMailResult.error);
    }
    if (sellerMailResult.error) {
      console.error("marketplace-buy: seller mailbox insert failed", sellerMailResult.error);
    }
    if (saleResult.error) {
      console.error("marketplace-buy: sale record failed", saleResult.error);
    }
    if (coinResult.error || !coinResult.data) {
      console.error("marketplace-buy: buyer coin update failed", coinResult.error);
      return new Response(JSON.stringify({ error: "Save was modified by another action" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Seller XP grant (fire-and-forget — does not block the response) ──────
    void (async () => {
      const sellerXpGained = Math.floor((listing.ask_price as number) * SELL_XP_PERCENT);
      if (sellerXpGained <= 0) return;
      const { data: sellerSave } = await supabaseAdmin
        .from("game_saves")
        .select("gardener_level, gardener_xp")
        .eq("user_id", listing.seller_id)
        .single();

      if (!sellerSave) return;
      const { level: newLevel, xp: newXp } = awardXp(
        (sellerSave.gardener_level as number) ?? 1,
        (sellerSave.gardener_xp    as number) ?? 0,
        sellerXpGained,
      );

      await supabaseAdmin
        .from("game_saves")
        .update({ gardener_level: newLevel, gardener_xp: newXp })
        .eq("user_id", listing.seller_id);
    })();

    return new Response(
      JSON.stringify({ ok: true, coins: newBuyerCoins, serverUpdatedAt: coinResult.data.updated_at }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("marketplace-buy error:", err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
