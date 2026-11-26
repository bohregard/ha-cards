import { css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { BaseCard } from "../lib/base-card";
import { findOnDevice } from "../lib/entities";
import { fetchStatistics, type ValuePoint } from "../lib/history";
import { navigate } from "../lib/nav";
import { compass, conditionIcon, conditionLabel, pressureTrend, rainPerHour } from "../lib/weather";
import { timeChart } from "./chart";
import { fold, foldButton } from "./fold";
import { homeStyles } from "./home-styles";

export interface WeatherCardConfig {
  type: string;
  /** The weather station's outdoor temperature sensor; the other readings are found on its device. */
  entity: string;
  /** A weather entity for the condition and forecast. */
  weather?: string;
  name?: string;
  navigation_path?: string;
  /** Start with the readings, chart and next hours showing (default: folded away). */
  expanded?: boolean;
}

interface Forecast {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation_probability?: number;
}

const HOUR = 3_600_000;
/** Station readings by the end of their entity ids (`sensor.<station>_<key>`). */
const KEYS = ["feelslike", "humidity", "dewpoint", "windspeed", "windgust", "maxdailygust", "winddir", "dailyrain", "weeklyrain", "baromrel", "uv", "solarradiation"] as const;
type Key = (typeof KEYS)[number];

/**
 * What it's like outside now, from your own weather station: temperature, feels-like, wind,
 * rain, pressure and UV, the last 24 hours of temperature and rain, and the next hours.
 */
export class BrinstarWeatherCard extends BaseCard<WeatherCardConfig> {
  @state() private temps: ValuePoint[] = [];
  @state() private rain: ValuePoint[] = [];
  @state() private pressure: ValuePoint[] = [];
  @state() private hourly: Forecast[] = [];
  @state() private today?: Forecast;
  @state() private expanded = false;

  static styles = [
    homeStyles,
    css`
      .now { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .now .big { font-size: 3.5rem; }
      .today { text-align: right; font-size: 0.85rem; font-weight: 500; color: var(--bp-muted); line-height: 1.5; }
      .today b { color: var(--bp-text); font-weight: 600; }
      .readings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; }
      @container (min-width: 520px) { .readings { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      .reading { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .reading span { font-size: 0.75rem; font-weight: 600; color: var(--bp-muted); }
      .reading b { font-size: 1.05rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
      .reading small { font-size: 0.78rem; font-weight: 500; color: var(--bp-muted); }
      .arrow { --mdc-icon-size: 18px; color: var(--bp-muted); display: inline-flex; transition: transform 0.4s ease; }
      .hours { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); text-align: center; }
      .hours div { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 500; }
      .hours span { color: var(--bp-muted); font-size: 0.72rem; }
      .hours ha-icon { --mdc-icon-size: 22px; color: var(--bp-muted); }
      .hours .wet { color: var(--bp-active); font-size: 0.72rem; font-weight: 600; }
    `,
  ];

  setConfig(config: WeatherCardConfig) {
    if (!config?.entity) throw new Error("Set entity to the weather station's outdoor temperature sensor");
    this.config = config;
    this.expanded = !!config.expanded;
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private ids(): Record<Key, string | undefined> {
    const anchor = this.config!.entity;
    return Object.fromEntries(
      KEYS.map((k) => [k, this.hass?.entities ? findOnDevice(this.hass.entities, anchor, "sensor", k) : undefined]),
    ) as Record<Key, string | undefined>;
  }

  protected watched() {
    return [this.config!.entity, this.config!.weather, ...Object.values(this.ids())];
  }

  /** Refetch on the hour, so the chart and the hourly forecast move along, and when the card opens. */
  protected historyKey() {
    return `${this.expanded ? "open" : "shut"}|${Math.floor(Date.now() / HOUR)}`;
  }

  /** Folded, the card needs only today's forecast; the history and hours load when it opens. */
  protected async loadHistory() {
    if (!this.hass || !this.config) return;
    if (this.config.weather) this.today = (await this.forecast("daily"))[0];
    if (!this.expanded) return;
    const i = this.ids();
    const now = Date.now();
    const start = now - 25 * HOUR;
    const means = await fetchStatistics(this.hass, [this.config.entity, i.baromrel].filter((x): x is string => !!x), start, now, "hour");
    this.temps = means[this.config.entity] ?? [];
    this.pressure = i.baromrel ? means[i.baromrel] ?? [] : [];
    if (i.dailyrain) {
      const totals = await fetchStatistics(this.hass, [i.dailyrain], start, now, "hour", "state");
      this.rain = rainPerHour(totals[i.dailyrain] ?? []);
    }
    if (this.config.weather) {
      this.hourly = (await this.forecast("hourly")).filter((f) => Date.parse(f.datetime) > now - HOUR).slice(0, 6);
    }
  }

  private async forecast(type: "hourly" | "daily"): Promise<Forecast[]> {
    const id = this.config!.weather!;
    const resp = await this.hass!.callWS<{ response?: Record<string, { forecast?: Forecast[] }> }>({
      type: "call_service",
      domain: "weather",
      service: "get_forecasts",
      target: { entity_id: id },
      service_data: { type },
      return_response: true,
    });
    return resp?.response?.[id]?.forecast ?? [];
  }

  private open(e: Event) {
    e.preventDefault();
    if (this.config?.navigation_path) navigate(this.config.navigation_path);
  }

  private unit(id?: string): string {
    return this.st(id)?.attributes.unit_of_measurement ?? "";
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config;
    const i = this.ids();
    const now = Date.now();
    const lang = this.language();
    const n = (k: Key) => this.num(i[k]);
    const temp = this.num(c.entity);
    const cond = this.val(c.weather);
    const deg = (v?: number) => (v === undefined ? "–" : `${Math.round(v)}°`);
    const fixed = (v: number | undefined, d: number) => (v === undefined ? "–" : v.toFixed(d));
    const dir = n("winddir");
    const trend = pressureTrend(this.pressure, now);
    const t1 = now;
    const t0 = now - 24 * HOUR;
    const day = this.temps.filter((p) => p.t >= t0);
    if (day.length && temp !== undefined) day.push({ t: now, v: temp });
    const hi = day.length ? Math.max(...day.map((p) => p.v)) : undefined;
    const lo = day.length ? Math.min(...day.map((p) => p.v)) : undefined;
    const rainDay = this.rain.filter((p) => p.t >= t0).reduce((s, p) => s + p.v, 0);
    const hourLabel = (t: string) => new Date(t).toLocaleTimeString(lang, { hour: "numeric" });

    return html`<ha-card>
      ${c.navigation_path ? html`<a class="hit" href=${c.navigation_path} aria-label="Open ${c.name ?? "Weather"}" @click=${this.open}></a>` : nothing}
      <div class="body">
        <div class="title">
          <span class="ico"><ha-icon icon="mdi:${cond ? conditionIcon(cond) : "thermometer"}"></ha-icon></span>
          <span class="name">${cond ? conditionLabel(cond) : c.name ?? "Weather"}</span>
          ${c.navigation_path ? html`<ha-icon class="go" icon="mdi:chevron-right"></ha-icon>` : nothing}
        </div>

        <div class="now">
          <div>
            <div class="big">${deg(temp)}</div>
            <div class="sub num">Feels like <b>${deg(n("feelslike"))}</b></div>
          </div>
          ${this.today
            ? html`<div class="today num">
                <div>High <b>${deg(this.today.temperature)}</b> · low <b>${deg(this.today.templow)}</b></div>
                ${this.today.precipitation_probability !== undefined ? html`<div>${Math.round(this.today.precipitation_probability)}% chance of rain</div>` : nothing}
              </div>`
            : nothing}
        </div>

        ${fold(this.expanded, "weather-details", html`<div class="readings">
          <div class="reading"><span>Humidity</span><b class="num">${fixed(n("humidity"), 0)}%</b></div>
          <div class="reading"><span>Wind</span>
            <b class="num">${fixed(n("windspeed"), 0)} ${this.unit(i.windspeed)}
              ${dir !== undefined
                ? html`<span class="arrow" style="transform:rotate(${dir + 180}deg)" aria-label="from the ${compass(dir)}"><ha-icon icon="mdi:navigation"></ha-icon></span>${compass(dir)}`
                : nothing}</b>
            <small class="num">Gust ${fixed(n("windgust"), 0)} · today's max ${fixed(n("maxdailygust"), 0)}</small></div>
          <div class="reading"><span>Rain today</span><b class="num">${fixed(n("dailyrain"), 2)} ${this.unit(i.dailyrain)}</b>
            <small class="num">${fixed(n("weeklyrain"), 2)} ${this.unit(i.weeklyrain)} this week</small></div>
          <div class="reading"><span>Pressure</span><b class="num">${fixed(n("baromrel"), 2)} ${this.unit(i.baromrel)}</b>
            ${trend ? html`<small>${trend[0].toUpperCase() + trend.slice(1)}</small>` : nothing}</div>
          <div class="reading"><span>UV index</span><b class="num">${fixed(n("uv"), 0)}</b>
            <small class="num">${fixed(n("solarradiation"), 0)} ${this.unit(i.solarradiation)} sun</small></div>
          <div class="reading"><span>Dew point</span><b class="num">${deg(n("dewpoint"))}</b>
            <small>${(n("humidity") ?? 0) >= 95 ? "Damp, misty air" : (n("dewpoint") ?? 0) >= 65 ? "Muggy" : "Comfortable"}</small></div>
        </div>

        <section>
          <h3>Last 24 hours
            <span class="hint num">${hi !== undefined ? `${deg(hi)} high · ${deg(lo)} low` : ""}${rainDay > 0 ? ` · ${rainDay.toFixed(2)} ${this.unit(i.dailyrain)} rain` : ""}</span></h3>
          ${timeChart({ line: day, bars: this.rain.filter((p) => p.t >= t0), t0, t1, barMax: 0.1, label: "Temperature and rain, last 24 hours" })}
          <div class="axis"><span>24 h ago</span><span>12 h</span><span>Now</span></div>
        </section>

        ${this.hourly.length
          ? html`<section>
              <h3>Next hours</h3>
              <div class="hours">
                ${this.hourly.map((f) => html`<div>
                  <span>${hourLabel(f.datetime)}</span>
                  <ha-icon icon="mdi:${conditionIcon(f.condition ?? "")}"></ha-icon>
                  <b class="num">${deg(f.temperature)}</b>
                  ${(f.precipitation_probability ?? 0) > 0 ? html`<span class="wet num">${Math.round(f.precipitation_probability!)}%</span>` : nothing}
                </div>`)}
              </div>
            </section>`
          : nothing}`)}
        ${foldButton(this.expanded, "weather-details", () => (this.expanded = !this.expanded))}
      </div>
    </ha-card>`;
  }
}
