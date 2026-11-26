import { css, html, nothing, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { BaseCard } from "../lib/base-card";
import { favouritesOff, lightsHeadline, lightsOn, type LightOn, type LightRef } from "../lib/lights";
import { homeStyles } from "./home-styles";

export interface LightsCardConfig {
  type: string;
  /** Every light the card knows, in the order to list them; `icon` is the icon of its area. */
  lights: { entity: string; name?: string; icon?: string }[];
  /** Lights offered as one-tap "turn on" buttons while they're off. */
  favourites?: string[];
  /** More entities for All off to switch off (e.g. a switch that drives several lights). */
  all_off_extra?: string[];
}

/**
 * The lights that are on, each with a switch and (for dimmers) a brightness slider, and All off;
 * under them, the favourites that are off as one-tap "turn on" buttons with their area's icon.
 * When everything is off the card is one quiet line plus the favourites.
 */
export class BrinstarLightsCard extends BaseCard<LightsCardConfig> {
  /** Brightness while a slider is being dragged, so the fill follows the thumb. */
  @state() private dragging?: { id: string; pct: number };

  static styles = [
    homeStyles,
    css`
      ha-card.lit { box-shadow: 0 8px 26px -14px color-mix(in srgb, var(--bp-lamp) 70%, transparent), var(--ha-card-box-shadow, none); }
      .title .name { font-size: 1.05rem; }
      .list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
      @container (min-width: 520px) { .list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .light {
        box-sizing: border-box; position: relative; overflow: hidden; display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 12px;
        border-radius: 18px; border: 1px solid color-mix(in srgb, var(--bp-lamp) 28%, var(--bp-line));
        background: color-mix(in srgb, var(--bp-lamp) 7%, var(--bp-card));
      }
      .light .fill { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--bp-lamp) 22%, transparent); pointer-events: none; transition: width 0.3s ease; }
      .light .ico { position: relative; width: 36px; height: 36px; --mdc-icon-size: 20px; }
      .light .txt { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .light b { font-size: 0.92rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .light .lvl { font-size: 0.78rem; font-weight: 500; color: var(--bp-muted); font-variant-numeric: tabular-nums; }
      .light input[type="range"] { pointer-events: auto; width: 100%; margin: 4px 0 0; accent-color: var(--bp-lamp); height: 18px; cursor: pointer; }
      .switch {
        position: relative; flex: none; width: 48px; height: 28px; border-radius: 14px; border: 0; padding: 0; cursor: pointer;
        background: var(--bp-lamp);
      }
      .switch::after { content: ""; position: absolute; top: 3px; left: 23px; width: 22px; height: 22px; border-radius: 50%; background: var(--bp-card); transition: left 0.2s ease; }
      .switch:focus-visible, .fav:focus-visible, .act:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; }
      .act {
        flex: none; min-height: 36px; padding: 0 14px; border-radius: 18px; border: 1px solid var(--bp-line); background: none;
        color: var(--bp-text); font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; --mdc-icon-size: 18px;
      }
      .favs { display: flex; flex-direction: column; gap: 8px; }
      .favs .label { font-size: 0.8rem; font-weight: 600; color: var(--bp-muted); }
      .favs .row { display: flex; flex-wrap: wrap; gap: 8px; }
      .light + .favs, .list + .favs { border-top: 1px solid var(--bp-line); padding-top: 12px; }
      .fav {
        display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px 0 6px; border-radius: 20px;
        border: 1px solid var(--bp-line); background: none; color: var(--bp-text); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
        transition: transform 0.15s ease, background 0.2s ease;
      }
      .fav:active { transform: scale(0.96); }
      .fav span.i { width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--bp-well); color: var(--bp-muted); --mdc-icon-size: 18px; }
    `,
  ];

  setConfig(config: LightsCardConfig) {
    if (!config?.lights?.length) throw new Error("Set lights to the lights the card should show");
    this.config = config;
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  protected watched() {
    return [...this.config!.lights.map((l) => l.entity), ...(this.config!.all_off_extra ?? [])];
  }

  private refs(): LightRef[] {
    return this.config!.lights.map((l) => ({
      entity: l.entity,
      name: l.name ?? this.st(l.entity)?.attributes.friendly_name ?? l.entity,
      icon: l.icon ?? "mdi:lightbulb",
    }));
  }

  private turn(id: string, on: boolean, data: Record<string, unknown> = {}) {
    this.call(id.split(".")[0], on ? "turn_on" : "turn_off", { entity_id: id, ...data });
  }

  private allOff() {
    const ids = [...this.config!.lights.map((l) => l.entity), ...(this.config!.all_off_extra ?? [])];
    this.call("homeassistant", "turn_off", { entity_id: ids });
  }

  private row(l: LightOn): TemplateResult {
    const pct = this.dragging?.id === l.entity ? this.dragging.pct : l.pct;
    return html`<div class="light">
      ${l.dimmable ? html`<span class="fill" style="width:${pct}%"></span>` : nothing}
      <span class="ico lit"><ha-icon icon=${l.icon}></ha-icon></span>
      <div class="txt">
        <b>${l.name}</b>
        <span class="lvl">${l.dimmable ? `${pct}%` : "On"}</span>
        ${l.dimmable
          ? html`<input type="range" min="1" max="100" .value=${String(pct)} aria-label="${l.name} brightness"
              @input=${(e: Event) => (this.dragging = { id: l.entity, pct: Number((e.target as HTMLInputElement).value) })}
              @change=${(e: Event) => {
                this.turn(l.entity, true, { brightness_pct: Number((e.target as HTMLInputElement).value) });
                this.dragging = undefined;
              }} />`
          : nothing}
      </div>
      <button class="switch" role="switch" aria-checked="true" aria-label="Turn off ${l.name}" title="Turn off ${l.name}"
        @click=${() => this.turn(l.entity, false)}></button>
    </div>`;
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const refs = this.refs();
    const on = lightsOn(refs, this.hass.states);
    const favs = favouritesOff(this.config.favourites ?? [], refs, this.hass.states);
    return html`<ha-card class=${on.length ? "lit" : ""}>
      <div class="body">
        <div class="title">
          <span class="ico ${on.length ? "lit" : ""}"><ha-icon icon=${on.length ? "mdi:lightbulb-group" : "mdi:lightbulb-group-off-outline"}></ha-icon></span>
          <span class="name">${lightsHeadline(on.length)}</span>
          ${on.length ? html`<button class="act" @click=${() => this.allOff()}><ha-icon icon="mdi:lightbulb-group-off-outline"></ha-icon>All off</button>` : nothing}
        </div>
        ${on.length ? html`<div class="list">${on.map((l) => this.row(l))}</div>` : nothing}
        ${favs.length
          ? html`<div class="favs">
              <span class="label">Turn on</span>
              <div class="row">
                ${favs.map((f) => html`<button class="fav" aria-label="Turn on ${f.name}" @click=${() => this.turn(f.entity, true)}>
                  <span class="i"><ha-icon icon=${f.icon}></ha-icon></span>${f.name}</button>`)}
              </div>
            </div>`
          : nothing}
      </div>
    </ha-card>`;
  }
}
