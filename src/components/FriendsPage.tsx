import { useEffect, useState, useCallback } from "react";
import { useGame } from "../store/GameContext";
import {
  getFriends,
  acceptFriendRequest,
  removeFriendship,
  type FriendWithProfile,
} from "../store/cloudSave";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { FlowerSprite } from "./FlowerSprite";
import { ItemSprite } from "./ItemSprite";
import {
  getPresenceStatus, formatLastSeen,
  STATUS_DOT,
  type PresenceStatus,
} from "../lib/presence";

interface Props {
  onViewProfile: (username: string) => void;
}

export function FriendsPage({ onViewProfile }: Props) {
  const { user } = useGame();
  const [friends, setFriends]                 = useState<FriendWithProfile[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendWithProfile[]>([]);
  const [pendingSent, setPendingSent]         = useState<FriendWithProfile[]>([]);
  const [loading, setLoading]                 = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const timeout = setTimeout(() => setLoading(false), 10_000);

    try {
      const result = await getFriends(user.id);
      setFriends(result.friends);
      setPendingReceived(result.pendingReceived);
      setPendingSent(result.pendingSent);
    } catch (e) {
      // console.error("Failed to load friends:", e);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleAccept(f: FriendWithProfile) {
    await acceptFriendRequest(f.friendship.id);
    load();
  }

  async function handleDecline(f: FriendWithProfile) {
    await removeFriendship(f.friendship.id);
    load();
  }

  if (!user) return null;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted-foreground text-sm font-mono animate-pulse">Loading...</p>
    </div>
  );

  const total = friends.length + pendingReceived.length + pendingSent.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Friends</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {friends.length} friend{friends.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Pending received */}
      {pendingReceived.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Requests ({pendingReceived.length})
          </h3>
          {pendingReceived.map((f) => (
            <FriendRow
              key={f.friendship.id}
              entry={f}
              onViewProfile={onViewProfile}
              actions={
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(f)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(f)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:border-red-400 hover:text-red-400 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* Friends list */}
      {friends.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Friends ({friends.length})
          </h3>
          {[...friends].sort((a, b) => {
            const order: Record<PresenceStatus, number> = { online: 0, away: 1, offline: 2 };
            return order[getPresenceStatus(a.profile.last_seen_at)] - order[getPresenceStatus(b.profile.last_seen_at)];
          }).map((f) => (
            <FriendRow
              key={f.friendship.id}
              entry={f}
              onViewProfile={onViewProfile}
              showPresence
              actions={
                <button
                  onClick={() => handleDecline(f)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:border-red-400 hover:text-red-400 transition-colors"
                >
                  Unfriend
                </button>
              }
            />
          ))}
        </div>
      )}

      {/* Pending sent */}
      {pendingSent.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Sent ({pendingSent.length})
          </h3>
          {pendingSent.map((f) => (
            <FriendRow
              key={f.friendship.id}
              entry={f}
              onViewProfile={onViewProfile}
              actions={
                <button
                  onClick={() => handleDecline(f)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:border-red-400 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              }
            />
          ))}
        </div>
      )}

      {total === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <p className="text-4xl">🌱</p>
          <p className="font-medium text-muted-foreground">No friends yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Search for players and send them a friend request.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Shared row component ───────────────────────────────────────────────────

function FriendRow({
  entry,
  onViewProfile,
  actions,
  showPresence = false,
}: {
  entry: FriendWithProfile;
  onViewProfile: (username: string) => void;
  actions: React.ReactNode;
  showPresence?: boolean;
}) {
  const { profile } = entry;
  const flower  = getFlower(profile.display_flower);
  const rarity  = flower ? RARITY_CONFIG[flower.rarity] : null;
  const mutObj  = profile.display_mutation ? MUTATIONS[profile.display_mutation as MutationType] : null;

  const status  = showPresence ? getPresenceStatus(profile.last_seen_at) : null;

  return (
    <div className="flex items-center gap-3 bg-card/60 border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors">
      <button
        onClick={() => onViewProfile(profile.username)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        {/* Avatar with presence dot */}
        <div className={`relative w-10 h-10 rounded-xl border flex items-center justify-center text-xl flex-shrink-0 border-border bg-background ${rarity?.glow ?? ""}`}>
          {flower ? <FlowerSprite species={flower} stage="bloom" imgSize="w-6 h-6" textSize="text-xl" /> : "🌱"}
          {mutObj && (
            <span className="absolute -top-1 -right-1 leading-none">
              <ItemSprite emoji={mutObj.emoji} sprite={mutObj.sprite} name={mutObj.emoji} textSize="text-sm" imgSize="w-4 h-4" />
            </span>
          )}
          {status && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${STATUS_DOT[status]}`}
              title={status === "offline"
                ? `Last seen ${formatLastSeen(profile.last_seen_at)}`
                : status === "away" ? "Away" : "Online"
              }
            />
          )}
        </div>

        {/* Name + status text */}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate hover:text-primary transition-colors">
            {profile.username}
          </p>
          {status === "offline" ? (
            <p className="text-xs text-zinc-500 font-mono">
              Last seen {formatLastSeen(profile.last_seen_at)}
            </p>
          ) : status === "away" ? (
            <p className="text-xs text-yellow-400 font-mono">Away</p>
          ) : status === "online" ? (
            <p className="text-xs text-green-500 font-mono">Online</p>
          ) : flower ? (
            <p className={`text-xs font-mono ${rarity?.color}`}>{flower.name}</p>
          ) : null}
        </div>
      </button>
      {actions}
    </div>
  );
}