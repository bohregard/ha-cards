import { LitElement, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { findOnDevice } from "../lib/entities";
import type { Hass, HassEntity } from "../lib/hass";

export const CONFIRM_MS = 4000;
const NO_READING = ["unavailable", "unknown", ""];
const REFRESH_MS = 5 * 60_000;

export interface PetCardConfig {
  type: string;
  entity: string;
  name?: string;
}

/**
 * What the feeder, fountain and litter cards share: sibling lookup on the device, the
 * two-tap confirm, a settings view toggle, and history that is fetched when `historyKey()`
 * changes or every 5 minutes, never on every `hass` update.
 */
export abstract class PetCard<C extends PetCardConfig> extends LitElement {
  @property({ attribute: false }) hass?: Hass;
  @state() protected config?: C;
  /** The action waiting for its second tap. */
  @state() protected confirming?: string;
  @state() protected settings = false;
  private confirmTimer?: number;
  private refreshTimer?: number;
  private loadedKey?: string;
  private loading = false;

  /** Entities whose changes re-render the card. */
  protected abstract watched(): (string | undefined)[];

  /** Changes when the history should be fetched again (e.g. a new feed). */
  protected historyKey(): string {
    return "";
  }

  protected async loadHistory(): Promise<void> {}

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback() {
    super.connectedCallback();
    this.refreshTimer = window.setInterval(() => this.refresh(true), REFRESH_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.refreshTimer);
    window.clearTimeout(this.confirmTimer);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as Hass | undefined;
    if (!old || !this.hass) return true;
    return this.watched().some((id) => !!id && old.states[id] !== this.hass!.states[id]);
  }

  protected updated() {
    this.refresh(false);
  }

  private async refresh(force: boolean) {
    if (!this.hass || !this.config || this.loading) return;
    const key = this.historyKey();
    if (!force && this.loadedKey === key) return;
    this.loading = true;
    this.loadedKey = key;
    try {
      await this.loadHistory();
    } catch (err) {
      console.warn(`${this.localName}: couldn't load history`, err);
    } finally {
      this.loading = false;
    }
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

  protected st(id?: string): HassEntity | undefined {
    return id ? this.hass?.states[id] : undefined;
  }

  /** The state, or undefined while there is no reading. */
  protected val(id?: string): string | undefined {
    const s = this.st(id)?.state;
    return s === undefined || NO_READING.includes(s) ? undefined : s;
  }

  protected num(id?: string): number | undefined {
    const v = Number(this.val(id));
    return this.val(id) === undefined || !Number.isFinite(v) ? undefined : v;
  }

  protected on(id?: string): boolean {
    return this.st(id)?.state === "on";
  }

  protected language(): string | undefined {
    return this.hass?.locale?.language;
  }

  protected call(domain: string, service: string, data: Record<string, unknown>) {
    return this.hass?.callService(domain, service, data);
  }

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

  protected toggle(id: string | undefined) {
    if (id) this.call(id.split(".")[0], this.on(id) ? "turn_off" : "turn_on", { entity_id: id });
  }

  protected press(id: string | undefined) {
    if (id) this.call("button", "press", { entity_id: id });
  }

  protected select(id: string | undefined, option: string) {
    if (id) this.call("select", "select_option", { entity_id: id, option });
  }
}
