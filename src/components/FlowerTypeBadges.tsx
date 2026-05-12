import { FLOWER_TYPES } from "../data/flowers";
import type { FlowerType } from "../data/flowers";
import { ItemSprite } from "./ItemSprite";

interface Props {
  types: FlowerType[];
  /** Extra classes applied to the wrapping div */
  className?: string;
}

/**
 * Renders a row of coloured type chips (🔥 Blaze, 💧 Tide …) for a flower.
 * Pass `className` to adjust spacing / margin from the call site.
 */
export function FlowerTypeBadges({ types, className = "" }: Props) {
  if (!types || types.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {types.map((t) => {
        const tc = FLOWER_TYPES[t];
        return (
          <span
            key={t}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] ${tc.bgColor} border ${tc.borderColor} ${tc.color}`}
          >
            <ItemSprite emoji={tc.emoji} sprite={tc.sprite} name={tc.name} textSize="text-[10px]" imgSize="w-3 h-3" />
            <span>{tc.name}</span>
          </span>
        );
      })}
    </div>
  );
}
