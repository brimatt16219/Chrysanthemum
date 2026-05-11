import type { FlowerSpecies, GrowthStage } from "../data/flowers";

interface Props {
  species:   FlowerSpecies;
  stage:     GrowthStage;
  /** Tailwind text-size class used when falling back to emoji, e.g. "text-2xl" */
  textSize?: string;
  /** Tailwind size classes applied to the <img>, e.g. "w-8 h-8" */
  imgSize?:  string;
  className?: string;
}

/**
 * Renders a pixel-art sprite <img> when one is available for the given stage,
 * otherwise falls back to the emoji. Add new sprites to FlowerSpecies.sprite
 * and drop the PNG in public/sprites/flowers/.
 */
export function FlowerSprite({
  species,
  stage,
  textSize  = "text-2xl",
  imgSize   = "w-8 h-8",
  className = "",
}: Props) {
  const src = species.sprite?.[stage];

  if (src) {
    return (
      <img
        src={src}
        alt={species.name}
        className={`${imgSize} object-contain image-rendering-pixelated ${className}`}
        style={{ imageRendering: "pixelated" }}
        draggable={false}
      />
    );
  }

  return (
    <span className={`${textSize} leading-none ${className}`}>
      {species.emoji[stage]}
    </span>
  );
}
