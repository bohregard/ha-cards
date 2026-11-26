import type { PetTone } from "./tone";

export type AirTone = Extract<PetTone, "ok" | "warn" | "error">;

export interface AirLevel {
  tone: AirTone;
  label: string;
}

/** Short words for a small card, by the full label. */
const SHORT: Record<string, string> = { "Unhealthy for sensitive groups": "unhealthy for some" };

/** PM2.5 in µg/m³ against the 2024 EPA AQI breakpoints. */
export function pm25Level(v: number): AirLevel {
  if (v <= 9) return { tone: "ok", label: "Good" };
  if (v <= 35.4) return { tone: "warn", label: "Moderate" };
  if (v <= 55.4) return { tone: "error", label: "Unhealthy for sensitive groups" };
  return { tone: "error", label: "Unhealthy" };
}

/** Sensirion VOC index: 100 is the room's own average; above 150 is more than usual. */
export function vocLevel(v: number): AirLevel {
  if (v <= 150) return { tone: "ok", label: "Normal" };
  if (v <= 250) return { tone: "warn", label: "Elevated" };
  return { tone: "error", label: "High" };
}

const RANK: Record<AirTone, number> = { ok: 0, warn: 1, error: 2 };

/** One line for a room's air: "Air good", or the worst reading with its value. */
export function airSummary(r: { pm25?: number; voc?: number }): { tone: AirTone; text: string } | undefined {
  const readings = [
    r.pm25 === undefined ? undefined : { name: "PM2.5", v: r.pm25, ...pm25Level(r.pm25) },
    r.voc === undefined ? undefined : { name: "VOC", v: r.voc, ...vocLevel(r.voc) },
  ].filter((x) => x !== undefined);
  if (!readings.length) return undefined;
  const worst = readings.reduce((a, b) => (RANK[b.tone] > RANK[a.tone] ? b : a));
  if (worst.tone === "ok") return { tone: "ok", text: "Air good" };
  return { tone: worst.tone, text: `${worst.name} ${Math.round(worst.v)} · ${SHORT[worst.label] ?? worst.label.toLowerCase()}` };
}
