import { useEffect, useState } from "react";
import type { WeatherType } from "../data/weather";

interface Props {
  weatherType: WeatherType;
  isActive: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

function useParticles(count: number, active: boolean): Particle[] {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active || count === 0) {
      setParticles([]);
      return;
    }
    setParticles(
      Array.from({ length: count }, (_, i) => ({
        id:       i,
        x:        Math.random() * 100,
        y:        Math.random() * -20,
        size:     0.8 + Math.random() * 0.8,
        duration: 2 + Math.random() * 3,
        delay:    Math.random() * 4,
        opacity:  0.4 + Math.random() * 0.5,
      }))
    );
  }, [count, active]);

  return particles;
}

// ── Rain ──────────────────────────────────────────────────────────────────
function RainOverlay({ active }: { active: boolean }) {
  const drops = useParticles(25, active);

  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      <div className="absolute inset-0 bg-blue-900/10" />
      {drops.map((d) => (
        <div
          key={d.id}
          className="absolute text-blue-300 select-none"
          style={{
            left:      `${d.x}%`,
            top:       `${d.y}%`,
            fontSize:  `${d.size}em`,
            opacity:   d.opacity,
            animation: `rainFall ${d.duration}s ${d.delay}s linear infinite`,
          }}
        >
          |
        </div>
      ))}
      <style>{`
        @keyframes rainFall {
          0%   { transform: translateY(-10vh) rotate(15deg); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(15deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Golden Hour ───────────────────────────────────────────────────────────
function GoldenHourOverlay({ active }: { active: boolean }) {
  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      <div className="absolute inset-0 bg-yellow-400/8" />
      <div
        className="absolute inset-x-0 -top-32 h-72"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(253,224,71,0.18) 0%, transparent 70%)" }}
      />
      {[
        { x: 15, y: 25, w: 100, delay: 0   },
        { x: 48, y: 45, w: 140, delay: 0.8 },
        { x: 72, y: 30, w: 90,  delay: 1.5 },
        { x: 88, y: 60, w: 120, delay: 2.2 },
      ].map((o, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left:       `${o.x}%`,
            top:        `${o.y}%`,
            width:      `${o.w}px`,
            height:     `${o.w}px`,
            transform:  "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(253,224,71,0.10) 0%, transparent 70%)",
            animation:  `goldenOrb ${3.5 + i * 0.6}s ${o.delay}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes goldenOrb {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 0.9; transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ── Prismatic Skies ───────────────────────────────────────────────────────
// Seven concentric circles centred below and outside the viewport.
// cy=160 (well below the screen) + large radii = the arches appear high
// up in the screen and never touch the bottom.
// strokeWidth=7 with radii spaced 6 apart = bands butt up against each
// other with no gap.
function PrismaticSkiesOverlay({ active }: { active: boolean }) {
  // Red outermost (largest r) → violet innermost (smallest r)
  // Centre at cx=50, cy=160 so the arch peaks near the top of the viewport
  // Radii spaced exactly strokeWidth apart to eliminate gaps
  const SW = 7; // stroke width
  const bands = [
    { color: "rgba(255,  0,  0, 0.22)", r: 130 }, // red
    { color: "rgba(255,140,  0, 0.22)", r: 123 }, // orange
    { color: "rgba(255,230,  0, 0.22)", r: 116 }, // yellow
    { color: "rgba( 50,205, 50, 0.22)", r: 109 }, // green
    { color: "rgba(  0,100,255, 0.22)", r: 102 }, // blue
    { color: "rgba( 75,  0,200, 0.22)", r:  95 }, // indigo
    { color: "rgba(148,  0,211, 0.22)", r:  88 }, // violet
  ];

  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      <div className="absolute inset-0 bg-pink-400/5" />

      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ animation: "rainbowPulse 5s ease-in-out infinite" }}
      >
        {bands.map((b, i) => (
          <circle
            key={i}
            cx="50"
            cy="160"
            r={b.r}
            fill="none"
            stroke={b.color}
            strokeWidth={SW}
          />
        ))}
      </svg>

      <style>{`
        @keyframes rainbowPulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Star Shower ───────────────────────────────────────────────────────────
function StarShowerOverlay({ active }: { active: boolean }) {
  const stars = useParticles(18, active);

  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      <div className="absolute inset-0 bg-indigo-950/25" />
      {stars.map((d) => (
        <div
          key={d.id}
          className="absolute select-none"
          style={{
            left:      `${d.x}%`,
            top:       `${d.y}%`,
            fontSize:  `${d.size}em`,
            opacity:   d.opacity,
            animation: `starFall ${d.duration + 1}s ${d.delay}s ease-in infinite`,
          }}
        >
          {d.id % 3 === 0 ? "⭐" : d.id % 3 === 1 ? "✦" : "·"}
        </div>
      ))}
      <style>{`
        @keyframes starFall {
          0%   { transform: translateY(-5vh) translateX(0) scale(1); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.8; }
          100% { transform: translateY(105vh) translateX(20px) scale(0.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Cold Front ────────────────────────────────────────────────────────────
function ColdFrontOverlay({ active }: { active: boolean }) {
  const flakes = useParticles(18, active);

  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      <div className="absolute inset-0 bg-cyan-400/8" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(6,182,212,0.08) 100%)" }}
      />
      {flakes.map((d) => (
        <div
          key={d.id}
          className="absolute select-none"
          style={{
            left:      `${d.x}%`,
            top:       `${d.y}%`,
            fontSize:  `${d.size * 1.2}em`,
            opacity:   d.opacity * 0.35,
            animation: `snowDrift ${d.duration + 2}s ${d.delay}s ease-in-out infinite`,
          }}
        >
          ❄️
        </div>
      ))}
      <style>{`
        @keyframes snowDrift {
          0%   { transform: translateY(-5vh) translateX(0) rotate(0deg); opacity: 0; }
          10%  { opacity: 0.35; }
          50%  { transform: translateY(50vh) translateX(15px) rotate(180deg); }
          90%  { opacity: 0.2; }
          100% { transform: translateY(105vh) translateX(-10px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Heatwave — tint and bottom glow only ─────────────────────────────────
function HeatwaveOverlay({ active }: { active: boolean }) {
  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      <div className="absolute inset-0 bg-orange-400/8" />
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.18) 0%, transparent 70%)" }}
      />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
export function WeatherOverlay({ weatherType, isActive }: Props) {
  if (!isActive || weatherType === "clear") return null;

  return (
    <>
      <RainOverlay           active={isActive && weatherType === "rain"} />
      <GoldenHourOverlay     active={isActive && weatherType === "golden_hour"} />
      <PrismaticSkiesOverlay active={isActive && weatherType === "prismatic_skies"} />
      <StarShowerOverlay     active={isActive && weatherType === "star_shower"} />
      <ColdFrontOverlay      active={isActive && weatherType === "cold_front"} />
      <HeatwaveOverlay       active={isActive && weatherType === "heatwave"} />
    </>
  );
}
