import { getCurrentPeriod, type DayPeriod } from "./dayNight";

export type WeatherType =
  | "clear"
  | "rain"
  | "golden_hour"
  | "prismatic_skies"
  | "star_shower"
  | "cold_front"
  | "heatwave"
  | "thunderstorm"
  | "tornado";

export type MutationType =
  | "golden"
  | "rainbow"
  | "moonlit"
  | "frozen"
  | "scorched";

export interface WeatherDefinition {
  id: WeatherType;
  name: string;
  emoji: string;
  description: string;
  // How long this weather lasts in ms
  durationMs: number;
  // Relative weight for random selection (0 = never picked)
  chance: number;
  // Minimum ms before this weather can repeat
  cooldownMs: number;
  // Growth speed multiplier (Rain only, others 1.0)
  growthMultiplier: number;
  // Mutation boost — which mutation gets boosted and by how much
  mutationBoost?: {
    mutation: MutationType;
    multiplier: number; // e.g. 2.0 = double the base chance
  };
  // Time-of-day gating — if set, this weather can only be rolled during these periods.
  // Uses the same UTC hour ranges defined in dayNight.ts.
  // Omit (undefined) to allow at any time of day.
  allowedPeriods?: DayPeriod[];
  // Visual config
  visual: {
    overlayColor: string;      // Tailwind bg class for screen tint
    particleEmoji?: string;    // Emoji used for particle effects
    particleCount: number;     // How many particles on screen
    pulseGlow?: string;        // Tailwind color for pulse glow
  };
}

export const WEATHER: Record<WeatherType, WeatherDefinition> = {
  clear: {
    id:              "clear",
    name:            "Clear Skies",
    emoji:           "☀️",
    description:     "A beautiful day. No special effects.",
    durationMs:      15 * 60_000,   // 15 minutes
    chance:          40,           // Most common
    cooldownMs:      0,
    growthMultiplier: 1.0,
    visual: {
      overlayColor:  "",
      particleCount: 0,
    },
  },
  rain: {
    id:              "rain",
    name:            "Rain",
    emoji:           "🌧️",
    description:     "Plants grow 2× faster while it rains.",
    durationMs:      20 * 60_000,   // 20 minutes
    chance:          20,
    cooldownMs:      30 * 60_000,
    growthMultiplier: 2.0,
    visual: {
      overlayColor:  "bg-blue-900/10",
      particleEmoji: "💧",
      particleCount: 20,
      pulseGlow:     "blue",
    },
  },
  golden_hour: {
    id:              "golden_hour",
    name:            "Golden Hour",
    emoji:           "✨",
    description:     "Golden mutations are twice as likely. Only occurs at dawn, sunset, or dusk.",
    durationMs:      15 * 60_000,   // 15 minutes
    chance:          10,
    cooldownMs:      45 * 60_000,
    growthMultiplier: 1.0,
    mutationBoost:   { mutation: "golden", multiplier: 2.0 },
    allowedPeriods:  ["dawn", "sunset", "dusk"],
    visual: {
      overlayColor:  "bg-yellow-400/10",
      particleEmoji: "✨",
      particleCount: 12,
      pulseGlow:     "yellow",
    },
  },
  prismatic_skies: {
    id:              "prismatic_skies",
    name:            "Prismatic Skies",
    emoji:           "🌈",
    description:     "Rainbow mutations are twice as likely. Only occurs during the day.",
    durationMs:      15 * 60_000,   // 15 minutes
    chance:          10,
    cooldownMs:      45 * 60_000,
    growthMultiplier: 1.0,
    mutationBoost:   { mutation: "rainbow", multiplier: 2.0 },
    allowedPeriods:  ["morning", "midday", "afternoon"],
    visual: {
      overlayColor:  "bg-pink-400/10",
      particleEmoji: "🌈",
      particleCount: 6,
      pulseGlow:     "pink",
    },
  },
  star_shower: {
    id:              "star_shower",
    name:            "Star Shower",
    emoji:           "🌙",
    description:     "Moonlit mutations are twice as likely. Only occurs at night.",
    durationMs:      17.5 * 60_000, // 17.5 minutes
    chance:          10,
    cooldownMs:      45 * 60_000,
    growthMultiplier: 1.0,
    mutationBoost:   { mutation: "moonlit", multiplier: 2.0 },
    allowedPeriods:  ["midnight", "night"],
    visual: {
      overlayColor:  "bg-indigo-900/20",
      particleEmoji: "⭐",
      particleCount: 15,
      pulseGlow:     "indigo",
    },
  },
  cold_front: {
    id:              "cold_front",
    name:            "Cold Front",
    emoji:           "❄️",
    description:     "Frozen mutations are twice as likely on harvest.",
    durationMs:      15 * 60_000,   // 15 minutes
    chance:          10,
    cooldownMs:      45 * 60_000,
    growthMultiplier: 1.0,
    mutationBoost:   { mutation: "frozen", multiplier: 2.0 },
    visual: {
      overlayColor:  "bg-cyan-400/10",
      particleEmoji: "❄️",
      particleCount: 15,
      pulseGlow:     "cyan",
    },
  },
  heatwave: {
    id:              "heatwave",
    name:            "Heatwave",
    emoji:           "🔥",
    description:     "Scorched mutations are twice as likely on harvest.",
    durationMs:      15 * 60_000,   // 15 minutes
    chance:          10,
    cooldownMs:      45 * 60_000,
    growthMultiplier: 1.0,
    mutationBoost:   { mutation: "scorched", multiplier: 2.0 },
    visual: {
      overlayColor:  "bg-orange-400/10",
      particleEmoji: "🔥",
      particleCount: 12,
      pulseGlow:     "orange",
    },
  },
  thunderstorm: {
    id:              "thunderstorm",
    name:            "Thunderstorm",
    emoji:           "⛈️",
    description:     "Plants grow 2× faster, but visibility is low.",
    durationMs:      20 * 60_000,   // 20 minutes
    chance:          8,
    cooldownMs:      60 * 60_000,
    growthMultiplier: 2.0,
    visual: {
      overlayColor:  "bg-slate-900/30",
      particleEmoji: "⚡",
      particleCount: 10,
      pulseGlow:     "slate",
    },
  },
  tornado: {
    id:              "tornado",
    name:            "Tornado",
    emoji:           "🌪️",
    description:     "A wild tornado sweeps through — all bloomed flowers receive a random mutation.",
    durationMs:      10 * 60_000,   // 10 minutes
    chance:          4,             // Rare
    cooldownMs:      120 * 60_000,  // 2-hour cooldown
    growthMultiplier: 1.0,
    visual: {
      overlayColor:  "bg-stone-700/20",
      particleEmoji: "🌪️",
      particleCount: 8,
      pulseGlow:     "stone",
    },
  },
};

export const WEATHER_LIST = Object.values(WEATHER);

// Returns true if the given weather type is allowed at the provided UTC hour.
// Weather with no allowedPeriods restriction is always eligible.
export function isWeatherAllowedAtHour(type: WeatherType, utcHour: number): boolean {
  const def = WEATHER[type];
  if (!def.allowedPeriods) return true;
  const period = getCurrentPeriod(utcHour);
  return def.allowedPeriods.includes(period.id);
}

// Pick the next weather randomly by weight, excluding cooldowns and time-of-day gates.
// utcHour defaults to the current UTC hour if not provided.
export function rollNextWeather(
  lastWeatherType: WeatherType,
  now: number,
  lastWeatherEndedAt: number,
  utcHour: number = new Date().getUTCHours(),
): WeatherType {
  const eligible = WEATHER_LIST.filter((w) => {
    if (w.id === "clear") return true;
    if (!isWeatherAllowedAtHour(w.id, utcHour)) return false;
    if (w.id === lastWeatherType) {
      return now - lastWeatherEndedAt >= w.cooldownMs;
    }
    return w.chance > 0;
  });

  const totalWeight = eligible.reduce((s, w) => s + w.chance, 0);
  let roll = Math.random() * totalWeight;

  for (const w of eligible) {
    roll -= w.chance;
    if (roll <= 0) return w.id;
  }

  return "clear";
}