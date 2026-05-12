import { useEffect, useState } from "react";
import { GEAR } from "../data/gear";
import { RARITY_CONFIG } from "../data/flowers";
import { ItemSprite } from "./ItemSprite";

interface Props {
  gearType: string;
  onDismiss: () => void;
}

export function GearExpiryBanner({ gearType, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 4_000);
    return () => { cancelAnimationFrame(show); clearTimeout(timer); };
  }, []);

  const def    = GEAR[gearType as keyof typeof GEAR];
  const rarity = def ? RARITY_CONFIG[def.rarity] : null;

  if (!def) return null;

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        transition-all duration-400
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      <div className="flex items-center gap-4 bg-card border border-border/60 rounded-2xl px-5 py-4 shadow-2xl min-w-72">

        {/* Icon */}
        <div className="flex-shrink-0">
          <ItemSprite emoji={def.emoji} sprite={def.sprite} name={def.name} textSize="text-3xl" imgSize="w-8 h-8" />
        </div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">
            <span className={rarity?.color}>{rarity?.label}</span> {def.name} expired
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            It has been removed from your farm.
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm flex-shrink-0 ml-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
