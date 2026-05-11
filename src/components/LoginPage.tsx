import { useEffect, useRef } from "react";
import { FLOWERS } from "../data/flowers";

// ── Login title music — plays in order, loops back to track 1 ─────────────
const LOGIN_TRACKS = [
  "/audio/music/dragonica_title_screen.mp3",
  "/audio/music/acnh_6pm.mp3",
  "/audio/music/dusk_in_mondstadt.mp3",
];

// ── Seeded pseudo-random (stable, no useState needed) ─────────────────────
function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const EMOJIS = FLOWERS.map((f) => f.emoji.bloom);

// ── Grid parameters ───────────────────────────────────────────────────────
// 9 columns spread −5 vw … 110 vw (wider than viewport to fill after leftward drift)
// 6 flowers per column, staggered so the screen is always full top-to-bottom.
// ALL flowers start at top:−3rem (above the fold); negative delays mean they
// are already mid-flight on mount — they entered from the top, never pop in.

// Desktop: 9 cols × 6 rows. Mobile (sm breakpoint): every-other column (cols 0,2,4,6,8)
// and only the first 4 rows — 5×4 = 20 petals instead of 54.
const COLS         = 9;
const ROWS_PER_COL = 6;
const MOBILE_ROWS  = 4;  // rows visible on mobile per column

interface Petal {
  id:          number;
  emoji:       string;
  left:        string;
  duration:    number;
  delay:       number;
  size:        number;
  opacity:     number;
  mobileHide:  boolean; // true → hidden on small screens
}

const PETALS: Petal[] = [];

for (let col = 0; col < COLS; col++) {
  const duration   = 26 + sr(col * 3) * 14;
  const leftPct    = (col / (COLS - 1)) * 115 - 5;
  const mobileCol  = col % 2 === 0;               // keep cols 0,2,4,6,8 on mobile

  for (let row = 0; row < ROWS_PER_COL; row++) {
    const idx = col * ROWS_PER_COL + row;
    PETALS.push({
      id:         idx,
      emoji:      EMOJIS[Math.floor(sr(idx * 7) * EMOJIS.length)],
      left:       `${leftPct}vw`,
      duration,
      delay:      -(row / ROWS_PER_COL) * duration,
      size:       2,
      opacity:    0.07 + sr(idx * 13) * 0.12,
      mobileHide: !mobileCol || row >= MOBILE_ROWS,
    });
  }
}

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  onSignIn: () => void;
  onGuest:  () => void;
}

export function LoginPage({ onSignIn, onGuest }: Props) {
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const trackIdx  = useRef(0);

  useEffect(() => {
    const el = new Audio(LOGIN_TRACKS[0]);
    el.volume = 0.5;
    audioRef.current = el;

    const advance = () => {
      trackIdx.current = (trackIdx.current + 1) % LOGIN_TRACKS.length;
      el.src = LOGIN_TRACKS[trackIdx.current];
      void el.play().catch(() => {});
    };

    el.addEventListener("ended", advance);

    // Attempt autoplay; browsers will allow it after a user gesture if blocked
    void el.play().catch(() => {});

    // Resume if blocked — any interaction on the page will kick it off
    const resume = () => { if (el.paused) void el.play().catch(() => {}); };
    document.addEventListener("click",      resume);
    document.addEventListener("keydown",    resume);
    document.addEventListener("touchstart", resume);

    return () => {
      el.removeEventListener("ended", advance);
      document.removeEventListener("click",      resume);
      document.removeEventListener("keydown",    resume);
      document.removeEventListener("touchstart", resume);
      el.pause();
      el.src = "";
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col items-center justify-center px-6 gap-8">

      {/* ── Drifting flower grid ──────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {PETALS.map((p) => (
          <span
            key={p.id}
            className={p.mobileHide ? "hidden sm:inline" : undefined}
            style={{
              position:   "absolute",
              left:       p.left,
              top:        "-3rem",          // always starts above the viewport
              fontSize:   `${p.size}rem`,
              opacity:    p.opacity,
              lineHeight: 1,
              rotate:     "12deg",
              animation:  `flower-drift ${p.duration}s ${p.delay}s linear infinite`,
              willChange: "translate",
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* ── Branding ─────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="text-6xl">🌸</div>
        <h1 className="text-3xl font-bold text-primary tracking-wide">Chrysanthemum</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Grow rare flowers, discover mutations, and build the ultimate garden.
        </p>
      </div>

      {/* ── Decorative flower row ─────────────────────────────────────────── */}
      <div className="relative flex gap-3 text-3xl select-none">
        <span>🌷</span><span>🌼</span><span>🌺</span><span>🌻</span><span>🌹</span>
      </div>

      {/* ── Auth buttons ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onSignIn}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity text-center"
        >
          Sign in with Google
        </button>
        <button
          onClick={onGuest}
          className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-center"
        >
          Play as guest
        </button>
        <p className="text-center text-[10px] text-muted-foreground px-2">
          Guest progress saves locally only and won't sync across devices.
        </p>
      </div>

    </div>
  );
}
