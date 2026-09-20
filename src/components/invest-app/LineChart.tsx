"use client";

import { useMemo } from "react";

export type ChartPoint = { time: string; price: number };

/**
 * Lightweight SVG line chart with a subtle area fill, right-side price labels
 * and bottom time labels. Green line when the series is net-positive, red when
 * net-negative.
 */
export function LineChart({ points, height = 220 }: { points: ChartPoint[]; height?: number }) {
  const { path, areaPath, yTicks, xTicks, color, last } = useMemo(() => {
    if (points.length === 0) {
      return { path: "", areaPath: "", yTicks: [] as number[], xTicks: [] as { i: number; label: string }[], color: "#22c55e", last: 0 };
    }
    const w = 1000; // viewBox width
    const h = height;
    const padTop = 14;
    const padBottom = 26;
    const padRight = 58;
    const padLeft = 0;

    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const x = (i: number) => padLeft + (i / Math.max(1, points.length - 1)) * (w - padLeft - padRight);
    const y = (v: number) => padTop + (1 - (v - min) / range) * (h - padTop - padBottom);

    let pathD = "";
    let areaD = "";
    points.forEach((p, i) => {
      const cx = x(i);
      const cy = y(p.price);
      pathD += `${i === 0 ? "M" : "L"}${cx.toFixed(2)},${cy.toFixed(2)}`;
      areaD += `${i === 0 ? "M" : "L"}${cx.toFixed(2)},${cy.toFixed(2)}`;
    });

    const line = pathD;
    let smooth = line;

    // Simple Catmull-Rom -> Bezier smoothing for the line path
    if (points.length >= 3) {
      const segs: string[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = i === 0 ? points[0] : points[i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i + 2 < points.length ? points[i + 2] : points[points.length - 1];
        const c1x = -0.1 * xPr(p0, points) + 1.1 * xPr(p1, points);
        const c1y = -0.1 * yPos(p0.price, min, range, h, padTop, padBottom) + 1.1 * yPos(p1.price, min, range, h, padTop, padBottom);
        const c2x = 1.1 * xPr(p1, points) - 0.1 * xPr(p2, points);
        const c2y = 1.1 * yPos(p1.price, min, range, h, padTop, padBottom) - 0.1 * yPos(p2.price, min, range, h, padTop, padBottom);
        segs.push(
          `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${xPr(p2, points).toFixed(2)},${yPos(
            p2.price,
            min,
            range,
            h,
            padTop,
            padBottom,
          ).toFixed(2)}`,
        );
      }
      const p0 = points[0];
      const p1x = xPr(p0, points);
      const p1y = yPos(p0.price, min, range, h, padTop, padBottom);
      smooth = `M${p1x.toFixed(2)},${p1y.toFixed(2)} ${segs.join(" ")}`;
    }

    const lastY = y(points[points.length - 1].price);
    const baseY = h - padBottom;
    const area = `${smooth} L${x(points.length - 1).toFixed(2)},${baseY} L${x(0).toFixed(2)},${baseY} Z`;

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
      const v = max - (range / ticks) * i;
      return Math.round(v * 100) / 100;
    });

    const xCount = Math.min(4, points.length);
    const xTicks = Array.from({ length: xCount > 1 ? xCount : 0 }, (_, i) => {
      const idx = Math.round((i / (xCount - 1)) * (points.length - 1));
      const p = points[idx];
      const t = p.time.includes("T") ? p.time.slice(11, 16) : p.time.slice(5);
      return { i: idx, label: t };
    });

    const positive = points[points.length - 1].price >= points[0].price;
    return { path: smooth, areaPath: area, yTicks, xTicks, color: positive ? "#22c55e" : "#ef4444", last: points[points.length - 1].price };

    function xPr(p: ChartPoint, arr: ChartPoint[]): number {
      const i = arr.indexOf(p);
      return padLeft + (i / Math.max(1, arr.length - 1)) * (w - padLeft - padRight);
    }
    function yPos(v: number, min: number, range: number, h: number, pt: number, pb: number): number {
      return pt + (1 - (v - min) / range) * (h - pt - pb);
    }
  }, [points, height]);

  if (points.length === 0) {
    return <div className="grid w-full place-items-center text-sm text-zinc-500" style={{ height }}>No chart data</div>;
  }

  return (
    <svg viewBox={`0 0 1000 ${height}`} className="h-auto w-full" preserveAspectRatio="none" role="img" aria-label="Price chart">
      <g>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1="0"
              x2="1000"
              y1={(height / (yTicks.length - 1)) * i}
              y2={(height / (yTicks.length - 1)) * i}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
            <text x="996" y={(height / (yTicks.length - 1)) * i + 4} fill="#71717a" fontSize="20" textAnchor="end">
              {t.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.i} x={(t.i / Math.max(1, points.length - 1)) * 940 + 10} y={height - 4} fill="#52525b" fontSize="19">
            {t.label}
          </text>
        ))}
      </g>
      <path d={areaPath} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}