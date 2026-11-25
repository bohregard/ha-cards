import { html, nothing, svg, type TemplateResult } from "lit";
import { barRects, linePath, stackedRects } from "../lib/chart";
import type { ValuePoint } from "../lib/history";

const W = 300;

/** Weekday initials under day bars, oldest first, today last and emphasised. */
export function dayLabels(days: number, now: number, lang?: string): TemplateResult {
  const d = new Date(now);
  const labels = Array.from({ length: days }, (_, i) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() - (days - 1 - i)).toLocaleDateString(lang, { weekday: "narrow" }),
  );
  return html`<div class="days" style="grid-template-columns:repeat(${days},1fr)">
    ${labels.map((l, i) => html`<span class=${i === days - 1 ? "today" : ""}>${l}</span>`)}
  </div>`;
}

/** One bar per day; today's bar is the solid one. */
export function bars(values: number[], label: string): TemplateResult {
  const h = 60;
  const rects = barRects(values, { w: W, h, gap: 8 });
  return html`<svg class="chart" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img" aria-label=${label}>
    ${rects.map(
      (r, i) => svg`<rect class="bar ${i === rects.length - 1 ? "today" : ""}" x=${r.x} y=${r.y} width=${r.w} height=${Math.max(r.h, values[i] > 0 ? 2 : 0)} rx="3"></rect>`,
    )}
  </svg>`;
}

/** Stacked day bars, one shade per series (s0, s1, s2). */
export function stacked(series: number[][], label: string): TemplateResult {
  const h = 60;
  const rects = stackedRects(series, { w: W, h, gap: 8 });
  return html`<svg class="chart" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img" aria-label=${label}>
    ${rects.map((row, s) => row.map((r) => svg`<rect class="s${s % 3}" x=${r.x} y=${r.y} width=${r.w} height=${r.h}></rect>`))}
  </svg>`;
}

export interface Mark {
  v: number;
  cls: "warn" | "error" | "";
}

/** A line over time with a soft area under it and dashed reference lines. */
export function lineChart(
  series: ValuePoint[][],
  o: { t0: number; t1: number; marks?: Mark[]; label: string; area?: boolean; pad?: number },
): TemplateResult {
  const h = 84;
  const all = [...series.flat().map((p) => p.v), ...(o.marks ?? []).map((m) => m.v)];
  if (!series.some((s) => s.length > 1)) return html`<div class="empty">Not enough history yet</div>`;
  const pad = o.pad ?? 0;
  const v0 = Math.min(...all) - pad;
  const v1 = Math.max(...all) + pad;
  const box = { w: W, h, t0: o.t0, t1: o.t1, v0, v1 };
  const y = (v: number) => (v1 === v0 ? h / 2 : h - ((v - v0) / (v1 - v0)) * h);
  return html`<svg class="chart tall" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img" aria-label=${o.label}>
    ${(o.marks ?? []).map((m) => svg`<line class="mark ${m.cls}" x1="0" x2=${W} y1=${y(m.v)} y2=${y(m.v)}></line>`)}
    ${series.map((pts, i) => {
      const d = linePath(pts, box);
      if (!d) return nothing;
      const cls = series.length > 1 ? `s${i % 3}` : "line";
      const area =
        o.area && series.length === 1
          ? svg`<path class="area" d=${`${d}L${(((pts[pts.length - 1].t - o.t0) / (o.t1 - o.t0 || 1)) * W).toFixed(1)},${h}L${(((pts[0].t - o.t0) / (o.t1 - o.t0 || 1)) * W).toFixed(1)},${h}Z`}></path>`
          : nothing;
      return svg`${area}<path class=${cls} d=${d}></path>`;
    })}
  </svg>`;
}

/** − value + with the number entity's own limits. */
export function stepper(
  value: number | undefined,
  o: { min: number; max: number; step: number; unit?: (n: number) => string; label: string; onChange: (v: number) => void; compact?: boolean },
): TemplateResult {
  const v = value ?? o.min;
  const show = value === undefined ? "–" : o.unit ? o.unit(v) : String(v);
  return html`<span class="stepper ${o.compact ? "compact" : ""}" role="group" aria-label=${o.label}>
    <button aria-label="Less" ?disabled=${value === undefined || v - o.step < o.min} @click=${() => o.onChange(v - o.step)}>−</button>
    <span>${show}</span>
    <button aria-label="More" ?disabled=${value === undefined || v + o.step > o.max} @click=${() => o.onChange(v + o.step)}>+</button>
  </span>`;
}

export function toggle(checked: boolean, label: string, onClick: () => void, confirming = false): TemplateResult {
  return html`<button
    class="toggle ${confirming ? "confirm" : ""}"
    role="switch"
    aria-checked=${checked ? "true" : "false"}
    aria-label=${label}
    @click=${onClick}
  ></button>`;
}

export function settingsTitle(name: string, onBack: () => void): TemplateResult {
  return html`<div class="title">
    <button class="gear" aria-label="Back" @click=${onBack}><ha-icon icon="mdi:arrow-left"></ha-icon></button>
    <span class="name">${name} settings</span>
  </div>`;
}
