import { useState, useEffect } from "react";
import { searchUsers } from "../store/cloudSave";
import type { CloudProfile } from "../store/cloudSave";
import { getFlower, RARITY_CONFIG } from "../data/flowers";
import { useGame } from "../store/GameContext";

interface Props {
  onViewProfile: (username: string) => void;
}

export function SearchPage({ onViewProfile }: Props) {
  const { profile: myProfile } = useGame();
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<CloudProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const found = await searchUsers(query);
      setResults(found);
      setSearched(true);
      setLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold">Find Players</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Search by username to view their garden and collection
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username..."
          className="w-full bg-card/60 border border-border rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Results */}
      {loading && (
        <p className="text-center text-muted-foreground text-sm font-mono animate-pulse py-8">
          Searching...
        </p>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-3xl">🌵</p>
          <p className="text-muted-foreground text-sm">No players found for "{query}"</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((p) => {
            const flower = getFlower(p.display_flower);
            const rarity = flower ? RARITY_CONFIG[flower.rarity] : null;
            const isMe   = myProfile?.id === p.id;

            return (
              <button
                key={p.id}
                onClick={() => onViewProfile(p.username)}
                className="flex items-center gap-4 bg-card/60 border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-all text-left group"
              >
                {/* Avatar */}
                <div className={`
                  w-12 h-12 rounded-xl border flex items-center justify-center text-2xl flex-shrink-0
                  ${rarity?.glow ?? ""} border-border bg-background
                `}>
                  {flower?.emoji.bloom ?? "🌱"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                      {p.username}
                    </p>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                        You
                      </span>
                    )}
                  </div>
                  {flower && (
                    <p className={`text-xs font-mono mt-0.5 ${rarity?.color}`}>
                      {flower.emoji.bloom} {flower.name}
                    </p>
                  )}
                </div>

                <span className="text-muted-foreground text-xs group-hover:text-primary transition-colors">
                  →
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">🌍</p>
          <p className="text-muted-foreground text-sm">
            Search for a player to view their garden
          </p>
        </div>
      )}
    </div>
  );
}