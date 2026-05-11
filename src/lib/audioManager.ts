import { SFX_TRACKS } from "../data/audioTracks";

const LS_KEY          = "chrysanthemum_settings";
const FADE_STEP_MS    = 50;    // crossfade tick rate
const FADE_DURATION_MS = 1500; // total crossfade time

// ── AudioManager ─────────────────────────────────────────────────────────────

class AudioManager {
  // Music — dual element A/B for crossfading
  private elA = new Audio();
  private elB = new Audio();
  private active: "A" | "B" = "A";

  private currentUrl:      string | null = null;
  private currentPlaylist: string[]      = [];
  private playlistIndex:   number        = 0;
  private fadeTimer:       ReturnType<typeof setInterval> | null = null;

  // SFX pool — up to 3 concurrent instances per sound id
  private sfxPool = new Map<string, HTMLAudioElement[]>();

  // Settings — read from localStorage on init, kept in sync via setters
  private _musicVolume: number;
  private _sfxVolume:   number;
  private _musicMuted:  boolean;
  private _sfxMuted:    boolean;

  // Weather ambience — looping layer (rain, etc.) independent of music
  private elAmbience        = new Audio();
  private currentAmbienceUrl: string | null = null;
  private ambienceTimer:    ReturnType<typeof setInterval> | null = null;

  // Autoplay gate — browsers block audio until first user gesture
  private unlocked    = false;
  private pendingUrl: string | null = null;

  constructor() {
    const raw    = localStorage.getItem(LS_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    this._musicVolume = (stored.musicVolume as number)  ?? 0.5;
    this._sfxVolume   = (stored.sfxVolume   as number)  ?? 0.7;
    this._musicMuted  = (stored.musicMuted  as boolean) ?? false;
    this._sfxMuted    = (stored.sfxMuted    as boolean) ?? false;

    this.elA.volume = 0;
    this.elB.volume = 0;

    this.elA.addEventListener("ended", () => this.advancePlaylist());
    this.elB.addEventListener("ended", () => this.advancePlaylist());

    // Pre-load all SFX into the pool so the browser fetches and decodes
    // every file at startup. Without this, first-play incurs a network
    // round-trip that causes a noticeable delay on harvest/plant/etc.
    for (const [id, url] of Object.entries(SFX_TRACKS)) {
      const el    = new Audio(url);
      el.preload  = "auto";
      this.sfxPool.set(id, [el]);
    }

    const unlock = () => {
      this.unlocked = true;
      if (this.pendingUrl) {
        this.crossfadeTo(this.pendingUrl);
        this.pendingUrl = null;
      }
    };
    document.addEventListener("click",      unlock, { once: true });
    document.addEventListener("keydown",    unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
  }

  // ── Public: music ───────────────────────────────────────────────────────────

  /** Call whenever the resolved playlist changes (period or weather switch). */
  playPlaylist(tracks: string[]): void {
    if (!tracks.length) return;
    const shuffled = this.shuffle(tracks);

    // After a period/weather switch, avoid immediately replaying the track
    // that was just playing. If the shuffle put it first and there are other
    // options, rotate it to the end so something new always plays.
    if (shuffled[0] === this.currentUrl && shuffled.length > 1) {
      shuffled.push(shuffled.shift()!);
    }

    this.currentPlaylist = shuffled;
    this.playlistIndex   = 0;
    const url            = shuffled[0];
    if (url === this.currentUrl) return; // single-track playlist — keep playing
    this.crossfadeTo(url);
  }

  setMusicVolume(v: number): void {
    this._musicVolume          = v;
    this.activeEl().volume     = this.effectiveMusicVolume();
  }

  setMusicMuted(m: boolean): void {
    this._musicMuted           = m;
    this.activeEl().volume     = this.effectiveMusicVolume();
  }

  // ── Public: SFX ────────────────────────────────────────────────────────────

  playSfx(id: string): void {
    if (this._sfxMuted) return;
    const url = SFX_TRACKS[id];
    if (!url) return;

    let pool = this.sfxPool.get(id) ?? [];
    let el   = pool.find((e) => e.paused || e.ended);

    if (!el) {
      if (pool.length >= 3) return;
      el   = new Audio(url);
      pool = [...pool, el];
      this.sfxPool.set(id, pool);
    }

    el.volume      = this.effectiveSfxVolume();
    el.currentTime = 0;
    void el.play().catch(() => {});
  }

  setSfxVolume(v: number): void {
    this._sfxVolume = v;
    if (!this.elAmbience.paused) {
      this.elAmbience.volume = this.effectiveAmbienceVolume();
    }
  }

  setSfxMuted(m: boolean): void {
    this._sfxMuted = m;
    if (!this.elAmbience.paused) {
      this.elAmbience.volume = this.effectiveAmbienceVolume();
    }
  }

  /** Fade in a looping weather ambience (e.g. rain). Pass null to fade out. */
  setWeatherAmbience(url: string | null): void {
    if (url === null) {
      if (this.elAmbience.paused) return;
      const startVol = this.elAmbience.volume;
      const steps    = FADE_DURATION_MS / FADE_STEP_MS;
      let   step     = 0;
      if (this.ambienceTimer) clearInterval(this.ambienceTimer);
      this.ambienceTimer = setInterval(() => {
        step++;
        const t = Math.min(step / steps, 1);
        this.elAmbience.volume = startVol * (1 - t);
        if (t >= 1) {
          clearInterval(this.ambienceTimer!);
          this.ambienceTimer       = null;
          this.currentAmbienceUrl  = null;
          this.elAmbience.pause();
          this.elAmbience.src      = "";
        }
      }, FADE_STEP_MS);
    } else {
      if (url === this.currentAmbienceUrl && !this.elAmbience.paused) return;
      this.currentAmbienceUrl  = url;
      this.elAmbience.src      = url;
      this.elAmbience.loop     = true;
      this.elAmbience.volume   = 0;
      void this.elAmbience.play().catch(() => {});
      const target = this.effectiveAmbienceVolume();
      const steps  = FADE_DURATION_MS / FADE_STEP_MS;
      let   step   = 0;
      if (this.ambienceTimer) clearInterval(this.ambienceTimer);
      this.ambienceTimer = setInterval(() => {
        step++;
        const t = Math.min(step / steps, 1);
        this.elAmbience.volume = target * t;
        if (t >= 1) {
          clearInterval(this.ambienceTimer!);
          this.ambienceTimer = null;
        }
      }, FADE_STEP_MS);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private activeEl()   { return this.active === "A" ? this.elA : this.elB; }
  private inactiveEl() { return this.active === "A" ? this.elB : this.elA; }

  private effectiveMusicVolume()   { return this._musicMuted ? 0 : this._musicVolume;          }
  private effectiveSfxVolume()     { return this._sfxMuted   ? 0 : this._sfxVolume;            }
  private effectiveAmbienceVolume(){ return this._sfxMuted   ? 0 : this._sfxVolume * 0.6;      }

  private crossfadeTo(url: string): void {
    if (!this.unlocked) { this.pendingUrl = url; return; }

    this.currentUrl    = url;
    const next         = this.inactiveEl();
    next.src           = url;
    next.volume        = 0;
    void next.play().catch(() => {});

    const target = this.effectiveMusicVolume();
    const cur    = this.activeEl();
    const steps  = FADE_DURATION_MS / FADE_STEP_MS;
    let   step   = 0;

    if (this.fadeTimer) clearInterval(this.fadeTimer);

    this.fadeTimer = setInterval(() => {
      step++;
      const t    = Math.min(step / steps, 1);
      cur.volume  = target * (1 - t);
      next.volume = target * t;

      if (t >= 1) {
        clearInterval(this.fadeTimer!);
        this.fadeTimer = null;
        cur.pause();
        cur.src    = "";
        cur.volume = 0;
        this.active = this.active === "A" ? "B" : "A";
      }
    }, FADE_STEP_MS);
  }

  private advancePlaylist(): void {
    if (!this.currentPlaylist.length) return;
    this.playlistIndex++;
    if (this.playlistIndex >= this.currentPlaylist.length) {
      this.currentPlaylist = this.shuffle(this.currentPlaylist);
      this.playlistIndex   = 0;
    }
    const url = this.currentPlaylist[this.playlistIndex];
    // Single-entry playlist — restart in place without crossfade
    if (url === this.currentUrl) {
      const el       = this.activeEl();
      el.currentTime = 0;
      void el.play().catch(() => {});
      return;
    }
    this.crossfadeTo(url);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j      = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export const audioManager = new AudioManager();