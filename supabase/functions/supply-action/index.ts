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

// ── Types (mirror src/store/gameStore.ts + src/data/gear.ts) ─────────────────

type ShopSlot = {
  speciesId:      string;
  price:          number;
  quantity:       number;
  isFertilizer?:  boolean;
  fertilizerType?: string;
  isGear?:        boolean;
  gearType?:      string;
  isConsumable?:  boolean;
  consumableId?:  string;
  isEmpty?:       boolean;
};

type GearInvItem    = { gearType: string; quantity: number };
type FertItem       = { type: string;     quantity: number };
type ConsumableItem = { id: string;       quantity: number };

// ── Response helpers ─────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (msg: string, status = 400) => json({ error: msg }, status);

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  initSentry();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const p = JSON.parse(atob(b64url(token.split(".")[1])));
      userId = p.sub;
    } catch {
      return err("Unauthorized", 401);
    }

    const body = await req.json() as {
      action:          "buy" | "buy_all" | "sync";
      slotId?:         string;
      supplyShop?:     ShopSlot[];
      lastSupplyReset?: number;
    };

    const { action } = body;
    if (!["buy", "buy_all", "sync", "unlock_slot"].includes(action)) {
      return err("Invalid action — use buy | buy_all | sync | unlock_slot");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── sync: push the restocked supply shop to DB ────────────────────────────
    if (action === "sync") {
      const authResult = await supabaseAdmin.auth.getUser(token);
      if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
        return err("Unauthorized", 401);
      }
      if (!body.supplyShop || typeof body.lastSupplyReset !== "number") {
        return err("supplyShop and lastSupplyReset required for sync");
      }

      // Read current state so we can: (a) guard stale syncs and (b) use CAS.
      const { data: cur, error: curErr } = await supabaseAdmin
        .from("game_saves")
        .select("last_supply_reset, updated_at")
        .eq("user_id", userId)
        .single();

      if (curErr || !cur) return err("Save not found", 404);

      // Skip if DB already has this or a newer reset — prevents an out-of-order
      // sync (e.g. after a concurrent buy) from clobbering more recent shop state.
      const dbReset = (cur.last_supply_reset as number) ?? 0;
      if (body.lastSupplyReset <= dbReset) {
        return json({ ok: true, serverUpdatedAt: cur.updated_at });
      }

      const newUpdatedAt = new Date().toISOString();
      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({
          supply_shop:        body.supplyShop,
          last_supply_reset:  body.lastSupplyReset,
          updated_at:         newUpdatedAt,
        })
        .eq("user_id", userId)
        .eq("updated_at", cur.updated_at as string) // CAS — skip if another write raced us
        .select("updated_at")
        .single();

      if (ue || !ud) {
        // CAS miss — a buy or other action already wrote. That write preserved the
        // correct shop state; returning ok without serverUpdatedAt is fine — the
        // client gets a fresh token on the next successful edge-function response.
        return json({ ok: true });
      }

      return json({ ok: true, serverUpdatedAt: ud.updated_at });
    }

    // ── buy ───────────────────────────────────────────────────────────────────
    if (action === "buy") {
      if (!body.slotId) return err("slotId required");

      const [authResult, saveResult] = await Promise.all([
        supabaseAdmin.auth.getUser(token),
        supabaseAdmin
          .from("game_saves")
          .select("coins, supply_shop, fertilizers, gear_inventory, consumables, updated_at")
          .eq("user_id", userId)
          .single(),
      ]);

      if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
        return err("Unauthorized", 401);
      }
      if (saveResult.error || !saveResult.data) {
        return err("Save not found", 404);
      }

      const save = saveResult.data;
      const priorUpdatedAt = save.updated_at as string;
      let coins         = save.coins as number;
      let supplyShop    = [...(save.supply_shop   ?? []) as ShopSlot[]];
      let fertilizers   = [...(save.fertilizers   ?? []) as FertItem[]];
      let gearInventory = [...(save.gear_inventory ?? []) as GearInvItem[]];
      let consumables   = [...(save.consumables   ?? []) as ConsumableItem[]];

      const slot = supplyShop.find((s) => s.speciesId === body.slotId);
      if (!slot || slot.isEmpty)      return err("Slot not found");
      if (slot.quantity < 1)          return err("Out of stock");
      if (coins < slot.price)         return err("Not enough coins");

      coins -= slot.price;
      supplyShop = supplyShop.map((s) =>
        s.speciesId === body.slotId ? { ...s, quantity: s.quantity - 1 } : s
      );

      if (slot.isFertilizer && slot.fertilizerType) {
        const fert = fertilizers.find((f) => f.type === slot.fertilizerType);
        fertilizers = fert
          ? fertilizers.map((f) => f.type === slot.fertilizerType ? { ...f, quantity: f.quantity + 1 } : f)
          : [...fertilizers, { type: slot.fertilizerType, quantity: 1 }];

      } else if (slot.isGear && slot.gearType) {
        const existing = gearInventory.find((g) => g.gearType === slot.gearType);
        gearInventory = existing
          ? gearInventory.map((g) => g.gearType === slot.gearType ? { ...g, quantity: g.quantity + 1 } : g)
          : [...gearInventory, { gearType: slot.gearType, quantity: 1 }];

      } else if (slot.isConsumable && slot.consumableId) {
        const existing = consumables.find((c) => c.id === slot.consumableId);
        consumables = existing
          ? consumables.map((c) => c.id === slot.consumableId ? { ...c, quantity: c.quantity + 1 } : c)
          : [...consumables, { id: slot.consumableId, quantity: 1 }];

      } else {
        return err("Slot has invalid type — not fertilizer, gear, or consumable");
      }

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({
          coins,
          supply_shop:    supplyShop,
          fertilizers,
          gear_inventory: gearInventory,
          consumables,
          updated_at:     new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) return err("Save was modified by another action", 409);

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "supply_buy",
        payload: { slotId: body.slotId },
        result:  { coins, type: slot.isFertilizer ? "fertilizer" : slot.isGear ? "gear" : "consumable" },
      });

      return json({ ok: true, coins, supplyShop, fertilizers, gearInventory, consumables, serverUpdatedAt: ud.updated_at });
    }

    // ── unlock_slot: remove the permanent pin from a locked supply slot ──────────
    if (action === "unlock_slot") {
      if (!body.slotId) return err("slotId required");

      const supplyShop = (save.supply_shop ?? []) as ShopSlot[];
      const slotIdx    = supplyShop.findIndex((s) => s.speciesId === body.slotId);

      if (slotIdx < 0) return err("Slot not found");

      // Already unlocked — treat as success so optimistic and server stay in sync
      if (!supplyShop[slotIdx].locked) {
        return json({ ok: true, supplyShop, serverUpdatedAt: priorUpdatedAt });
      }

      const newSupplyShop = supplyShop.map((s, i) =>
        i === slotIdx ? { ...s, locked: false } : s
      );

      const { data: ud, error: ue } = await supabaseAdmin
        .from("game_saves")
        .update({ supply_shop: newSupplyShop, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", priorUpdatedAt)
        .select("updated_at")
        .single();

      if (ue || !ud) return err("Save conflict — please retry", 409);

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "supply_unlock_slot",
        payload: { slotId: body.slotId },
      });

      return json({ ok: true, supplyShop: newSupplyShop, serverUpdatedAt: ud.updated_at });
    }

    // ── buy_all: atomically buy 1 of every affordable non-empty supply slot ─────
    if (action === "buy_all") {
      const [authResult, saveResult] = await Promise.all([
        supabaseAdmin.auth.getUser(token),
        supabaseAdmin
          .from("game_saves")
          .select("coins, supply_shop, fertilizers, gear_inventory, consumables, updated_at")
          .eq("user_id", userId)
          .single(),
      ]);
      if (authResult.error || !authResult.data.user || authResult.data.user.id !== userId) {
        return err("Unauthorized", 401);
      }
      if (saveResult.error || !saveResult.data) return err("Save not found", 404);

      const save2         = saveResult.data;
      const prior2        = save2.updated_at as string;
      let coins2          = save2.coins as number;
      let supplyShop2     = [...(save2.supply_shop   ?? []) as ShopSlot[]];
      let fertilizers2    = [...(save2.fertilizers   ?? []) as FertItem[]];
      let gearInventory2  = [...(save2.gear_inventory ?? []) as GearInvItem[]];
      let consumables2    = [...(save2.consumables   ?? []) as ConsumableItem[]];

      const slots = supplyShop2.filter((s) => !s.isEmpty && s.quantity > 0);
      let bought = false;
      for (const slot of slots) {
        if (coins2 < slot.price) continue;
        coins2 -= slot.price;
        supplyShop2 = supplyShop2.map((s) =>
          s.speciesId === slot.speciesId ? { ...s, quantity: s.quantity - 1 } : s
        );
        if (slot.isFertilizer && slot.fertilizerType) {
          const f = fertilizers2.find((x) => x.type === slot.fertilizerType);
          fertilizers2 = f
            ? fertilizers2.map((x) => x.type === slot.fertilizerType ? { ...x, quantity: x.quantity + 1 } : x)
            : [...fertilizers2, { type: slot.fertilizerType, quantity: 1 }];
        } else if (slot.isGear && slot.gearType) {
          const g = gearInventory2.find((x) => x.gearType === slot.gearType);
          gearInventory2 = g
            ? gearInventory2.map((x) => x.gearType === slot.gearType ? { ...x, quantity: x.quantity + 1 } : x)
            : [...gearInventory2, { gearType: slot.gearType, quantity: 1 }];
        } else if (slot.isConsumable && slot.consumableId) {
          const c = consumables2.find((x) => x.id === slot.consumableId);
          consumables2 = c
            ? consumables2.map((x) => x.id === slot.consumableId ? { ...x, quantity: x.quantity + 1 } : x)
            : [...consumables2, { id: slot.consumableId, quantity: 1 }];
        }
        bought = true;
      }
      if (!bought) return err("Cannot afford any items");

      const { data: ud2, error: ue2 } = await supabaseAdmin
        .from("game_saves")
        .update({
          coins:          coins2,
          supply_shop:    supplyShop2,
          fertilizers:    fertilizers2,
          gear_inventory: gearInventory2,
          consumables:    consumables2,
          updated_at:     new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("updated_at", prior2)
        .select("updated_at")
        .single();

      if (ue2 || !ud2) return err("Save was modified by another action", 409);

      void supabaseAdmin.from("action_log").insert({
        user_id: userId, action: "supply_buy_all",
        result:  { coins: coins2, slots: slots.length },
      });

      return json({ ok: true, coins: coins2, supplyShop: supplyShop2, fertilizers: fertilizers2, gearInventory: gearInventory2, consumables: consumables2, serverUpdatedAt: ud2.updated_at });
    }

    return err("Unhandled action");

  } catch (e) {
    console.error("supply-action error:", e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return err("Internal server error", 500);
  }
});
