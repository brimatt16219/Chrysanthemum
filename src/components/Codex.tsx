import { useState, useMemo } from "react";
import { FLOWERS, MUTATIONS, RARITY_CONFIG } from "../data/flowers";
import type { Rarity, MutationType } from "../data/flowers";
import {
  getTotalCodexEntries,
  isDiscovered,
  getSpeciesCompletion,
} from "../store/gameStore";
import { useGame } from "../store/GameContext";

type FilterRarity = Rarity | "all";
type FilterStatus = "all" | "discovered" | "undiscovered";

interface Props {
  // When used on a profile page, pass in a read-only discovered array
  // When used in the main game, leave empty and it reads from context
  discoveredOverride?: string[];
  compact?: boolean; // compact mode for profile preview
}

export function Codex({ discoveredOverride, compact = false }: Props) {
  const { state } = useGame();
  const discovered = discoveredOverride ?? state.discovered;

  const [filterRarity, setFilterRarity] = useState<FilterRarity>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch]             = useState("");
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const total    = getTotalCodexEntries();
  const found    = discovered.length;
  const pct      = total > 0 ? Math.round((found / total) * 100) : 0;

  const filtered = useMemo(() => {
    return FLOWERS.filter((f) => {
      if (filterRarity !== "all" && f.rarity !== filterRarity) return false;

      const { found: specFound } = getSpeciesCompletion(discovered, f.id);
      if (filterStatus === "discovered"   && specFound === 0) return false;
      if (filterStatus === "undiscovered" && specFound > 0)   return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        // Show mystery entries as ??? so don't filter out by name if undiscovered
        const hasBase = isDiscovered(discovered, f.id);
        if (!hasBase && !f.id.includes(q)) return false;
        if (hasBase && !f.name.toLowerCase().includes(q) && !f.description.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [discovered, filterRarity, filterStatus, search]);

  if (compact) {
    return <CompactCodex discovered={discovered} total={total} found={found} pct={pct} />;
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-bold">Floral Codex</h2>
        <p className="text-xs text-muted-foreground">
          Discover flowers by harvesting them. Mutations unlock separately.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-card/60 border border-border rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Overall Completion</p>
          <p className="text-sm font-mono text-primary">{found} / {total}</p>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">{pct}% complete</p>
      </div>

      {/* Rarity breakdown */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(["common", "uncommon", "rare", "legendary", "mythic", "exalted"] as Rarity[]).map((r) => {
          const rarityFlowers = FLOWERS.filter((f) => f.rarity === r);
          const rarityTotal   = rarityFlowers.reduce((s, f) => s + 1 + f.possibleMutations.length, 0);
          const rarityFound   = rarityFlowers.reduce((s, f) => {
            return s + getSpeciesCompletion(discovered, f.id).found;
          }, 0);
          const cfg = RARITY_CONFIG[r];

          return (
            <div key={r} className="bg-card/60 border border-border rounded-xl p-2 text-center">
              <p className={`text-[10px] font-mono ${cfg.color} capitalize`}>{r.slice(0, 3)}</p>
              <p className="text-sm font-bold mt-0.5">{rarityFound}</p>
              <p className="text-[10px] text-muted-foreground">/{rarityTotal}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flowers..."
            className="w-full bg-card/60 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Rarity filter */}
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "common", "uncommon", "rare", "legendary", "mythic", "exalted"] as FilterRarity[]).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRarity(r)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
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

        {/* Status filter */}
        <div className="flex gap-1.5">
          {(["all", "discovered", "undiscovered"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
                ${filterStatus === s
                  ? "bg-primary/20 border border-primary/50 text-primary"
                  : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                }
              `}
            >
              {s === "all" ? "All" : s === "discovered" ? "✓ Found" : "? Missing"}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground font-mono">
        Showing {filtered.length} / {FLOWERS.length} species
      </p>

      {/* Flower entries */}
      <div className="flex flex-col gap-2">
        {filtered.map((f) => {
          const hasBase    = isDiscovered(discovered, f.id);
          const { found: specFound, total: specTotal } = getSpeciesCompletion(discovered, f.id);
          const rarity     = RARITY_CONFIG[f.rarity];
          const isExpanded = expandedId === f.id;

          return (
            <div
              key={f.id}
              className={`
                bg-card/60 border rounded-xl overflow-hidden transition-all
                ${hasBase ? `border-border hover:border-primary/30 ${rarity.glow}` : "border-border/40 opacity-60"}
              `}
            >
              {/* Main row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : f.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {/* Emoji */}
                <div className="text-2xl flex-shrink-0 w-8 text-center">
                  {hasBase ? f.emoji.bloom : "❓"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">
                      {hasBase ? f.name : "???"}
                    </p>
                    <span className={`text-[10px] font-mono ${rarity.color}`}>
                      {rarity.label}
                    </span>
                  </div>
                  {hasBase && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {f.description}
                    </p>
                  )}
                </div>

                {/* Completion */}
                <div className="flex-shrink-0 text-right">
                  <p className={`text-xs font-mono ${specFound === specTotal ? "text-primary" : "text-muted-foreground"}`}>
                    {specFound}/{specTotal}
                  </p>
                  {specFound === specTotal && (
                    <p className="text-[10px] text-primary">✓ Complete</p>
                  )}
                </div>

                {/* Expand arrow */}
                <span className={`text-muted-foreground text-xs transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>

              {/* Expanded mutation details */}
              {isExpanded && (
                <div className="px-4 pb-3 border-t border-border/40 pt-3 space-y-2">
                  {/* Base entry */}
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                      hasBase ? "bg-primary/20 text-primary" : "bg-border text-muted-foreground"
                    }`}>
                      {hasBase ? "✓" : "?"}
                    </span>
                    <span className="text-sm">{hasBase ? f.emoji.bloom : "❓"}</span>
                    <span className="text-xs text-foreground">
                      {hasBase ? f.name : "???"}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">Base</span>
                  </div>

                  {/* Mutation entries */}
                  {f.possibleMutations.map((mutId) => {
                    const found  = isDiscovered(discovered, f.id, mutId);
                    const mut    = MUTATIONS[mutId as MutationType];
                    return (
                      <div key={mutId} className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                          found ? "bg-primary/20 text-primary" : "bg-border text-muted-foreground"
                        }`}>
                          {found ? "✓" : "?"}
                        </span>
                        <span className="text-sm">{found ? f.emoji.bloom : "❓"}</span>
                        <span className="text-xs">{found ? mut.emoji : "❓"}</span>
                        <span className={`text-xs ${found ? mut.color : "text-muted-foreground"}`}>
                          {found ? mut.name : "???"}
                        </span>
                        {found && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            ×{mut.valueMultiplier} value
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-3xl">🌿</p>
          <p className="text-muted-foreground text-sm">No flowers match your filters.</p>
        </div>
      )}
    </div>
  );
}

// ── Compact version for profile page ──────────────────────────────────────

function CompactCodex({
  discovered,
  total,
  found,
  pct,
}: {
  discovered: string[];
  total: number;
  found: number;
  pct: number;
}) {
  // Show up to 20 discovered bloom emojis as a preview
  const discoveredSpecies = FLOWERS
    .filter((f) => isDiscovered(discovered, f.id))
    .sort((a, b) => b.sellValue - a.sellValue);
  const preview           = discoveredSpecies.slice(0, 20);

  return (
    <div className="bg-card/60 border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">🌿 Floral Codex</h3>
        <p className="text-xs font-mono text-primary">{found} / {total}</p>
      </div>

      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {preview.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {preview.map((f) => (
            <span key={f.id} className="text-xl" title={f.name}>
              {f.emoji.bloom}
            </span>
          ))}
          {discoveredSpecies.length > 20 && (
            <span className="text-xs text-muted-foreground self-center">
              +{discoveredSpecies.length - 20} more
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No flowers discovered yet.</p>
      )}

      <p className="text-xs text-muted-foreground">{pct}% complete</p>
    </div>
  );
}
