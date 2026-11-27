export interface EntityEntry {
  entity_id: string;
  device_id?: string;
  translation_key?: string;
}

export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

export type Tone = "active" | "ok" | "error" | "idle";

const PER_ROOM = /_room_\d+_/;

/**
 * The entity on the vacuum's device with this domain and translation key.
 * Dreame also makes per-room entities with the same key (select.x_room_1_suction_level);
 * those are skipped so the device-wide one is returned.
 */
export function findSibling(
  entities: Record<string, EntityEntry>,
  vacuumId: string,
  domain: string,
  key: string,
): string | undefined {
  const device = entities[vacuumId]?.device_id;
  if (!device) return undefined;
  return Object.values(entities).find(
    (e) =>
      e.device_id === device &&
      e.translation_key === key &&
      e.entity_id.startsWith(`${domain}.`) &&
      !PER_ROOM.test(e.entity_id),
  )?.entity_id;
}

/** Clean the selected rooms, or the whole map when none are selected. */
export function cleanCall(vacuumId: string, segments: number[]): ServiceCall {
  if (segments.length === 0) {
    return { domain: "vacuum", service: "start", data: { entity_id: vacuumId } };
  }
  return {
    domain: "dreame_vacuum",
    service: "vacuum_clean_segment",
    data: { entity_id: vacuumId, segments },
  };
}

/** Lamplight colour role for a vacuum state: amber active, sage ok, ember error. */
export function stateTone(state: string, attrs: Record<string, unknown>): Tone {
  if (state === "error" || attrs.has_error === true) return "error";
  if (state === "cleaning" || state === "returning") return "active";
  if (state === "docked") return "ok";
  return "idle";
}

/** The battery icon for a level, rounded to the nearest ten, with the charging variant. */
export function batteryIcon(pct: number, charging: boolean): string {
  const step = Math.round(pct / 10) * 10;
  const base = charging ? "mdi:battery-charging" : "mdi:battery";
  if (step >= 100) return charging ? "mdi:battery-charging-100" : "mdi:battery";
  if (step <= 0) return charging ? "mdi:battery-charging-outline" : "mdi:battery-outline";
  return `${base}-${step}`;
}
