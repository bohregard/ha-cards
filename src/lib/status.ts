import { findSibling, type EntityEntry } from "./vacuum";

export type PartTone = "ok" | "warn" | "error";

export interface ConsumablePart {
  key: string;
  label: string;
  /** Percent-left sensor. */
  level: string;
  /** Time-left sensor, if the integration has one. */
  remaining?: string;
  /** Reset button, if the integration has one. */
  reset?: string;
}

/** Dreame translation keys for each part: [key, label, level, time left, reset]. */
const PARTS: [string, string, string, string, string][] = [
  ["main_brush", "Main brush", "main_brush_left", "main_brush_time_left", "reset_main_brush"],
  ["side_brush", "Side brush", "side_brush_left", "side_brush_time_left", "reset_side_brush"],
  ["filter", "Filter", "filter_left", "filter_time_left", "reset_filter"],
  ["sensor", "Sensors", "sensor_dirty_left", "sensor_dirty_time_left", "reset_sensor"],
  ["wheel", "Wheel", "wheel_dirty_left", "wheel_dirty_time_left", "reset_wheel"],
  ["scale_inhibitor", "Scale inhibitor", "scale_inhibitor_left", "scale_inhibitor_time_left", "reset_scale_inhibitor"],
];

/** Dock and tank status sensors: [translation key, label]. */
export const DOCK_SENSORS: [string, string][] = [
  ["self_wash_base_status", "Base"],
  ["auto_empty_status", "Auto-empty"],
  ["clean_water_tank_status", "Clean water tank"],
  ["dirty_water_tank_status", "Dirty water tank"],
  ["dust_bag_status", "Dust bag"],
  ["detergent_status", "Detergent"],
  ["hot_water_status", "Hot water"],
  ["station_drainage_status", "Drainage"],
  ["low_water_warning", "Water level"],
];

/** The consumables this vacuum has, with their sensors and reset buttons. */
export function consumableParts(entities: Record<string, EntityEntry>, vacuumId: string): ConsumablePart[] {
  const parts: ConsumablePart[] = [];
  for (const [key, label, level, remaining, reset] of PARTS) {
    const levelId = findSibling(entities, vacuumId, "sensor", level);
    if (!levelId) continue;
    parts.push({
      key,
      label,
      level: levelId,
      remaining: findSibling(entities, vacuumId, "sensor", remaining),
      reset: findSibling(entities, vacuumId, "button", reset),
    });
  }
  return parts;
}

const HOURS_PER: Record<string, number> = { min: 1 / 60, h: 1, d: 24 };

/** "17 h", "12 days", "18 months" or "Due now"; undefined when the value or unit is unreadable. */
export function formatRemaining(value: number, unit: string): string | undefined {
  const per = HOURS_PER[unit];
  if (per === undefined || !Number.isFinite(value)) return undefined;
  const hours = value * per;
  if (hours <= 0) return "Due now";
  if (hours < 48) return `${Math.max(1, Math.round(hours))} h`;
  const days = hours / 24;
  if (days < 60) return `${Math.round(days)} days`;
  return `${Math.round(days / 30.44)} months`;
}

/** Ember under 10%, amber under 20%. */
export function partTone(pct: number): PartTone {
  if (pct < 10) return "error";
  if (pct < 20) return "warn";
  return "ok";
}

const FINE = new Set(["installed", "enabled", "idle", "no_warning", "available", "completed", "disabled"]);

/** "ok" for a normal dock state, "warn" for anything else, undefined when there's no reading. */
export function statusTone(state: string): Exclude<PartTone, "error"> | undefined {
  if (!state || state === "unavailable" || state === "unknown") return undefined;
  return FINE.has(state) ? "ok" : "warn";
}

/** "Today", "Yesterday", a weekday within the last week, else a short date. */
export function dayLabel(when: Date, now: Date, locale?: string): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(when)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return when.toLocaleDateString(locale, { weekday: "short" });
  return when.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
