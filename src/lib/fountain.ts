import { sumPerDay, type ValuePoint } from "./history";
import type { Status } from "./tone";

/** A rise bigger than this between two samples is someone refilling the tank. */
export const REFILL_JUMP_G = 100;

export function fountainStatus(f: { online: boolean; empty: boolean; low: boolean }): Status {
  if (!f.online) return { label: "Offline", tone: "error" };
  if (f.empty) return { label: "Refill now", tone: "error" };
  if (f.low) return { label: "Water low", tone: "warn" };
  return { label: "Water OK", tone: "ok" };
}

/**
 * Why the motor is or isn't running. `wanted` is the Pump switch; the firmware holds the
 * motor off while the tank is below its empty threshold, and on battery in a radar mode
 * until a cat is detected.
 */
export function pumpReason(p: { running: boolean; wanted: boolean; empty: boolean }): string {
  if (p.running) return "Pump running";
  if (!p.wanted) return "Pump off";
  if (p.empty) return "Pump stopped";
  return "Waiting for a cat";
}

/**
 * Water used per local day (drinking plus evaporation), oldest first: the net drop in weight
 * across each day, with refills left out so they neither count nor cancel the drinking.
 * Small rises (sloshing, a cat leaning on it) stay in, so they cancel the matching dips.
 */
export function waterUsedPerDay(points: ValuePoint[], now: number, days: number): number[] {
  const deltas: ValuePoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = points[i].v - points[i - 1].v;
    if (d <= REFILL_JUMP_G) deltas.push({ t: points[i].t, v: d });
  }
  return sumPerDay(deltas, now, days).map((net) => Math.max(0, -net));
}
