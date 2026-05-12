import { useEffect, useState } from "react";
import { ItemSprite } from "./ItemSprite";

interface Props {
  emoji: string;
  sprite?: string;
  label: string;
  count: number;
  color?: string;
  variant?: "gain" | "loss";
  onDone: () => void;
}

export function GenericToastPopup({ emoji, sprite, label, count, color = "text-primary", variant = "gain", onDone }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => { setVisible(false); setTimeout(onDone, 300); }, 1_200);
    return () => clearTimeout(timer);
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  const signClass = variant === "loss" ? "text-red-400" : color;
  const sign      = variant === "loss" ? "-" : "+";

  return (
    <div className={`pointer-events-none transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
      <div className="flex items-center gap-1.5 bg-card border rounded-full px-3 py-1 shadow-lg">
        <span className={`text-xs font-bold font-mono ${signClass}`}>{sign}{count}</span>
        <ItemSprite emoji={emoji} sprite={sprite} name={emoji} textSize="text-base" imgSize="w-5 h-5" />
        <span className={`text-xs font-bold font-mono ${color}`}>{label}</span>
      </div>
    </div>
  );
}
