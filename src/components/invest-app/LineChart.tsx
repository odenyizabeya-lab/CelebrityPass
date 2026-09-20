"use client";

import { useMemo } from "react";

export type ChartPoint = { time: string; price: number };

type YTick = { value: number; top: string };
type XTick = { left: string; label: string };

const fmtY = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Responsive SVG price chart with HTML axis labels (crisp at any scale).
 * Green line when the series is net-positive, red when net-negative.
 */
export function LineChart({ points, height = 220 }: { points: ChartPoint[]; height?: number }) {
  const { path, area, yTicks, xTicks, color } = useMemo(() => {
    const empty = { path: "", area: "", yTicks: [] as YTick[], xTicks: [] as XTick[], color: "#22c55e" };
    if (points.length === 0) return empty;

    const w = 1000; // viewBox width (stretched responsively)
    const h = height; // viewBox height == rendered pixel height
    const padTop = 14;
    const padBottom = 26;
    const padRight = 58;

    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const x = (i: number) => (i / Math.max(1, points.length - 1)) * (w - padRight);
    const y = (v: number) => padTop + (1 - (v - min) / range) * (h - padTop - padBottom);

    const pt = (i: number) => {
      const c = Math.max(0, Math.min(points.length - 1, i));
      return { cx: x(c), cy: y(points[c].price) };
    };

    // Catmull-Rom -> Bezier smoothing for the line path
    let smooth: string;
    if (points.length >= 3) {
      const segs: string[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = pt(i - 1);
        const p1 = pt(i);
        const p2 = pt(i + 1);
        const p3 = pt(i + 2);
        const c1x = p1.cx + (p2.cx - p0.cx) / 6;
        const c1y = p1.cy + (p2.cy - p0.cy) / 6;
        const c2x = p2.cx - (p3.cx - p1.cx) / 6;
        const c2y = p2.cy - (p3.cy - p1.cy) / 6;
        segs.push(`C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.cx.toFixed(2)},${p2.cy.toFixed(2)}`);
      }
      const start = pt(0);
      smooth = `M${start.cx.toFixed(2)},${start.cy.toFixed(2)} ${segs.join(" ")}`;
    } else {
      smooth = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.price).toFixed(2)}`).join(" ");
    }

    const baseY = h - padBottom;
    const area = `${smooth} L${x(points.length - 1).toFixed(2)},${baseY} L${x(0).toFixed(2)},${baseY} Z`;

    const divisions = 4;
    const yTicks: YTick[] = Array.from({ length: divisions + 1 }, (_, i) => {
      const v = max - (range / divisions) * i;
      return { value: v, top: `${(y(v) / h) * 100}%` };
    });

    const xCount = Math.min(4, points.length);
    const xTicks: XTick[] = Array.from({ length: xCount > 1 ? xCount : 0 }, (_, i) => {
      const t = points[Math.round((i / (xCount - 1)) * (points.length - 1))];
      const label = t.time.includes("T") ? t.time.slice(11, 16) : t.time.slice(5);
      return { left: `${(x(i) / w) * 100}%`, label };
    });

    const positive = points[points.length - 1].price >= points[0].price;
    return { path: smooth, area, yTicks, xTicks, color: positive ? "#22c55e" : "#ef4444" };
  }, [points, height]);

  if (points.length === 0) {
    return <div className="grid w-full place-items-center text-sm text-zinc-500" style={{ height }}>No chart data</div>;
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 1000 ${height}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Price chart">
        <g>
          {yTicks.map((t, i) => (
            <line
              key={i}
              x1="0"
              x2="1000"
              y1={(height / (yTicks.length - 1)) * i}
              y2={(height / (yTicks.length - 1)) * i}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          ))}
        </g>
        <path d={area} fill={color} opacity="0.12" />
        <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {yTicks.map((t) => (
        <span
          key={`y${t.value}`}
          className="absolute right-0.5 -translate-y-1/2 text-[10px] font-semibold tabular-nums tracking-tight text-zinc-500"
          style={{ top: t.top }}
        >
          {fmtY(t.value)}
        </span>
      ))}
      {xTicks.map((t) => (
        <span
          key={`x${t.left}`}
          className="absolute bottom-0.5 -translate-x-1/2 text-[10px] font-medium tabular-nums tracking-tight text-zinc-500"
          style={{ left: t.left }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}