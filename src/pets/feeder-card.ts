import { html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { feederArt } from "../art/feeder";
import { feedKind, feederStatus, feedsFromHistory, foodEstimate, nextMeal, type Feed, type Meal } from "../lib/feeder";
import { plural, when } from "../lib/format";
import type { Hass } from "../lib/hass";
import { fetchHistory, sumPerDay } from "../lib/history";
import { PetCard, type PetCardConfig } from "./base";
import { bars, dayLabels, settingsTitle, stepper, toggle } from "./parts";
import { petStyles } from "./pet-styles";

export interface FeederCardConfig extends PetCardConfig {
  /** What a full hopper holds. */
  hopper_grams?: number;
  /** Weight of one scoop (weigh a few and divide). */
  grams_per_scoop?: number;
}

const DAY = 86_400_000;
const DEFAULT_HOPPER_G = 1300;
const DEFAULT_SCOOP_G = 10;

/** An ESPHome cat feeder: food left (estimated), last and next meal, feed now, meal settings. */
export class BrinstarFeederCard extends PetCard<FeederCardConfig> {
  static styles = petStyles;
  @state() private feeds: Feed[] = [];

  static getStubConfig(hass: Hass) {
    const entity = Object.keys(hass.states).find((e) => e.startsWith("sensor.") && e.endsWith("_last_fed"));
    return { entity: entity ?? "sensor.cat_feeder_last_fed" };
  }

  setConfig(config: FeederCardConfig) {
    if (!config?.entity) throw new Error("Set `entity` to any entity of the feeder, e.g. sensor.cat_feeder_last_fed");
    this.config = config;
  }

  private ids() {
    return {
      lastFed: this.sib("sensor", "last_fed"),
      scoops: this.sib("sensor", "dispensed_food_scoops"),
      signal: this.sib("sensor", "signal"),
      low: this.sib("binary_sensor", "food_low"),
      empty: this.sib("binary_sensor", "food_empty"),
      jammed: this.sib("binary_sensor", "jammed"),
      dispense: this.sib("button", "dispense_food"),
      refill: this.sib("button", "reset_food_level_refilled"),
      amount: this.sib("number", "manual_dispense_scoops"),
      threshold: this.sib("number", "low_food_threshold"),
      mute: this.sib("switch", "mute_sounds"),
      chime: this.sib("switch", "hourly_low_food_chime"),
      meals: [1, 2, 3, 4].map((i) => ({ time: this.sib("time", `meal_${i}_time`), scoops: this.sib("number", `meal_${i}_scoops`) })),
    };
  }

  protected watched() {
    const i = this.ids();
    return [this.config?.entity, ...Object.values(i).filter((v): v is string => typeof v === "string"), ...i.meals.flatMap((m) => [m.time, m.scoops])];
  }

  protected historyKey() {
    const i = this.ids();
    return `${this.val(i.lastFed)}|${this.st(i.refill)?.state}`;
  }

  private refillAt(): number | undefined {
    const t = Date.parse(this.st(this.ids().refill)?.state ?? "");
    return Number.isNaN(t) ? undefined : t;
  }

  protected async loadHistory() {
    const { lastFed, scoops } = this.ids();
    if (!lastFed || !scoops || !this.hass) return;
    const now = Date.now();
    const start = Math.max(now - 60 * DAY, Math.min(now - 7 * DAY, this.refillAt() ?? now));
    const h = await fetchHistory(this.hass, [lastFed, scoops], start, now, true);
    this.feeds = feedsFromHistory(h[lastFed], h[scoops]);
  }

  private meals(): Meal[] {
    return this.ids().meals.map((m) => ({ time: this.val(m.time) ?? "", scoops: this.num(m.scoops) ?? 0 }));
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
    const name = this.config!.name ?? "Feeder";
    const online = this.st(i.signal)?.state !== "unavailable" && this.st(this.config!.entity)?.state !== "unavailable";
    const status = feederStatus({ online, jammed: this.on(i.jammed), empty: this.on(i.empty), low: this.on(i.low) });
    const est = foodEstimate({
      feeds: this.feeds,
      refillAt: this.refillAt(),
      hopperGrams: this.config!.hopper_grams ?? DEFAULT_HOPPER_G,
      gramsPerScoop: this.config!.grams_per_scoop ?? DEFAULT_SCOOP_G,
      now,
    });
    const meals = this.meals();
    const lastAt = Date.parse(this.val(i.lastFed) ?? "");
    const lastScoops = this.num(i.scoops);
    const kind = Number.isNaN(lastAt) ? undefined : feedKind(lastAt, meals);
    const next = nextMeal(meals, now);
    const perDay = sumPerDay(this.feeds.map((f) => ({ t: f.at, v: f.scoops })), now, 7);
    const amount = this.num(i.amount);
    const amountAttrs = this.st(i.amount)?.attributes ?? {};
    const fallback = this.on(i.empty) ? 0.04 : this.on(i.low) ? 0.2 : 0.55;

    return html`
      <div class="head">
        <div class="art">${feederArt({ fraction: est?.fraction, fallback, tone: online ? status.tone : "idle" })}</div>
        <div class="facts">
          <div class="title">
            <span class="name">${name}</span>
            <button class="gear" aria-label="${name} settings" @click=${() => (this.settings = true)}><ha-icon icon="mdi:cog-outline"></ha-icon></button>
          </div>
          <span class="status" data-tone=${status.tone}>${status.label}</span>
          ${est
            ? html`<span class="line num"><b>≈ ${Math.round(est.leftGrams / 10) * 10} g left</b>${est.daysLeft !== undefined
                  ? ` · ${est.daysLeft < 1 ? "under a day" : `about ${plural(Math.round(est.daysLeft), "day")}`}`
                  : nothing}</span>`
            : html`<span class="line">Tap <b>I refilled it</b> after filling to start the food estimate</span>`}
          ${Number.isNaN(lastAt)
            ? html`<span class="line">Not fed yet</span>`
            : html`<span class="line">Last <b>${when(lastAt, now, lang)}</b> · ${kind !== undefined ? `Meal ${kind + 1}` : "Manual"}${lastScoops !== undefined
                  ? ` · ${plural(lastScoops, "scoop")}`
                  : nothing}</span>`}
          <span class="line">${next ? html`Next <b>${when(next.at, now, lang)}</b> · ${plural(next.scoops, "scoop")}` : "No meals scheduled"}</span>
        </div>
      </div>
      <section>
        <h3>Scoops per day <span class="hint num">${plural(perDay[perDay.length - 1], "scoop")} today</span></h3>
        ${bars(perDay, "Scoops dispensed per day, last 7 days")} ${dayLabels(7, now, lang)}
      </section>
      <div class="actions">
        ${stepper(amount, {
          min: amountAttrs.min ?? 1,
          max: amountAttrs.max ?? 6,
          step: amountAttrs.step ?? 1,
          unit: (n) => plural(n, "scoop"),
          label: "Scoops to feed now",
          onChange: (v) => this.setNumber(i.amount, v),
        })}
        <button
          class="btn primary ${this.confirming === "feed" ? "confirm" : ""}"
          ?disabled=${!online || !i.dispense}
          @click=${() => this.confirm("feed", () => this.press(i.dispense))}
        >
          <ha-icon icon="mdi:food-drumstick-outline"></ha-icon>${this.confirming === "feed" ? `Feed ${plural(amount ?? 1, "scoop")}?` : "Feed now"}
        </button>
      </div>
      <div class="actions">
        <button
          class="btn ${this.confirming === "refill" ? "confirm" : ""}"
          ?disabled=${!i.refill}
          @click=${() => this.confirm("refill", () => this.press(i.refill))}
        >
          <ha-icon icon="mdi:refresh"></ha-icon>${this.confirming === "refill" ? "Mark as full?" : "I refilled it"}
        </button>
        <button
          class="btn icon"
          aria-label="Mute sounds"
          aria-pressed=${this.on(i.mute) ? "true" : "false"}
          ?disabled=${!i.mute}
          @click=${() => this.toggle(i.mute)}
        >
          <ha-icon icon=${this.on(i.mute) ? "mdi:volume-off" : "mdi:volume-high"}></ha-icon>
        </button>
      </div>
    `;
  }

  private renderSettings() {
    const i = this.ids();
    const name = this.config!.name ?? "Feeder";
    const numRow = (id: string | undefined, label: string, sub: string, unit?: (n: number) => string) => {
      if (!id) return nothing;
      const a = this.st(id)?.attributes ?? {};
      return html`<div class="row">
        <span class="label">${label}<small>${sub}</small></span>
        <span class="controls">${stepper(this.num(id), { min: a.min ?? 0, max: a.max ?? 10, step: a.step ?? 1, unit, label, onChange: (v) => this.setNumber(id, v) })}</span>
      </div>`;
    };
    return html`
      ${settingsTitle(name, () => (this.settings = false))}
      <section>
        <h3>Meals</h3>
        <div class="rows">
          ${i.meals.map((m, n) => {
            if (!m.time || !m.scoops) return nothing;
            const scoops = this.num(m.scoops) ?? 0;
            const a = this.st(m.scoops)?.attributes ?? {};
            return html`<div class="row">
              <span class="label short">Meal ${n + 1}${scoops ? nothing : html`<small>Skipped</small>`}</span>
              <span class="controls">
                <input
                  type="time"
                  aria-label="Meal ${n + 1} time"
                  .value=${(this.val(m.time) ?? "").slice(0, 5)}
                  @change=${(e: Event) => this.call("time", "set_value", { entity_id: m.time, time: `${(e.target as HTMLInputElement).value}:00` })}
                />
                ${stepper(scoops, { min: a.min ?? 0, max: a.max ?? 6, step: a.step ?? 1, label: `Meal ${n + 1} scoops`, compact: true, onChange: (v) => this.setNumber(m.scoops, v) })}
              </span>
            </div>`;
          })}
        </div>
        <span class="note">Time, then scoops. 0 scoops skips a meal.</span>
      </section>
      <section>
        <h3>Feeder</h3>
        <div class="rows">
          ${numRow(i.threshold, "Low-food threshold", "Food sensor count that means low")}
          ${i.chime
            ? html`<div class="row"><span class="label">Hourly low-food chime<small>While food is low</small></span>${toggle(this.on(i.chime), "Hourly low-food chime", () => this.toggle(i.chime))}</div>`
            : nothing}
          ${i.mute ? html`<div class="row"><span class="label">Mute sounds</span>${toggle(this.on(i.mute), "Mute sounds", () => this.toggle(i.mute))}</div>` : nothing}
        </div>
        <span class="note">
          Estimate: ${this.config!.hopper_grams ?? DEFAULT_HOPPER_G} g hopper, ${this.config!.grams_per_scoop ?? DEFAULT_SCOOP_G} g per scoop
          (card options <code>hopper_grams</code>, <code>grams_per_scoop</code>).
        </span>
      </section>
    `;
  }
}
