/**
 * Washer and dryer state from a "running" entity (a plug's binary sensor, or a helper set from a
 * power reading) and, when it reports a cycle, an LG ThinQ appliance sensor (smartthinq_sensors:
 * `run_state`, `current_course`, `remain_time`/`initial_time` as H:MM:SS, `error_state`/
 * `error_message`, and on washers `door_open`).
 */
import { ago } from "./format";
import type { HassEntity } from "./hass";
import type { StatePoint } from "./history";

export type LaundryTone = "error" | "warn" | "active" | "ok" | "idle";
/** `unload`: done, and the door hasn't been opened since. */
export type LaundryState = "error" | "unload" | "running" | "done" | "idle";

export interface RunTimes {
  /** When the current run began (epoch ms); absent when not running or unknown. */
  since?: number;
  /** When the last run ended. */
  finished?: number;
}

export interface MachineInput {
  name: string;
  running: boolean;
  times: RunTimes;
  watts?: number;
  appliance?: HassEntity;
  now: number;
  /** How long "Done" lasts before the machine reads idle. */
  doneMs: number;
}

export interface MachineStatus {
  state: LaundryState;
  tone: LaundryTone;
  line: string;
  /** How long it has been running, e.g. "42 min". */
  elapsed?: string;
  /** LG's course and phase ("Normal · Rinsing"), or when it finished. */
  detail?: string;
  /** Minutes left, from LG. */
  left?: number;
  /** 0–1, from LG's initial and remaining time. */
  progress?: number;
  /** Watts while running. */
  power?: number;
  /** Running, with an LG appliance configured that reports no cycle (e.g. offline in ThinQ). */
  noDetails: boolean;
}

const MIN = 60_000;
const NO_VALUE = ["", "-", "none", "not selected"];

/**
 * When the current run began and the last one ended, from the running entity's history.
 * `unavailable`/`unknown` rows (HA restarts) are skipped, so a blip doesn't split a run. `live`,
 * the entity's state now (t = its last_changed), counts as a last row: history can lag a few
 * seconds behind a start or finish.
 */
export function runTimes(rows: StatePoint[], live?: StatePoint): RunTimes {
  let prev: string | undefined;
  let since: number | undefined;
  let finished: number | undefined;
  for (const { t, s } of live ? [...rows, live] : rows) {
    if ((s !== "on" && s !== "off") || s === prev) continue;
    if (s === "on") since = t;
    else if (prev === "on") finished = t;
    prev = s;
  }
  return { since: prev === "on" ? since : undefined, finished };
}

/** LG's "H:MM:SS" as whole minutes. */
export function parseDuration(v: unknown): number | undefined {
  const m = typeof v === "string" ? /^(\d+):(\d{2}):(\d{2})$/.exec(v.trim()) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

/** "42 min", "1 h", "1 h 5 min". */
export function minutesText(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function text(v: unknown): string | undefined {
  return typeof v === "string" && !NO_VALUE.includes(v.trim().toLowerCase()) ? v.trim() : undefined;
}

/** LG's current cycle, only while it reports one. */
export function lgCycle(e?: HassEntity): { course?: string; phase: string; left?: number; progress?: number } | undefined {
  if (e?.state !== "on") return undefined;
  const phase = text(e.attributes.run_state);
  if (!phase) return undefined;
  const left = parseDuration(e.attributes.remain_time);
  const total = parseDuration(e.attributes.initial_time);
  const progress = left !== undefined && total ? Math.min(1, Math.max(0, (total - left) / total)) : undefined;
  return { course: text(e.attributes.current_course), phase, left, progress };
}

function lgError(e?: HassEntity): string | undefined {
  if (e?.attributes.error_state !== "on") return undefined;
  return text(e.attributes.error_message) ?? "Error";
}

/** The washer door, when LG has updated since the run finished. */
function doorSince(e: HassEntity | undefined, finished: number): "open" | "closed" | undefined {
  const door = e?.attributes.door_open;
  const updated = Date.parse(e?.last_updated ?? "");
  if ((door !== "on" && door !== "off") || !Number.isFinite(updated) || updated < finished) return undefined;
  return door === "on" ? "open" : "closed";
}

export function machineStatus(m: MachineInput): MachineStatus {
  const error = lgError(m.appliance);
  if (error) return { state: "error", tone: "error", line: `Error · ${error}`, noDetails: false };

  if (m.running) {
    const elapsed = m.times.since !== undefined ? minutesText(Math.max(0, (m.now - m.times.since) / MIN)) : undefined;
    const cycle = lgCycle(m.appliance);
    const detail = cycle ? [cycle.course, cycle.phase].filter(Boolean).join(" · ") : undefined;
    return {
      state: "running", tone: "active", line: elapsed ? `Running · ${elapsed}` : "Running", elapsed, detail,
      left: cycle?.left, progress: cycle?.progress,
      power: m.watts !== undefined ? Math.round(m.watts) : undefined,
      noDetails: !!m.appliance && !cycle,
    };
  }

  const { finished } = m.times;
  if (finished !== undefined && m.now - finished < m.doneMs) {
    const done = `Done ${ago(finished, m.now)}`;
    const door = doorSince(m.appliance, finished);
    if (door === "closed") return { state: "unload", tone: "warn", line: "Waiting to be unloaded", detail: done, noDetails: false };
    if (door !== "open") return { state: "done", tone: "ok", line: done, noDetails: false };
  }
  return { state: "idle", tone: "idle", line: "Idle", noDetails: false };
}

const RANK: LaundryState[] = ["error", "unload", "running", "done"];

/** The card's one line: an error, then an unload, then a run, then a finished run. */
export function headline(ms: { name: string; status: MachineStatus }[]): { tone: LaundryTone; text: string } {
  for (const state of RANK) {
    const hit = ms.find((m) => m.status.state === state);
    if (!hit) continue;
    const { name, status: s } = hit;
    if (state === "error") return { tone: s.tone, text: `${name} error · ${s.line.replace(/^Error · /, "")}` };
    if (state === "unload") return { tone: s.tone, text: `${name} done · waiting to be unloaded` };
    if (state === "running") {
      const text = s.left !== undefined ? `${name} · ${minutesText(s.left)} left`
        : `${name} running${s.elapsed ? ` · ${s.elapsed}` : ""}`;
      return { tone: s.tone, text };
    }
    return { tone: s.tone, text: `${name} ${s.line.charAt(0).toLowerCase()}${s.line.slice(1)}` };
  }
  return { tone: "idle", text: ms.length === 2 ? "Both idle" : ms.length > 2 ? "All idle" : "Idle" };
}
