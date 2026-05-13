import { useEffect, useState } from "react";
import { ItemSprite } from "./ItemSprite";

interface Props {
  onDismiss: () => void;
  /** "seeds" = seed shop restock; "supply" = gear & fertilizer supply shop restock */
  type?: "seeds" | "supply";
}

export function ShopRestockBanner({ onDismiss, type = "seeds" }: Props) {
  const [visible, setVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 4_000);

    return () => {
      cancelAnimationFrame(show);
      clearTimeout(timer);
    };
  }, []);

  return (
    // Positioning + z-index live on the wrapper in App.tsx so multiple banners
    // can stack vertically instead of overlapping. `pointer-events-auto` re-enables
    // pointer events for the dismiss button (the wrapper sets `pointer-events-none`
    // so the empty space around stacked banners doesn't block taps below).
    <div
      className={`
        transition-all duration-400 pointer-events-auto
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      <div className="flex items-center gap-4 bg-card border border-primary/40 rounded-2xl px-5 py-4 shadow-2xl shadow-primary/20 min-w-72">

        {/* Icon */}
        <div className="flex-shrink-0 animate-bounce">
          {type === "supply"
            ? <ItemSprite emoji="🧪" sprite="/sprites/ui/consumables.png" name="Supply shop" textSize="text-3xl" imgSize="w-8 h-8" />
            : <ItemSprite emoji="🛒" sprite="/sprites/ui/tab_shop.png" name="Shop" textSize="text-3xl" imgSize="w-8 h-8" />}
        </div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">
            {type === "supply" ? "Supply Restocked!" : "Shop Restocked!"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {type === "supply"
              ? "Fresh gear and fertilizer are available."
              : "Fresh seeds and fertilizer are available."}
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
