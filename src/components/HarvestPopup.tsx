import { useEffect, useState } from "react";
import { getFlower, RARITY_CONFIG } from "../data/flowers";

interface Props {
  speciesId: string;
  onDone: () => void;
}

export function HarvestPopup({ speciesId, onDone }: Props) {
  const [visible, setVisible] = useState(true);
  const species = getFlower(speciesId);
  const rarity = species ? RARITY_CONFIG[species.rarity] : null;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 1_200);
    return () => clearTimeout(timer);
  }, []);

  if (!species) return null;

  return (
    <div
      className={`
        pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2
        flex items-center gap-1.5 bg-card border rounded-full px-3 py-1 shadow-lg z-30
        transition-all duration-300
        ${visible ? "opacity-100 -translate-y-0" : "opacity-0 -translate-y-2"}
        ${rarity?.glow}
      `}
    >
      <span className="text-base">{species.emoji.bloom}</span>
      <span className={`text-xs font-bold font-mono ${rarity?.color}`}>
        +{species.sellValue} 🪙
      </span>
    </div>
  );
}