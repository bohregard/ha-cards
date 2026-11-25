import type { StatePoint } from "./history";
import type { Status } from "./tone";

export interface Feed {
  /** When the food was dispensed, epoch ms. */
  at: number;
  scoops: number;
}

export interface Meal {
  /** "HH:MM" (the time entity's state may carry seconds; only HH:MM is read). */
  time: string;
  scoops: number;
}

export interface FoodEstimate {
  leftGrams: number;
  /** 0..1 of a full hopper. */
  fraction: number;
  /** At the last 7 days' rate; undefined when nothing was dispensed in that time. */
  daysLeft?: number;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** The scoop count is published a few seconds after "last fed"; accept it up to this late. */
const SCOOPS_LAG = MINUTE;
/** A feed this close to a scheduled meal is that meal. */
const MEAL_WINDOW_MIN = 2;

/**
 * Feeds from the history of the feeder's "last fed" timestamp sensor and its "dispensed
 * scoops" sensor. A feed is each distinct last-fed value (a reconnect republishes the same one).
 */
export function feedsFromHistory(lastFed: StatePoint[], scoops: StatePoint[]): Feed[] {
  const seen = new Set<string>();
  const feeds: Feed[] = [];
  for (const { s } of lastFed) {
    const at = Date.parse(s);
    if (Number.isNaN(at) || seen.has(s)) continue;
    seen.add(s);
    let n = 0;
    for (const row of scoops) {
      if (row.t > at + SCOOPS_LAG) break;
      const v = Number(row.s);
      if (Number.isFinite(v)) n = v;
    }
    feeds.push({ at, scoops: n });
  }
  return feeds;
}

/** Food left after the scoops dispensed since the hopper was last marked refilled. */
export function foodEstimate(o: {
  feeds: Feed[];
  refillAt?: number;
  hopperGrams: number;
  gramsPerScoop: number;
  now: number;
}): FoodEstimate | undefined {
  if (o.refillAt === undefined) return undefined;
  const used = o.feeds.filter((f) => f.at > o.refillAt!).reduce((sum, f) => sum + f.scoops, 0) * o.gramsPerScoop;
  const leftGrams = Math.max(0, o.hopperGrams - used);
  const week = o.feeds.filter((f) => f.at > o.now - 7 * DAY).reduce((sum, f) => sum + f.scoops, 0) * o.gramsPerScoop;
  return {
    leftGrams,
    fraction: o.hopperGrams > 0 ? leftGrams / o.hopperGrams : 0,
    daysLeft: week > 0 ? leftGrams / (week / 7) : undefined,
  };
}

function minutesOf(time: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

/** The index of the scheduled meal a feed belongs to, or undefined for a manual feed. */
export function feedKind(at: number, meals: Meal[]): number | undefined {
  const d = new Date(at);
  const mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const i = meals.findIndex((meal) => {
    const m = minutesOf(meal.time);
    if (m === undefined || meal.scoops <= 0) return false;
    const diff = Math.abs(mins - m);
    return Math.min(diff, 1440 - diff) <= MEAL_WINDOW_MIN;
  });
  return i >= 0 ? i : undefined;
}

/** The next scheduled meal that dispenses food, today or tomorrow. */
export function nextMeal(meals: Meal[], now: number): { index: number; at: number; scoops: number } | undefined {
  const d = new Date(now);
  let best: { index: number; at: number; scoops: number } | undefined;
  meals.forEach((meal, index) => {
    const m = minutesOf(meal.time);
    if (m === undefined || meal.scoops <= 0) return;
    let at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60).getTime();
    if (at <= now) at = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, Math.floor(m / 60), m % 60).getTime();
    if (!best || at < best.at) best = { index, at, scoops: meal.scoops };
  });
  return best;
}

/** Worst problem first, the same order as the Home dashboard's feeder flags. */
export function feederStatus(f: { online: boolean; jammed: boolean; empty: boolean; low: boolean }): Status {
  if (!f.online) return { label: "Offline", tone: "error" };
  if (f.jammed) return { label: "Jammed", tone: "error" };
  if (f.empty) return { label: "Out of food", tone: "error" };
  if (f.low) return { label: "Food low", tone: "warn" };
  return { label: "Food OK", tone: "ok" };
}
