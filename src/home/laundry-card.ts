import { css, html, nothing, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { BaseCard } from "../lib/base-card";
import { fetchHistory, type StatePoint } from "../lib/history";
import {
  headline,
  machineStatus,
  minutesText,
  runTimes,
  type LaundryTone,
  type MachineStatus,
  type RunTimes,
} from "../lib/laundry";
import { homeStyles } from "./home-styles";

export interface LaundryMachineConfig {
  name: string;
  icon?: string;
  /** On while the machine runs: a plug's binary sensor, or a helper set from its power. */
  running: string;
  /** Watts, shown while it runs. */
  power?: string;
  /** An LG ThinQ appliance sensor (smartthinq_sensors), for the cycle, time left, door and errors. */
  appliance?: string;
}

export interface LaundryCardConfig {
  type: string;
  title?: string;
  /** How long "Done" lasts, in hours (default 4). */
  done_hours?: number;
  machines: LaundryMachineConfig[];
}

const HOUR = 3_600_000;
const TICK_MS = 30_000;
const ICON_CLASS: Record<LaundryTone, string> = { error: "bad", warn: "due", active: "air", ok: "ok", idle: "" };

/**
 * Washer and dryer at a glance: running (for how long, the power, and LG's cycle and time left
 * when it reports one), done, waiting to be unloaded, or idle. Run times come from the recorder,
 * so an HA restart doesn't reset them.
 */
export class BrinstarLaundryCard extends BaseCard<LaundryCardConfig> {
  @state() private now = Date.now();
  @state() private times: Record<string, StatePoint[]> = {};
  private ticker?: number;

  static styles = [
    homeStyles,
    css`
      .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .who .name { font-size: 1rem; font-weight: 600; }
      .head { font-size: 0.88rem; font-weight: 600; color: var(--bp-muted); overflow-wrap: anywhere; }
      /* Tone text is mixed toward the text colour so it stays readable in light themes. */
      .head.active, .line.active { color: color-mix(in srgb, var(--bp-active) 55%, var(--bp-text)); }
      .head.warn, .line.warn { color: color-mix(in srgb, var(--bp-amber) 70%, var(--bp-text)); }
      .head.error { color: var(--bp-error); }
      /* On the panel's well the plain error colour falls under 4.5:1 in light themes. */
      .line.error { color: color-mix(in srgb, var(--bp-error) 80%, var(--bp-text)); }
      .ico.air { background: color-mix(in srgb, var(--bp-active) 16%, transparent); color: var(--bp-active); }
      .ico.due { background: color-mix(in srgb, var(--bp-amber) 16%, transparent); color: color-mix(in srgb, var(--bp-amber) 80%, var(--bp-text)); }
      .ico.ok { background: color-mix(in srgb, var(--bp-ok) 16%, transparent); color: var(--bp-ok); }

      .machines { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
      @container (min-width: 520px) { .machines { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .machine {
        display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 12px; border: 0; border-radius: 16px;
        background: var(--bp-well); color: inherit; font: inherit; text-align: left; cursor: pointer;
        transition: transform 0.15s ease;
      }
      .machine:active { transform: scale(0.985); }
      .machine:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; }
      .machine .top { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .machine .ico { width: 36px; height: 36px; --mdc-icon-size: 20px; }
      .machine .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .nm { font-size: 0.95rem; font-weight: 600; }
      .line { font-size: 0.82rem; font-weight: 500; color: var(--bp-muted); overflow-wrap: anywhere; }
      .line b { color: var(--bp-text); font-weight: 600; }
      .watts { flex: none; font-size: 0.85rem; font-weight: 500; color: var(--bp-muted); }
      .watts b { color: var(--bp-text); font-weight: 600; }
      .meter.run i { background: var(--bp-active); }
      .note { font-size: 0.75rem; }
      @media (prefers-reduced-motion: reduce) { .machine { transition: none; } }
    `,
  ];

  static getStubConfig() {
    return { machines: [{ name: "Washer", icon: "mdi:washing-machine", running: "binary_sensor.washer_running" }] };
  }

  setConfig(config: LaundryCardConfig) {
    if (!Array.isArray(config?.machines) || !config.machines.length || config.machines.some((m) => !m?.running)) {
      throw new Error("Set `machines`: each needs a `name` and a `running` entity");
    }
    this.config = config;
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback() {
    super.connectedCallback();
    this.now = Date.now();
    this.ticker = window.setInterval(() => (this.now = Date.now()), TICK_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.ticker);
  }

  protected watched() {
    return (this.config?.machines ?? []).flatMap((m) => [m.running, m.power, m.appliance]);
  }

  /** A start or finish fetches history again. */
  protected historyKey() {
    return (this.config?.machines ?? []).map((m) => this.st(m.running)?.state ?? "").join("|");
  }

  protected async loadHistory() {
    if (!this.hass || !this.config) return;
    const now = Date.now();
    this.times = await fetchHistory(this.hass, this.config.machines.map((m) => m.running), now - 24 * HOUR, now, true);
  }

  private runTimes(m: LaundryMachineConfig): RunTimes {
    const live = this.st(m.running);
    const t = Date.parse(live?.last_changed ?? live?.last_updated ?? "");
    return runTimes(this.times[m.running] ?? [], live && Number.isFinite(t) ? { t, s: live.state } : undefined);
  }

  private status(m: LaundryMachineConfig): MachineStatus {
    return machineStatus({
      name: m.name,
      running: this.on(m.running),
      times: this.runTimes(m),
      watts: this.num(m.power),
      appliance: this.st(m.appliance),
      now: this.now,
      doneMs: (this.config?.done_hours ?? 4) * HOUR,
    });
  }

  private moreInfo(m: LaundryMachineConfig) {
    const entityId = m.appliance && this.st(m.appliance) ? m.appliance : m.running;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const machines = this.config.machines.map((m) => ({ cfg: m, name: m.name, status: this.status(m) }));
    const head = headline(machines);
    const lang = this.language();
    return html`<ha-card>
      <div class="title">
        <span class="ico ${ICON_CLASS[head.tone]}"><ha-icon icon="mdi:washing-machine"></ha-icon></span>
        <div class="who">
          <span class="name">${this.config.title ?? "Laundry"}</span>
          <span class="head ${head.tone}">${head.text}</span>
        </div>
      </div>
      <div class="machines">${machines.map(({ cfg, status }) => this.renderMachine(cfg, status, lang))}</div>
    </ha-card>`;
  }

  private renderMachine(m: LaundryMachineConfig, s: MachineStatus, lang?: string): TemplateResult {
    const detail = [s.detail, s.left !== undefined ? `${minutesText(s.left)} left` : undefined].filter(Boolean).join(" · ");
    const watts = s.power !== undefined ? new Intl.NumberFormat(lang).format(s.power) : undefined;
    const pct = s.progress !== undefined ? Math.round(s.progress * 100) : undefined;
    return html`<button class="machine" @click=${() => this.moreInfo(m)} aria-label="${m.name}: ${s.line}${detail ? `, ${detail}` : ""}">
      <div class="top">
        <span class="ico ${ICON_CLASS[s.tone]}"><ha-icon icon=${m.icon ?? "mdi:washing-machine"}></ha-icon></span>
        <span class="txt">
          <span class="nm">${m.name}</span>
          <span class="line num ${s.tone}">${s.line}</span>
        </span>
        ${watts ? html`<span class="watts num"><b>${watts}</b> W</span>` : nothing}
      </div>
      ${detail ? html`<span class="line num">${detail}</span>` : nothing}
      ${pct !== undefined
        ? html`<div class="meter run" role="progressbar" aria-label="${m.name} cycle" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`
        : nothing}
      ${s.noDetails ? html`<span class="line note">No cycle details from LG ThinQ</span>` : nothing}
    </button>`;
  }
}
