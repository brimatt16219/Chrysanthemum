import { useEffect } from "react";
import { useGame } from "../store/GameContext";
import { useSettings } from "../store/SettingsContext";
import { useDayNight } from "./useDayNight";
import { audioManager } from "../lib/audioManager";
import { AMBIENT_TRACKS, WEATHER_TRACKS } from "../data/audioTracks";

export function useAudio(): void {
  const { activeWeather, weatherIsActive } = useGame();
  const { settings }                       = useSettings();
  const dayPeriod                          = useDayNight();

  // ── Sync volume/mute to AudioManager ─────────────────────────────────────
  useEffect(() => { audioManager.setMusicVolume(settings.musicVolume); }, [settings.musicVolume]);
  useEffect(() => { audioManager.setMusicMuted(settings.musicMuted);   }, [settings.musicMuted]);
  useEffect(() => { audioManager.setSfxVolume(settings.sfxVolume);     }, [settings.sfxVolume]);
  useEffect(() => { audioManager.setSfxMuted(settings.sfxMuted);       }, [settings.sfxMuted]);

  // ── Resolve and play correct music playlist ───────────────────────────────
  // Weather overrides ambient when active and a track exists for that type.
  // Falls through to the current day period's playlist otherwise.
  // A stable `context` string is passed so the manager can detect ambient ↔
  // weather switches and hard-cut (no crossfade overlap) between them.
  // Empty playlists (e.g. the unfinished night period) fall back to midnight
  // tracks so music never silences on first load.
  useEffect(() => {
    const isWeather = weatherIsActive && !!WEATHER_TRACKS[activeWeather]?.length;
    const raw       = isWeather ? WEATHER_TRACKS[activeWeather]! : AMBIENT_TRACKS[dayPeriod.id];
    const playlist  = raw.length ? raw : AMBIENT_TRACKS.midnight; // fallback for empty periods
    const context   = isWeather ? `weather:${activeWeather}` : "ambient";
    audioManager.playPlaylist(playlist, context);
  }, [weatherIsActive, activeWeather, dayPeriod.id]);

  // ── Weather ambience (looping rain) ──────────────────────────────────────
  useEffect(() => {
    const needsRain =
      weatherIsActive &&
      (activeWeather === "rain" || activeWeather === "thunderstorm");
    audioManager.setWeatherAmbience(needsRain ? "/audio/sfx/rain_loop.mp3" : null);
  }, [weatherIsActive, activeWeather]);
}