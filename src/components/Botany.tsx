import { useState } from "react";
import { useGame } from "../store/GameContext";
import { FLOWERS, RARITY_CONFIG, getFlower, type MutationType } from "../data/flowers";
import { MUTATIONS } from "../data/flowers";
import { BOTANY_REQUIREMENTS, BOTANY_RARITY_ORDER, NEXT_RARITY } from "../data/botany";
import { botanyConvert } from "../store/gameStore";
import type { InventoryItem } from "../store/gameStore";
import type { Rarity } from "../data/flowers";

type Selection = { speciesId: string; mutation?: MutationType };

// ── Sub-component: result banner ──────────────────────────────────────────

function ConvertResult({
  speciesId,
  onClose,
}: {
  speciesId: string;
  onClose: () => void;
}) {
  const species = getFlower(speciesId);
  if (!species) return null;
  const cfg = RARITY_CONFIG[species.rarity];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Conversion complete</p>
        <div className={`text-5xl ${cfg.glow}`}>{species.emoji.bloom}</div>
        <div className="text-center">
          <p className={`font-semibold text-lg ${cfg.color}`}>{species.name}</p>
          <p className={`text-xs ${cfg.color} opacity-70`}>{cfg.label}</p>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          You received 1 <span className={cfg.color}>{species.name}</span> seed.
          {!FLOWERS.filter((f) => f.rarity === species.rarity).every(() => true) && " New discovery!"}
        </p>
        <button
          onClick={onClose}
          className="mt-1 px-5 py-2 rounded-full text-xs font-semibold bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Sub-component: selection screen ──────────────────────────────────────

function SelectionScreen({
  rarity,
  eligibleItems,
  onBack,
  onConvert,
}: {
  rarity: Rarity;
  eligibleItems: InventoryItem[];
  onBack: () => void;
  onConvert: (selections: Selection[]) => void;
}) {
  const required = BOTANY_REQUIREMENTS[rarity] ?? 0;
  const nextRarity = NEXT_RARITY[rarity];
  const cfg = RARITY_CONFIG[rarity];
  const nextCfg = nextRarity ? RARITY_CONFIG[nextRarity] : null;

  const [selections, setSelections] = useState<Selection[]>([]);

  function countSelected(speciesId: string, mutation?: MutationType): number {
    return selections.filter(
      (s) => s.speciesId === speciesId && s.mutation === mutation
    ).length;
  }

  function handleAddMore(speciesId: string, mutation?: MutationType) {
    const already = countSelected(speciesId, mutation);
    const invItem  = eligibleItems.find(
      (i) => i.speciesId === speciesId && i.mutation === mutation
    );
    if (!invItem) return;
    if (selections.length >= required) return;
    if (already >= invItem.quantity) return;
    setSelections((prev) => [...prev, { speciesId, mutation }]);
  }

  function handleRemoveOne(speciesId: string, mutation?: MutationType) {
    let idx = -1;
    for (let i = selections.length - 1; i >= 0; i--) {
      if (selections[i].speciesId === speciesId && selections[i].mutation === mutation) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;
    setSelections((prev) => prev.filter((_, i) => i !== idx));
  }

  const isFull = selections.length === required;

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          ← Back
        </button>
        <div>
          <p className="font-semibold">
            <span className={cfg.color}>{cfg.label}</span>
            {nextCfg && (
              <>
                {" "}→{" "}
                <span className={nextCfg.color}>{nextCfg.label}</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Select {required} flowers to convert
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Selected</span>
          <span className={isFull ? "text-primary font-medium" : ""}>
            {selections.length} / {required}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${(selections.length / required) * 100}%` }}
          />
        </div>
      </div>

      {/* Flower grid */}
      <div className="grid grid-cols-2 gap-2">
        {eligibleItems.map((item) => {
          const species   = getFlower(item.speciesId);
          if (!species) return null;
          const mut       = item.mutation ? MUTATIONS[item.mutation] : null;
          const selected  = countSelected(item.speciesId, item.mutation);
          const available = item.quantity - selected;
          const isSelected = selected > 0;

          return (
            <div
              key={`${item.speciesId}${item.mutation ?? ""}`}
              className={`
                relative rounded-xl border p-3 transition-all duration-150
                ${isSelected
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-card/60 hover:border-border/80"
                }
              `}
            >
              {/* Top row: emoji + name */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{species.emoji.bloom}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {mut ? <span className={mut.color}>{mut.emoji} </span> : null}
                    {species.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.quantity} in inventory
                    {selected > 0 && ` · ${selected} selected`}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRemoveOne(item.speciesId, item.mutation)}
                  disabled={selected === 0}
                  className="w-6 h-6 rounded-md border border-border text-muted-foreground text-xs flex items-center justify-center hover:border-primary/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  −
                </button>
                <span className="flex-1 text-center text-xs font-mono text-muted-foreground">
                  {selected}
                </span>
                <button
                  onClick={() => handleAddMore(item.speciesId, item.mutation)}
                  disabled={available === 0 || isFull}
                  className="w-6 h-6 rounded-md border border-border text-muted-foreground text-xs flex items-center justify-center hover:border-primary/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Convert button */}
      <button
        onClick={() => onConvert(selections)}
        disabled={!isFull}
        className={`
          w-full py-3 rounded-full text-sm font-semibold border transition-all duration-200 text-center
          ${isFull
            ? "border-primary text-primary hover:bg-primary/10 hover:scale-[1.02]"
            : "border-border text-muted-foreground opacity-50 cursor-not-allowed"
          }
        `}
      >
        {isFull
          ? `Convert → ${nextCfg?.label ?? "?"} Seed`
          : `Select ${required - selections.length} more`}
      </button>
    </div>
  );
}

// ── Main Botany component ─────────────────────────────────────────────────

export function Botany() {
  const { state, update } = useGame();

  const [activeRarity, setActiveRarity] = useState<Rarity | null>(null);
  const [resultSpeciesId, setResultSpeciesId] = useState<string | null>(null);

  function getEligibleItems(rarity: Rarity): InventoryItem[] {
    return state.inventory.filter((item) => {
      if (item.isSeed) return false;
      const species = getFlower(item.speciesId);
      return species?.rarity === rarity && item.quantity > 0;
    });
  }

  function getTotalEligible(rarity: Rarity): number {
    return getEligibleItems(rarity).reduce((sum, i) => sum + i.quantity, 0);
  }

  function handleConvert(selections: Selection[]) {
    if (!activeRarity) return;
    const res = botanyConvert(state, selections);
    if (!res) return;
    update(res.state);
    setResultSpeciesId(res.outputSpeciesId);
    setActiveRarity(null);
  }

  if (activeRarity) {
    return (
      <>
        <SelectionScreen
          rarity={activeRarity}
          eligibleItems={getEligibleItems(activeRarity)}
          onBack={() => setActiveRarity(null)}
          onConvert={handleConvert}
        />
        {resultSpeciesId && (
          <ConvertResult
            speciesId={resultSpeciesId}
            onClose={() => setResultSpeciesId(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="font-bold text-lg tracking-wide">🌿 Botany Lab</h2>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Combine harvested flowers to receive a rare seed of the next rarity.
          Undiscovered species are prioritised.
        </p>
      </div>

      {/* Result banner (shown while on main view after a conversion) */}
      {resultSpeciesId && (
        <ConvertResult
          speciesId={resultSpeciesId}
          onClose={() => setResultSpeciesId(null)}
        />
      )}

      {/* Tier cards */}
      <div className="flex flex-col gap-3">
        {BOTANY_RARITY_ORDER.map((rarity) => {
          const required   = BOTANY_REQUIREMENTS[rarity] ?? 0;
          const nextRarity = NEXT_RARITY[rarity];
          const cfg        = RARITY_CONFIG[rarity];
          const nextCfg    = nextRarity ? RARITY_CONFIG[nextRarity] : null;
          const eligible   = getTotalEligible(rarity);
          const canOpen    = eligible >= 1;

          // Sample up to 5 species of the next rarity to preview as output
          const nextFlowers = nextRarity
            ? FLOWERS.filter((f) => f.rarity === nextRarity).slice(0, 5)
            : [];

          return (
            <button
              key={rarity}
              onClick={() => canOpen && setActiveRarity(rarity)}
              disabled={!canOpen}
              className={`
                w-full text-left rounded-2xl border p-4 transition-all duration-200
                ${canOpen
                  ? "border-border bg-card/60 hover:border-primary/40 hover:bg-card/80 hover:scale-[1.01]"
                  : "border-border/40 bg-card/30 opacity-50 cursor-not-allowed"
                }
              `}
            >
              <div className="flex items-center justify-between gap-3">

                {/* Left: rarity info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground">×{required}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                  {nextCfg && (
                    <span className={`text-xs font-semibold ${nextCfg.color}`}>
                      {nextCfg.label} Seed
                    </span>
                  )}
                </div>

                {/* Right: inventory count + flower previews */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Output flower emoji previews */}
                  {nextFlowers.length > 0 && (
                    <div className="flex -space-x-1">
                      {nextFlowers.map((f) => (
                        <span
                          key={f.id}
                          className="text-base leading-none"
                          title={f.name}
                        >
                          {f.emoji.bloom}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Progress pill */}
                  <span
                    className={`
                      text-xs font-mono px-2 py-0.5 rounded-full border
                      ${eligible >= required
                        ? "border-primary/50 text-primary bg-primary/10"
                        : "border-border text-muted-foreground"
                      }
                    `}
                  >
                    {eligible}/{required}
                  </span>
                </div>
              </div>

              {/* Progress bar (subtle) */}
              <div className="mt-2.5 h-0.5 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    eligible >= required ? "bg-primary" : "bg-muted-foreground/40"
                  }`}
                  style={{ width: `${Math.min(100, (eligible / required) * 100)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="text-center text-[10px] text-muted-foreground">
        Harvest flowers from your garden to fill the conversion stations.
      </p>
    </div>
  );
}
