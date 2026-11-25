import { html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { litterArt } from "../art/litter";
import { ago, plural } from "../lib/format";
import type { Hass } from "../lib/hass";
import { fetchHistory } from "../lib/history";
import { assignCat, dailyWeights, litterStatus, visitsPerCat, weighings, type Cat, type Weighing } from "../lib/litter";
import type { PetTone } from "../lib/tone";
import { PetCard, type PetCardConfig } from "./base";
import { dayLabels, lineChart, settingsTitle, stacked, toggle } from "./parts";
import { petStyles } from "./pet-styles";

export interface LitterCardConfig extends PetCardConfig {
  /** Optional entity holding the last clean cycle time (e.g. an input_datetime an automation sets). */
  last_cycle?: string;
  /** Cats by weight, lightest first; leave `max_lb` off the heaviest. */
  cats?: Cat[];
}

const DAY = 86_400_000;

/** A Litter-Robot: litter and drawer levels, last cycle, weight and visits per cat, settings. */
export class BrinstarLitterCard extends PetCard<LitterCardConfig> {
  static styles = petStyles;
  @state() private weights: Weighing[] = [];

  static getStubConfig(hass: Hass) {
    const entity = Object.keys(hass.states).find((e) => e.startsWith("vacuum.") && e.includes("litter"));
    return { entity: entity ?? "vacuum.litter_robot_litter_box" };
  }

  setConfig(config: LitterCardConfig) {
    if (!config?.entity?.startsWith("vacuum.")) throw new Error("Set `entity` to the Litter-Robot's vacuum entity, e.g. vacuum.litter_robot_litter_box");
    this.config = config;
  }

  private cats(): Cat[] {
    return this.config?.cats?.length ? this.config.cats : [{ name: "Cat" }];
  }

  private ids() {
    const s = (k: string) => this.sib("sensor", k);
    return {
      litter: s("litter_level"),
      drawer: s("waste_drawer"),
      weight: s("pet_weight"),
      code: s("status_code"),
      hopper: s("hopper_status"),
      laser: this.sib("binary_sensor", "laser_dirty"),
      delay: this.sib("select", "cycle_delay"),
      globe: this.sib("select", "globe_light"),
      globeBrightness: this.sib("select", "globe_brightness"),
      panel: this.sib("select", "brightness_level"),
      night: this.sib("switch", "night_light_mode"),
      lockout: this.sib("switch", "panel_lockout"),
      reset: this.sib("button", "reset"),
    };
  }

  protected watched() {
    return [this.config?.entity, this.config?.last_cycle, ...Object.values(this.ids())];
  }

  protected historyKey() {
    return `${this.st(this.ids().weight)?.last_changed}`;
  }

  protected async loadHistory() {
    const { weight } = this.ids();
    if (!weight || !this.hass) return;
    const now = Date.now();
    const h = await fetchHistory(this.hass, [weight], now - 30 * DAY, now, false);
    this.weights = weighings(h[weight]);
  }

  private lastCycle(): number | undefined {
    const id = this.config!.last_cycle;
    const raw = id ? this.val(id) : this.st(this.config!.entity)?.last_changed;
    const t = raw ? Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T")) : NaN;
    return Number.isNaN(t) ? undefined : t;
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
    const name = this.config!.name ?? "Litter box";
    const vac = this.st(this.config!.entity)!;
    const online = vac.state !== "unavailable";
    const drawer = this.num(i.drawer);
    const litter = this.num(i.litter);
    const status = litterStatus({ online, state: vac.state, code: this.val(i.code) ?? "", drawerPct: drawer ?? 0 });
    const drawerTone: PetTone = drawer === undefined ? "idle" : drawer > 80 ? "error" : drawer > 75 ? "warn" : "ok";
    const last = this.lastCycle();
    const hopper = this.val(i.hopper);
    const cats = this.cats();
    const unit = this.st(i.weight)?.attributes.unit_of_measurement ?? "lb";
    const recent = this.weights.filter((w) => w.t >= now - 7 * DAY);
    const visits = visitsPerCat(recent, cats, now, 7);
    const today = visits.reduce((sum, row) => sum + row[row.length - 1], 0);
    const trend = dailyWeights(this.weights, cats, now, 30);
    const first = Math.min(...trend.flat().map((p) => p.t), now);
    const latest = cats.map((_, c) => [...this.weights].reverse().find((w) => assignCat(w.lb, cats) === c));

    return html`
      <div class="head">
        <div class="art">${litterArt({ litter: litter === undefined ? undefined : litter / 100, drawer: drawer === undefined ? undefined : drawer / 100, tone: online ? status.tone : "idle", drawerTone })}</div>
        <div class="facts">
          <div class="title">
            <span class="name">${name}</span>
            <button class="gear" aria-label="${name} settings" @click=${() => (this.settings = true)}><ha-icon icon="mdi:cog-outline"></ha-icon></button>
          </div>
          <span class="status" data-tone=${status.tone}>${status.label}</span>
          ${last !== undefined ? html`<span class="line">Last cycle <b>${ago(last, now)}</b></span>` : nothing}
          <span class="line num">Litter <b>${litter ?? "–"}%</b> · Drawer <b>${drawer ?? "–"}%</b></span>
          ${this.on(i.laser) ? html`<span class="line warn">Clean the cat sensor</span>` : nothing}
          ${hopper && !["enabled", "disabled"].includes(hopper) ? html`<span class="line warn">LitterHopper: ${hopper.replace(/_/g, " ")}</span>` : nothing}
        </div>
      </div>
      <section>
        <h3>Weight <span class="hint">daily average${first < now - 2 * DAY ? `, ${Math.round((now - first) / DAY) + 1} days` : ""}</span></h3>
        ${lineChart(trend, { t0: first - DAY / 2, t1: now, pad: 0.5, label: "Each cat's average weight per day, last 30 days" })}
        <div class="legend">
          ${cats.map(
            (c, n) =>
              html`<span><i class="s${n % 3}"></i>${c.name}${latest[n] ? html` <b class="num">${latest[n]!.lb.toLocaleString(lang, { maximumFractionDigits: 1 })} ${unit}</b>` : nothing}</span>`,
          )}
        </div>
      </section>
      <section>
        <h3>Visits per day <span class="hint num">${plural(today, "visit")} today</span></h3>
        ${stacked(visits, "Visits per cat per day, last 7 days")} ${dayLabels(7, now, lang)}
      </section>
      <div class="actions">
        <button
          class="btn primary ${this.confirming === "clean" ? "confirm" : ""}"
          ?disabled=${!online}
          @click=${() => this.confirm("clean", () => this.call("vacuum", "start", { entity_id: this.config!.entity }))}
        >
          <ha-icon icon="mdi:rotate-right"></ha-icon>${this.confirming === "clean" ? "Start a clean cycle?" : "Clean now"}
        </button>
      </div>
    `;
  }

  private renderSettings() {
    const i = this.ids();
    const name = this.config!.name ?? "Litter box";
    const selectRow = (id: string | undefined, label: string, sub?: string) => {
      const e = this.st(id);
      if (!id || !e) return nothing;
      const unit = e.attributes.unit_of_measurement ? ` ${e.attributes.unit_of_measurement}` : "";
      return html`<div class="row">
        <span class="label">${label}${sub ? html`<small>${sub}</small>` : nothing}</span>
        <select aria-label=${label} @change=${(ev: Event) => this.select(id, (ev.target as HTMLSelectElement).value)}>
          ${(e.attributes.options ?? []).map((o: string) => html`<option .value=${o} ?selected=${o === e.state}>${o.replace(/_/g, " ")}${unit}</option>`)}
        </select>
      </div>`;
    };
    const switchRow = (id: string | undefined, label: string, sub?: string) =>
      id && this.st(id)
        ? html`<div class="row"><span class="label">${label}${sub ? html`<small>${sub}</small>` : nothing}</span>${toggle(this.on(id), label, () => this.toggle(id))}</div>`
        : nothing;
    return html`
      ${settingsTitle(name, () => (this.settings = false))}
      <section>
        <h3>Cleaning</h3>
        <div class="rows">${selectRow(i.delay, "Clean cycle wait", "After a cat leaves")}</div>
      </section>
      <section>
        <h3>Lights and panel</h3>
        <div class="rows">
          ${selectRow(i.globe, "Globe light")} ${selectRow(i.globeBrightness, "Globe brightness")} ${selectRow(i.panel, "Panel brightness")}
          ${switchRow(i.night, "Night light")} ${switchRow(i.lockout, "Panel lockout", "Locks the buttons on the robot")}
        </div>
      </section>
      ${i.reset
        ? html`<section>
            <h3>Robot</h3>
            <div class="rows">
              <div class="row">
                <span class="label">Reset<small>Restarts the robot. Use it to clear a fault.</small></span>
                <button class="btn ${this.confirming === "reset" ? "confirm" : ""}" style="flex:none" @click=${() => this.confirm("reset", () => this.press(i.reset))}>
                  ${this.confirming === "reset" ? "Reset now?" : "Reset"}
                </button>
              </div>
            </div>
          </section>`
        : nothing}
    `;
  }
}
