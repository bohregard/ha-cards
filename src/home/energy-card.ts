import { css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { BaseCard } from "../lib/base-card";
import { formatPower, rankCircuits } from "../lib/energy";
import { fetchStatistics, type ValuePoint } from "../lib/history";
import { navigate } from "../lib/nav";
import { timeChart } from "./chart";
import { homeStyles } from "./home-styles";

export interface EnergyCardConfig {
  type: string;
  name?: string;
  /** Whole-house power now (W). */
  power: string;
  /** Whole-house current now (A). */
  current?: string;
  voltage?: string;
  /** Energy used today (kWh), a daily total that resets at midnight. */
  energy_today?: string;
  cost_today?: string;
  /** Each leg of the service, to show balance against the main breaker. */
  legs?: { name: string; current: string; power?: string }[];
  /** Main breaker size in amps; the leg bars are scaled to it. */
  max_current?: number;
  /** Clamped circuits by what they draw now. */
  circuits?: { name: string; power: string }[];
  /** How many circuits to list before the rest fold into one row (default 6). */
  top?: number;
  navigation_path?: string;
}

const HOUR = 3_600_000;

/**
 * Whole-house power from a CT energy monitor: watts, amps and volts now, energy and cost today,
 * each leg against the main breaker, the last 24 hours, and which circuits draw it.
 */
export class BrinstarEnergyCard extends BaseCard<EnergyCardConfig> {
  @state() private history: ValuePoint[] = [];

  static styles = [
    homeStyles,
    css`
      .now { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .today { text-align: right; }
      .today .k { font-size: 1.6rem; font-weight: 300; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
      .today .k small { font-size: 0.85rem; font-weight: 500; color: var(--bp-muted); margin-left: 3px; }
      .legs { display: grid; gap: 10px; }
      .leg { display: grid; grid-template-columns: 4.5rem 1fr auto; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 500; }
      .leg b { font-weight: 600; font-variant-numeric: tabular-nums; }
      .circuits { display: grid; gap: 2px; }
      .circuit { display: grid; grid-template-columns: minmax(0, 1fr) 24% 4.4rem; align-items: center; gap: 10px; min-height: 30px; font-size: 0.85rem; font-weight: 500; }
      .circuit .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .circuit .w { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
      .circuit.unmeasured .n, .circuit.other .n { color: var(--bp-muted); }
      .circuit.unmeasured .meter i { background: color-mix(in srgb, var(--bp-muted) 45%, transparent); }
    `,
  ];

  setConfig(config: EnergyCardConfig) {
    if (!config?.power) throw new Error("Set power to the whole-house power sensor");
    this.config = config;
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  protected watched() {
    const c = this.config!;
    return [c.power, c.current, c.voltage, c.energy_today, c.cost_today, ...(c.legs ?? []).flatMap((l) => [l.current, l.power]), ...(c.circuits ?? []).map((x) => x.power)];
  }

  /** Refetch every quarter hour so the chart keeps up. */
  protected historyKey() {
    return String(Math.floor(Date.now() / (HOUR / 4)));
  }

  protected async loadHistory() {
    if (!this.hass || !this.config) return;
    const now = Date.now();
    const s = await fetchStatistics(this.hass, [this.config.power], now - 24 * HOUR, now, "5minute");
    this.history = s[this.config.power] ?? [];
  }

  private open(e: Event) {
    e.preventDefault();
    if (this.config?.navigation_path) navigate(this.config.navigation_path);
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config;
    const lang = this.language();
    const now = Date.now();
    const watts = this.num(c.power);
    const amps = this.num(c.current);
    const volts = this.num(c.voltage);
    const kwh = this.num(c.energy_today);
    const cost = this.num(c.cost_today);
    const max = c.max_current ?? 0;
    const rows = watts === undefined ? [] : rankCircuits(watts, (c.circuits ?? []).map((x) => ({ name: x.name, watts: this.num(x.power) })), c.top ?? 6);
    const top = rows[0]?.watts ?? 0;
    const day = this.history.filter((p) => p.t >= now - 24 * HOUR);
    if (day.length && watts !== undefined) day.push({ t: now, v: watts });
    const peak = day.length ? day.reduce((a, b) => (b.v > a.v ? b : a)) : undefined;
    const money = (v: number) => v.toLocaleString(lang, { style: "currency", currency: this.st(c.cost_today)?.attributes.unit_of_measurement ?? "USD" });

    return html`<ha-card>
      ${c.navigation_path ? html`<a class="hit" href=${c.navigation_path} aria-label="Open ${c.name ?? "Energy"}" @click=${this.open}></a>` : nothing}
      <div class="body">
        <div class="title">
          <span class="ico"><ha-icon icon="mdi:lightning-bolt-outline"></ha-icon></span>
          <span class="name">${c.name ?? "Energy"}</span>
          ${c.navigation_path ? html`<ha-icon class="go" icon="mdi:chevron-right"></ha-icon>` : nothing}
        </div>

        <div class="now">
          <div>
            <div class="big">${watts === undefined ? "–" : formatPower(watts, lang).replace(/ (k?W)$/, "")}<small>${watts !== undefined && watts >= 10_000 ? "kW" : "W"}</small></div>
            <div class="sub num">${amps !== undefined ? html`<b>${amps.toFixed(1)} A</b>` : nothing}${amps !== undefined && volts !== undefined ? " · " : ""}${volts !== undefined ? `${volts.toFixed(1)} V` : nothing}</div>
          </div>
          ${kwh !== undefined
            ? html`<div class="today">
                <div class="k">${kwh.toLocaleString(lang, { maximumFractionDigits: 1 })}<small>kWh today</small></div>
                ${cost !== undefined ? html`<div class="sub num">${money(cost)} so far</div>` : nothing}
              </div>`
            : nothing}
        </div>

        ${c.legs?.length
          ? html`<div class="legs" aria-label="Current on each leg">
              ${c.legs.map((l) => {
                const a = this.num(l.current);
                const f = max && a !== undefined ? a / max : 0;
                const tone = f >= 0.95 ? "error" : f >= 0.8 ? "warn" : "";
                return html`<div class="leg"><span class="muted">${l.name}</span>
                  <div class="meter ${tone}"><i style="width:${Math.min(100, f * 100).toFixed(1)}%"></i></div>
                  <b>${a === undefined ? "–" : `${a.toFixed(1)} A`}${max ? html`<span class="muted"> / ${max}</span>` : nothing}</b></div>`;
              })}
            </div>`
          : nothing}

        <section>
          <h3>Last 24 hours ${peak ? html`<span class="hint num">Peak ${formatPower(peak.v, lang)} at ${new Date(peak.t).toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" })}</span>` : nothing}</h3>
          ${timeChart({ line: day, t0: now - 24 * HOUR, t1: now, label: "Whole-house power, last 24 hours", height: 84 })}
          <div class="axis"><span>24 h ago</span><span>12 h</span><span>Now</span></div>
        </section>

        ${rows.length
          ? html`<section>
              <h3>Using it now</h3>
              <div class="circuits">
                ${rows.map((r) => html`<div class="circuit ${r.kind}">
                  <span class="n">${r.name}</span>
                  <div class="meter"><i style="width:${top ? Math.max(2, (r.watts / top) * 100).toFixed(1) : 0}%"></i></div>
                  <span class="w">${formatPower(r.watts, lang)}</span>
                </div>`)}
              </div>
            </section>`
          : nothing}
      </div>
    </ha-card>`;
  }
}
