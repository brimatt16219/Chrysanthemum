import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useGame } from "../store/GameContext";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import type { FertilizerType } from "../data/upgrades";
import { GEAR as GEAR_CATALOG } from "../data/gear";
import type { GearType } from "../data/gear";
import { CONSUMABLE_RECIPE_MAP } from "../data/consumables";
import type { ConsumableId } from "../data/consumables";
import { edgeMarketplaceCancel } from "../lib/edgeFunctions";
import { FlowerSprite } from "./FlowerSprite";
import { ItemSprite } from "./ItemSprite";

interface MyListing {
  id:         string;
  species_id: string;
  mutation:   string | null;
  is_seed:    boolean;
  ask_price:  number;
  base_value: number;
  created_at: string;
  expires_at: string;
  status:     "active" | "sold" | "cancelled" | "expired";
  buyer_id:   string | null;
  sold_at:    string | null;
}

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function formatExpiry(expiresAt: string): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return "Expired";
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)   return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STATUS_LABEL: Record<MyListing["status"], string> = {
  active:    "Active",
  sold:      "Sold",
  cancelled: "Cancelled",
  expired:   "Expired",
};

const STATUS_COLOR: Record<MyListing["status"], string> = {
  active:    "text-primary",
  sold:      "text-green-400",
  cancelled: "text-muted-foreground",
  expired:   "text-orange-400",
};

interface Props {
  onRefreshNeeded?: () => void; // parent can sync slot count after cancel
}

export function MyListingsPage({ onRefreshNeeded }: Props) {
  const { user, state, update, getState } = useGame();

  const [listings,   setListings]   = useState<MyListing[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("marketplace_listings")
      .select("id, species_id, mutation, is_seed, ask_price, base_value, created_at, expires_at, status, buyer_id, sold_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setListings((data ?? []) as MyListing[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(listing: MyListing) {
    if (cancelling) return;
    setCancelling(listing.id);
    setError(null);

    try {
      const result = await edgeMarketplaceCancel(listing.id);
      const cur = getState();
      update({
        ...cur,
        inventory: result.inventory,
        ...(result.fertilizers   ? { fertilizers:   result.fertilizers   } : {}),
        ...(result.gearInventory ? { gearInventory: result.gearInventory } : {}),
        ...(result.consumables   ? { consumables:   result.consumables   } : {}),
      });
      setListings((prev) =>
        prev.map((l) => l.id === listing.id ? { ...l, status: "cancelled" } : l)
      );
      onRefreshNeeded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel listing");
    } finally {
      setCancelling(null);
    }
  }

  const active   = listings.filter((l) => l.status === "active");
  const history  = listings.filter((l) => l.status !== "active");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground font-mono animate-pulse">Loading your listings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">My Listings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {active.length} / {state.marketplaceSlots} slot{state.marketplaceSlots !== 1 ? "s" : ""} used
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-400 font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Active listings */}
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center bg-card/40 border border-border rounded-2xl">
          <p className="text-3xl">📭</p>
          <p className="font-medium text-muted-foreground">No active listings</p>
          <p className="text-xs text-muted-foreground">
            Go to Browse and tap "+ List Item" to create one.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Active</p>
          {active.map((listing) => (
            <ActiveListingRow
              key={listing.id}
              listing={listing}
              cancelling={cancelling === listing.id}
              onCancel={() => handleCancel(listing)}
            />
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">History</p>
          {history.map((listing) => (
            <HistoryListingRow key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Active listing row ─────────────────────────────────────────────────────

function ActiveListingRow({
  listing,
  cancelling,
  onCancel,
}: {
  listing:    MyListing;
  cancelling: boolean;
  onCancel:   () => void;
}) {
  const isFertilizer  = listing.species_id.startsWith("fert:");
  const isGear        = listing.species_id.startsWith("gear:");
  const isConsumable  = listing.species_id.startsWith("consumable:");
  const fertDef       = isFertilizer ? FERTILIZERS[listing.species_id.replace("fert:", "") as FertilizerType]   : null;
  const gearDef       = isGear       ? GEAR_CATALOG[listing.species_id.replace("gear:", "") as GearType]         : null;
  const consumableRec = isConsumable ? CONSUMABLE_RECIPE_MAP[listing.species_id.replace("consumable:", "") as ConsumableId] : null;
  const species       = (isFertilizer || isGear || isConsumable) ? null : getFlower(listing.species_id);
  const mut           = (!isFertilizer && !isGear && !isConsumable && listing.mutation) ? MUTATIONS[listing.mutation as MutationType] : null;
  const rarity        = species ? RARITY_CONFIG[species.rarity] : (isGear && gearDef) ? RARITY_CONFIG[gearDef.rarity] : (isConsumable && consumableRec) ? RARITY_CONFIG[consumableRec.rarity] : null;
  const expiring      = new Date(listing.expires_at).getTime() - Date.now() < 2 * 3_600_000;

  return (
    <div className={`bg-card/60 border rounded-2xl p-4 space-y-3 transition-all ${rarity?.glow ?? ""} border-border`}>
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          {isFertilizer && fertDef
            ? <ItemSprite emoji={fertDef.emoji} sprite={fertDef.sprite} name={fertDef.name} textSize="text-3xl" imgSize="w-8 h-8" />
            : isGear && gearDef
            ? <ItemSprite emoji={gearDef.emoji} sprite={gearDef.sprite} name={gearDef.name} textSize="text-3xl" imgSize="w-8 h-8" />
            : isConsumable && consumableRec
            ? <ItemSprite emoji={consumableRec.emoji} sprite={consumableRec.sprite} name={consumableRec.name} textSize="text-3xl" imgSize="w-8 h-8" />
            : listing.is_seed
            ? species
              ? <FlowerSprite species={species} stage="seed" textSize="text-3xl" imgSize="w-8 h-8" />
              : <span className="text-3xl">🌱</span>
            : species
              ? <FlowerSprite species={species} stage="bloom" textSize="text-3xl" imgSize="w-8 h-8" />
              : <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-3xl" imgSize="w-8 h-8" />
          }
          {!isFertilizer && !isGear && !isConsumable && !listing.is_seed && mut && (
            <span className="absolute -top-1 -right-1 text-sm">{mut.emoji}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isFertilizer ? (
              <>
                <p className={`text-sm font-bold ${fertDef?.color ?? ""}`}>{fertDef?.name ?? listing.species_id}</p>
                <span className="text-xs font-mono text-muted-foreground">Fertilizer</span>
              </>
            ) : isGear ? (
              <>
                <p className="text-sm font-bold">{gearDef?.name ?? listing.species_id}</p>
                <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
              </>
            ) : isConsumable ? (
              <>
                <p className="text-sm font-bold">{consumableRec?.name ?? listing.species_id}</p>
                <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
              </>
            ) : (
              <>
                <p className="text-sm font-bold">{species?.name ?? listing.species_id}</p>
                {listing.is_seed
                  ? <span className="text-xs font-mono text-muted-foreground">Seed</span>
                  : mut && <span className={`text-xs font-mono font-bold ${mut.color}`}>{mut.name}</span>
                }
                <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
              </>
            )}
          </div>
          <p className={`text-xs font-mono mt-0.5 ${expiring ? "text-orange-400" : "text-muted-foreground"}`}>
            {expiring && "⚠ "}expires in {formatExpiry(listing.expires_at)}
          </p>
        </div>

        <div className="text-right flex-shrink-0 space-y-1">
          <p className="text-sm font-bold font-mono text-primary inline-flex items-center gap-0.5">{formatCoins(listing.ask_price)} <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" /></p>
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="text-xs text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
          >
            {cancelling ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      </div>

      {expiring && (
        <p className="text-[10px] text-orange-400/80 font-mono">
          Listing expires soon — item will be returned to your inventory automatically.
        </p>
      )}
    </div>
  );
}

// ── History row ────────────────────────────────────────────────────────────

function HistoryListingRow({ listing }: { listing: MyListing }) {
  const isFertilizer  = listing.species_id.startsWith("fert:");
  const isGear        = listing.species_id.startsWith("gear:");
  const isConsumable  = listing.species_id.startsWith("consumable:");
  const fertDef       = isFertilizer ? FERTILIZERS[listing.species_id.replace("fert:", "") as FertilizerType]   : null;
  const gearDef       = isGear       ? GEAR_CATALOG[listing.species_id.replace("gear:", "") as GearType]         : null;
  const consumableRec = isConsumable ? CONSUMABLE_RECIPE_MAP[listing.species_id.replace("consumable:", "") as ConsumableId] : null;
  const species       = (isFertilizer || isGear || isConsumable) ? null : getFlower(listing.species_id);
  const mut           = (!isFertilizer && !isGear && !isConsumable && listing.mutation) ? MUTATIONS[listing.mutation as MutationType] : null;
  const rarity        = species ? RARITY_CONFIG[species.rarity] : (isGear && gearDef) ? RARITY_CONFIG[gearDef.rarity] : (isConsumable && consumableRec) ? RARITY_CONFIG[consumableRec.rarity] : null;

  return (
    <div className="bg-card/40 border border-border/40 rounded-2xl px-4 py-3 flex items-center gap-3 opacity-70">
      <div className="relative flex-shrink-0">
        {isFertilizer && fertDef
          ? <ItemSprite emoji={fertDef.emoji} sprite={fertDef.sprite} name={fertDef.name} textSize="text-2xl" imgSize="w-7 h-7" />
          : isGear && gearDef
          ? <ItemSprite emoji={gearDef.emoji} sprite={gearDef.sprite} name={gearDef.name} textSize="text-2xl" imgSize="w-7 h-7" />
          : isConsumable && consumableRec
          ? <ItemSprite emoji={consumableRec.emoji} sprite={consumableRec.sprite} name={consumableRec.name} textSize="text-2xl" imgSize="w-7 h-7" />
          : listing.is_seed
          ? species
            ? <FlowerSprite species={species} stage="seed" textSize="text-2xl" imgSize="w-7 h-7" />
            : <span className="text-2xl">🌱</span>
          : species
            ? <FlowerSprite species={species} stage="bloom" textSize="text-2xl" imgSize="w-7 h-7" />
            : <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-2xl" imgSize="w-7 h-7" />
        }
        {!isFertilizer && !isGear && !isConsumable && !listing.is_seed && mut && (
          <span className="absolute -top-1 -right-1 text-xs">{mut.emoji}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isFertilizer ? (
            <>
              <p className={`text-sm font-semibold ${fertDef?.color ?? ""}`}>{fertDef?.name ?? listing.species_id}</p>
              <span className="text-xs font-mono text-muted-foreground">Fertilizer</span>
            </>
          ) : isGear ? (
            <>
              <p className="text-sm font-semibold">{gearDef?.name ?? listing.species_id}</p>
              <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
            </>
          ) : isConsumable ? (
            <>
              <p className="text-sm font-semibold">{consumableRec?.name ?? listing.species_id}</p>
              <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">{species?.name ?? listing.species_id}</p>
              {listing.is_seed
                ? <span className="text-xs font-mono text-muted-foreground">Seed</span>
                : mut && <span className={`text-xs font-mono ${mut.color}`}>{mut.name}</span>
              }
              <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {listing.sold_at ? formatDate(listing.sold_at) : formatDate(listing.created_at)}
        </p>
      </div>

      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className="text-sm font-mono font-semibold inline-flex items-center gap-0.5">{formatCoins(listing.ask_price)} <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" /></p>
        <p className={`text-xs font-mono ${STATUS_COLOR[listing.status]}`}>
          {STATUS_LABEL[listing.status]}
        </p>
      </div>
    </div>
  );
}
