import type { FlowerSpecies, GrowthStage } from "../data/flowers";
import { useSettings } from "../store/SettingsContext";

// Shared sprites used for every species at these stages.
// Per-species overrides (species.sprite[stage]) take priority if present.
const SHARED_SPRITES: Partial<Record<GrowthStage, string>> = {
  seed:   "/sprites/flowers/seed.png",
  sprout: "/sprites/flowers/sprout.png",
};

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
 * otherwise falls back to the emoji. Seed/sprout use shared sprites; bloom
 * uses a per-species sprite (species.sprite.bloom) when available.
 */
export function FlowerSprite({
  species,
  stage,
  textSize  = "text-2xl",
  imgSize   = "w-8 h-8",
  className = "",
}: Props) {
  const { settings } = useSettings();
  // Per-species sprite takes priority; shared sprite is the fallback for seed/sprout
  const src = settings.useSprites
    ? (species.sprite?.[stage] ?? SHARED_SPRITES[stage])
    : undefined;

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
