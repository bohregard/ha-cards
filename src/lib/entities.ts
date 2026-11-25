import type { EntityEntry } from "./vacuum";

/**
 * Another entity on the same device as `anchorId`, in `domain`, identified by `key`:
 * its translation key when the integration sets one (Litter-Robot), otherwise the end of
 * its entity id (`<domain>.<anything>_<key>`), which is how ESPHome entities are named.
 */
export function findOnDevice(
  entities: Record<string, EntityEntry>,
  anchorId: string,
  domain: string,
  key: string,
): string | undefined {
  const device = entities[anchorId]?.device_id;
  if (!device) return undefined;
  const mine = Object.values(entities).filter((e) => e.device_id === device && e.entity_id.startsWith(`${domain}.`));
  return (
    mine.find((e) => e.translation_key === key)?.entity_id ??
    mine.find((e) => e.entity_id.endsWith(`_${key}`))?.entity_id
  );
}
