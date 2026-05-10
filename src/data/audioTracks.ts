import type { DayPeriod } from "./dayNight";
import type { WeatherType } from "./weather";

// ── Ambient tracks (time of day) ──────────────────────────────────────────────
// Each period gets a playlist — multiple tracks shuffle randomly, single-entry
// playlists just loop. Paths are relative to /public.

export const AMBIENT_TRACKS: Record<DayPeriod, string[]> = {
  midnight:  ["/audio/music/ambient_midnight.mp3"],
  dawn:      ["/audio/music/ambient_dawn.mp3"],
  morning:   ["/audio/music/ambient_morning_1.mp3", "/audio/music/ambient_morning_2.mp3"],
  midday:    ["/audio/music/ambient_midday_1.mp3",  "/audio/music/ambient_midday_2.mp3"],
  afternoon: ["/audio/music/ambient_afternoon_1.mp3", "/audio/music/ambient_afternoon_2.mp3"],
  sunset:    ["/audio/music/ambient_sunset.mp3"],
  dusk:      ["/audio/music/ambient_dusk.mp3"],
  night:     ["/audio/music/ambient_night_1.mp3", "/audio/music/ambient_night_2.mp3"],
};

// ── Weather override tracks ───────────────────────────────────────────────────
// "clear" intentionally omitted — clear weather falls through to ambient.
// Partial so unknown/future weather types don't require a track.

export const WEATHER_TRACKS: Partial<Record<WeatherType, string[]>> = {
  rain:            ["/audio/music/weather_rain.mp3"],
  thunderstorm:    ["/audio/music/weather_thunderstorm.mp3"],
  tornado:         ["/audio/music/weather_tornado.mp3"],
  cold_front:      ["/audio/music/weather_cold_front.mp3"],
  heatwave:        ["/audio/music/weather_heatwave.mp3"],
  golden_hour:     ["/audio/music/weather_golden_hour.mp3"],
  prismatic_skies: ["/audio/music/weather_prismatic_skies.mp3"],
  star_shower:     ["/audio/music/weather_star_shower.mp3"],
};

// ── SFX ───────────────────────────────────────────────────────────────────────

export const SFX_TRACKS: Record<string, string> = {
  harvest:          "/audio/sfx/harvest.mp3",
  plant:            "/audio/sfx/plant.mp3",
  levelUp:          "/audio/sfx/level_up.mp3",
  mutation:         "/audio/sfx/mutation.mp3",
  questComplete:    "/audio/sfx/quest_complete.mp3",
  checkinClaim:     "/audio/sfx/checkin_claim.mp3",
  achievementClaim: "/audio/sfx/achievement_claim.mp3",
  click:            "/audio/sfx/click.mp3",
  // ── Weather SFX ────────────────────────────────────────
  thunderCrack:     "/audio/sfx/thunder_crack.mp3",   // one-shot, synced to lightning flash
  rainLoop:         "/audio/sfx/rain_loop.mp3",        // looping ambient — via setWeatherAmbience
};