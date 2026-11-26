export const OBJECTS = ["person", "cat", "dog"];

/**
 * What Frigate sees right now in a room: each object whose
 * `binary_sensor.<camera>_<object>_occupancy` is on for any of the room's cameras.
 */
export function detections(
  states: Record<string, { state: string } | undefined>,
  cameras: string[],
  objects: string[] = OBJECTS,
): string[] {
  return objects.filter((o) => cameras.some((c) => states[`binary_sensor.${c}_${o}_occupancy`]?.state === "on"));
}
