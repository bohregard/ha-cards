import { countPerDay, type StatePoint } from "./history";
import type { Status } from "./tone";

export interface Cat {
  name: string;
  /** Heaviest weighing (lb) that is still this cat; leave it off the heaviest cat. */
  max_lb?: number;
}

export interface Weighing {
  t: number;
  lb: number;
}

/** Litter-Robot status codes that mean it can't be used, with what to tell people. */
const FAULTS: Record<string, string> = {
  br: "Bonnet removed",
  csf: "Cat sensor fault",
  csi: "Cat sensor interrupted",
  dhf: "Dump and home position fault",
  dpf: "Dump position fault",
  hpf: "Home position fault",
  off: "Powered off",
  offline: "Offline",
  otf: "Motor over-torque",
  pd: "Pinch detected",
  scf: "Cat sensor fault",
  spf: "Pinch detected",
};
const DRAWER_FULL = ["dfs", "sdf"];
const DRAWER_ALMOST = ["df1", "df2"];
const CYCLING = ["ccp", "ec"];
const CAT_INSIDE = ["cst", "cd"];

/** Index of the cat a weighing belongs to: the first whose `max_lb` it doesn't exceed. */
export function assignCat(lb: number, cats: Cat[]): number {
  const i = cats.findIndex((c) => c.max_lb === undefined || lb <= c.max_lb);
  return i >= 0 ? i : cats.length - 1;
}

/** Numeric pet-weight readings; each one is a visit. */
export function weighings(rows: StatePoint[]): Weighing[] {
  return rows.map((r) => ({ t: r.t, lb: Number(r.s) })).filter((w) => w.lb > 0);
}

/** Visits per cat per local day: one row per cat, oldest day first. */
export function visitsPerCat(w: Weighing[], cats: Cat[], now: number, days: number): number[][] {
  return cats.map((_, i) =>
    countPerDay(
      w.filter((x) => assignCat(x.lb, cats) === i).map((x) => x.t),
      now,
      days,
    ),
  );
}

export function litterStatus(s: { online: boolean; state: string; code: string; drawerPct: number }): Status {
  if (!s.online) return { label: "Offline", tone: "error" };
  if (DRAWER_FULL.includes(s.code)) return { label: "Drawer full", tone: "error" };
  if (FAULTS[s.code]) return { label: FAULTS[s.code], tone: "error" };
  if (s.state === "error") return { label: "Needs attention", tone: "error" };
  if (s.drawerPct > 80) return { label: "Drawer full", tone: "error" };
  if (s.drawerPct > 75 || DRAWER_ALMOST.includes(s.code)) return { label: "Drawer almost full", tone: "warn" };
  if (s.state === "cleaning" || CYCLING.includes(s.code)) return { label: "Cycling", tone: "active" };
  if (CAT_INSIDE.includes(s.code)) return { label: "Cat inside", tone: "active" };
  if (s.state === "paused" || s.code === "p") return { label: "Paused", tone: "warn" };
  return { label: "Ready", tone: "ok" };
}

/**
 * Each cat's average weight per local day (plotted at local noon), last `days` days. Days with
 * no weighing for that cat are left out rather than drawn as zero.
 */
export function dailyWeights(w: Weighing[], cats: Cat[], now: number, days: number): { t: number; v: number }[][] {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (days - 1)).getTime();
  return cats.map((_, c) => {
    const byDay = new Map<number, number[]>();
    for (const x of w) {
      if (x.t < start || assignCat(x.lb, cats) !== c) continue;
      const day = new Date(x.t);
      const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime();
      byDay.set(noon, [...(byDay.get(noon) ?? []), x.lb]);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([t, lbs]) => ({ t, v: Math.round((lbs.reduce((s, v) => s + v, 0) / lbs.length) * 100) / 100 }));
  });
}
