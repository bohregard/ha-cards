import { css, html, nothing, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { BaseCard } from "../lib/base-card";
import {
  climateView,
  deg,
  fanSpeedIndex,
  fanSpeeds,
  modeButtons,
  parseClimateHistory,
  runHint,
  runTime,
  stepTarget,
  type ClimateTarget,
  type ClimateTone,
  type FanSpeed,
  type RunSpan,
  type TargetKey,
  type TargetSpan,
} from "../lib/climate";
import { formatPower } from "../lib/energy";
import { fetchRowsWithAttributes, type ValuePoint } from "../lib/history";
import { timeChart } from "./chart";
import { fold, foldButton } from "./fold";
import { homeStyles } from "./home-styles";

export interface ClimateCardConfig {
  type: string;
  /** The thermostat. */
  entity: string;
  /** An outdoor temperature sensor, for "64° outside". */
  outside?: string;
  /** Power sensors for the circuits the AC and heat run on; their sum shows while it runs. */
  power?: string[];
  /** Fans, each with the temperature sensor of its room. */
  fans?: { entity: string; name?: string; temperature?: string }[];
  /** Start with the last 24 hours and the fan and eco switches showing (default: folded away). */
  expanded?: boolean;
}

const HOUR = 3_600_000;
/** Taps on − and + collect for this long before one set_temperature goes out. */
const SEND_MS = 1200;
/** How long the card shows a sent target before trusting the thermostat's own value again. */
const HOLD_MS = 10_000;
const MIN_RUNNING_W = 20;

const TONE_CLASS: Record<ClimateTone, string> = { cool: "air", heat: "lit", idle: "", off: "", error: "bad" };
const ACTION_ICON: Record<string, string> = {
  cooling: "mdi:snowflake",
  heating: "mdi:fire",
  preheating: "mdi:fire",
  fan: "mdi:fan",
  drying: "mdi:water-percent",
};
const TARGET_NAME: Record<TargetKey, string> = { temperature: "target", target_temp_low: "heat target", target_temp_high: "cool target" };
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const modeTone = (m: string) => (m === "heat" ? "heat" : m === "off" ? "off" : m === "heat_cool" || m === "auto" ? "auto" : "cool");

/**
 * The thermostat and the fans on one card: what it's doing now, the inside temperature, the
 * target to step, the mode, and each fan's speed. The fold holds the last 24 hours (inside
 * temperature, target and when it ran) and the circulate fan and eco switches.
 */
export class BrinstarClimateCard extends BaseCard<ClimateCardConfig> {
  @state() private expanded = false;
  /** Targets stepped on the card but not yet confirmed by the thermostat. */
  @state() private pending: Partial<Record<TargetKey, number>> = {};
  @state() private temps: ValuePoint[] = [];
  @state() private targets: TargetSpan[] = [];
  @state() private runs: RunSpan[] = [];
  @state() private loaded = false;
  private sendTimer?: number;
  private holdTimer?: number;

  static styles = [
    homeStyles,
    css`
      /* The big reading and the target side by side; the inside line spans under both. */
      .now { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 12px; }
      .now .big { font-size: 3.5rem; }
      .now .sub { grid-column: 1 / -1; }
      .targets { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
      .stepper { display: flex; flex-direction: column; align-items: center; gap: 4px; }
      .stepper .lbl { font-size: 0.78rem; font-weight: 600; color: var(--bp-muted); }
      .stepper .ctl { display: flex; align-items: center; gap: 4px; }
      .stepper .ctl b { min-width: 3.4ch; text-align: center; font-size: 1.6rem; font-weight: 500; }
      .stepper .ico { width: 44px; height: 44px; }
      .stepper.compact { flex-direction: row; gap: 8px; }
      .stepper.compact .ctl b { font-size: 1.1rem; font-weight: 600; }
      .stepper.compact .ico { width: 40px; height: 40px; }

      .seg { display: flex; gap: 2px; padding: 2px; border-radius: 22px; background: var(--bp-well); }
      .seg button {
        flex: 1; min-width: 40px; min-height: 40px; padding: 0 6px; border: 0; border-radius: 20px; background: none;
        color: var(--bp-muted); font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .seg button:hover:not(.on):not(:disabled) { color: var(--bp-text); }
      .seg button.on { background: var(--bp-card); color: var(--bp-text); box-shadow: 0 1px 4px rgb(0 0 0 / 0.22); }
      /* Tone text is mixed toward the text colour so it stays readable on its tint in light themes. */
      .seg button.on.cool { background: color-mix(in srgb, var(--bp-active) 20%, var(--bp-card)); color: color-mix(in srgb, var(--bp-active) 55%, var(--bp-text)); }
      .seg button.on.heat { background: color-mix(in srgb, var(--bp-lamp) 20%, var(--bp-card)); color: color-mix(in srgb, var(--bp-lamp) 55%, var(--bp-text)); }
      .seg button:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 1px; }
      .seg button:disabled { opacity: 0.45; cursor: default; }

      .fans { display: flex; flex-direction: column; border-top: 1px solid var(--bp-line); }
      .fan { display: flex; align-items: center; gap: 8px; min-height: 56px; }
      .fan + .fan { border-top: 1px solid var(--bp-line); }
      .fan .ico { width: 36px; height: 36px; --mdc-icon-size: 20px; }
      .fan .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .fan b { font-size: 0.92rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fan .txt span { font-size: 0.78rem; font-weight: 500; color: var(--bp-muted); }
      .fan .seg { flex: none; }
      .ico.spin ha-icon { animation: bp-spin var(--spin, 2s) linear infinite; }
      @keyframes bp-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .ico.spin ha-icon { animation: none; } }

      .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.72rem; font-weight: 500; color: var(--bp-muted); }
      .legend span { display: inline-flex; align-items: center; gap: 6px; }
      .legend i { display: inline-block; width: 14px; height: 0; border-top: 2px solid var(--bp-muted); }
      .legend i.dash { border-top: 2px dashed color-mix(in srgb, var(--bp-text) 55%, transparent); }
      .legend i.cool, .legend i.heat { height: 6px; border: 0; border-radius: 2px; background: var(--bp-active); }
      .legend i.heat { background: var(--bp-lamp); }
      .pills { display: flex; flex-wrap: wrap; gap: 8px; }
      .pill {
        display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px 0 10px; border-radius: 20px;
        border: 1px solid var(--bp-line); background: none; color: var(--bp-muted); font: inherit; font-size: 0.85rem; font-weight: 600;
        cursor: pointer; --mdc-icon-size: 18px; transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
      }
      .pill:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; }
      .pill.on { color: var(--bp-text); border-color: color-mix(in srgb, var(--bp-text) 40%, var(--bp-line)); background: var(--bp-well); }
      .pill.on.air { color: color-mix(in srgb, var(--bp-active) 55%, var(--bp-text)); border-color: color-mix(in srgb, var(--bp-active) 50%, var(--bp-line)); background: color-mix(in srgb, var(--bp-active) 12%, transparent); }
    `,
  ];

  setConfig(config: ClimateCardConfig) {
    if (!config?.entity) throw new Error("Set entity to the thermostat (a climate entity)");
    this.config = config;
    this.expanded = !!config.expanded;
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.sendTimer);
    window.clearTimeout(this.holdTimer);
  }

  protected watched() {
    const c = this.config!;
    return [c.entity, c.outside, ...(c.power ?? []), ...(c.fans ?? []).flatMap((f) => [f.entity, f.temperature])];
  }

  /** Refetch on the hour, and when the card opens. */
  protected historyKey() {
    return `${this.expanded ? "open" : "shut"}|${Math.floor(Date.now() / HOUR)}`;
  }

  protected async loadHistory() {
    if (!this.hass || !this.config || !this.expanded) return;
    const now = Date.now();
    const rows = await fetchRowsWithAttributes(this.hass, this.config.entity, now - 24 * HOUR, now);
    const h = parseClimateHistory(rows, now);
    this.temps = h.temps;
    this.targets = h.targets;
    this.runs = h.runs;
    this.loaded = true;
  }

  private attrs(): Record<string, any> {
    return this.st(this.config!.entity)?.attributes ?? {};
  }

  private step(): number {
    const a = this.attrs();
    return num(a.target_temp_step) ?? (this.hass?.config?.unit_system?.temperature === "°C" ? 0.5 : 1);
  }

  private bump(key: TargetKey, dir: 1 | -1) {
    const a = this.attrs();
    const cur = this.pending[key] ?? num(a[key]);
    if (cur === undefined) return;
    const step = this.step();
    let min = num(a.min_temp) ?? 7;
    let max = num(a.max_temp) ?? 35;
    // In heat/cool the range can't cross itself.
    const other = (k: TargetKey) => this.pending[k] ?? num(a[k]);
    const hi = other("target_temp_high");
    const lo = other("target_temp_low");
    if (key === "target_temp_low" && hi !== undefined) max = Math.min(max, hi - step);
    if (key === "target_temp_high" && lo !== undefined) min = Math.max(min, lo + step);
    this.pending = { ...this.pending, [key]: stepTarget(cur, dir * step, step, min, max) };
    window.clearTimeout(this.sendTimer);
    window.clearTimeout(this.holdTimer);
    this.sendTimer = window.setTimeout(() => this.send(), SEND_MS);
  }

  private send() {
    const a = this.attrs();
    const p = this.pending;
    const data: Record<string, unknown> = { entity_id: this.config!.entity };
    if (p.temperature !== undefined) data.temperature = p.temperature;
    else {
      data.target_temp_low = p.target_temp_low ?? a.target_temp_low;
      data.target_temp_high = p.target_temp_high ?? a.target_temp_high;
    }
    this.call("climate", "set_temperature", data);
    this.holdTimer = window.setTimeout(() => (this.pending = {}), HOLD_MS);
  }

  private setMode(mode: string) {
    window.clearTimeout(this.sendTimer);
    window.clearTimeout(this.holdTimer);
    this.pending = {};
    this.call("climate", "set_hvac_mode", { entity_id: this.config!.entity, hvac_mode: mode });
  }

  private setFan(id: string, i: number, speeds: FanSpeed[]) {
    if (i < 0) this.call("fan", "turn_off", { entity_id: id });
    else if (speeds.length === 1 && speeds[0].label === "On") this.call("fan", "turn_on", { entity_id: id });
    else this.call("fan", "set_percentage", { entity_id: id, percentage: speeds[i].pct });
  }

  private stepper(t: ClimateTarget, compact: boolean): TemplateResult {
    const value = this.pending[t.key] ?? t.value;
    const name = TARGET_NAME[t.key];
    return html`<div class="stepper ${compact ? "compact" : ""}">
      <span class="lbl">${t.label}</span>
      <div class="ctl">
        <button class="ico" aria-label="Lower the ${name}" @click=${() => this.bump(t.key, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
        <b class="num" aria-live="polite">${deg(value)}</b>
        <button class="ico" aria-label="Raise the ${name}" @click=${() => this.bump(t.key, 1)}><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>
    </div>`;
  }

  private fanRow(f: { entity: string; name?: string; temperature?: string }): TemplateResult {
    const e = this.st(f.entity);
    const a = e?.attributes ?? {};
    const s = e?.state ?? "unavailable";
    const offline = s === "unavailable" || s === "unknown";
    const speeds = fanSpeeds(((a.supported_features ?? 0) & 1) === 1 ? num(a.percentage_step) ?? 1 : undefined);
    const idx = fanSpeedIndex(s, a.percentage, speeds);
    const name = f.name ?? a.friendly_name ?? f.entity;
    const temp = this.num(f.temperature);
    const sub = [temp !== undefined ? deg(Math.round(temp)) : "", offline ? "Offline" : idx < 0 ? "Off" : speeds[idx].label].filter(Boolean).join(" · ");
    const spin = idx < 0 ? 0 : 3.6 - (2.6 * speeds[idx].pct) / 100;
    return html`<div class="fan">
      <span class="ico ${idx >= 0 ? "air spin" : offline ? "bad" : ""}" style=${spin ? `--spin:${spin.toFixed(2)}s` : ""}>
        <ha-icon icon=${idx >= 0 ? "mdi:fan" : offline ? "mdi:fan-alert" : "mdi:fan-off"}></ha-icon></span>
      <div class="txt"><b>${name}</b><span class="num">${sub}</span></div>
      <div class="seg" role="group" aria-label="${name} speed">
        <button class=${idx < 0 && !offline ? "on" : ""} aria-pressed=${idx < 0 ? "true" : "false"} ?disabled=${offline}
          @click=${() => this.setFan(f.entity, -1, speeds)}>Off</button>
        ${speeds.map(
          (sp, i) => html`<button class=${i === idx ? "on cool" : ""} aria-pressed=${i === idx ? "true" : "false"} ?disabled=${offline}
            @click=${() => this.setFan(f.entity, i, speeds)}>${sp.label}</button>`,
        )}
      </div>
    </div>`;
  }

  private details(a: Record<string, any>): TemplateResult {
    const now = Date.now();
    const t0 = now - 24 * HOUR;
    const line = this.temps.filter((p) => p.t >= t0);
    const cur = num(a.current_temperature);
    if (line.length && cur !== undefined) line.push({ t: now, v: cur });
    const ran = runTime(this.runs, t0, now);
    const fanModes: string[] = a.fan_modes ?? [];
    const presets: string[] = a.preset_modes ?? [];
    const id = this.config!.entity;
    const circulating = a.fan_mode === "on";
    const eco = a.preset_mode === "eco";
    return html`<section>
        <h3>Last 24 hours <span class="hint num">${this.loaded ? runHint(ran) : ""}</span></h3>
        ${timeChart({ line, steps: this.targets, spans: this.runs, t0, t1: now, label: "Inside temperature, target and when it ran, last 24 hours" })}
        <div class="axis"><span>24 h ago</span><span>12 h</span><span>Now</span></div>
        <div class="legend">
          <span><i></i>Inside</span>
          ${this.targets.length ? html`<span><i class="dash"></i>Target</span>` : nothing}
          ${ran.cool ? html`<span><i class="cool"></i>Cooling</span>` : nothing}
          ${ran.heat ? html`<span><i class="heat"></i>Heating</span>` : nothing}
        </div>
      </section>
      ${fanModes.includes("on") || presets.includes("eco")
        ? html`<div class="pills">
            ${fanModes.includes("on")
              ? html`<button class="pill ${circulating ? "on air" : ""}" aria-pressed=${circulating ? "true" : "false"}
                  @click=${() => this.call("climate", "set_fan_mode", {
                    entity_id: id,
                    fan_mode: circulating ? (fanModes.includes("auto") ? "auto" : fanModes.find((m) => m !== "on")) : "on",
                  })}><ha-icon icon="mdi:fan"></ha-icon>Circulate fan</button>`
              : nothing}
            ${presets.includes("eco")
              ? html`<button class="pill ${eco ? "on" : ""}" aria-pressed=${eco ? "true" : "false"}
                  @click=${() => this.call("climate", "set_preset_mode", {
                    entity_id: id,
                    preset_mode: eco ? (presets.includes("none") ? "none" : presets.find((p) => p !== "eco")) : "eco",
                  })}><ha-icon icon="mdi:leaf"></ha-icon>Eco</button>`
              : nothing}
          </div>`
        : nothing}`;
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config;
    const e = this.st(c.entity);
    const a = this.attrs();
    const s = e?.state ?? "unavailable";
    const v = climateView(s, a);
    const watts = v.running ? (c.power ?? []).reduce((sum, id) => sum + (this.num(id) ?? 0), 0) : 0;
    const icon = v.tone === "error" ? "mdi:thermostat" : v.tone === "off" ? "mdi:hvac-off" : ACTION_ICON[a.hvac_action] ?? "mdi:thermostat";
    const inside = num(a.current_temperature);
    const humidity = num(a.current_humidity);
    const outside = this.num(c.outside);
    const sub = ["Inside", humidity !== undefined ? `${Math.round(humidity)}% humidity` : "", outside !== undefined ? `${Math.round(outside)}° outside` : ""]
      .filter(Boolean)
      .join(" · ");
    const modes = modeButtons(a.hvac_modes ?? []);
    const live = v.tone !== "error";

    return html`<ha-card>
      <div class="body">
        <div class="title">
          <span class="ico ${TONE_CLASS[v.tone]}"><ha-icon icon=${icon}></ha-icon></span>
          <span class="name ${v.tone === "error" ? "tone-error" : ""}">${v.headline}</span>
          ${watts >= MIN_RUNNING_W ? html`<span class="aside num">${formatPower(watts, this.language())}</span>` : nothing}
        </div>
        ${live
          ? html`<div class="now">
                <div class="big">${inside !== undefined ? deg(inside) : "–"}</div>
                ${v.targets.length ? html`<div class="targets">${v.targets.map((t) => this.stepper(t, v.targets.length > 1))}</div>` : nothing}
                <div class="sub num">${sub}</div>
              </div>
              ${modes.length
                ? html`<div class="seg" role="group" aria-label="Mode">
                    ${modes.map(
                      (m) => html`<button class=${m.mode === s ? `on ${modeTone(m.mode)}` : ""} aria-pressed=${m.mode === s ? "true" : "false"}
                        @click=${() => this.setMode(m.mode)}>${m.label}</button>`,
                    )}
                  </div>`
                : nothing}`
          : nothing}
        ${c.fans?.length ? html`<div class="fans">${c.fans.map((f) => this.fanRow(f))}</div>` : nothing}
        ${live ? fold(this.expanded, "climate-details", this.details(a)) : nothing}
        ${live ? foldButton(this.expanded, "climate-details", () => (this.expanded = !this.expanded)) : nothing}
      </div>
    </ha-card>`;
  }
}
