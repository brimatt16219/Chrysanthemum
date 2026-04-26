import { useEffect, useState } from "react";
import { getFlower, RARITY_CONFIG, MUTATIONS, type MutationType } from "../data/flowers";

interface Props {
  speciesId: string;
  mutation?: MutationType;
  onDone: () => void;
}

export function HarvestPopup({ speciesId, mutation, onDone }: Props) {
  const [visible, setVisible] = useState(true);
  const species = getFlower(speciesId);
  const rarity = species ? RARITY_CONFIG[species.rarity] : null;
  const mut = mutation ? MUTATIONS[mutation] : null;
  const value = species
    ? Math.floor(species.sellValue * (mut?.valueMultiplier ?? 1))
    : 0;

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setVisible(false);
        setTimeout(onDone, 300);
      },
      mut ? 2_000 : 1_200
    );
    return () => clearTimeout(timer);
  }, []);

  if (!species) return null;

  return (
    <div
      className={`
        pointer-events-none flex flex-col items-center gap-0.5
        transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      {/* Mutation badge */}
      {mut && (
        <div
          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-card border ${mut.color} border-current`}
        >
          {mut.emoji} {mut.name}!
        </div>
      )}

      {/* Coin popup */}
      <div
        className={`flex items-center gap-1.5 bg-card border rounded-full px-3 py-1 shadow-lg ${rarity?.glow}`}
      >
        <span className="text-base">{species.emoji.bloom}</span>
        <span className={`text-xs font-bold font-mono ${mut ? mut.color : rarity?.color}`}>
          +{value} 🟡
        </span>
      </div>
    </div>
  );
}
