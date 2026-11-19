import { LitElement, html, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import type { Hass, HassEntity } from "../lib/hass";
import {
  DOCK_SENSORS,
  consumableParts,
  dayLabel,
  formatRemaining,
  partTone,
  statusTone,
  type ConsumablePart,
} from "../lib/status";
import { findSibling } from "../lib/vacuum";
import { statusStyles } from "./status-styles";

export interface StatusCardConfig {
  type: string;
  entity: string;
  title?: string;
}

const CONFIRM_MS = 4000;
const NO_READING = ["unavailable", "unknown", ""];

/** Consumables (with reset), last clean, and dock/tank status for a Dreame vacuum. */
export class BrinstarVacuumStatusCard extends LitElement {
  static styles = statusStyles;

  @property({ attribute: false }) hass?: Hass;
  @state() private config?: StatusCardConfig;
  /** The part whose Reset was tapped once and is waiting for the second tap. */
  @state() private confirming?: string;
  private confirmTimer?: number;

  static getStubConfig(hass: Hass) {
    return { entity: Object.keys(hass.states).find((e) => e.startsWith("vacuum.")) ?? "vacuum.example" };
  }

  setConfig(config: StatusCardConfig) {
    if (!config?.entity?.startsWith("vacuum.")) {
      throw new Error("Set `entity` to a vacuum entity, e.g. vacuum.my_robot");
    }
    this.config = config;
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.confirmTimer);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as Hass | undefined;
    if (!old || !this.hass) return true;
    return this.watched().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  private sibling(domain: string, key: string): string | undefined {
    if (!this.hass?.entities || !this.config) return undefined;
    return findSibling(this.hass.entities, this.config.entity, domain, key);
  }

  private parts(): ConsumablePart[] {
    if (!this.hass?.entities || !this.config) return [];
    return consumableParts(this.hass.entities, this.config.entity);
  }

  private watched(): string[] {
    const ids: (string | undefined)[] = [];
    for (const p of this.parts()) ids.push(p.level, p.remaining);
    for (const key of ["cleaning_history", "cleaning_time", "cleaned_area", ...DOCK_SENSORS.map(([k]) => k)]) {
      ids.push(this.sibling("sensor", key));
    }
    return ids.filter((x): x is string => !!x);
  }

  private stateOf(id?: string): HassEntity | undefined {
    return id ? this.hass?.states[id] : undefined;
  }

  private fmt(entity: HassEntity): string {
    return this.hass?.formatEntityState?.(entity) ?? entity.state;
  }

  /** Resetting tells the robot a part is new and can't be undone, so it takes a second tap. */
  private reset(part: ConsumablePart) {
    if (!part.reset) return;
    if (this.confirming !== part.key) {
      window.clearTimeout(this.confirmTimer);
      this.confirming = part.key;
      this.confirmTimer = window.setTimeout(() => (this.confirming = undefined), CONFIRM_MS);
      return;
    }
    window.clearTimeout(this.confirmTimer);
    this.confirming = undefined;
    this.hass?.callService("button", "press", { entity_id: part.reset });
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    if (!this.hass.states[this.config.entity]) {
      return html`<ha-card><ha-alert alert-type="warning">Entity not found: ${this.config.entity}</ha-alert></ha-card>`;
    }
    const rows = this.parts()
      .map((p) => ({ part: p, pct: Number(this.stateOf(p.level)?.state) }))
      .filter((r) => Number.isFinite(r.pct));
    const worst = rows.some((r) => partTone(r.pct) === "error") ? "error" : rows.some((r) => partTone(r.pct) === "warn") ? "warn" : "ok";
    const due = rows.filter((r) => partTone(r.pct) !== "ok").map((r) => r.part.label);
    return html`<ha-card>
      <h2>
        ${this.config.title ?? "Maintenance"}
        <span class="hint ${worst}">${due.length ? `${due.join(", ")} low` : "All good"}</span>
      </h2>
      ${this.renderParts(rows)} ${this.renderLastClean()} ${this.renderDock()}
    </ha-card>`;
  }

  private renderParts(rows: { part: ConsumablePart; pct: number }[]) {
    if (!rows.length) return nothing;
    return html`<section>
      <h3>Consumables</h3>
      <div class="parts">
        ${rows.map(({ part, pct }) => {
          const rem = this.stateOf(part.remaining);
          const left = rem ? formatRemaining(Number(rem.state), rem.attributes.unit_of_measurement) : undefined;
          const confirming = this.confirming === part.key;
          return html`<div class="part" data-tone=${partTone(pct)}>
            <div class="name">
              <span>${part.label}</span>
              <span class="value">${pct}%${left ? html` · ${left === "Due now" ? left : `${left} left`}` : nothing}</span>
            </div>
            <div class="meter" role="meter" aria-label="${part.label} remaining" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100">
              <div style="width:${Math.max(0, Math.min(100, pct))}%"></div>
            </div>
            ${part.reset
              ? html`<button
                  class="reset ${confirming ? "confirm" : ""}"
                  aria-label=${confirming ? `Confirm reset ${part.label}` : `Reset ${part.label}`}
                  @click=${() => this.reset(part)}
                >
                  <ha-icon icon="mdi:restore"></ha-icon>${confirming ? "Reset?" : nothing}
                </button>`
              : nothing}
          </div>`;
        })}
      </div>
    </section>`;
  }

  private renderLastClean() {
    const history = this.stateOf(this.sibling("sensor", "cleaning_history"));
    const when = history && !NO_READING.includes(history.state) ? new Date(history.state) : undefined;
    const duration = this.stateOf(this.sibling("sensor", "cleaning_time"));
    const area = this.stateOf(this.sibling("sensor", "cleaned_area"));
    const facts: [string, string][] = [];
    if (when && !Number.isNaN(when.getTime())) {
      const lang = this.hass!.locale?.language;
      facts.push([
        when.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" }),
        dayLabel(when, new Date(), lang),
      ]);
    }
    if (duration && !NO_READING.includes(duration.state)) {
      facts.push([`${duration.state} ${duration.attributes.unit_of_measurement ?? ""}`.trim(), "Duration"]);
    }
    if (area && !NO_READING.includes(area.state)) {
      facts.push([`${area.state} ${area.attributes.unit_of_measurement ?? ""}`.trim(), "Area"]);
    }
    if (!facts.length) return nothing;
    return html`<section>
      <h3>Last clean</h3>
      <div class="facts">
        ${facts.map(([big, small]) => html`<div class="fact"><span class="big">${big}</span><span class="small">${small}</span></div>`)}
      </div>
    </section>`;
  }

  private renderDock() {
    const rows = DOCK_SENSORS.map(([key, label]) => ({ label, entity: this.stateOf(this.sibling("sensor", key)) }))
      .map((r) => ({ ...r, tone: r.entity ? statusTone(r.entity.state) : undefined }))
      .filter((r): r is { label: string; entity: HassEntity; tone: "ok" | "warn" } => !!r.entity && !!r.tone);
    if (!rows.length) return nothing;
    return html`<section>
      <h3>Dock &amp; tanks</h3>
      <div class="rows">
        ${rows.map(
          (r) => html`<span>${r.label}</span><span class="value ${r.tone === "warn" ? "warn" : ""}">${this.fmt(r.entity)}</span>`,
        )}
      </div>
    </section>`;
  }
}
