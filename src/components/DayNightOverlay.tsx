import type { DayPeriodDefinition } from "../data/dayNight";

interface Props {
  period: DayPeriodDefinition;
}

export function DayNightOverlay({ period }: Props) {
  // No overlay during night and midnight — dark theme already looks correct
  if (!period.overlayColor || period.overlayOpacity === 0) return null;

  const color = period.overlayColor.replace("VAL", String(period.overlayOpacity));

  // Dawn and sunset get a directional gradient (light rising/setting at horizon)
  // Morning, midday, afternoon get a uniform tint
  // Dusk gets a top-down gradient (sky darkening from above)

  const style: React.CSSProperties = (() => {
    switch (period.id) {
      case "dawn":
        return {
          background: `linear-gradient(to top, ${color} 0%, transparent 60%)`,
        };
      case "sunset":
        return {
          background: `linear-gradient(to top, ${color} 0%, transparent 70%)`,
        };
      case "dusk":
        return {
          background: `linear-gradient(to bottom, ${color} 0%, transparent 60%)`,
        };
      default:
        return {
          background: color,
        };
    }
  })();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-10 transition-opacity duration-[3000ms]"
      style={style}
    />
  );
}
