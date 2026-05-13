import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ActiveBoost } from "../store/gameStore";
import { ItemSprite } from "./ItemSprite";

const BOOST_DISPLAY: Record<ActiveBoost["type"], { emoji: string; sprite: string; label: string }> = {
  growth:     { emoji: "🌿", sprite: "/sprites/consumables/verdant_rush.png",   label: "Verdant Rush" },
  craft:      { emoji: "⚒️", sprite: "/sprites/consumables/forge_haste.png",    label: "Forge Haste" },
  attunement: { emoji: "🌀", sprite: "/sprites/consumables/resonance_draft.png", label: "Resonance Draft" },
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface Props {
  activeBoosts: ActiveBoost[] | undefined;
}

/** Consolidated HUD pill for all active speed boosts.
 *  - Shows all boost emojis in one pill; time only when exactly 1 boost is active.
 *  - Click opens a fixed-position dropdown (portal) listing each boost with its
 *    full name and time remaining. Renders nothing when no boosts are active. */
export function ActiveBoostsHUD({ activeBoosts }: Props) {
  const [now, setNow]   = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const buttonRef       = useRef<HTMLButtonElement>(null);

  // Position of the dropdown in viewport coords
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Recalculate drop position whenever it opens
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropPos({
      top:   rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const live = (activeBoosts ?? []).filter(
    (b) => new Date(b.expiresAt).getTime() > now,
  );

  if (live.length === 0) return null;

  // Show inline time only when there is exactly one active boost
  const showInlineTime = live.length === 1;

  // Sort soonest-expiring first for the modal
  const sorted = [...live].sort(
    (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
  );

  const dropdown = open && dropPos && createPortal(
    <div
      style={{ position: "fixed", top: dropPos.top, right: dropPos.right }}
      className="z-[200] min-w-[190px] rounded-xl border border-amber-500/30 bg-card/95 backdrop-blur-sm shadow-xl px-3 py-2.5 space-y-2"
    >
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        Active Boosts
      </p>
      {sorted.map((b) => {
        const cfg       = BOOST_DISPLAY[b.type];
        const remaining = new Date(b.expiresAt).getTime() - now;
        return (
          <div key={b.type} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-amber-300">
              <ItemSprite emoji={cfg.emoji} sprite={cfg.sprite} name={cfg.label} textSize="text-sm" imgSize="w-4 h-4" />
              <span className="font-medium">{cfg.label}</span>
            </span>
            <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
              {formatRemaining(remaining)}
            </span>
          </div>
        );
      })}
    </div>,
    document.body,
  );

  return (
    <>
      {/* ── Combined pill — same sizing as WeatherBanner ── */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
        title="Active boosts — click for details"
      >
        {live.map((b) => (
          <ItemSprite key={b.type} emoji={BOOST_DISPLAY[b.type].emoji} sprite={BOOST_DISPLAY[b.type].sprite} name={BOOST_DISPLAY[b.type].label} textSize="text-sm" imgSize="w-4 h-4" />
        ))}
        {showInlineTime && (
          <span className="ml-0.5">
            {formatRemaining(new Date(live[0].expiresAt).getTime() - now)}
          </span>
        )}
      </button>

      {/* ── Portal dropdown — escapes sticky/stacking-context clipping ── */}
      {dropdown}
    </>
  );
}
