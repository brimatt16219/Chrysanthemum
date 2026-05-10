import { useSettings } from "../store/SettingsContext";

interface Props { onClose: () => void; }

export function SettingsModal({ onClose }: Props) {
  const { settings, setSetting } = useSettings();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-5 w-80 shadow-xl flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">⚙️ Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>

        {/* Music */}
        <Section label="🎵 Music">
          <SliderRow
            value={settings.musicVolume}
            muted={settings.musicMuted}
            onChange={(v) => setSetting("musicVolume", v)}
            onToggleMute={() => setSetting("musicMuted", !settings.musicMuted)}
          />
        </Section>

        {/* SFX */}
        <Section label="🔊 Sound Effects">
          <SliderRow
            value={settings.sfxVolume}
            muted={settings.sfxMuted}
            onChange={(v) => setSetting("sfxVolume", v)}
            onToggleMute={() => setSetting("sfxMuted", !settings.sfxMuted)}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
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