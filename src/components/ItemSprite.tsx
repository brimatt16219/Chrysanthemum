import { useSettings } from "../store/SettingsContext";

const PX = { imageRendering: "pixelated" as const };

interface Props {
  emoji:     string;
  sprite?:   string;
  name?:     string;
  /** Tailwind text-size class used when falling back to emoji, e.g. "text-2xl" */
  textSize?: string;
  /** Tailwind size classes applied to the <img>, e.g. "w-8 h-8" */
  imgSize?:  string;
  className?: string;
}

/**
 * Renders a pixel-art sprite <img> when one is available and sprites are enabled,
 * otherwise falls back to the emoji. Works for gear, consumable, and fertilizer items.
 */
export function ItemSprite({
  emoji,
  sprite,
  name      = "",
  textSize  = "text-2xl",
  imgSize   = "w-8 h-8",
  className = "",
}: Props) {
  const { settings } = useSettings();

  if (settings.useSprites && sprite) {
    return (
      <img
        src={sprite}
        alt={name || emoji}
        className={`${imgSize} object-contain ${className}`}
        style={PX}
        draggable={false}
      />
    );
  }

  return (
    <span className={`${textSize} leading-none ${className}`}>
      {emoji}
    </span>
  );
}
