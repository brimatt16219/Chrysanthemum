import { FLOWER_TYPES } from "../data/flowers";
import {
  ALL_FLOWER_TYPES,
  UNIVERSAL_ESSENCE_DISPLAY,
  UNIVERSAL_ESSENCE_TYPE,
  type EssenceItem,
} from "../data/essences";
import type { FlowerType } from "../data/flowers";
import { ItemSprite } from "./ItemSprite";

interface Props {
  essences: EssenceItem[];
}

/** Shows the full essence wallet — all 12 elementals + Universal — even when
 *  the player has 0 of a given type. Empty cells are dimmed so non-zero
 *  amounts still pop visually. Used in the Inventory "Essences" tab and at
 *  the top of the Alchemy → Sacrifice view. */
export function EssenceBank({ essences }: Props) {
  // Index amounts by type for O(1) lookup
  const amountByType = new Map<string, number>(essences.map((e) => [e.type, e.amount]));

  // Render order: 12 flower-type essences first (in FLOWER_TYPES order), then Universal last.
  const ordered: { type: string; amount: number; cfg: { emoji: string; sprite?: string; name: string; color: string; bgColor: string; borderColor: string } }[] = [
    ...ALL_FLOWER_TYPES.map((type) => ({
      type,
      amount: amountByType.get(type) ?? 0,
      cfg:    FLOWER_TYPES[type as FlowerType],
    })),
    {
      type:   UNIVERSAL_ESSENCE_TYPE,
      amount: amountByType.get(UNIVERSAL_ESSENCE_TYPE) ?? 0,
      cfg:    UNIVERSAL_ESSENCE_DISPLAY,
    },
  ];

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
      {ordered.map(({ type, amount, cfg }) => {
        const empty       = amount <= 0;
        const isUniversal = type === UNIVERSAL_ESSENCE_TYPE;
        // Universal Essence uses the prismatic rainbow treatment (animated
        // border + bg) instead of its static slate config. Empty Universal
        // still dims to 40% so the cycle remains visible but muted.
        const tileClasses = isUniversal
          ? "rainbow-tile border"
          : `${cfg.bgColor} ${cfg.borderColor}`;
        const textColorClass = isUniversal ? "rainbow-text" : cfg.color;
        return (
          <div
            key={type}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-opacity
              ${tileClasses}
              ${empty ? "opacity-40" : ""}
            `}
          >
            <ItemSprite emoji={cfg.emoji} sprite={cfg.sprite} name={cfg.name} textSize="text-sm" imgSize="w-4 h-4" className="shrink-0" />
            <div className="min-w-0">
              <p className={`font-semibold leading-none ${textColorClass}`}>{amount}</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
                {cfg.name}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
