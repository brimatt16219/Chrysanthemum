import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { applyTheme } from "../data/themes";

export interface Settings {
  plotAnimations:          boolean;
  plotGearIndicator:       boolean;
  plotMutationIndicator:   boolean;
  plotMutationVfx:         boolean;
  plotMasteryIndicator:    boolean;
  plotFertilizerIndicator: boolean;
  useSprites:              boolean;
  pixelBorders:            boolean;
  theme:                   string;
  // ── Audio ──────────────────────────────────────────────
  musicVolume:             number;   // 0–1
  sfxVolume:               number;   // 0–1
  musicMuted:              boolean;
  sfxMuted:                boolean;
}

const DEFAULTS: Settings = {
  plotAnimations:          true,
  plotGearIndicator:       true,
  plotMutationIndicator:   false,
  plotMutationVfx:         true,
  plotMasteryIndicator:    true,
  plotFertilizerIndicator: true,
  useSprites:              true,
  pixelBorders:            true,
  theme:                   "garden",
  // ── Audio ──────────────────────────────────────────────
  musicVolume:             0.5,
  sfxVolume:               0.7,
  musicMuted:              false,
  sfxMuted:                false,
};

const LS_KEY = "chrysanthemum_settings";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const s   = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    // Apply synchronously so there's no flash before the first render
    applyTheme(s.theme);
    return s;
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

interface SettingsCtx {
  settings:    Settings;
  setSetting:  <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  // Re-apply theme CSS vars whenever the theme changes
  useEffect(() => { applyTheme(settings.theme); }, [settings.theme]);

  return <Ctx.Provider value={{ settings, setSetting }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
