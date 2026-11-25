import type { EntityEntry } from "./vacuum";

/** The slice of Home Assistant's frontend `hass` object these cards use. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated: string;
}

export interface Hass {
  states: Record<string, HassEntity>;
  entities: Record<string, EntityEntry>;
  locale?: { language: string };
  callService(domain: string, service: string, data: Record<string, unknown>): Promise<unknown>;
  callWS<T = unknown>(msg: Record<string, unknown>): Promise<T>;
  formatEntityState?(entity: HassEntity, state?: string): string;
  hassUrl(path: string): string;
}
