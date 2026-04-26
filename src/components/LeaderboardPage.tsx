import { useEffect, useState, useCallback, useMemo } from "react";
import { useGame } from "../store/GameContext";
import {
  getLeaderboard,
  getFriendsLeaderboard,
  getMyRank,
  type LeaderboardEntry,
} from "../store/cloudSave";
import { getFlower, RARITY_CONFIG, MUTATIONS } from "../data/flowers";
import type { MutationType } from "../data/flowers";
import { getTotalCodexEntries } from "../store/gameStore";

interface Props {
  onViewProfile: (username: string) => void;
}

type LeaderboardTab = "global" | "friends";
type SortBy         = "coins" | "codex";

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
const TOTAL_CODEX = getTotalCodexEntries();

export function LeaderboardPage({ onViewProfile }: Props) {
  const { user, state } = useGame();

  const [activeTab, setActiveTab]     = useState<LeaderboardTab>("global");
  const [sortBy, setSortBy]           = useState<SortBy>("coins");
  const [entries, setEntries]         = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank]           = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
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

  // Sort + re-rank client-side when switching sort mode
  const sortedEntries = useMemo(() => {
    if (sortBy === "coins") return entries; // already ranked by coins from DB
    const sorted = [...entries].sort(
      (a, b) => (b.discovered_count ?? 0) - (a.discovered_count ?? 0)
    );
    return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
  }, [entries, sortBy]);

  const myEntry = sortedEntries.find((e) => e.id === user?.id);
  const myCodexCount = state.discovered.length;

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

      {/* Tab + sort row — single flex row, equal-width buttons */}
      <div className="flex gap-2">
        {(["global", "friends"] as LeaderboardTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`
              flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center
              ${activeTab === t
                ? "bg-primary/20 border border-primary/50 text-primary"
                : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
              }
            `}
          >
            {t === "global" ? "🌍" : "👥"}
            <span className="hidden sm:inline ml-1 capitalize">{t}</span>
          </button>
        ))}
        {(["coins", "codex"] as SortBy[]).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`
              flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center
              ${sortBy === s
                ? "bg-primary/20 border border-primary/50 text-primary"
                : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
              }
            `}
          >
            {s === "coins" ? "🟡" : "📖"}
            <span className="hidden sm:inline ml-1 capitalize">{s}</span>
          </button>
        ))}
      </div>

      {/* Your rank banner */}
      {user && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
          <span className="text-2xl">
            {myEntry && myEntry.rank <= 3 ? RANK_MEDALS[myEntry.rank] : "🌸"}
          </span>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-mono">Your rank</p>
            <p className="text-sm font-bold">
              {myEntry ? `#${myEntry.rank}` : myRank ? `#${myRank}` : "Unranked"}{" "}
              <span className="text-muted-foreground font-normal">
                {sortBy === "coins"
                  ? `· ${state.coins.toLocaleString()} 🟡`
                  : `· ${myCodexCount}/${TOTAL_CODEX} 📖`
                }
              </span>
            </p>
          </div>
          {activeTab === "friends" && sortedEntries.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Among {sortedEntries.length} players
            </p>
          )}
        </div>
      )}

      {/* No friends message */}
      {activeTab === "friends" && !loading && sortedEntries.length <= 1 && (
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
      {!loading && sortedEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          {sortedEntries.map((entry) => {
            const flower  = getFlower(entry.display_flower);
            const rarity  = flower ? RARITY_CONFIG[flower.rarity] : null;
            const mutObj  = entry.display_mutation ? MUTATIONS[entry.display_mutation as MutationType] : null;
            const isMe   = entry.id === user?.id;
            const medal  = RANK_MEDALS[entry.rank];
            const codexPct = TOTAL_CODEX > 0
              ? Math.round(((entry.discovered_count ?? 0) / TOTAL_CODEX) * 100)
              : 0;

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
                  relative w-10 h-10 rounded-xl border flex items-center justify-center
                  text-xl flex-shrink-0 border-border bg-background
                  ${rarity?.glow ?? ""}
                `}>
                  {flower?.emoji.bloom ?? "🌱"}
                  {mutObj && (
                    <span className="absolute -top-1 -right-1 text-sm leading-none">{mutObj.emoji}</span>
                  )}
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
                    {timeAgo(entry.updated_at)}
                  </p>
                </div>

                {/* Stat — coins or codex depending on sort */}
                <div className="text-right flex-shrink-0">
                  {sortBy === "coins" ? (
                    <>
                      <p className="text-sm font-mono font-semibold">
                        {entry.coins.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">🟡</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-mono font-semibold">
                        {entry.discovered_count ?? 0}
                        <span className="text-muted-foreground font-normal text-xs">/{TOTAL_CODEX}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{codexPct}% 📖</p>
                    </>
                  )}
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

      {/* Footer note */}
      {activeTab === "global" && !loading && sortedEntries.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pb-4">
          Top {sortedEntries.length} players by {sortBy === "coins" ? "coins" : "codex completion"} · Updates on refresh
        </p>
      )}
    </div>
  );
}
