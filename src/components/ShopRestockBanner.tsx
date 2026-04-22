import { useEffect, useState } from "react";

interface Props {
  onDismiss: () => void;
}

export function ShopRestockBanner({ onDismiss }: Props) {
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
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        transition-all duration-400
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      <div className="flex items-center gap-4 bg-card border border-primary/40 rounded-2xl px-5 py-4 shadow-2xl shadow-primary/20 min-w-72">

        {/* Icon */}
        <div className="text-3xl flex-shrink-0 animate-bounce">🛒</div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Shop Restocked!</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fresh seeds and fertilizer are available.
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
