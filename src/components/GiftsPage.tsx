import { useEffect, useState, useCallback } from "react";
import { useGame } from "../store/GameContext";
import {
  getPendingGifts,
  claimGift,
  type GiftWithSender,
} from "../store/cloudSave";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import type { InventoryItem } from "../store/gameStore";

interface Props {
  onViewProfile: (username: string) => void;
}

export function GiftsPage({ onViewProfile }: Props) {
  const { user, state, update } = useGame();
  const [gifts, setGifts]     = useState<GiftWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed]   = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const timeout = setTimeout(() => setLoading(false), 10_000);

    try {
      const g = await getPendingGifts(user.id);
      setGifts(g);
    } catch (e) {
      // console.error("Failed to load gifts:", e);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleClaim(gw: GiftWithSender) {
    if (!user) return;
    setClaiming(gw.gift.id);

    const ok = await claimGift(gw.gift.id);
    if (!ok) { setClaiming(null); return; }

    // Add flower to local inventory
    const mutation = gw.gift.mutation as MutationType | undefined;
    const existing = state.inventory.find(
      (i) => i.speciesId === gw.gift.species_id && i.mutation === mutation
    );

    const newInventory: InventoryItem[] = existing
      ? state.inventory.map((i) =>
          i.speciesId === gw.gift.species_id && i.mutation === mutation
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      : [...state.inventory, { speciesId: gw.gift.species_id, quantity: 1, mutation }];

    update({ ...state, inventory: newInventory });
    setClaimed((prev) => [...prev, gw.gift.id]);
    setClaiming(null);
  }

  if (!user) return null;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted-foreground text-sm font-mono animate-pulse">Loading gifts...</p>
    </div>
  );

  const unclaimed = gifts.filter((g) => !claimed.includes(g.gift.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Gift Inbox</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unclaimed.length} unclaimed gift{unclaimed.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {unclaimed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <p className="text-4xl">🎁</p>
          <p className="font-medium text-muted-foreground">No gifts waiting</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            When a friend sends you a flower it will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {unclaimed.map((gw) => {
            const species = getFlower(gw.gift.species_id);
            const mut     = gw.gift.mutation ? MUTATIONS[gw.gift.mutation as MutationType] : null;
            const rarity  = species ? RARITY_CONFIG[species.rarity] : null;
            const isClaiming = claiming === gw.gift.id;

            return (
              <div
                key={gw.gift.id}
                className={`bg-card/60 border rounded-2xl p-4 space-y-3 transition-all ${rarity?.glow ?? ""} border-border hover:border-primary/30`}
              >
                {/* Sender + flower */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <span className="text-4xl">{species?.emoji.bloom ?? "🌱"}</span>
                    {mut && (
                      <span className="absolute -top-1 -right-1 text-sm">{mut.emoji}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold">{species?.name ?? "Unknown"}</p>
                      {mut && (
                        <span className={`text-xs font-mono font-bold ${mut.color}`}>
                          {mut.name}
                        </span>
                      )}
                      <span className={`text-xs font-mono ${rarity?.color}`}>
                        {rarity?.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      From{" "}
                      <button
                        onClick={() => onViewProfile(gw.senderProfile.username)}
                        className="text-primary hover:underline"
                      >
                        {gw.senderProfile.username}
                      </button>
                      {" · "}
                      {new Date(gw.gift.created_at).toLocaleDateString(undefined, {
                        month: "short", day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Message */}
                {gw.gift.message && (
                  <div className="bg-background border border-border rounded-xl px-3 py-2">
                    <p className="text-xs text-foreground/80 italic">"{gw.gift.message}"</p>
                  </div>
                )}

                {/* Claim button */}
                <button
                  onClick={() => handleClaim(gw)}
                  disabled={isClaiming}
                  className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isClaiming ? "Claiming..." : "Claim Gift 🎁"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}