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

// ── Shared wrapper ────────────────────────────────────────────────────────
// Always mounted — opacity drives the fade-in/out so transitions are smooth
// across all weather changes including back to clear.
function OverlayWrapper({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden
        transition-opacity duration-1500
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      {children}
    </div>
  );
}

// ── Rain ──────────────────────────────────────────────────────────────────
function RainOverlay({ active }: { active: boolean }) {
  const drops = useParticles(25, active);

  return (
    <OverlayWrapper active={active}>
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
    </OverlayWrapper>
  );
}

// ── Golden Hour ───────────────────────────────────────────────────────────
function GoldenHourOverlay({ active }: { active: boolean }) {
  return (
    <OverlayWrapper active={active}>
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
    </OverlayWrapper>
  );
}

// ── Prismatic Skies ───────────────────────────────────────────────────────
function PrismaticSkiesOverlay({ active }: { active: boolean }) {
  const SW = 7;
  const bands = [
    { color: "rgba(255,  0,  0, 0.05)", r: 130 },
    { color: "rgba(255,140,  0, 0.05)", r: 123 },
    { color: "rgba(255,230,  0, 0.05)", r: 116 },
    { color: "rgba( 50,205, 50, 0.05)", r: 109 },
    { color: "rgba(  0,100,255, 0.05)", r: 102 },
    { color: "rgba( 75,  0,200, 0.05)", r:  95 },
    { color: "rgba(148,  0,211, 0.05)", r:  88 },
  ];

  return (
    <OverlayWrapper active={active}>
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
    </OverlayWrapper>
  );
}

// ── Star Shower ───────────────────────────────────────────────────────────
function StarShowerOverlay({ active }: { active: boolean }) {
  const stars = useParticles(18, active);

  return (
    <OverlayWrapper active={active}>
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
    </OverlayWrapper>
  );
}

// ── Cold Front ────────────────────────────────────────────────────────────
function ColdFrontOverlay({ active }: { active: boolean }) {
  const flakes = useParticles(18, active);

  return (
    <OverlayWrapper active={active}>
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
    </OverlayWrapper>
  );
}

// ── Heatwave ──────────────────────────────────────────────────────────────
function HeatwaveOverlay({ active }: { active: boolean }) {
  return (
    <OverlayWrapper active={active}>
      <div className="absolute inset-0 bg-orange-400/8" />
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.18) 0%, transparent 70%)" }}
      />
    </OverlayWrapper>
  );
}

// ── Thunderstorm ──────────────────────────────────────────────────────────
function ThunderstormOverlay({ active }: { active: boolean }) {
  const drops = useParticles(35, active);

  return (
    <OverlayWrapper active={active}>
      <div className="absolute inset-0 bg-slate-900/30" />
      {/* Heavy rain */}
      {drops.map((d) => (
        <div
          key={d.id}
          className="absolute text-slate-400 select-none"
          style={{
            left:      `${d.x}%`,
            top:       `${d.y}%`,
            fontSize:  `${d.size}em`,
            opacity:   d.opacity * 0.7,
            animation: `heavyRain ${d.duration * 0.7}s ${d.delay}s linear infinite`,
          }}
        >
          |
        </div>
      ))}
      {/* Lightning flashes */}
      {[{ delay: 2 }, { delay: 7 }, { delay: 13 }].map((l, i) => (
        <div
          key={i}
          className="absolute inset-0 bg-white/5"
          style={{ animation: `lightning 15s ${l.delay}s ease-out infinite` }}
        />
      ))}
      <style>{`
        @keyframes heavyRain {
          0%   { transform: translateY(-10vh) rotate(20deg); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(20deg); opacity: 0; }
        }
        @keyframes lightning {
          0%, 4%, 8%, 100% { opacity: 0; }
          2%               { opacity: 1; }
          6%               { opacity: 0.6; }
        }
      `}</style>
    </OverlayWrapper>
  );
}

// ── Tornado ───────────────────────────────────────────────────────────────
function TornadoOverlay({ active }: { active: boolean }) {
  const debris = useParticles(12, active);

  return (
    <OverlayWrapper active={active}>
      <div className="absolute inset-0 bg-stone-700/20" />
      {/* Swirling debris */}
      {debris.map((d) => (
        <div
          key={d.id}
          className="absolute select-none"
          style={{
            left:      `${d.x}%`,
            top:       `${d.y}%`,
            fontSize:  `${d.size * 0.9}em`,
            opacity:   d.opacity * 0.6,
            animation: `tornadoSpin ${d.duration + 1}s ${d.delay}s linear infinite`,
          }}
        >
          {d.id % 4 === 0 ? "🍂" : d.id % 4 === 1 ? "·" : d.id % 4 === 2 ? "∘" : "✦"}
        </div>
      ))}
      {/* Central vortex glow */}
      <div
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width:      "200px",
          height:     "400px",
          background: "radial-gradient(ellipse at center, rgba(120,113,108,0.15) 0%, transparent 70%)",
          animation:  "vortexPulse 3s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes tornadoSpin {
          0%   { transform: translateY(-5vh) rotate(0deg) translateX(0); opacity: 0; }
          10%  { opacity: 0.6; }
          50%  { transform: translateY(50vh) rotate(540deg) translateX(30px); }
          90%  { opacity: 0.3; }
          100% { transform: translateY(105vh) rotate(1080deg) translateX(-20px); opacity: 0; }
        }
        @keyframes vortexPulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scaleX(1); }
          50%       { opacity: 1;   transform: translate(-50%, -50%) scaleX(1.3); }
        }
      `}</style>
    </OverlayWrapper>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
// All overlays are always mounted — active prop drives opacity transitions.
// This gives smooth cross-fades between any two weather types including clear.
export function WeatherOverlay({ weatherType, isActive }: Props) {
  return (
    <>
      <RainOverlay           active={isActive && weatherType === "rain"} />
      <GoldenHourOverlay     active={isActive && weatherType === "golden_hour"} />
      <PrismaticSkiesOverlay active={isActive && weatherType === "prismatic_skies"} />
      <StarShowerOverlay     active={isActive && weatherType === "star_shower"} />
      <ColdFrontOverlay      active={isActive && weatherType === "cold_front"} />
      <HeatwaveOverlay       active={isActive && weatherType === "heatwave"} />
      <ThunderstormOverlay   active={isActive && weatherType === "thunderstorm"} />
      <TornadoOverlay        active={isActive && weatherType === "tornado"} />
    </>
  );
}
