import { statusTone } from "./status";

/**
 * What the compact vacuum card says: a headline for what the robot is doing (or its worst
 * problem), the one action its icon offers, when it runs next and which parts are running low.
 */

export type SummaryTone = "active" | "ok" | "warn" | "error" | "idle";

export interface Problem {
  text: string;
  tone: "warn" | "error";
}

export interface VacuumSummary {
  tone: SummaryTone;
  headline: string;
  /** What tapping the icon does: pause a clean, or send it back to the dock. */
  action?: "pause" | "home";
  /** Cleaning, paused mid-clean or heading home: the card shows the run's progress. */
  running: boolean;
  /** Worst first. */
  problems: Problem[];
}

export interface SummaryInput {
  state: string;
  attrs: { error?: unknown; has_error?: unknown; charging?: unknown };
  /** The room it's in, while it runs. */
  room?: string;
  /** Tank, bag and water statuses (label and raw state). */
  dock?: { label: string; state: string }[];
  /** Consumables and how much is left, in percent. */
  parts?: { label: string; pct: number }[];
}

const OFFLINE = ["unavailable", "unknown", ""];
const human = (s: string) => s.replace(/_/g, " ");

export function vacuumSummary(i: SummaryInput): VacuumSummary {
  if (OFFLINE.includes(i.state)) {
    return { tone: "error", headline: "Offline", running: false, problems: [{ text: "Offline", tone: "error" }] };
  }
  const failed = i.state === "error" || i.attrs.has_error === true;
  const errorText = typeof i.attrs.error === "string" && i.attrs.error !== "No error" ? i.attrs.error : "Needs help";
  const problems: Problem[] = [
    ...(failed ? [{ text: errorText, tone: "error" as const }] : []),
    ...(i.dock ?? []).filter((d) => statusTone(d.state) === "warn").map((d) => ({ text: `${d.label}: ${human(d.state)}`, tone: "warn" as const })),
    ...(i.parts ?? []).filter((p) => p.pct < 10).map((p) => ({ text: `${p.label} ${Math.round(p.pct)}% left`, tone: "warn" as const })),
  ];

  let base: Omit<VacuumSummary, "problems">;
  switch (i.state) {
    case "cleaning":
      base = { tone: "active", headline: i.room ? `Cleaning ${i.room}` : "Cleaning", action: "pause", running: true };
      break;
    case "paused":
      base = { tone: "idle", headline: i.room ? `Paused in ${i.room}` : "Paused", action: "home", running: true };
      break;
    case "returning":
      base = { tone: "active", headline: "Heading home", running: true };
      break;
    case "docked":
      base = { tone: "ok", headline: i.attrs.charging === true ? "Docked · charging" : "Docked", running: false };
      break;
    case "error":
      base = { tone: "error", headline: errorText, running: false };
      break;
    default:
      base = { tone: "idle", headline: "Stopped off the dock", action: "home", running: false };
  }

  if (failed) return { tone: "error", headline: errorText, running: base.running, problems };
  // While it runs, what it's doing stays the headline; problems are listed under it.
  if (problems.length && !base.running) return { ...base, tone: problems[0].tone, headline: problems[0].text, problems };
  return { ...base, problems };
}

export interface ScheduleTask {
  enabled?: boolean;
  invalid?: boolean;
  time?: string;
  repeats?: string;
  once?: boolean;
  options?: string[] | null;
}

export interface NextRun {
  /** When it starts, if the task runs every day or once; otherwise only `time` is known. */
  at?: number;
  /** "14:00". */
  time: string;
  rooms: string[];
}

type RoomMap = Record<string, { id: number; name: string }[]>;

/**
 * The next scheduled clean from the robot's own schedule. Dreame doesn't document which
 * character of `repeats` is which weekday, so only every-day and one-off tasks get a date.
 */
export function nextScheduled(tasks: ScheduleTask[] | undefined, rooms: RoomMap | undefined, selectedMap: string | undefined, now: number): NextRun | undefined {
  const list = (selectedMap && rooms?.[selectedMap]) || Object.values(rooms ?? {})[0] || [];
  const names = new Map(list.map((r) => [String(r.id), r.name]));
  const runs: NextRun[] = [];
  for (const t of tasks ?? []) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.time ?? "");
    if (!t.enabled || t.invalid || !m) continue;
    const rooms = (t.options ?? []).map((id) => names.get(id)).filter((n): n is string => !!n);
    const run: NextRun = { time: t.time!, rooms };
    if (t.once || t.repeats === "1111111") {
      const d = new Date(now);
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      if (d.getTime() <= now) d.setDate(d.getDate() + 1);
      run.at = d.getTime();
    }
    runs.push(run);
  }
  const dated = runs.filter((r) => r.at !== undefined).sort((a, b) => a.at! - b.at!);
  return dated[0] ?? runs.sort((a, b) => minutes(a.time) - minutes(b.time))[0];
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** "14:00" as the locale writes it ("2:00 PM"). */
export function clock(hhmm: string, lang?: string): string {
  const d = new Date(2000, 0, 1);
  d.setHours(0, minutes(hhmm), 0, 0);
  return d.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });
}

/** Parts from 10% up to 20%: worth knowing before they become a problem. */
export function lowParts(parts: { label: string; pct: number }[]): string[] {
  return parts.filter((p) => p.pct >= 10 && p.pct < 20).map((p) => `${p.label} ${Math.round(p.pct)}%`);
}

/** "41 min · 25 m²", "1 h 5 min · 40 m²". */
export function runFacts(mins: number | undefined, area: number | undefined, unit: string | undefined): string {
  const parts: string[] = [];
  if (mins !== undefined) {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    parts.push(h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`);
  }
  if (area !== undefined) parts.push(`${Math.round(area)} ${unit ?? "m²"}`);
  return parts.join(" · ");
}
