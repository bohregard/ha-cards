import type { Hass } from "./hass";

/** A recorded state: `t` is epoch ms. */
export interface StatePoint {
  t: number;
  s: string;
}

/** A numeric sample (statistics mean): `t` is the period start, epoch ms. */
export interface ValuePoint {
  t: number;
  v: number;
}

interface CompressedRow {
  s: string;
  /** Attributes, when they were asked for. */
  a?: Record<string, unknown>;
  lu: number;
  lc?: number;
}

interface StatisticsRow {
  start: number;
  mean?: number | null;
  min?: number | null;
  max?: number | null;
  /** The last state in the period; all HA keeps for running totals (state_class total). */
  state?: number | null;
}

export type StatisticField = "mean" | "min" | "max" | "state";

/** Rows of `history/history_during_period` (compressed format) for one entity. */
export function parseHistory(resp: Record<string, CompressedRow[]>, entityId: string): StatePoint[] {
  return (resp[entityId] ?? []).map((r) => ({ t: Math.round((r.lc ?? r.lu) * 1000), s: r.s }));
}

/** Rows of `recorder/statistics_during_period` for one statistic, keeping those with the field (mean by default). */
export function parseStatistics(
  resp: Record<string, StatisticsRow[]>,
  statisticId: string,
  field: StatisticField = "mean",
): ValuePoint[] {
  return (resp[statisticId] ?? [])
    .filter((r) => typeof r[field] === "number")
    .map((r) => ({ t: r.start, v: r[field] as number }));
}

/** When a binary sensor turned on. A sensor already on at the start of the window doesn't count. */
export function onTimes(rows: StatePoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].s === "on" && rows[i - 1].s !== "on") out.push(rows[i].t);
  }
  return out;
}

/** Local-day keys for the last `days` days, oldest first, ending with today. */
function dayKeys(now: number, days: number): string[] {
  const d = new Date(now);
  return Array.from({ length: days }, (_, i) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() - (days - 1 - i)).toDateString(),
  );
}

/** Sum of `v` per local day for the last `days` days, oldest first. */
export function sumPerDay(items: ValuePoint[], now: number, days: number): number[] {
  const keys = dayKeys(now, days);
  const sums = keys.map(() => 0);
  for (const { t, v } of items) {
    const i = keys.indexOf(new Date(t).toDateString());
    if (i >= 0) sums[i] += v;
  }
  return sums;
}

/** How many times fall on each local day for the last `days` days, oldest first. */
export function countPerDay(times: number[], now: number, days: number): number[] {
  return sumPerDay(
    times.map((t) => ({ t, v: 1 })),
    now,
    days,
  );
}

const iso = (t: number) => new Date(t).toISOString();

/**
 * State history for some entities. `includeStart` adds the state each one had when the window
 * began (wanted for levels, not for event-like sensors whose every change is an event).
 */
export async function fetchHistory(
  hass: Pick<Hass, "callWS">,
  ids: string[],
  start: number,
  end: number,
  includeStart: boolean,
): Promise<Record<string, StatePoint[]>> {
  const resp = await hass.callWS<Record<string, CompressedRow[]>>({
    type: "history/history_during_period",
    start_time: iso(start),
    end_time: iso(end),
    entity_ids: ids,
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
    include_start_time_state: includeStart,
  });
  return Object.fromEntries(ids.map((id) => [id, parseHistory(resp ?? {}, id)]));
}

/**
 * One entity's history rows with their attributes (e.g. a thermostat's temperature and action),
 * including the state it had when the window began.
 */
export async function fetchRowsWithAttributes(
  hass: Pick<Hass, "callWS">,
  id: string,
  start: number,
  end: number,
): Promise<CompressedRow[]> {
  const resp = await hass.callWS<Record<string, CompressedRow[]>>({
    type: "history/history_during_period",
    start_time: iso(start),
    end_time: iso(end),
    entity_ids: [id],
    minimal_response: false,
    no_attributes: false,
    significant_changes_only: false,
    include_start_time_state: true,
  });
  return resp?.[id] ?? [];
}

/** Long-term (hourly) or short-term (5-minute) statistics for some sensors: the mean, or `field`. */
export async function fetchStatistics(
  hass: Pick<Hass, "callWS">,
  ids: string[],
  start: number,
  end: number,
  period: "5minute" | "hour",
  field: StatisticField = "mean",
): Promise<Record<string, ValuePoint[]>> {
  const resp = await hass.callWS<Record<string, StatisticsRow[]>>({
    type: "recorder/statistics_during_period",
    start_time: iso(start),
    end_time: iso(end),
    statistic_ids: ids,
    period,
    types: [field],
  });
  return Object.fromEntries(ids.map((id) => [id, parseStatistics(resp ?? {}, id, field)]));
}
