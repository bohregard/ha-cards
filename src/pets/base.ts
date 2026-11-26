import { state } from "lit/decorators.js";
import { BaseCard } from "../lib/base-card";
import { findOnDevice } from "../lib/entities";


export interface PetCardConfig {
  type: string;
  entity: string;
  name?: string;
}

/**
 * What the feeder, fountain and litter cards add to `BaseCard`: sibling lookup on the
 * device and a settings view toggle.
 */
export abstract class PetCard<C extends PetCardConfig> extends BaseCard<C> {
  @state() protected settings = false;

  protected sib(domain: string, key: string): string | undefined {
    if (!this.hass?.entities || !this.config) return undefined;
    // The registry object only changes when entities are added or renamed; cache per (registry, anchor).
    if (this.sibSource !== this.hass.entities || this.sibAnchor !== this.config.entity) {
      this.sibCache.clear();
      this.sibSource = this.hass.entities;
      this.sibAnchor = this.config.entity;
    }
    const k = `${domain}|${key}`;
    if (!this.sibCache.has(k)) this.sibCache.set(k, findOnDevice(this.hass.entities, this.config.entity, domain, key));
    return this.sibCache.get(k);
  }
  private sibCache = new Map<string, string | undefined>();
  private sibSource?: object;
  private sibAnchor?: string;

  protected setNumber(id: string | undefined, value: number) {
    if (id) this.call("number", "set_value", { entity_id: id, value });
  }

  protected press(id: string | undefined) {
    if (id) this.call("button", "press", { entity_id: id });
  }

  protected select(id: string | undefined, option: string) {
    if (id) this.call("select", "select_option", { entity_id: id, option });
  }
}
