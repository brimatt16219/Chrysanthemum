import { useState, useMemo, useEffect } from "react";
import { FLOWERS, MUTATIONS, RARITY_CONFIG, FLOWER_TYPES } from "../data/flowers";
import type { Rarity, MutationType, FlowerType } from "../data/flowers";
import { FlowerTypeBadges } from "./FlowerTypeBadges";
import { FlowerSprite } from "./FlowerSprite";
import { ItemSprite } from "./ItemSprite";
import {
  getTotalCodexEntries,
  isDiscovered,
  getSpeciesCompletion,
} from "../store/gameStore";
import { useGame } from "../store/GameContext";

type FilterRarity = Rarity | "all";
type FilterStatus = "all" | "discovered" | "undiscovered" | "new";

/** Format a growth-time millisecond duration for the codex stats panel.
 *  Shows d/h/m/s so times above 24 h read as days rather than raw hours. */
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1_000);
  const days    = Math.floor(totalSec / 86_400);
  const hours   = Math.floor((totalSec % 86_400) / 3_600);
  const minutes = Math.floor((totalSec % 3_600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (days    > 0) parts.push(`${days}d`);
  if (hours   > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

interface Props {
  // When used on a profile page, pass in a read-only discovered array
  // When used in the main game, leave empty and it reads from context
  discoveredOverride?: string[];
  compact?: boolean; // compact mode for profile preview
  /** Entries the user hasn't acknowledged (i.e., hasn't opened that card yet).
   *  Drives the red dot on cards. App owns this set; we mutate via markSeen. */
  unseenEntries?: Set<string>;
  /** Called when the user expands a card — marks every entry belonging to
   *  that species (base + mutations) as seen, so the navbar badge ticks down
   *  and the red dot disappears. */
  markSeen?: (speciesId: string) => void;
}

export function Codex({ discoveredOverride, compact = false, unseenEntries, markSeen }: Props) {
  const { state } = useGame();
  const discovered = discoveredOverride ?? state.discovered;

  // Snapshot unseen entries at mount so the "Newly discovered" labels persist
  // through expanding/collapsing while the user is on the codex tab. The
  // labels disappear automatically when the user navigates away (component
  // unmounts) and the next visit takes a fresh snapshot of whatever's still
  // unseen at that moment.
  const [freshlyDiscovered] = useState<Set<string>>(
    () => new Set(unseenEntries ?? [])
  );

  const [filterRarity, setFilterRarity] = useState<FilterRarity>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  // Multi-select type filter (OR semantics — show flowers with ANY selected
  // type). Empty array = "all types". Mirrors the Alchemy → Sacrifice filter.
  const [activeTypes, setActiveTypes]   = useState<FlowerType[]>([]);
  const [search, setSearch]             = useState("");
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const total    = getTotalCodexEntries();
  const found    = discovered.length;
  const pct      = total > 0 ? Math.round((found / total) * 100) : 0;

  useEffect(() => {
    if (filterStatus === "new" && freshlyDiscovered.size === 0) {
      setFilterStatus("all");
    }
  }, [freshlyDiscovered.size, filterStatus])

  const filtered = useMemo(() => {
    return FLOWERS.filter((f) => {
      if (filterRarity !== "all" && f.rarity !== filterRarity) return false;

      // Type filter — OR semantics: a flower passes if it has any selected type.
      // Empty selection = no filter.
      if (activeTypes.length > 0 && !f.types.some((t) => activeTypes.includes(t))) {
        return false;
      }

      const { found: specFound } = getSpeciesCompletion(discovered, f.id);
      if (filterStatus === "discovered"   && specFound === 0) return false;
      if (filterStatus === "undiscovered" && specFound > 0)   return false;
      if (filterStatus === "new" && !freshlyDiscovered.has(f.id) && !(Object.keys(MUTATIONS) as MutationType[]).some((m) => freshlyDiscovered.has(`${f.id}:${m}`))) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        // Undiscovered flowers never match search — otherwise typing the
        // internal id (e.g. "void_chrysalis") would leak species the player
        // hasn't earned yet via the ??? entries.
        const hasBase = isDiscovered(discovered, f.id);
        if (!hasBase) return false;
        if (!f.name.toLowerCase().includes(q) && !f.description.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [discovered, filterRarity, filterStatus, activeTypes, search]);

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
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {(["common", "uncommon", "rare", "legendary", "mythic", "exalted", "prismatic"] as Rarity[]).map((r) => {
          const rarityFlowers = FLOWERS.filter((f) => f.rarity === r);
          const mutationCount = Object.keys(MUTATIONS).length;
          const rarityTotal   = rarityFlowers.reduce((s) => s + 1 + mutationCount, 0);
          const rarityFound   = rarityFlowers.reduce((s, f) => {
            return s + getSpeciesCompletion(discovered, f.id).found;
          }, 0);
          const cfg = RARITY_CONFIG[r];

          return (
            <div key={r} className="bg-card/60 border border-border rounded-xl p-2 text-center">
              <p className={`text-[10px] font-mono ${cfg.color} capitalize`}>{r}</p>
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
          {(["all", "common", "uncommon", "rare", "legendary", "mythic", "exalted", "prismatic"] as FilterRarity[]).map((r) => (
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

        {/* Type filter — OR multi-select. Click to toggle a type; empty = all */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTypes([])}
            className={`
              px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all
              ${activeTypes.length === 0
                ? "bg-foreground/10 border border-foreground/40 text-foreground"
                : "bg-card/60 border border-border text-muted-foreground hover:border-foreground/30"
              }
            `}
          >
            All types
          </button>
          {(Object.keys(FLOWER_TYPES) as FlowerType[]).map((t) => {
            const cfg      = FLOWER_TYPES[t];
            const isActive = activeTypes.includes(t);
            return (
              <button
                key={t}
                onClick={() => setActiveTypes((prev) =>
                  isActive ? prev.filter((x) => x !== t) : [...prev, t]
                )}
                className={`
                  inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all
                  ${isActive
                    ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color} border`
                    : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                  }
                `}
              >
                <ItemSprite emoji={cfg.emoji} sprite={cfg.sprite} name={cfg.name} textSize="text-[10px]" imgSize="w-3.5 h-3.5" />
                <span>{cfg.name}</span>
              </button>
            );
          })}
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
          <div className="relative">
            {(unseenEntries?.size ?? 0) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 z-10 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-card shadow-[0_0_8px_rgba(239,68,68,0.6)]" />    
              )}
              <button
                disabled={(unseenEntries?.size ?? 0) === 0}
                onClick={() => setFilterStatus("new")}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed
                  ${filterStatus === "new"
                    ? "bg-primary/20 border border-primary/50 text-primary"
                    : "bg-card/60 border border-border text-muted-foreground hover:border-primary/30"
                  }
                `}
                >
                  ✦ New
              </button>
          </div>
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
          // Card has unseen content if any of this species' discovered entries
          // (base or mutation combos) are in the unseen set. Drives the red
          // dot in the top-right of the card.
          const cardHasUnseen = (unseenEntries?.size ?? 0) > 0 && (
            unseenEntries!.has(f.id) ||
            (Object.keys(MUTATIONS) as MutationType[]).some((m) =>
              unseenEntries!.has(`${f.id}:${m}`)
            )
          );

          return (
            <div
              key={f.id}
              className={`
                relative bg-card/60 border rounded-xl overflow-hidden transition-all
                ${hasBase ? `border-border hover:border-primary/30 ${rarity.glow}` : "border-border/40 opacity-60"}
              `}
            >
              {/* Unseen-discovery dot — top-right corner. Cleared when the card
                  is expanded (markSeen marks every entry of this species). */}
              {cardHasUnseen && (
                <span
                  className="absolute top-2 right-2 z-10 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-card shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                  aria-label="New discovery"
                />
              )}

              {/* Main row */}
              <button
                onClick={() => {
                  setExpandedId(isExpanded ? null : f.id);
                  // On expand (not collapse), mark this species' entries as seen.
                  if (!isExpanded) markSeen?.(f.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {/* Emoji */}
                <div className="flex-shrink-0 w-8 flex items-center justify-center">
                  {hasBase
                    ? <FlowerSprite species={f} stage="bloom" textSize="text-2xl" imgSize="w-7 h-7" />
                    : <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-2xl" imgSize="w-7 h-7" />
                  }
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
                  {hasBase && <FlowerTypeBadges types={f.types} className="mt-1" />}
                  {hasBase && (
                    <p className={`text-xs text-muted-foreground mt-1 ${isExpanded ? "" : "truncate"}`}>
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
                    <p className="text-[10px] text-primary font-semibold">⚡ Mastered</p>
                  )}
                </div>

                {/* Expand arrow */}
                <span className={`text-muted-foreground text-xs transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>

              {/* Expanded mutation details — uses the CSS-grid `0fr → 1fr`
                  trick so the dropdown smoothly animates open/closed without
                  needing to measure heights. Inner div is `overflow-hidden`
                  so the content clips while the row collapses. */}
              <div
                className={`
                  grid transition-[grid-template-rows] duration-300 ease-out
                  ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}
                `}
              >
                <div className="overflow-hidden">
                <div className="px-4 pb-3 border-t border-border/40 pt-3 space-y-2">
                  {/* Stats — growth time + sell price (only for discovered species) */}
                  {hasBase && (
                    <div className="bg-card/40 border border-border/40 rounded-lg px-3 py-2 mb-1 text-xs font-mono text-muted-foreground space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span>Seed → Sprout</span>
                        <span className="text-foreground">{formatDuration(f.growthTime.seed)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Sprout → Bloom</span>
                        <span className="text-foreground">{formatDuration(f.growthTime.sprout)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5 border-t border-border/40 mt-0.5">
                        <span>Sell value</span>
                        <span className="text-foreground">{f.sellValue.toLocaleString()} 🟡</span>
                      </div>
                    </div>
                  )}

                  {/* Base entry */}
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                      hasBase ? "bg-primary/20 text-primary" : "bg-border text-muted-foreground"
                    }`}>
                      {hasBase ? "✓" : "?"}
                    </span>
                    {hasBase
                      ? <FlowerSprite species={f} stage="bloom" textSize="text-sm" imgSize="w-5 h-5" />
                      : <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-sm" imgSize="w-5 h-5" />
                    }
                    <span className="text-xs text-foreground">
                      {hasBase ? f.name : "???"}
                    </span>
                    {freshlyDiscovered.has(f.id) && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30">
                        Newly discovered
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">Base</span>
                  </div>

                  {/* Mutation entries */}
                  {(Object.keys(MUTATIONS) as MutationType[]).map((mutId) => {
                    const found  = isDiscovered(discovered, f.id, mutId);
                    const mut    = MUTATIONS[mutId];
                    const isFresh = freshlyDiscovered.has(`${f.id}:${mutId}`);
                    return (
                      <div key={mutId} className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                          found ? "bg-primary/20 text-primary" : "bg-border text-muted-foreground"
                        }`}>
                          {found ? "✓" : "?"}
                        </span>
                        {found
                          ? <FlowerSprite species={f} stage="bloom" textSize="text-sm" imgSize="w-5 h-5" />
                          : <ItemSprite emoji="❓" sprite="/sprites/ui/unknown.png" name="Unknown" textSize="text-sm" imgSize="w-5 h-5" />
                        }
                        <span className="text-xs">{found ? mut.emoji : "❓"}</span>
                        <span className={`text-xs ${found ? mut.color : "text-muted-foreground"}`}>
                          {found ? mut.name : "???"}
                        </span>
                        {isFresh && (
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30">
                            Newly discovered
                          </span>
                        )}
                        {found && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            ×{mut.valueMultiplier} value
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Mastery bonus */}
                  {specFound === specTotal && (
                    <div className="mt-1 pt-2 border-t border-border/40 flex items-center gap-2">
                      <span className="text-sm">⚡</span>
                      <span className="text-xs text-primary font-semibold">Mastered</span>
                      <span className="text-xs text-muted-foreground ml-auto">grows 20% faster</span>
                    </div>
                  )}
                </div>
                </div>
              </div>
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
