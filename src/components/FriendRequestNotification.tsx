import { useEffect, useState } from "react";

interface Props {
  onDismiss: () => void;
  onView: () => void;
}

export function FriendRequestNotification({ onDismiss, onView }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 5_000);
    return () => clearTimeout(timer);
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
        <div className="text-2xl flex-shrink-0">👋</div>
        <div className="flex-1">
          <p className="text-sm font-bold">New friend request!</p>
          <button
            onClick={() => { setVisible(false); setTimeout(onView, 400); }}
            className="text-xs text-primary hover:underline mt-0.5"
          >
            View in Friends tab →
          </button>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}