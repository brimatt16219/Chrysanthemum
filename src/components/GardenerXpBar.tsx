import { cumulativeXpForLevel, xpForLevel, MAX_GARDENER_LEVEL } from "../data/gardenerLevel";

interface Props {
  level: number;
  xp:    number;
}

export function GardenerXpBar({ level, xp }: Props) {
  const isMax  = level >= MAX_GARDENER_LEVEL;
  const xpStep = isMax ? 1 : xpForLevel(level);                 // avoid ÷0 at cap
  const xpInto = isMax ? xpStep : xp - cumulativeXpForLevel(level);
  const pct    = Math.min(100, (xpInto / xpStep) * 100);

  return (
    <div className="w-full sm:max-w-2xl sm:mx-auto flex items-center gap-2 px-3 sm:px-4 pb-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap min-w-[28px]">
        {isMax ? "MAX" : `Lv.${level}`}
      </span>
      <div
        className="flex-1 h-1 rounded-full bg-muted overflow-hidden"
        title={isMax ? "Max level reached!" : `${xpInto.toLocaleString()} / ${xpStep.toLocaleString()} XP to next level`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block min-w-[90px] text-right">
        {isMax ? "🌟 Max Level" : `${xpInto.toLocaleString()} / ${xpStep.toLocaleString()} XP`}
      </span>
    </div>
  );
}
