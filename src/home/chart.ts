import { html, nothing, svg, type TemplateResult } from "lit";
import { linePath, stepPath } from "../lib/chart";
import type { ValuePoint } from "../lib/history";

const W = 300;

/**
 * A day-long chart: a line (with a soft area under it) on top and, optionally, bars in a band
 * along the bottom. Bars scale to `barMax` or their largest value, whichever is bigger, so a
 * trace amount never looks like a downpour. `steps` draws a dashed stepped line on the same
 * scale (a thermostat's target); `spans` marks periods in a thin strip under the line, each
 * classed by its `kind` (when it was cooling or heating).
 */
export function timeChart(o: {
  line: ValuePoint[];
  bars?: ValuePoint[];
  t0: number;
  t1: number;
  label: string;
  barMax?: number;
  height?: number;
  steps?: { t0: number; t1: number; v: number }[];
  spans?: { t0: number; t1: number; kind: string }[];
}): TemplateResult {
  const h = o.height ?? 96;
  const band = o.bars?.length ? 22 : 0;
  const strip = o.spans ? 6 : 0;
  const lh = h - band - (band ? 6 : 0) - (strip ? strip + 6 : 0);
  if (o.line.length < 2) return html`<div class="empty">Not enough history yet</div>`;
  const steps = (o.steps ?? []).filter((s) => s.t1 > o.t0 && s.t0 < o.t1);
  const vs = [...o.line.map((p) => p.v), ...steps.map((s) => s.v)];
  const pad = (Math.max(...vs) - Math.min(...vs)) * 0.12 || 1;
  const box = { w: W, h: lh, t0: o.t0, t1: o.t1, v0: Math.min(...vs) - pad, v1: Math.max(...vs) + pad };
  const d = linePath(o.line, box);
  const x = (t: number) => (((t - o.t0) / (o.t1 - o.t0 || 1)) * W).toFixed(1);
  const first = o.line[0];
  const last = o.line[o.line.length - 1];
  const max = Math.max(o.barMax ?? 0, ...(o.bars ?? []).map((b) => b.v));
  const slot = o.bars && o.bars.length > 1 ? (W / ((o.t1 - o.t0) / (o.bars[1].t - o.bars[0].t))) * 0.7 : 6;
  return html`<svg class="chart" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img" aria-label=${o.label} style="height:${h}px">
    <path class="area" d="${d}L${x(last.t)},${lh}L${x(first.t)},${lh}Z"></path>
    <path class="line" d=${d}></path>
    ${steps.length ? svg`<path class="target" d=${stepPath(steps, box)}></path>` : nothing}
    ${strip
      ? svg`<rect class="strip" x="0" y=${lh + 6} width=${W} height=${strip} rx="3"></rect>
        ${o.spans!.map((sp) => {
          const a = Math.max(sp.t0, o.t0);
          const b = Math.min(sp.t1, o.t1);
          return b > a
            ? svg`<rect class="run ${sp.kind}" x=${x(a)} y=${lh + 6} width=${Math.max(1, Number(x(b)) - Number(x(a)))} height=${strip} rx="2"></rect>`
            : nothing;
        })}`
      : nothing}
    ${band
      ? svg`<line class="grid" x1="0" x2=${W} y1=${h - 0.5} y2=${h - 0.5}></line>
        ${o.bars!.map((b) => {
          const bh = max > 0 ? (b.v / max) * band : 0;
          return bh > 0 ? svg`<rect class="rain" x=${Number(x(b.t)) - slot / 2} y=${h - bh} width=${slot} height=${bh} rx="1.5"></rect>` : nothing;
        })}`
      : nothing}
  </svg>`;
}
