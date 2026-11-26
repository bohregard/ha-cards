import type { ValuePoint } from "./history";

export interface LineBox {
  w: number;
  h: number;
  /** Time range (epoch ms) mapped to 0..w. */
  t0: number;
  t1: number;
  /** Value range mapped to h..0. */
  v0: number;
  v1: number;
}

export interface BarBox {
  w: number;
  h: number;
  gap: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const r = (n: number) => Math.round(n * 10) / 10;

/** SVG path for a line through the points; "" when there's nothing to draw. */
export function linePath(points: ValuePoint[], b: LineBox): string {
  if (points.length < 2) return "";
  const span = b.t1 - b.t0 || 1;
  const range = b.v1 - b.v0;
  return points
    .map((p, i) => {
      const x = ((p.t - b.t0) / span) * b.w;
      const y = range === 0 ? b.h / 2 : b.h - ((p.v - b.v0) / range) * b.h;
      return `${i ? "L" : "M"}${r(x)},${r(y)}`;
    })
    .join("");
}

/**
 * SVG path for a stepped value held over spans (e.g. a thermostat's target): flat across each
 * span, a vertical step where spans touch, and a gap where they don't. Clipped to the box's time range.
 */
export function stepPath(spans: { t0: number; t1: number; v: number }[], b: LineBox): string {
  const span = b.t1 - b.t0 || 1;
  const range = b.v1 - b.v0;
  const x = (t: number) => r(((t - b.t0) / span) * b.w);
  const y = (v: number) => r(range === 0 ? b.h / 2 : b.h - ((v - b.v0) / range) * b.h);
  let d = "";
  let lastEnd: number | undefined;
  for (const s of spans) {
    const t0 = Math.max(s.t0, b.t0);
    const t1 = Math.min(s.t1, b.t1);
    if (t1 <= t0) continue;
    d += `${lastEnd === t0 ? "L" : "M"}${x(t0)},${y(s.v)}L${x(t1)},${y(s.v)}`;
    lastEnd = t1;
  }
  return d;
}

/** Bars for one series, scaled to its largest value. */
export function barRects(values: number[], b: BarBox): Rect[] {
  return stackedRects([values], b)[0];
}

/**
 * Stacked bars: `series[s][day]`. Returns rects in the same shape, each series sitting on
 * top of the ones before it, scaled so the tallest day fills the height.
 */
export function stackedRects(series: number[][], b: BarBox): Rect[][] {
  const days = series[0]?.length ?? 0;
  const totals = Array.from({ length: days }, (_, d) => series.reduce((sum, s) => sum + (s[d] ?? 0), 0));
  const max = Math.max(0, ...totals);
  const bw = days ? (b.w - b.gap * (days - 1)) / days : 0;
  const base = totals.map(() => b.h);
  return series.map((s) =>
    s.map((v, d) => {
      const h = max ? (v / max) * b.h : 0;
      base[d] -= h;
      return { x: r(d * (bw + b.gap)), y: r(base[d]), w: r(bw), h: r(h) };
    }),
  );
}
