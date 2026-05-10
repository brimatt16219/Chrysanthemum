import { useSettings } from "../store/SettingsContext";
import type { Settings } from "../store/SettingsContext";
import { THEMES } from "../data/themes";

interface Props { onClose: () => void; }

// ── Module-level constants ────────────────────────────────────────────────────

const VISUAL_TOGGLES: { key: keyof Settings; label: string; description: string }[] = [
  {
    key:         "plotAnimations",
    label:       "Tile animations",
    description: "Particle effects on tiles (water drops, glow, birds, sparkles)",
  },
  {
    key:         "plotGearIndicator",
    label:       "Gear indicators",
    description: "Small icons showing active gear effects (💧 🌸 🧹 🧺 💡)",
  },
  {
    key:         "plotMutationIndicator",
    label:       "Mutation badge",
    description: "Mutation emoji shown on bloomed tiles",
  },
  {
    key:         "plotMasteryIndicator",
    label:       "Mastery badge",
    description: "⚡ shown on tiles with a mastery speed bonus",
  },
  {
    key:         "plotFertilizerIndicator",
    label:       "Fertilizer badge",
    description: "Fertilizer emoji shown on tiles with an active fertilizer",
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: Props) {
  const { settings, setSetting } = useSettings();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 w-full sm:w-96 max-h-[85vh] overflow-y-auto shadow-xl flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">⚙️ Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">🎨 Appearance</p>

          {/* Theme picker */}
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => {
                const active = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSetting("theme", t.id)}
                    className={`
                      rounded-xl border-2 p-2 transition-all text-left
                      ${active ? "border-primary scale-[1.03]" : "border-border hover:border-primary/40"}
                    `}
                  >
                    <div
                      className="w-full h-7 rounded-lg mb-1.5 relative overflow-hidden"
                      style={{ backgroundColor: t.swatch[0] }}
                    >
                      <div
                        className="absolute bottom-1 right-1.5 w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.swatch[1] }}
                      />
                    </div>
                    <p className="text-[10px] font-medium leading-none">{t.emoji} {t.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual toggles */}
          <div className="space-y-3 pt-1 border-t border-border mt-1">
            {VISUAL_TOGGLES.map(({ key, label, description }) => (
              <ToggleRow
                key={key}
                label={label}
                description={description}
                value={settings[key] as boolean}
                onToggle={() => setSetting(key, !(settings[key] as boolean))}
              />
            ))}
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── Music ───────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">🎵 Music</p>
          <SliderRow
            value={settings.musicVolume}
            muted={settings.musicMuted}
            onChange={(v) => setSetting("musicVolume", v)}
            onToggleMute={() => setSetting("musicMuted", !settings.musicMuted)}
          />
        </section>

        <div className="border-t border-border" />

        {/* ── Sound Effects ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">🔊 Sound Effects</p>
          <SliderRow
            value={settings.sfxVolume}
            muted={settings.sfxMuted}
            onChange={(v) => setSetting("sfxVolume", v)}
            onToggleMute={() => setSetting("sfxMuted", !settings.sfxMuted)}
          />
        </section>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleRow({
  label, description, value, onToggle,
}: {
  label: string; description: string; value: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 pt-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`
          relative flex-shrink-0 w-10 h-6 rounded-full border transition-colors duration-200
          ${value ? "bg-primary/30 border-primary/60" : "bg-card border-border"}
        `}
        role="switch"
        aria-checked={value}
      >
        <span
          className={`
            absolute inset-y-0 my-auto w-4 h-4 rounded-full transition-transform duration-200
            ${value ? "translate-x-5 bg-primary" : "translate-x-0.5 bg-muted-foreground/50"}
          `}
        />
      </button>
    </div>
  );
}

function SliderRow({
  value, muted, onChange, onToggleMute,
}: {
  value: number; muted: boolean;
  onChange: (v: number) => void;
  onToggleMute: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggleMute}
        className="text-base leading-none flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔈"}
      </button>
      <input
        type="range"
        min={0} max={1} step={0.01}
        value={muted ? 0 : value}
        disabled={muted}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-primary disabled:opacity-40"
      />
      <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
        {muted ? "—" : `${Math.round(value * 100)}%`}
      </span>
    </div>
  );
}
