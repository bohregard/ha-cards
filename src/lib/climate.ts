import type { ValuePoint } from "./history";

/**
 * What a climate card shows for a thermostat and its fans: the mode buttons, a headline that
 * says what it's doing now (or when it will start), the targets to step, fan speeds, and how
 * long it ran from the thermostat's history.
 */

export type ClimateTone = "cool" | "heat" | "idle" | "off" | "error";
export type TargetKey = "temperature" | "target_temp_low" | "target_temp_high";

export interface ClimateTarget {
  key: TargetKey;
  label: string;
  value: number;
}

export interface ClimateView {
  tone: ClimateTone;
  headline: string;
  /** Cooling, heating or moving air right now. */
  running: boolean;
  targets: ClimateTarget[];
}

export interface ClimateAttrs {
  hvac_action?: string | null;
  temperature?: number | null;
  target_temp_low?: number | null;
  target_temp_high?: number | null;
}

export interface FanSpeed {
  label: string;
  pct: number;
}

export interface TargetSpan {
  t0: number;
  t1: number;
  v: number;
}

export interface RunSpan {
  t0: number;
  t1: number;
  kind: "cool" | "heat";
}

const MODE_ORDER = ["off", "cool", "heat", "heat_cool", "auto", "dry", "fan_only"];
const MODE_LABEL: Record<string, string> = {
  off: "Off",
  cool: "Cool",
  heat: "Heat",
  heat_cool: "Auto",
  auto: "Auto",
  dry: "Dry",
  fan_only: "Fan",
};

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const tenths = (v: number) => `${Math.round(v * 10) / 10}`;
/** "75°", "20.5°". */
export const deg = (v: number) => `${tenths(v)}°`;

/** The thermostat's modes as buttons: Off, Cool, Heat, Auto first, anything else after. */
export function modeButtons(modes: string[]): { mode: string; label: string }[] {
  const rank = (m: string) => {
    const i = MODE_ORDER.indexOf(m);
    return i < 0 ? MODE_ORDER.length : i;
  };
  return [...modes]
    .sort((a, b) => rank(a) - rank(b))
    .map((mode) => {
      if (mode === "heat_cool" && modes.includes("auto")) return { mode, label: "Heat/Cool" };
      const fallback = mode.replace(/_/g, " ");
      return { mode, label: MODE_LABEL[mode] ?? fallback.charAt(0).toUpperCase() + fallback.slice(1) };
    });
}

export function climateView(state: string, a: ClimateAttrs): ClimateView {
  if (!state || state === "unavailable" || state === "unknown") {
    return { tone: "error", headline: "Thermostat offline", running: false, targets: [] };
  }
  if (state === "off") return { tone: "off", headline: "Off", running: false, targets: [] };

  const t = num(a.temperature);
  const lo = num(a.target_temp_low);
  const hi = num(a.target_temp_high);
  const range = state === "heat_cool" && lo !== undefined && hi !== undefined;
  const targets: ClimateTarget[] = range
    ? [
        { key: "target_temp_low", label: "Heat to", value: lo },
        { key: "target_temp_high", label: "Cool to", value: hi },
      ]
    : t !== undefined
      ? [{ key: "temperature", label: state === "heat" ? "Heat to" : state === "cool" ? "Cool to" : "Keep at", value: t }]
      : [];
  const coolTo = range ? hi : t;
  const heatTo = range ? lo : t;

  switch (a.hvac_action) {
    case "cooling":
      return { tone: "cool", headline: coolTo !== undefined ? `Cooling to ${deg(coolTo)}` : "Cooling", running: true, targets };
    case "heating":
      return { tone: "heat", headline: heatTo !== undefined ? `Heating to ${deg(heatTo)}` : "Heating", running: true, targets };
    case "preheating":
      return { tone: "heat", headline: "Preheating", running: true, targets };
    case "fan":
      return { tone: "cool", headline: "Fan running", running: true, targets };
    case "drying":
      return { tone: "cool", headline: "Drying", running: true, targets };
  }

  let headline = "Idle";
  if (range) headline = `Idle · keeps ${tenths(lo)}–${deg(hi)}`;
  else if (t !== undefined && state === "cool") headline = `Idle · cools above ${deg(t)}`;
  else if (t !== undefined && state === "heat") headline = `Idle · heats below ${deg(t)}`;
  return { tone: "idle", headline, running: false, targets };
}

/** One step up or down, snapped to the step and kept within the thermostat's range. */
export function stepTarget(value: number, delta: number, step: number, min: number, max: number): number {
  const snapped = Math.round((value + delta) / step) * step;
  return Math.round(Math.min(max, Math.max(min, snapped)) * 1000) / 1000;
}

const SPEED_NAMES: Record<number, string[]> = {
  1: ["On"],
  2: ["Low", "High"],
  3: ["Low", "Med", "High"],
  4: ["Low", "Med", "High", "Max"],
};

/** A fan's speed buttons from its `percentage_step`; a fan without speeds has a single On. */
export function fanSpeeds(step: number | undefined): FanSpeed[] {
  if (!step || step <= 0) return [{ label: "On", pct: 100 }];
  const n = Math.round(100 / step);
  if (n > 6) return [25, 50, 75, 100].map((pct) => ({ label: `${pct}%`, pct }));
  return Array.from({ length: n }, (_, i) => {
    const pct = Math.round(((i + 1) * 100) / n);
    return { label: SPEED_NAMES[n]?.[i] ?? `${pct}%`, pct };
  });
}

/** Which speed button is lit: -1 for Off, else the speed nearest the reported percentage. */
export function fanSpeedIndex(state: string, pct: number | null | undefined, speeds: FanSpeed[]): number {
  if (state !== "on") return -1;
  if (typeof pct !== "number") return speeds.length - 1;
  let best = 0;
  speeds.forEach((s, i) => {
    if (Math.abs(s.pct - pct) < Math.abs(speeds[best].pct - pct)) best = i;
  });
  return best;
}

interface ClimateRow {
  s: string;
  a?: Record<string, unknown>;
  lu: number;
  lc?: number;
}

/**
 * The thermostat's history (`history/history_during_period` with attributes): inside
 * temperature, the target while it wasn't off, and when it was cooling or heating. Rows are
 * timed by `lu`, since most rows are attribute changes that leave `lc` behind.
 */
export function parseClimateHistory(rows: ClimateRow[], end: number): { temps: ValuePoint[]; targets: TargetSpan[]; runs: RunSpan[] } {
  const temps: ValuePoint[] = [];
  const targets: TargetSpan[] = [];
  const runs: RunSpan[] = [];
  rows.forEach((r, i) => {
    const t = Math.round(r.lu * 1000);
    const next = i + 1 < rows.length ? Math.round(rows[i + 1].lu * 1000) : end;
    const a = r.a ?? {};
    if (r.s === "unavailable" || r.s === "unknown") return;
    const cur = num(a.current_temperature);
    if (cur !== undefined) temps.push({ t, v: cur });
    const target = r.s === "off" ? undefined : num(a.temperature);
    if (target !== undefined) {
      const last = targets[targets.length - 1];
      if (last && last.v === target && last.t1 === t) last.t1 = next;
      else targets.push({ t0: t, t1: next, v: target });
    }
    const kind = a.hvac_action === "cooling" ? "cool" : a.hvac_action === "heating" ? "heat" : undefined;
    if (kind) {
      const last = runs[runs.length - 1];
      if (last && last.kind === kind && last.t1 === t) last.t1 = next;
      else runs.push({ t0: t, t1: next, kind });
    }
  });
  return { temps, targets, runs };
}

/** How long it cooled and heated within the window, in ms. */
export function runTime(runs: RunSpan[], t0: number, t1: number): { cool: number; heat: number } {
  const out = { cool: 0, heat: 0 };
  for (const r of runs) out[r.kind] += Math.max(0, Math.min(r.t1, t1) - Math.max(r.t0, t0));
  return out;
}

function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} min`;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "Cooled 3 h 20 min", "Cooled 2 h · heated 1 h", "Didn't run". */
export function runHint(t: { cool: number; heat: number }): string {
  const parts = [t.cool > 0 ? `cooled ${duration(t.cool)}` : "", t.heat > 0 ? `heated ${duration(t.heat)}` : ""].filter(Boolean);
  if (!parts.length) return "Didn't run";
  const s = parts.join(" · ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
