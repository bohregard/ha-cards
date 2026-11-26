import { LitElement, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import type { Hass, HassEntity } from "./hass";

const NO_READING = ["unavailable", "unknown", ""];
const REFRESH_MS = 5 * 60_000;

export interface CardConfig {
  type: string;
}

/**
 * What every card in the bundle shares: re-render only when a watched entity changes, and
 * history that is fetched when `historyKey()` changes or every 5 minutes, never on every
 * `hass` update.
 */
export abstract class BaseCard<C extends CardConfig> extends LitElement {
  @property({ attribute: false }) hass?: Hass;
  @state() protected config?: C;
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

  protected toggle(id: string | undefined) {
    if (id) this.call(id.split(".")[0], this.on(id) ? "turn_off" : "turn_on", { entity_id: id });
  }
}
