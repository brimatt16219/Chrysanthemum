import { useEffect, useState } from "react";
import type { WeatherType } from "../data/weather";

interface Props {
  weatherType: WeatherType;
  isActive: boolean;
}

interface Particle {
  id: number;
  x: number;      // % from left
  y: number;      // % from top (starting position)
  size: number;   // em
  duration: number; // animation duration in seconds
  delay: number;  // animation delay in seconds
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
        y:        Math.random() * -20,       // start above viewport
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
      {/* Blue tint */}
      <div className="absolute inset-0 bg-blue-900/10" />

      {/* Rain drops */}
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
  const sparkles = useParticles(14, active);

  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      {/* Warm golden tint */}
      <div className="absolute inset-0 bg-yellow-400/8" />

      {/* Radial glow from top */}
      <div className="absolute inset-x-0 -top-32 h-64 bg-gradient-to-b from-yellow-300/15 to-transparent" />

      {/* Sparkle particles */}
      {sparkles.map((d) => (
        <div
          key={d.id}
          className="absolute select-none"
          style={{
            left:      `${d.x}%`,
            top:       `${d.y + 10}%`,
            fontSize:  `${d.size}em`,
            opacity:   d.opacity,
            animation: `sparkleFloat ${d.duration + 1}s ${d.delay}s ease-in-out infinite`,
          }}
        >
          ✨
        </div>
      ))}

      <style>{`
        @keyframes sparkleFloat {
          0%   { transform: translateY(0) scale(0.8); opacity: 0; }
          20%  { opacity: 1; }
          50%  { transform: translateY(-30px) scale(1.1); }
          80%  { opacity: 0.6; }
          100% { transform: translateY(-60px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Prismatic Skies ───────────────────────────────────────────────────────
function PrismaticSkiesOverlay({ active }: { active: boolean }) {
  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      {/* Soft pink tint */}
      <div className="absolute inset-0 bg-pink-400/8" />

      {/* Rainbow arc */}
      <div
        className="absolute"
        style={{
          top:    "-60px",
          left:   "-20%",
          width:  "140%",
          height: "300px",
          borderRadius: "50%",
          border: "12px solid transparent",
          borderTopColor: "transparent",
          background:
            "linear-gradient(180deg, transparent 60%, transparent 100%) padding-box, " +
            "linear-gradient(90deg, rgba(255,0,0,0.15), rgba(255,165,0,0.15), rgba(255,255,0,0.15), rgba(0,255,0,0.15), rgba(0,0,255,0.15), rgba(238,130,238,0.15)) border-box",
          animation: "rainbowPulse 4s ease-in-out infinite",
        }}
      />

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
      {/* Dark blue night tint */}
      <div className="absolute inset-0 bg-indigo-950/25" />

      {/* Falling stars */}
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
      {/* Cyan tint on edges */}
      <div className="absolute inset-0 bg-cyan-400/8" />
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(6,182,212,0.08) 100%)" }}
      />

      {/* Snowflakes */}
      {flakes.map((d) => (
        <div
          key={d.id}
          className="absolute select-none text-cyan-200"
          style={{
            left:      `${d.x}%`,
            top:       `${d.y}%`,
            fontSize:  `${d.size * 1.2}em`,
            opacity:   d.opacity,
            animation: `snowDrift ${d.duration + 2}s ${d.delay}s ease-in-out infinite`,
          }}
        >
          ❄️
        </div>
      ))}

      <style>{`
        @keyframes snowDrift {
          0%   { transform: translateY(-5vh) translateX(0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translateY(50vh) translateX(15px) rotate(180deg); }
          90%  { opacity: 0.8; }
          100% { transform: translateY(105vh) translateX(-10px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Heatwave ──────────────────────────────────────────────────────────────
function HeatwaveOverlay({ active }: { active: boolean }) {
  const embers = useParticles(14, active);

  return (
    <div
      className={`
        pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity duration-1000
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      {/* Orange tint on edges */}
      <div className="absolute inset-0 bg-orange-400/8" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-orange-500/10 to-transparent" />

      {/* Heat shimmer lines */}
      <div
        className="absolute inset-0"
        style={{ animation: "heatShimmer 3s ease-in-out infinite" }}
      >
        {[20, 45, 70, 85].map((x) => (
          <div
            key={x}
            className="absolute top-0 bottom-0 w-px bg-orange-300/5"
            style={{ left: `${x}%`, animation: `shimmerLine ${2 + x * 0.02}s ease-in-out infinite` }}
          />
        ))}
      </div>

      {/* Rising ember particles */}
      {embers.map((d) => (
        <div
          key={d.id}
          className="absolute select-none"
          style={{
            left:      `${d.x}%`,
            bottom:    "0%",
            fontSize:  `${d.size * 0.8}em`,
            opacity:   d.opacity,
            animation: `emberRise ${d.duration + 1}s ${d.delay}s ease-out infinite`,
          }}
        >
          🔥
        </div>
      ))}

      <style>{`
        @keyframes emberRise {
          0%   { transform: translateY(0) scale(0.5); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 0.5; }
          100% { transform: translateY(-60vh) scale(0.2) translateX(${Math.random() > 0.5 ? 20 : -20}px); opacity: 0; }
        }
        @keyframes shimmerLine {
          0%, 100% { opacity: 0.03; transform: scaleX(1); }
          50%       { opacity: 0.08; transform: scaleX(1.5); }
        }
      `}</style>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
export function WeatherOverlay({ weatherType, isActive }: Props) {
  if (!isActive || weatherType === "clear") return null;

  return (
    <>
      <RainOverlay          active={isActive && weatherType === "rain"} />
      <GoldenHourOverlay    active={isActive && weatherType === "golden_hour"} />
      <PrismaticSkiesOverlay active={isActive && weatherType === "prismatic_skies"} />
      <StarShowerOverlay    active={isActive && weatherType === "star_shower"} />
      <ColdFrontOverlay     active={isActive && weatherType === "cold_front"} />
      <HeatwaveOverlay      active={isActive && weatherType === "heatwave"} />
    </>
  );
}
