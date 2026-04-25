export type WeatherType =
  | "clear"
  | "rain"
  | "golden_hour"
  | "prismatic_skies"
  | "star_shower"
  | "cold_front"
  | "heatwave";

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
    durationMs:      15 * 60_000,  // 15 minutes
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
    durationMs:      24 * 60_000,
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
    description:     "Golden mutations are twice as likely on harvest.",
    durationMs:      18 * 60_000,
    chance:          10,
    cooldownMs:      45 * 60_000,
    growthMultiplier: 1.0,
    mutationBoost:   { mutation: "golden", multiplier: 2.0 },
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
    description:     "Rainbow mutations are twice as likely on harvest.",
    durationMs:      18 * 60_000,
    chance:          10,
    cooldownMs:      45 * 60_000,
    growthMultiplier: 1.0,
    mutationBoost:   { mutation: "rainbow", multiplier: 2.0 },
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
    description:     "Moonlit mutations are twice as likely on harvest.",
    durationMs:      21 * 60_000,
    chance:          10,
    cooldownMs:      45 * 60_000,
    growthMultiplier: 1.0,
    mutationBoost:   { mutation: "moonlit", multiplier: 2.0 },
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
    durationMs:      18 * 60_000,
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
    durationMs:      18 * 60_000,
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
};

export const WEATHER_LIST = Object.values(WEATHER);

// Pick the next weather randomly by weight, excluding cooldowns
export function rollNextWeather(
  lastWeatherType: WeatherType,
  now: number,
  lastWeatherEndedAt: number
): WeatherType {
  const eligible = WEATHER_LIST.filter((w) => {
    if (w.id === "clear") return true;
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