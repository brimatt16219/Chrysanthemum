import type { DayPeriod } from "./dayNight";
import type { WeatherType } from "./weather";

// ── Track library ──────────────────────────────────────────────────────────────
// Each file is defined exactly once. Add periods to periods[] or weather[] to
// reuse the same file across multiple contexts — no duplication needed.
// Files live at public/audio/music/<file>.

interface AmbientTrack   { id: string; file: string; periods: DayPeriod[];  }
interface WeatherTrackDef { id: string; file: string; weather: WeatherType[]; }

const MUSIC_BASE = "/audio/music/";

// ── Ambient library ───────────────────────────────────────────────────────────

const AMBIENT_LIBRARY: AmbientTrack[] = [

  // ── Midnight ──────────────────────────────────────────────────────────────
  { id: "zelda_chill_oot_mikel",    file: "zelda_chill_oot_mikel.mp3",    periods: ["midnight"]                     },
  { id: "butterflies_aura",         file: "butterflies_aura.mp3",          periods: ["midnight"]                     },
  { id: "cherry_blossom_aura",      file: "cherry_blossom_aura.mp3",       periods: ["midnight"]                     },
  { id: "impermanence_riddiman",    file: "impermanence_riddiman.mp3",     periods: ["midnight", "sunset", "dusk"]   },

  // ── Dawn ─────────────────────────────────────────────────────────────────
  { id: "sunset_chill",             file: "sunset_chill.mp3",              periods: ["dawn", "morning", "midday"]    },
  { id: "honey_jam_massobeats",     file: "honey_jam_massobeats.mp3",      periods: ["dawn", "morning"]              },
  { id: "marshmallow_lukrembo",     file: "marshmallow_lukrembo.mp3",      periods: ["dawn"]                         },
  { id: "lith_harbor_soulrez",      file: "lith_harbor_soulrez.mp3",       periods: ["dawn"]                         },

  // ── Morning ───────────────────────────────────────────────────────────────
  { id: "where_souls_rest_soulrez", file: "where_souls_rest_soulrez.mp3",  periods: ["morning"]                      },
  { id: "chillin_at_home_dosi",     file: "chillin_at_home_dosi.mp3",      periods: ["morning", "afternoon"]         },

  // ── Midday ────────────────────────────────────────────────────────────────
  { id: "sleepy_puppy_riddiman",    file: "sleepy_puppy_riddiman.mp3",     periods: ["midday", "afternoon", "sunset"] },
  { id: "upon_the_sky_soulrez",     file: "upon_the_sky_soulrez.mp3",      periods: ["midday"]                       },
  { id: "cygnus_garden_soulrez",    file: "cygnus_garden_soulrez.mp3",     periods: ["midday"]                       },

  // ── Afternoon ─────────────────────────────────────────────────────────────
  { id: "coffee_riddiman",          file: "coffee_riddiman.mp3",           periods: ["afternoon", "sunset", "dusk"]  },
  { id: "black_heaven_soulrez",     file: "black_heaven_soulrez.mp3",      periods: ["afternoon"]                    },

  // ── Sunset / Dusk ─────────────────────────────────────────────────────────
  { id: "hateno_village_mikel",     file: "hateno_village_mikel.mp3",      periods: ["sunset", "dusk"]               },

  // ── Night ─────────────────────────────────────────────────────────────────
  // TODO: add night tracks

];

// ── Weather library ───────────────────────────────────────────────────────────

const WEATHER_LIBRARY: WeatherTrackDef[] = [

  // ── Rain ─────────────────────────────────────────────────────────────────
  { id: "speed_js",                      file: "speed_js.mp3",                     weather: ["rain"]                          },
  { id: "sleepywood_slofi",              file: "sleepywood_slofi.mp3",              weather: ["rain"]                          },
  { id: "sfa_viento",                    file: "sfa_viento.mp3",                   weather: ["rain", "tornado"]               },
  { id: "sfa_obebodd_dans",              file: "sfa_obebodd_dans.mp3",              weather: ["rain", "thunderstorm"]          },

  // ── Thunderstorm / Tornado ────────────────────────────────────────────────
  { id: "song_of_storms_mikel",          file: "song_of_storms_mikel.mp3",         weather: ["thunderstorm", "tornado"]       },
  { id: "lost_woods_mikel",              file: "lost_woods_mikel.mp3",              weather: ["thunderstorm"]                  },
  { id: "dragon_roost_mikel",            file: "dragon_roost_mikel.mp3",            weather: ["thunderstorm", "tornado"]       },

  // ── Cold Front ────────────────────────────────────────────────────────────
  { id: "ambient_blue_twan_am",          file: "ambient_blue_twan_am.mp3",         weather: ["cold_front"]                    },
  { id: "beach_wave_ic",                 file: "beach_wave_ic.mp3",                weather: ["cold_front"]                    },
  { id: "temple_of_time_soulrez",        file: "temple_of_time_soulrez.mp3",       weather: ["cold_front"]                    },
  { id: "glowing_glacier_tower_heroes",  file: "glowing_glacier_tower_heroes.mp3", weather: ["cold_front"]                    },

  // ── Heatwave ──────────────────────────────────────────────────────────────
  { id: "questrosound_ghost_riders",     file: "questrosound_ghost_riders.mp3",    weather: ["heatwave"]                      },
  { id: "questrosound_sunset_tracer",    file: "questrosound_sunset_tracer.mp3",   weather: ["heatwave"]                      },
  { id: "tranquility_tos_ost",           file: "tranquility_tos_ost.mp3",          weather: ["heatwave"]                      },

  // ── Golden Hour ───────────────────────────────────────────────────────────
  { id: "smooth_vibes_ben_beiny",        file: "smooth_vibes_ben_beiny.mp3",       weather: ["golden_hour"]                   },
  { id: "analysis_chris_marshall",       file: "analysis_chris_marshall.mp3",      weather: ["golden_hour"]                   },
  { id: "violet_clouds_ic",              file: "violet_clouds_ic.mp3",             weather: ["golden_hour", "prismatic_skies"] },

  // ── Prismatic Skies ───────────────────────────────────────────────────────
  { id: "serenity_heart_plus_up",        file: "serenity_heart_plus_up.mp3",       weather: ["prismatic_skies", "star_shower"] },
  { id: "radiant_lightheart",            file: "radiant_lightheart.mp3",            weather: ["prismatic_skies"]               },

  // ── Star Shower ───────────────────────────────────────────────────────────
  { id: "moonlit_poolside_drowsy_daze",  file: "moonlit_poolside_drowsy_daze.mp3", weather: ["star_shower"]                   },
  { id: "aqua_glow_martin_sponticcia",   file: "aqua_glow_martin_sponticcia.mp3",  weather: ["star_shower"]                   },

];

// ── Derived maps — consumed by useAudio / audioManager ───────────────────────
// Built from the libraries above — do not edit these directly.

export const AMBIENT_TRACKS: Record<DayPeriod, string[]> = {
  midnight: [], dawn: [], morning: [], midday: [],
  afternoon: [], sunset: [], dusk: [], night: [],
};
for (const track of AMBIENT_LIBRARY) {
  for (const period of track.periods) {
    AMBIENT_TRACKS[period].push(MUSIC_BASE + track.file);
  }
}

export const WEATHER_TRACKS: Partial<Record<WeatherType, string[]>> = {};
for (const track of WEATHER_LIBRARY) {
  for (const w of track.weather) {
    (WEATHER_TRACKS[w] ??= []).push(MUSIC_BASE + track.file);
  }
}

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
  // ── Weather SFX ────────────────────────────────────────────────────────────
  thunderCrack:     "/audio/sfx/thunder_crack.mp3",   // one-shot, synced to lightning flash
  rainLoop:         "/audio/sfx/rain_loop.mp3",        // looping ambient — via setWeatherAmbience
  // ── Economy SFX ────────────────────────────────────────────────────────────
  sell:             "/audio/sfx/sell.mp3",              // sell all blooms from inventory
  buy:              "/audio/sfx/buy.mp3",               // purchase from shop, supply shop, or marketplace
};
