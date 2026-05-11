import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useGame } from "../store/GameContext";
import { FLOWERS } from "../data/flowers";
import type { Rarity } from "../data/flowers";
import { getFlower } from "../data/flowers";
import { FERTILIZERS } from "../data/upgrades";
import type { FertilizerType } from "../data/upgrades";
import { edgeMarketplaceBuy } from "../lib/edgeFunctions";
import { ListingCard } from "./ListingCard";
import type { Listing } from "./ListingCard";
import { CreateListingModal } from "./CreateListingModal";
import {
  getNextMarketplaceSlotUpgrade,
  MARKETPLACE_SLOT_UPGRADES,
  MAX_MARKETPLACE_SLOTS,
} from "../data/upgrades";
import { edgeMarketplaceUpgradeSlots } from "../lib/edgeFunctions";
import { useDailyProgress } from "../hooks/useDailyProgress";
import { audioManager } from "../lib/audioManager";

const PAGE_SIZE = 20;

type SortKey = "price_asc" | "price_desc" | "newest";
type FilterRarity = Rarity | "all";

interface Props {
  onViewProfile: (username: string) => void;
}

export function MarketplacePage({ onViewProfile }: Props) {
  const { user, state, update, getState } = useGame();

  const [listings,     setListings]     = useState<Listing[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(false);
  const [page,         setPage]         = useState(0);
  const [search,       setSearch]       = useState("");
  const [filterRarity, setFilterRarity] = useState<FilterRarity>("all");
  const [sort,         setSort]         = useState<SortKey>("newest");
  const [showModal,    setShowModal]    = useState(false);
  const [buyError,     setBuyError]     = useState<string | null>(null);
  const [buySuccess,   setBuySuccess]   = useState(false);
  const [upgrading,    setUpgrading]    = useState(false);

  // ── Load listings ──────────────────────────────────────────────────────────
  const loadListings = useCallback(async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const offset = reset ? 0 : page * PAGE_SIZE;

    // Build query
    let query = supabase
      .from("marketplace_listings")
      .select("id, seller_id, species_id, mutation, is_seed, ask_price, base_value, created_at, expires_at")
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString());

    // Rarity filter — resolve to matching species ids
    if (filterRarity !== "all") {
      const ids = FLOWERS.filter((f) => f.rarity === filterRarity).map((f) => f.id);
      query = query.in("species_id", ids);
    }

    // Sort
    if (sort === "price_asc")  query = query.order("ask_price", { ascending: true });
    if (sort === "price_desc") query = query.order("ask_price", { ascending: false });
    if (sort === "newest")     query = query.order("created_at", { ascending: false });

    query = query.range(offset, offset + PAGE_SIZE - 1);

    const { data, error } = await query;

    if (error || !data) {
      if (reset) setLoading(false); else setLoadingMore(false);
      return;
    }

    // Client-side name search (after rarity filter to keep result set small)
    const searched = search.trim()
      ? data.filter((l) => {
          const sid = l.species_id as string;
          const name = sid.startsWith("fert:")
            ? FERTILIZERS[sid.replace("fert:", "") as FertilizerType]?.name.toLowerCase() ?? sid
            : getFlower(sid)?.name.toLowerCase() ?? sid;
          return name.includes(search.trim().toLowerCase());
        })
      : data;

    // Batch-resolve seller usernames
    const sellerIds = [...new Set(searched.map((l) => l.seller_id as string))];
    const usernameMap: Record<string, string> = {};

    if (sellerIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, username")
        .in("id", sellerIds);

      if (users) {
        for (const u of users) {
          usernameMap[u.id as string] = u.username as string;
        }
      }
    }

    const enriched: Listing[] = searched.map((l) => ({
      id:              l.id as string,
      seller_id:       l.seller_id as string,
      seller_username: usernameMap[l.seller_id as string] ?? "unknown",
      species_id:      l.species_id as string,
      mutation:        l.mutation as string | null,
      is_seed:         (l.is_seed as boolean) ?? false,
      ask_price:       l.ask_price as number,
      base_value:      l.base_value as number,
      created_at:      l.created_at as string,
      expires_at:      l.expires_at as string,
    }));

    if (reset) {
      setListings(enriched);
      setPage(1);
    } else {
      setListings((prev) => [...prev, ...enriched]);
      setPage((p) => p + 1);
    }

    setHasMore(data.length === PAGE_SIZE);
    if (reset) setLoading(false); else setLoadingMore(false);
  }, [search, filterRarity, sort, page]);

  useEffect(() => { loadListings(true); }, [search, filterRarity, sort]);

  // ── Realtime sync ──────────────────────────────────────────────────────────
  // Keep filter values in a ref so the subscription callback always reads the
  // latest values without needing to re-subscribe on every filter change.
  const filtersRef = useRef({ search, filterRarity, sort });
  useEffect(() => { filtersRef.current = { search, filterRarity, sort }; }, [search, filterRarity, sort]);

  useEffect(() => {
    const channel = supabase
      .channel("marketplace-listings-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "marketplace_listings", filter: "status=eq.active" },
        async (payload) => {
          const l = payload.new as Record<string, unknown>;
          const { search: s, filterRarity: fr } = filtersRef.current;

          // Apply current rarity filter
          if (fr !== "all") {
            const species = getFlower(l.species_id as string);
            if (!species || species.rarity !== fr) return;
          }
          // Apply current search filter
          if (s.trim()) {
            const sid = l.species_id as string;
            const name = sid.startsWith("fert:")
              ? FERTILIZERS[sid.replace("fert:", "") as FertilizerType]?.name.toLowerCase() ?? sid
              : getFlower(sid)?.name.toLowerCase() ?? "";
            if (!name.includes(s.trim().toLowerCase())) return;
          }

          // Fetch seller username
          const { data: userData } = await supabase
            .from("users")
            .select("username")
            .eq("id", l.seller_id as string)
            .single();

          const newListing: Listing = {
            id:              l.id as string,
            seller_id:       l.seller_id as string,
            seller_username: (userData?.username as string) ?? "unknown",
            species_id:      l.species_id as string,
            mutation:        (l.mutation as string | null) ?? null,
            is_seed:         (l.is_seed as boolean) ?? false,
            ask_price:       l.ask_price as number,
            base_value:      l.base_value as number,
            created_at:      l.created_at as string,
            expires_at:      l.expires_at as string,
          };

          setListings((prev) => {
            if (prev.some((e) => e.id === newListing.id)) return prev; // dedupe
            // Newest sort → prepend; price sorts → append (close enough without re-sorting)
            return filtersRef.current.sort === "newest"
              ? [newListing, ...prev]
              : [...prev, newListing];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "marketplace_listings" },
        (payload) => {
          const l = payload.new as Record<string, unknown>;
          // Remove from browse list the moment a listing is no longer active
          if (l.status !== "active") {
            setListings((prev) => prev.filter((e) => e.id !== l.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []); // subscribe once — filter logic reads from filtersRef

  const { trackProgress } = useDailyProgress();

  // ── Buy handler ────────────────────────────────────────────────────────────
  async function handleBuy(listing: Listing) {
    setBuyError(null);
    setBuySuccess(false);
    try {
      const result = await edgeMarketplaceBuy(listing.id);
      const cur = getState();
      update({ ...cur, coins: result.coins });
      audioManager.playSfx("buy");
      void trackProgress("marketplace_buy");
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setBuySuccess(true);
      setTimeout(() => setBuySuccess(false), 5_000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Purchase failed";
      // Race condition — someone else bought it between render and click
      if (msg.includes("no longer available") || msg.includes("not found") || msg.toLowerCase().includes("listing")) {
        setListings((prev) => prev.filter((l) => l.id !== listing.id));
        setBuyError("This listing was just sold — it has been removed from the list.");
      } else {
        setBuyError(msg);
      }
    }
  }

  // ── Upgrade slots handler ──────────────────────────────────────────────────
  async function handleUpgradeSlots() {
    if (upgrading) return;
    setUpgrading(true);
    try {
      const result = await edgeMarketplaceUpgradeSlots();
      const cur = getState();
      update({ ...cur, coins: result.coins, marketplaceSlots: result.marketplaceSlots });
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Failed to upgrade slots");
    } finally {
      setUpgrading(false);
    }
  }

  const nextUpgrade = getNextMarketplaceSlotUpgrade(state.marketplaceSlots);
  const hasSlots    = state.marketplaceSlots > 0;

  // ── No slots yet — unlock prompt ──────────────────────────────────────────
  if (!hasSlots) {
    const firstSlot = MARKETPLACE_SLOT_UPGRADES[0];
    const canAfford = state.coins >= firstSlot.cost;

    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
        <p className="text-5xl">🏪</p>
        <h2 className="text-lg font-bold">Marketplace</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Buy and sell flowers with other players. Unlock your first listing slot to get started.
        </p>
        <div className="bg-card/60 border border-border rounded-2xl p-4 w-full max-w-xs space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">First slot</span>
            <span className="font-mono font-bold">{(firstSlot.cost / 1_000).toFixed(0)}k 🟡</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Your coins</span>
            <span className={`font-mono font-bold ${canAfford ? "text-primary" : "text-red-400"}`}>
              {state.coins.toLocaleString()} 🟡
            </span>
          </div>
          <button
            onClick={handleUpgradeSlots}
            disabled={!canAfford || upgrading}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {upgrading ? "Unlocking..." : canAfford ? "Unlock Marketplace — 10k 🟡" : "Not enough coins"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Marketplace</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state.marketplaceSlots} / {MAX_MARKETPLACE_SLOTS} slot{state.marketplaceSlots !== 1 ? "s" : ""}
            {!nextUpgrade && <span> · max</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {nextUpgrade && (
            <button
              onClick={handleUpgradeSlots}
              disabled={state.coins < nextUpgrade.cost || upgrading}
              className="px-3 py-1.5 border border-primary/40 text-primary text-xs font-semibold rounded-xl hover:bg-primary/10 transition-all disabled:opacity-40 disabled:border-border disabled:text-muted-foreground whitespace-nowrap"
            >
              {upgrading ? "..." : `+1 slot — ${nextUpgrade.cost >= 1_000_000 ? `${(nextUpgrade.cost/1_000_000).toFixed(1)}M` : `${(nextUpgrade.cost/1_000).toFixed(0)}k`} 🟡`}
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            + List Item
          </button>
        </div>
      </div>

      {/* Buy success banner */}
      {buySuccess && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 text-xs text-primary font-mono flex items-center justify-between">
          <span>📬 Item sent to your Mailbox — collect it in the Social tab!</span>
          <button onClick={() => setBuySuccess(false)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Buy error banner */}
      {buyError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-400 font-mono">
          {buyError}
          <button onClick={() => setBuyError(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-2">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by flower name..."
            className="w-full bg-card/60 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Rarity filter */}
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "common", "uncommon", "rare", "legendary", "mythic", "exalted", "prismatic"] as (FilterRarity)[]).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRarity(r)}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-semibold transition-all capitalize
                ${filterRarity === r
                  ? "bg-primary/20 border border-primary/50 text-primary"
                  : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                }
              `}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-1.5">
          {([
            { key: "newest",     label: "Newest"      },
            { key: "price_asc",  label: "Price ↑"     },
            { key: "price_desc", label: "Price ↓"     },
          ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                ${sort === key
                  ? "bg-primary/20 border border-primary/50 text-primary"
                  : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                }
              `}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => loadListings(true)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground font-mono animate-pulse">Loading listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <p className="text-4xl">🏪</p>
          <p className="font-medium text-muted-foreground">No listings found</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search || filterRarity !== "all"
              ? "Try adjusting your filters."
              : "Be the first to list a flower!"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              currentUserId={user?.id}
              currentCoins={state.coins}
              onBuy={handleBuy}
              onViewProfile={onViewProfile}
            />
          ))}

          {hasMore && (
            <button
              onClick={() => loadListings(false)}
              disabled={loadingMore}
              className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all disabled:opacity-40"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}

        </div>
      )}

      {/* Create listing modal */}
      {showModal && (
        <CreateListingModal
          onClose={() => setShowModal(false)}
          onListed={() => {
            setShowModal(false);
            loadListings(true);
          }}
        />
      )}
    </div>
  );
}

