import { useEffect, useState } from "react";
import { ItemSprite } from "./ItemSprite";

interface Props {
  emoji:     string;
  sprite?:   string;
  name:      string;
  /** Banner title — defaults to "Craft Ready!". Use "Attunement Ready!" etc.
   *  for non-craft queue completions that share the same banner shape. */
  title?:    string;
  /** When > 1 the body shows "{count} items ready to collect." instead of the
   *  individual item name. Lets the parent consolidate multiple completions into
   *  a single banner instead of stacking one per item. */
  count?:    number;
  onDismiss: () => void;
}

/** Floating banner that fires when a queue entry transitions to "ready to
 *  collect". Auto-dismisses after 4 seconds, mirroring the shop restock
 *  banner. The wrapper that mounts it sets the position + z-index so multiple
 *  banners can stack vertically. */
export function CraftCompletionBanner({ emoji, sprite, name, title = "Craft Ready!", count, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 4_000);

    return () => {
      cancelAnimationFrame(show);
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`
        transition-all duration-400 pointer-events-auto
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      <div className="flex items-center gap-4 bg-card border border-amber-500/40 rounded-2xl px-5 py-4 shadow-2xl shadow-amber-500/20 min-w-72">

        {/* Icon */}
        <div className="flex-shrink-0 animate-bounce">
          <ItemSprite emoji={emoji} sprite={sprite} name={name} textSize="text-3xl" imgSize="w-8 h-8" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {count && count > 1
              ? `${count} items ready to collect.`
              : `${name} is ready to collect.`}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 400);
          }}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm flex-shrink-0 ml-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
