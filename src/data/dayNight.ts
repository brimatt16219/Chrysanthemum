export type DayPeriod =
  | "midnight"
  | "dawn"
  | "morning"
  | "midday"
  | "afternoon"
  | "sunset"
  | "dusk"
  | "night";

export interface DayPeriodDefinition {
  id: DayPeriod;
  label: string;
  emoji: string;
  // Hour range [start, end) in 24h local time
  startHour: number;
  endHour: number;
  // Overlay — color and opacity. Empty string = no overlay (dark theme already matches)
  overlayColor: string;
  overlayOpacity: number;
}

export const DAY_PERIODS: DayPeriodDefinition[] = [
  {
    id:             "midnight",
    label:          "Midnight",
    emoji:          "🌑",
    startHour:      0,
    endHour:        5,
    overlayColor:   "",
    overlayOpacity: 0,   // app is already dark
  },
  {
    id:             "dawn",
    label:          "Dawn",
    emoji:          "🌅",
    startHour:      5,
    endHour:        7,
    overlayColor:   "rgba(255, 160, 80, VAL)",  // warm peach rising from bottom
    overlayOpacity: 0.08,
  },
  {
    id:             "morning",
    label:          "Morning",
    emoji:          "🌤️",
    startHour:      7,
    endHour:        11,
    overlayColor:   "rgba(255, 245, 200, VAL)",  // soft warm white
    overlayOpacity: 0.05,
  },
  {
    id:             "midday",
    label:          "Midday",
    emoji:          "☀️",
    startHour:      11,
    endHour:        14,
    overlayColor:   "rgba(255, 240, 160, VAL)",  // bright warm yellow
    overlayOpacity: 0.07,
  },
  {
    id:             "afternoon",
    label:          "Afternoon",
    emoji:          "🌞",
    startHour:      14,
    endHour:        17,
    overlayColor:   "rgba(255, 210, 120, VAL)",  // slightly golden
    overlayOpacity: 0.05,
  },
  {
    id:             "sunset",
    label:          "Sunset",
    emoji:          "🌇",
    startHour:      17,
    endHour:        19,
    overlayColor:   "rgba(255, 100, 40, VAL)",   // deep orange-pink
    overlayOpacity: 0.10,
  },
  {
    id:             "dusk",
    label:          "Dusk",
    emoji:          "🌆",
    startHour:      19,
    endHour:        21,
    overlayColor:   "rgba(120, 60, 180, VAL)",   // purple/indigo transition
    overlayOpacity: 0.06,
  },
  {
    id:             "night",
    label:          "Night",
    emoji:          "🌙",
    startHour:      21,
    endHour:        24,
    overlayColor:   "",
    overlayOpacity: 0,   // dark theme already matches
  },
];

export function getCurrentPeriod(hour: number): DayPeriodDefinition {
  return (
    DAY_PERIODS.find((p) => hour >= p.startHour && hour < p.endHour) ??
    DAY_PERIODS[0] // fallback to midnight
  );
}
