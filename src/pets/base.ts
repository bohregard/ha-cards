import { state } from "lit/decorators.js";
import { BaseCard } from "../lib/base-card";
import { findOnDevice } from "../lib/entities";

export const CONFIRM_MS = 4000;

export interface PetCardConfig {
  type: string;
  entity: string;
  name?: string;
}

/**
 * What the feeder, fountain and litter cards add to `BaseCard`: sibling lookup on the
 * device, the two-tap confirm and a settings view toggle.
 */
export abstract class PetCard<C extends PetCardConfig> extends BaseCard<C> {
  /** The action waiting for its second tap. */
  @state() protected confirming?: string;
  @state() protected settings = false;
  private confirmTimer?: number;

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.confirmTimer);
  }

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

  /** First tap arms `key` for 4 s; a second tap runs it. */
  protected confirm(key: string, run: () => void) {
    if (this.confirming !== key) {
      window.clearTimeout(this.confirmTimer);
      this.confirming = key;
      this.confirmTimer = window.setTimeout(() => (this.confirming = undefined), CONFIRM_MS);
      return;
    }
    window.clearTimeout(this.confirmTimer);
    this.confirming = undefined;
    run();
  }

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
