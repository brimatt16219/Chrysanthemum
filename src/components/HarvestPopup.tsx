import { useEffect, useState } from "react";
import { getFlower, RARITY_CONFIG, MUTATIONS, type MutationType } from "../data/flowers";
import { FlowerSprite } from "./FlowerSprite";
import { ItemSprite } from "./ItemSprite";

interface Props {
  speciesId: string;
  mutation?: MutationType;
  count: number;
  isSeed?: boolean;
  onDone: () => void;
}

export function HarvestPopup({ speciesId, mutation, count, isSeed, onDone }: Props) {
  const [visible, setVisible] = useState(true);
  const species = getFlower(speciesId);
  const rarity  = species ? RARITY_CONFIG[species.rarity] : null;
  const mut     = mutation ? MUTATIONS[mutation] : null;

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(
      () => {
        setVisible(false);
        setTimeout(onDone, 300);
      },
      mut ? 2_000 : 1_200
    );
    return () => clearTimeout(timer);
  // count intentionally excluded: the timer must NOT reset on every count increment.
  // Rapid harvests (bell gear, auto-planter) would otherwise cancel the pending
  // dismiss on each push → onDone never fires → popup lives forever (#241).
  // The count prop still updates the displayed number; only the timer is locked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!species) return null;

  return (
    <div
      className={`
        pointer-events-none
        transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      <div
        className={`flex items-center gap-1.5 bg-card border rounded-full px-3 py-1 shadow-lg ${rarity?.glow}`}
      >
        <span className={`text-xs font-bold font-mono ${isSeed ? "text-green-400" : mut ? mut.color : rarity?.color}`}>
          +{count}
        </span>
        <FlowerSprite species={species} stage={isSeed ? "seed" : "bloom"} textSize="text-base" imgSize="w-5 h-5" />
        {isSeed && (
          <span className="text-xs font-bold font-mono text-green-400">Seed</span>
        )}
        {!isSeed && mut && (
          <span className={`text-xs font-bold font-mono ${mut.color} inline-flex items-center gap-1`}>
            <ItemSprite emoji={mut.emoji} sprite={mut.sprite} name={mut.emoji} textSize="text-xs" imgSize="w-3.5 h-3.5" />
            {mut.name}
          </span>
        )}
      </div>
    </div>
  );
}
