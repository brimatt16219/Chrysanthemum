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
  useEffect(() => {
    const playlist =
      weatherIsActive && WEATHER_TRACKS[activeWeather]?.length
        ? WEATHER_TRACKS[activeWeather]!
        : AMBIENT_TRACKS[dayPeriod.id];
    audioManager.playPlaylist(playlist);
  }, [weatherIsActive, activeWeather, dayPeriod.id]);

  // ── Weather ambience (looping rain) ──────────────────────────────────────
  useEffect(() => {
    const needsRain =
      weatherIsActive &&
      (activeWeather === "rain" || activeWeather === "thunderstorm");
    audioManager.setWeatherAmbience(needsRain ? "/audio/sfx/rain_loop.mp3" : null);
  }, [weatherIsActive, activeWeather]);
}