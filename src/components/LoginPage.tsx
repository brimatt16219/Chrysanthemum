import { useEffect } from "react";
import { FLOWERS } from "../data/flowers";
import { startLoginMusic } from "../lib/loginAudio";
import { ItemSprite } from "./ItemSprite";
import { useSettings } from "../store/SettingsContext";

// ── Seeded pseudo-random (stable, no useState needed) ─────────────────────
function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const FLOWERS_DATA = FLOWERS.map((f) => ({ emoji: f.emoji.bloom, sprite: f.sprite?.bloom }));

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
  sprite?:     string;
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
    const idx    = col * ROWS_PER_COL + row;
    const flower = FLOWERS_DATA[Math.floor(sr(idx * 7) * FLOWERS_DATA.length)];
    PETALS.push({
      id:         idx,
      emoji:      flower.emoji,
      sprite:     flower.sprite,
      left:       `${leftPct}vw`,
      duration,
      delay:      -(row / ROWS_PER_COL) * duration,
      size:       2,
      opacity:    0.07 + sr(idx * 13) * 0.12,
      mobileHide: !mobileCol || row >= MOBILE_ROWS,
    });
  }
}

// ── Decorative row sprites ─────────────────────────────────────────────────
const DECO_FLOWERS = [
  { emoji: "🌷", sprite: "/sprites/flowers/tulip.png"    },
  { emoji: "🌼", sprite: "/sprites/flowers/daisy.png"    },
  { emoji: "🌺", sprite: "/sprites/flowers/orchid.png"   },
  { emoji: "🌻", sprite: "/sprites/flowers/sunflower.png"},
  { emoji: "🌹", sprite: "/sprites/flowers/rose.png"     },
];

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  onSignIn: () => void;
}

export function LoginPage({ onSignIn }: Props) {
  const { settings } = useSettings();

  useEffect(() => {
    // Module-level singleton — persists through React unmounts so music
    // survives the brief component teardown during guest / OAuth flow.
    // stopLoginMusic() is called by useAudio when game audio takes over.
    startLoginMusic();
    // No cleanup here intentionally.
  }, []);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col items-center justify-center px-6 gap-8">

      {/* ── Drifting flower grid ──────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {PETALS.map((p) => {
          const sharedStyle: React.CSSProperties = {
            position:   "absolute",
            left:       p.left,
            top:        "-3rem",
            opacity:    p.opacity,
            rotate:     "12deg",
            animation:  `flower-drift ${p.duration}s ${p.delay}s linear infinite`,
            willChange: "translate",
          };
          if (settings.useSprites && p.sprite) {
            return (
              <img
                key={p.id}
                src={p.sprite}
                alt=""
                draggable={false}
                className={p.mobileHide ? "hidden sm:block" : ""}
                style={{ ...sharedStyle, width: `${p.size}rem`, height: `${p.size}rem`, objectFit: "contain", imageRendering: "pixelated" }}
              />
            );
          }
          return (
            <span
              key={p.id}
              className={p.mobileHide ? "hidden sm:inline" : undefined}
              style={{ ...sharedStyle, fontSize: `${p.size}rem`, lineHeight: 1 }}
            >
              {p.emoji}
            </span>
          );
        })}
      </div>

      {/* ── Branding ─────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center gap-3 text-center">
        <ItemSprite emoji="🌸" sprite="/sprites/flowers/sakura_blossom.png" name="Sakura Blossom" textSize="text-6xl" imgSize="w-16 h-16" />
        <div className="flex flex-col items-center gap-0.5">
          <h1 className="text-3xl font-bold text-primary tracking-wide">Chrysanthemum</h1>
          <p className="text-xs font-semibold tracking-widest uppercase text-pink-400">✿ Sakura Festival Event ✿</p>
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Grow rare flowers, discover mutations, and build the ultimate garden.
        </p>
      </div>

      {/* ── Decorative flower row ─────────────────────────────────────────── */}
      <div className="relative flex gap-3 text-3xl select-none">
        {DECO_FLOWERS.map((f) => (
          <ItemSprite key={f.emoji} emoji={f.emoji} sprite={f.sprite} name={f.emoji} textSize="text-3xl" imgSize="w-8 h-8" />
        ))}
      </div>

      {/* ── Auth buttons ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-3 w-full max-w-xs">
        {/* 2-step pixel border: outer wrapper shows 2 px of primary color as the
            "border" ring; the clip-path on both layers gives pixel-stepped corners. */}
        <div
          className="btn-pixel-2 p-[2px] w-full"
          style={{ background: "hsl(var(--primary) / 0.55)" }}
        >
          <button
            onClick={onSignIn}
            className="btn-pixel-2 w-full py-3 bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity text-center"
          >
            Sign in with Google
          </button>
        </div>
      </div>

    </div>
  );
}
