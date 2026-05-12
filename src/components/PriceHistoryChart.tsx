import { useEffect, useState } from "react";
import { ItemSprite } from "./ItemSprite";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { supabase } from "../lib/supabase";

interface SalePoint {
  soldAt: string;   // ISO string
  price:  number;
}

interface Props {
  speciesId: string;
  mutation?: string;
  baseValue: number; // shop sell value — shown as reference line
}

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Custom tooltip shown on hover
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: SalePoint }[] }) {
  if (!active || !payload?.length) return null;
  const { value, payload: point } = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs shadow-md">
      <p className="font-mono font-bold text-primary inline-flex items-center gap-0.5">{formatCoins(value)} <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" /></p>
      <p className="text-muted-foreground">{formatDate(point.soldAt)}</p>
    </div>
  );
}

export function PriceHistoryChart({ speciesId, mutation, baseValue }: Props) {
  const [points, setPoints]   = useState<SalePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const base = supabase
      .from("marketplace_sales")
      .select("price, sold_at")
      .eq("species_id", speciesId);

    const q = mutation
      ? base.eq("mutation", mutation)
      : base.filter("mutation", "is", null);

    q.order("sold_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // Table may not exist yet or schema cache stale — show empty state
          setLoading(false);
          return;
        }
        // Reverse so oldest → newest left to right
        const pts = data
          .map((r) => ({ soldAt: r.sold_at as string, price: r.price as number }))
          .reverse();
        setPoints(pts);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [speciesId, mutation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <p className="text-xs text-muted-foreground animate-pulse font-mono">Loading price history...</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-20 gap-1">
        <p className="text-xs text-muted-foreground">No sales recorded yet</p>
        <p className="text-[10px] text-muted-foreground/60 inline-flex items-center gap-0.5">Base sell value: {formatCoins(baseValue)} <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" /></p>
      </div>
    );
  }

  const prices  = points.map((p) => p.price);
  const minP    = Math.min(...prices);
  const maxP    = Math.max(...prices);
  const padding = Math.max(Math.floor((maxP - minP) * 0.15), 1);
  const yMin    = Math.max(0, minP - padding);
  const yMax    = maxP + padding;

  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-mono">
          Price history · last {points.length} sale{points.length !== 1 ? "s" : ""}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">
          <span className="inline-flex items-center gap-0.5">avg {formatCoins(avgPrice)} <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" /></span>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="soldAt"
            tickFormatter={formatDate}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={formatCoins}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
          {/* Base sell value reference line */}
          <ReferenceLine
            y={baseValue}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={points.length <= 10 ? { r: 2.5, fill: "hsl(var(--primary))", strokeWidth: 0 } : false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-muted-foreground/50 text-right">
        <span className="inline-flex items-center gap-0.5">— base sell value {formatCoins(baseValue)} <ItemSprite emoji="🟡" sprite="/sprites/ui/coins.png" name="coins" textSize="text-xs" imgSize="w-3.5 h-3.5" /></span>
      </p>
    </div>
  );
}
