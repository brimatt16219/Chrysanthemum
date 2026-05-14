import { useEffect } from "react";
import { useGame } from "../store/GameContext";
import { useSettings } from "../store/SettingsContext";
import { useDayNight } from "./useDayNight";
import { audioManager } from "../lib/audioManager";
import { stopLoginMusic } from "../lib/loginAudio";
import { AMBIENT_TRACKS, WEATHER_TRACKS } from "../data/audioTracks";

export function useAudio(enabled: boolean): void {
  const { activeWeather, weatherIsActive } = useGame();
  const { settings }                       = useSettings();
  const dayPeriod                          = useDayNight();

  // ── Sync volume/mute to AudioManager (always safe) ───────────────────────
  useEffect(() => { audioManager.setMusicVolume(settings.musicVolume); }, [settings.musicVolume]);
  useEffect(() => { audioManager.setMusicMuted(settings.musicMuted);   }, [settings.musicMuted]);
  useEffect(() => { audioManager.setSfxVolume(settings.sfxVolume);     }, [settings.sfxVolume]);
  useEffect(() => { audioManager.setSfxMuted(settings.sfxMuted);       }, [settings.sfxMuted]);

  // ── Stop login music the moment game audio takes over ────────────────────
  useEffect(() => {
    if (enabled) stopLoginMusic();
  }, [enabled]);

  // ── Resolve and play correct music playlist ───────────────────────────────
  useEffect(() => {
    if (!enabled) {
      audioManager.stopMusic();
      return;
    }
    const isWeather = weatherIsActive && !!WEATHER_TRACKS[activeWeather]?.length;
    const raw       = isWeather ? WEATHER_TRACKS[activeWeather]! : AMBIENT_TRACKS[dayPeriod.id];
    const playlist  = raw.length ? raw : AMBIENT_TRACKS.midnight;
    const context   = isWeather ? `weather:${activeWeather}` : "ambient";
    audioManager.playPlaylist(playlist, context);
  }, [enabled, weatherIsActive, activeWeather, dayPeriod.id]);

  // ── Weather ambience (looping rain) ──────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      audioManager.setWeatherAmbience(null);
      return;
    }
    const needsRain =
      weatherIsActive &&
      (activeWeather === "rain" || activeWeather === "thunderstorm");
    audioManager.setWeatherAmbience(needsRain ? "/audio/sfx/rain_loop.mp3" : null);
  }, [enabled, weatherIsActive, activeWeather]);
}