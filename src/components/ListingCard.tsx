import { useState } from "react";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import type { FertilizerType } from "../data/upgrades";
import { GEAR as GEAR_CATALOG } from "../data/gear";
import type { GearType } from "../data/gear";
import { CONSUMABLE_RECIPE_MAP } from "../data/consumables";
import type { ConsumableId } from "../data/consumables";
import { FlowerTypeBadges } from "./FlowerTypeBadges";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { FlowerSprite } from "./FlowerSprite";
import { ItemSprite } from "./ItemSprite";

export interface Listing {
  id:               string;
  seller_id:        string;
  seller_username:  string;
  species_id:       string;
  mutation:         string | null;
  is_seed:          boolean;
  ask_price:        number;
  base_value:       number;
  created_at:       string;
  expires_at:       string;
}

interface Props {
  listing:        Listing;
  currentUserId?: string;
  currentCoins:   number;
  onBuy:          (listing: Listing) => Promise<void>;
  onViewProfile:  (username: string) => void;
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

export function ListingCard({ listing, currentUserId, currentCoins, onBuy, onViewProfile }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [buying,   setBuying]   = useState(false);

  const isFertilizer  = listing.species_id?.startsWith("fert:");
  const isGear        = listing.species_id?.startsWith("gear:");
  const isConsumable  = listing.species_id?.startsWith("consumable:");
  const fertType      = isFertilizer  ? listing.species_id.replace("fert:", "") as FertilizerType : null;
  const gearType      = isGear        ? listing.species_id.replace("gear:", "") as GearType       : null;
  const consumableId  = isConsumable  ? listing.species_id.replace("consumable:", "") as ConsumableId : null;
  const fertDef       = fertType      ? FERTILIZERS[fertType]                                     : null;
  const gearDef       = gearType      ? GEAR_CATALOG[gearType]                                    : null;
  const consumableRec = consumableId  ? CONSUMABLE_RECIPE_MAP[consumableId]                       : null;

  const species   = (isFertilizer || isGear || isConsumable) ? null : getFlower(listing.species_id);
  const mut       = (!isFertilizer && !isGear && !isConsumable && listing.mutation) ? MUTATIONS[listing.mutation as MutationType] : null;
  const rarity    = species ? RARITY_CONFIG[species.rarity] : null;

  const isOwnListing = listing.seller_id === currentUserId;
  const canAfford    = currentCoins >= listing.ask_price;
  const expiring     = new Date(listing.expires_at).getTime() - Date.now() < 2 * 3_600_000; // < 2h

  async function handleBuy() {
    if (buying || isOwnListing || !canAfford) return;
    setBuying(true);
    try {
      await onBuy(listing);
    } finally {
      setBuying(false);
    }
  }

  // ── Fertilizer card ────────────────────────────────────────────────────────
  if (isFertilizer && fertDef) {
    return (
      <div className="bg-card/60 border border-border hover:border-primary/30 rounded-2xl overflow-hidden transition-all">
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <ItemSprite emoji={fertDef.emoji} sprite={fertDef.sprite} name={fertDef.name} textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={`text-sm font-bold ${fertDef.color}`}>{fertDef.name}</p>
              <span className="text-xs font-mono text-muted-foreground">Fertilizer</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{fertDef.speedMultiplier}× growth speed</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <p className="text-xs text-muted-foreground">
                by{" "}
                <button
                  onClick={(e) => { e.stopPropagation(); onViewProfile(listing.seller_username); }}
                  className="text-primary hover:underline"
                >
                  {listing.seller_username}
                </button>
              </p>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <p className={`text-xs font-mono ${expiring ? "text-orange-400" : "text-muted-foreground"}`}>
                {expiring && "⚠ "}expires {formatExpiry(listing.expires_at)}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <p className="text-sm font-bold font-mono text-primary inline-flex items-center gap-0.5">
              {formatCoins(listing.ask_price)}
              <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" />
            </p>
            {listing.base_value > 0 && (
              <p className="text-[10px] text-muted-foreground font-mono">
                shop {formatCoins(listing.base_value)}
              </p>
            )}
            {isOwnListing ? (
              <span className="text-[10px] text-muted-foreground font-mono bg-border/50 px-2 py-0.5 rounded-full">
                Your listing
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleBuy(); }}
                disabled={buying || !canAfford}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {buying ? "Buying..." : canAfford ? "Buy" : "Can't afford"}
              </button>
            )}
          </div>

          <span className={`text-muted-foreground text-xs transition-transform flex-shrink-0 ml-1 pointer-events-none ${expanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>

        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border/40">
            <PriceHistoryChart
              speciesId={listing.species_id}
              baseValue={listing.base_value}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Gear card ──────────────────────────────────────────────────────────────
  if (isGear && gearDef) {
    const gearRarity = RARITY_CONFIG[gearDef.rarity];
    return (
      <div className={`bg-card/60 border rounded-2xl overflow-hidden transition-all ${gearRarity?.glow ?? ""} border-border hover:border-primary/30`}>
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <ItemSprite emoji={gearDef.emoji} sprite={gearDef.sprite} name={gearDef.name} textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold">{gearDef.name}</p>
              <span className={`text-xs font-mono ${gearRarity?.color}`}>{gearRarity?.label}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <p className="text-xs text-muted-foreground">
                by{" "}
                <button
                  onClick={(e) => { e.stopPropagation(); onViewProfile(listing.seller_username); }}
                  className="text-primary hover:underline"
                >
                  {listing.seller_username}
                </button>
              </p>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <p className={`text-xs font-mono ${expiring ? "text-orange-400" : "text-muted-foreground"}`}>
                {expiring && "⚠ "}expires {formatExpiry(listing.expires_at)}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <p className="text-sm font-bold font-mono text-primary inline-flex items-center gap-0.5">
              {formatCoins(listing.ask_price)}
              <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" />
            </p>
            {listing.base_value > 0 && (
              <p className="text-[10px] text-muted-foreground font-mono">
                shop {formatCoins(listing.base_value)}
              </p>
            )}
            {isOwnListing ? (
              <span className="text-[10px] text-muted-foreground font-mono bg-border/50 px-2 py-0.5 rounded-full">
                Your listing
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleBuy(); }}
                disabled={buying || !canAfford}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {buying ? "Buying..." : canAfford ? "Buy" : "Can't afford"}
              </button>
            )}
          </div>

          <span className={`text-muted-foreground text-xs transition-transform flex-shrink-0 ml-1 pointer-events-none ${expanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>

        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border/40">
            <PriceHistoryChart
              speciesId={listing.species_id}
              baseValue={listing.base_value}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Consumable card ───────────────────────────────────────────────────────
  if (isConsumable && consumableRec) {
    const consumableRarity = RARITY_CONFIG[consumableRec.rarity];
    return (
      <div className={`bg-card/60 border rounded-2xl overflow-hidden transition-all ${consumableRarity?.glow ?? ""} border-border hover:border-primary/30`}>
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <ItemSprite emoji={consumableRec.emoji} sprite={consumableRec.sprite} name={consumableRec.name} textSize="text-3xl" imgSize="w-8 h-8" className="flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold">{consumableRec.name}</p>
              <span className={`text-xs font-mono ${consumableRarity?.color}`}>{consumableRarity?.label}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <p className="text-xs text-muted-foreground">
                by{" "}
                <button
                  onClick={(e) => { e.stopPropagation(); onViewProfile(listing.seller_username); }}
                  className="text-primary hover:underline"
                >
                  {listing.seller_username}
                </button>
              </p>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <p className={`text-xs font-mono ${expiring ? "text-orange-400" : "text-muted-foreground"}`}>
                {expiring && "⚠ "}expires {formatExpiry(listing.expires_at)}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <p className="text-sm font-bold font-mono text-primary inline-flex items-center gap-0.5">
              {formatCoins(listing.ask_price)}
              <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" />
            </p>
            {isOwnListing ? (
              <span className="text-[10px] text-muted-foreground font-mono bg-border/50 px-2 py-0.5 rounded-full">
                Your listing
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleBuy(); }}
                disabled={buying || !canAfford}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {buying ? "Buying..." : canAfford ? "Buy" : "Can't afford"}
              </button>
            )}
          </div>

          <span className={`text-muted-foreground text-xs transition-transform flex-shrink-0 ml-1 pointer-events-none ${expanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>

        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border/40">
            <PriceHistoryChart
              speciesId={listing.species_id}
              baseValue={listing.base_value}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Flower / seed card ─────────────────────────────────────────────────────
  return (
    <div className={`bg-card/60 border rounded-2xl overflow-hidden transition-all ${rarity?.glow ?? ""} border-border hover:border-primary/30`}>

      {/* Main row — clicking anywhere toggles price history */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >

        {/* Flower / Seed */}
        <div className="relative flex-shrink-0">
          {listing.is_seed
            ? species
              ? <FlowerSprite species={species} stage="seed" textSize="text-3xl" imgSize="w-8 h-8" />
              : <span className="text-3xl">🌱</span>
            : species
              ? <FlowerSprite species={species} stage="bloom" textSize="text-3xl" imgSize="w-8 h-8" />
              : <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-3xl" imgSize="w-8 h-8" />
          }
          {!listing.is_seed && mut && (
            <span className="absolute -top-1 -right-1 text-sm">{mut.emoji}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold">{species?.name ?? listing.species_id}</p>
            {listing.is_seed
              ? <span className="text-xs font-mono text-muted-foreground">Seed</span>
              : mut && <span className={`text-xs font-mono font-bold ${mut.color}`}>{mut.name}</span>
            }
            <span className={`text-xs font-mono ${rarity?.color}`}>{rarity?.label}</span>
          </div>
          {species && <FlowerTypeBadges types={species.types} className="mt-1" />}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <p className="text-xs text-muted-foreground">
              by{" "}
              <button
                onClick={(e) => { e.stopPropagation(); onViewProfile(listing.seller_username); }}
                className="text-primary hover:underline"
              >
                {listing.seller_username}
              </button>
            </p>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <p className={`text-xs font-mono ${expiring ? "text-orange-400" : "text-muted-foreground"}`}>
              {expiring && "⚠ "}expires {formatExpiry(listing.expires_at)}
            </p>
          </div>
        </div>

        {/* Price + actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <p className="text-sm font-bold font-mono text-primary">
            {formatCoins(listing.ask_price)} 🟡
          </p>
          {listing.base_value > 0 && (
            <p className="text-[10px] text-muted-foreground font-mono">
              base {formatCoins(listing.base_value)}
            </p>
          )}
          {isOwnListing ? (
            <span className="text-[10px] text-muted-foreground font-mono bg-border/50 px-2 py-0.5 rounded-full">
              Your listing
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleBuy(); }}
              disabled={buying || !canAfford}
              className="text-xs font-semibold px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {buying ? "Buying..." : canAfford ? "Buy" : "Can't afford"}
            </button>
          )}
        </div>

        {/* Expand indicator */}
        <span
          className={`text-muted-foreground text-xs transition-transform flex-shrink-0 ml-1 pointer-events-none ${expanded ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </div>

      {/* Expanded price history */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/40">
          <PriceHistoryChart
            speciesId={listing.species_id}
            mutation={listing.mutation ?? undefined}
            baseValue={listing.base_value}
          />
        </div>
      )}
    </div>
  );
}
