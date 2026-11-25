import { html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { fountainArt, type Tick } from "../art/fountain";
import { plural } from "../lib/format";
import { fountainStatus, pumpReason, waterUsedPerDay } from "../lib/fountain";
import type { Hass } from "../lib/hass";
import { fetchHistory, fetchStatistics, onTimes, type ValuePoint } from "../lib/history";
import type { PetTone } from "../lib/tone";
import { PetCard, type PetCardConfig } from "./base";
import { bars, dayLabels, lineChart, settingsTitle, toggle, type Mark } from "./parts";
import { petStyles } from "./pet-styles";

export interface FountainCardConfig extends PetCardConfig {
  /** Water in a full tank, in grams (1 g = 1 ml). */
  capacity_grams?: number;
}

const HOUR = 3_600_000;
const DEFAULT_CAPACITY_G = 3000;

/** A scale-based ESPHome water fountain: level, pump state and why, use per day, filter. */
export class BrinstarFountainCard extends PetCard<FountainCardConfig> {
  static styles = petStyles;
  /** 5-minute means of the water weight, last 7 days. */
  @state() private stats: ValuePoint[] = [];
  @state() private visits?: number;

  static getStubConfig(hass: Hass) {
    const entity = Object.keys(hass.states).find((e) => e.startsWith("sensor.") && e.endsWith("_water_weight"));
    return { entity: entity ?? "sensor.cat_fountain_water_weight" };
  }

  setConfig(config: FountainCardConfig) {
    if (!config?.entity) throw new Error("Set `entity` to the fountain's water weight sensor, e.g. sensor.cat_fountain_water_weight");
    this.config = config;
  }

  private ids() {
    const b = (k: string) => this.sib("binary_sensor", k);
    return {
      weight: this.sib("sensor", "water_weight") ?? this.config!.entity,
      low: b("water_low"),
      empty: b("water_empty"),
      running: b("pump_running"),
      adapter: b("power_adapter"),
      charging: b("charging"),
      cat: b("cat_detected"),
      filterDue: b("filter_due"),
      pump: this.sib("switch", "pump"),
      boost: this.sib("switch", "pump_boost"),
      dry: this.sib("switch", "dry_run_protection"),
      mode: this.sib("select", "pump_mode"),
      emptyT: this.sib("number", "water_empty_threshold"),
      lowT: this.sib("number", "water_low_threshold"),
      radar: this.sib("number", "radar_run_time"),
      filterLife: this.sib("number", "filter_life"),
      battery: this.sib("sensor", "battery"),
      filterDays: this.sib("sensor", "filter_days_left"),
      filterChanged: this.sib("button", "filter_changed"),
    };
  }

  protected watched() {
    return [this.config?.entity, ...Object.values(this.ids())];
  }

  protected historyKey() {
    // Refetch after a refill or when the cat sensor fires; otherwise every 5 minutes.
    const i = this.ids();
    return `${this.st(i.empty)?.state}|${this.st(i.cat)?.last_changed}`;
  }

  protected async loadHistory() {
    const i = this.ids();
    if (!this.hass) return;
    const now = Date.now();
    const s = await fetchStatistics(this.hass, [i.weight], now - 7 * 24 * HOUR, now, "5minute");
    this.stats = s[i.weight];
    if (i.cat) {
      const d = new Date(now);
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const h = await fetchHistory(this.hass, [i.cat], midnight, now, true);
      this.visits = onTimes(h[i.cat]).length;
    }
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    if (!this.hass.states[this.config.entity]) {
      return html`<ha-card><ha-alert alert-type="warning">Entity not found: ${this.config.entity}</ha-alert></ha-card>`;
    }
    return html`<ha-card>${this.settings ? this.renderSettings() : this.renderMain()}</ha-card>`;
  }

  private renderMain() {
    const i = this.ids();
    const now = Date.now();
    const lang = this.language();
    const name = this.config!.name ?? "Fountain";
    const cap = this.config!.capacity_grams ?? DEFAULT_CAPACITY_G;
    const weight = this.num(i.weight);
    const online = this.st(i.weight)?.state !== "unavailable";
    const status = fountainStatus({ online, empty: this.on(i.empty), low: this.on(i.low) });
    const running = this.on(i.running);
    const tone: PetTone = !online ? "idle" : status.tone !== "ok" ? status.tone : running ? "active" : "ok";
    const emptyT = this.num(i.emptyT);
    const lowT = this.num(i.lowT);
    const ticks: Tick[] = [
      ...(emptyT !== undefined ? [{ at: emptyT / cap, cls: "error" as const }] : []),
      ...(lowT !== undefined ? [{ at: lowT / cap, cls: "warn" as const }] : []),
    ];
    const marks: Mark[] = [
      ...(emptyT !== undefined ? [{ v: emptyT, cls: "error" as const }] : []),
      ...(lowT !== undefined ? [{ v: lowT, cls: "warn" as const }] : []),
    ];
    const day = this.stats.filter((p) => p.t >= now - 24 * HOUR);
    if (weight !== undefined) day.push({ t: now, v: weight });
    const used = waterUsedPerDay(this.stats, now, 7);
    const filterDays = this.num(i.filterDays);
    const onBattery = this.st(i.adapter)?.state === "off";

    return html`
      <div class="head">
        <div class="art">${fountainArt({ fraction: weight === undefined ? undefined : weight / cap, tone, flowing: online && running, ticks })}</div>
        <div class="facts">
          <div class="title">
            <span class="name">${name}</span>
            <button class="gear" aria-label="${name} settings" @click=${() => (this.settings = true)}><ha-icon icon="mdi:cog-outline"></ha-icon></button>
          </div>
          <span class="status" data-tone=${status.tone}>${status.label}</span>
          ${online && weight !== undefined
            ? html`<span class="line num"><b>${(weight / 1000).toLocaleString(lang, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} L</b> ·
                ${pumpReason({ running, wanted: this.on(i.pump), empty: this.on(i.empty) })}</span>`
            : nothing}
          ${this.st(i.dry)?.state === "off" ? html`<span class="line warn">Dry-run protection is off</span>` : nothing}
          <span class="line">
            ${this.visits !== undefined ? html`${plural(this.visits, "visit")} today · ` : nothing}
            ${this.on(i.filterDue)
              ? html`<b>Filter due</b>`
              : filterDays !== undefined
                ? html`Filter ${plural(Math.max(0, Math.round(filterDays)), "day")} left`
                : "Filter not tracked yet"}
          </span>
          ${onBattery
            ? html`<span class="line">On battery · ${this.num(i.battery) ?? "–"}%${this.on(i.charging) ? " · charging" : ""}</span>`
            : nothing}
        </div>
      </div>
      <section>
        <h3>Last 24 hours ${weight !== undefined ? html`<span class="hint num">${Math.round(weight).toLocaleString(lang)} g</span>` : nothing}</h3>
        ${lineChart([day], { t0: now - 24 * HOUR, t1: now, marks, area: true, pad: 40, label: "Water in the tank, last 24 hours" })}
      </section>
      <section>
        <h3>Used per day <span class="hint num">≈ ${Math.round(used[used.length - 1]).toLocaleString(lang)} ml today</span></h3>
        ${bars(used, "Water used per day (drinking and evaporation), last 7 days")} ${dayLabels(7, now, lang)}
      </section>
      <div class="actions">
        <button class="btn" aria-pressed=${this.on(i.pump) ? "true" : "false"} ?disabled=${!i.pump || !online} @click=${() => this.toggle(i.pump)}>
          <ha-icon icon="mdi:pump"></ha-icon>${this.on(i.pump) ? "Pump on" : "Pump off"}
        </button>
        <button
          class="btn ${this.confirming === "filter" ? "confirm" : ""}"
          ?disabled=${!i.filterChanged || !online}
          @click=${() => this.confirm("filter", () => this.press(i.filterChanged))}
        >
          <ha-icon icon="mdi:filter-check-outline"></ha-icon>${this.confirming === "filter" ? "Start new filter?" : "New filter"}
        </button>
      </div>
    `;
  }

  private renderSettings() {
    const i = this.ids();
    const name = this.config!.name ?? "Fountain";
    const mode = this.st(i.mode);
    const numRow = (id: string | undefined, label: string, sub: string) => {
      if (!id) return nothing;
      const a = this.st(id)?.attributes ?? {};
      return html`<div class="row">
        <span class="label">${label}<small>${sub}</small></span>
        <span class="controls">
          <input
            type="number"
            aria-label=${label}
            min=${a.min ?? 0}
            max=${a.max ?? 10000}
            step=${a.step ?? 1}
            .value=${this.num(id) === undefined ? "" : String(this.num(id))}
            @change=${(e: Event) => this.setNumber(id, Number((e.target as HTMLInputElement).value))}
          />
          <small>${a.unit_of_measurement ?? ""}</small>
        </span>
      </div>`;
    };
    const dryOn = this.on(i.dry);
    return html`
      ${settingsTitle(name, () => (this.settings = false))}
      <section>
        <h3>Pump</h3>
        <div class="rows">
          ${mode
            ? html`<div class="row">
                <span class="label">Mode<small>Radar modes run only after a cat is seen</small></span>
                <select aria-label="Pump mode" @change=${(e: Event) => this.select(i.mode, (e.target as HTMLSelectElement).value)}>
                  ${(mode.attributes.options ?? []).map((o: string) => html`<option .value=${o} ?selected=${o === mode.state}>${o}</option>`)}
                </select>
              </div>`
            : nothing}
          ${i.boost ? html`<div class="row"><span class="label">Boost<small>Stronger flow</small></span>${toggle(this.on(i.boost), "Pump boost", () => this.toggle(i.boost))}</div>` : nothing}
          ${numRow(i.radar, "Radar run time", "How long the pump runs after a cat is seen")}
          ${i.dry
            ? html`<div class="row">
                <span class="label">Dry-run protection<small>${this.confirming === "dry" ? "Tap again to turn it off" : "Stops the pump below Water empty"}</small></span>
                ${toggle(dryOn, "Dry-run protection", () => (dryOn ? this.confirm("dry", () => this.toggle(i.dry)) : this.toggle(i.dry)), this.confirming === "dry")}
              </div>`
            : nothing}
        </div>
      </section>
      <section>
        <h3>Water and filter</h3>
        <div class="rows">
          ${numRow(i.emptyT, "Water empty", "Below this the pump stops")}
          ${numRow(i.lowT, "Water low", "Below this it asks for a refill")}
          ${numRow(i.filterLife, "Filter life", "Days between filter changes")}
        </div>
        <span class="note">Full tank: ${this.config!.capacity_grams ?? DEFAULT_CAPACITY_G} g (card option <code>capacity_grams</code>).</span>
      </section>
    `;
  }
}
