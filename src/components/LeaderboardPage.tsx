import { useEffect, useState, useCallback } from "react";
import { useGame } from "../store/GameContext";
import {
  getLeaderboard,
  getFriendsLeaderboard,
  getMyRank,
  type LeaderboardEntry,
} from "../store/cloudSave";
import { getFlower, RARITY_CONFIG } from "../data/flowers";

interface Props {
  onViewProfile: (username: string) => void;
}

type LeaderboardTab = "global" | "friends";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardPage({ onViewProfile }: Props) {
  const { user, profile, state } = useGame();

  const [activeTab, setActiveTab]   = useState<LeaderboardTab>("global");
  const [entries, setEntries]       = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank]         = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    if (activeTab === "global") {
      const [board, rank] = await Promise.all([
        getLeaderboard(),
        user ? getMyRank(user.id) : Promise.resolve(null),
      ]);
      setEntries(board);
      setMyRank(rank);
    } else {
      if (!user) { setEntries([]); setLoading(false); return; }
      const board = await getFriendsLeaderboard(user.id);
      setEntries(board);
      setMyRank(board.find((e) => e.id === user.id)?.rank ?? null);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, [activeTab, user]);

  useEffect(() => { load(); }, [load]);

  const myEntry = entries.find((e) => e.id === user?.id);

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Leaderboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Updated {timeAgo(lastRefresh.toISOString())}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {(["global", "friends"] as LeaderboardTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`
              px-4 py-2 rounded-xl text-xs font-semibold transition-all capitalize
              ${activeTab === t
                ? "bg-primary/20 border border-primary/50 text-primary"
                : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
              }
            `}
          >
            {t === "global" ? "🌍 Global" : "👥 Friends"}
          </button>
        ))}
      </div>

      {/* Your rank banner */}
      {user && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
          <span className="text-2xl">
            {myRank && myRank <= 3 ? RANK_MEDALS[myRank] : "🌸"}
          </span>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-mono">Your rank</p>
            <p className="text-sm font-bold">
              {myRank ? `#${myRank}` : "Unranked"}{" "}
              <span className="text-muted-foreground font-normal">
                · {state.coins.toLocaleString()} 🪙
              </span>
            </p>
          </div>
          {activeTab === "friends" && entries.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Among {entries.length} players
            </p>
          )}
        </div>
      )}

      {/* No friends message */}
      {activeTab === "friends" && !loading && entries.length <= 1 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">👥</p>
          <p className="text-muted-foreground text-sm font-medium">No friends to compare yet</p>
          <p className="text-xs text-muted-foreground">
            Add friends in the Search tab to see a friends leaderboard.
          </p>
        </div>
      )}

      {/* Guest prompt for friends tab */}
      {activeTab === "friends" && !user && (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">🔒</p>
          <p className="text-muted-foreground text-sm">
            Sign in to see your friends leaderboard
          </p>
        </div>
      )}

      {/* Leaderboard list */}
      {!loading && entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => {
            const flower   = getFlower(entry.display_flower);
            const rarity   = flower ? RARITY_CONFIG[flower.rarity] : null;
            const isMe     = entry.id === user?.id;
            const medal    = RANK_MEDALS[entry.rank];

            return (
              <button
                key={entry.id}
                onClick={() => onViewProfile(entry.username)}
                className={`
                  flex items-center gap-3 rounded-xl px-4 py-3 border transition-all text-left group
                  ${isMe
                    ? "bg-primary/10 border-primary/40"
                    : "bg-card/60 border-border hover:border-primary/30"
                  }
                `}
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {medal ? (
                    <span className="text-xl">{medal}</span>
                  ) : (
                    <span className="text-sm font-mono text-muted-foreground">
                      #{entry.rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className={`
                  w-10 h-10 rounded-xl border flex items-center justify-center
                  text-xl flex-shrink-0 border-border bg-background
                  ${rarity?.glow ?? ""}
                `}>
                  {flower?.emoji.bloom ?? "🌱"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-semibold truncate group-hover:text-primary transition-colors ${isMe ? "text-primary" : ""}`}>
                      {entry.username}
                    </p>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 flex-shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Farm size {entry.farm_size}×{entry.farm_size} · {timeAgo(entry.updated_at)}
                  </p>
                </div>

                {/* Coins */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono font-semibold">
                    {entry.coins.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">🪙</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-card/60 border border-border animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Global footer note */}
      {activeTab === "global" && !loading && entries.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pb-4">
          Top {entries.length} players by coins · Updates on refresh
        </p>
      )}
    </div>
  );
}