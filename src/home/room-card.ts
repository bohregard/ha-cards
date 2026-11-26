import { css, html, nothing } from "lit";
import { airSummary } from "../lib/air";
import { BaseCard } from "../lib/base-card";
import { detections, OBJECTS } from "../lib/frigate";
import { navigate } from "../lib/nav";
import { homeStyles } from "./home-styles";

export interface RoomCardConfig {
  type: string;
  name: string;
  icon?: string;
  /** The card's one action: toggled by the room icon. */
  light?: string;
  /** Every light in the room, for "2 on". */
  lights?: string[];
  temperature?: string;
  humidity?: string;
  pm25?: string;
  voc?: string;
  /** Frigate camera names whose person/cat/dog occupancy counts for this room. */
  frigate?: string[];
  navigation_path?: string;
}

const OBJECT_ICON: Record<string, string> = { person: "mdi:account", cat: "mdi:cat", dog: "mdi:dog" };
const OBJECT_NAME: Record<string, string> = { person: "Person", cat: "Cat", dog: "Dog" };

/**
 * One room at a glance: its main light (the icon is the switch), temperature, humidity, what
 * Frigate sees right now and the air. The rest of the card opens the room's page.
 */
export class BrinstarRoomCard extends BaseCard<RoomCardConfig> {
  static styles = [
    homeStyles,
    css`
      ha-card { gap: 10px; min-height: 120px; }
      .body { gap: 10px; flex: 1; }
      .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
      .seen { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
      .chip {
        display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 9px 0 7px; border-radius: 13px;
        font-size: 0.75rem; font-weight: 600; --mdc-icon-size: 16px;
        color: var(--bp-active); background: color-mix(in srgb, var(--bp-active) 14%, transparent);
      }
      .chip.solo { padding: 0; width: 26px; justify-content: center; }
      .name { font-size: 0.95rem; font-weight: 600; line-height: 1.25; }
      .line { font-size: 0.8rem; font-weight: 500; color: var(--bp-muted); line-height: 1.35; }
      .text { margin-top: auto; display: flex; flex-direction: column; gap: 2px; }
      ha-card.lit { box-shadow: 0 8px 26px -14px color-mix(in srgb, var(--bp-lamp) 70%, transparent), var(--ha-card-box-shadow, none); }
    `,
  ];

  setConfig(config: RoomCardConfig) {
    if (!config?.name) throw new Error("Set a name for the room");
    this.config = config;
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 4, rows: "auto" };
  }

  protected watched() {
    const c = this.config!;
    return [
      c.light, ...(c.lights ?? []), c.temperature, c.humidity, c.pm25, c.voc,
      ...(c.frigate ?? []).flatMap((cam) => OBJECTS.map((o) => `binary_sensor.${cam}_${o}_occupancy`)),
    ];
  }

  private open(e: Event) {
    e.preventDefault();
    if (this.config?.navigation_path) navigate(this.config.navigation_path);
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config;
    const light = this.st(c.light);
    const lit = this.on(c.light);
    const temp = this.num(c.temperature);
    const hum = this.num(c.humidity);
    const lights = c.lights ?? [];
    const onCount = lights.filter((id) => this.on(id)).length;
    const facts = [
      temp !== undefined ? `${Math.round(temp)}°` : undefined,
      hum !== undefined ? `${Math.round(hum)}%` : undefined,
      lights.length ? (onCount ? `${onCount} on` : "Lights off") : c.light ? (lit ? "On" : "Off") : undefined,
    ].filter(Boolean);
    const seen = detections(this.hass.states, c.frigate ?? []);
    const air = airSummary({ pm25: this.num(c.pm25), voc: this.num(c.voc) });
    const lightName = light?.attributes.friendly_name ?? `${c.name} light`;
    const offline = !!c.light && (!light || light.state === "unavailable");

    return html`<ha-card class=${lit ? "lit" : ""}>
      ${c.navigation_path ? html`<a class="hit" href=${c.navigation_path} aria-label="Open ${c.name}" @click=${this.open}></a>` : nothing}
      <div class="body">
        <div class="top">
          ${c.light
            ? html`<button class="ico ${lit ? "lit" : ""}" aria-pressed=${lit ? "true" : "false"} ?disabled=${offline}
                aria-label="${lit ? "Turn off" : "Turn on"} ${lightName}" title="${lit ? "Turn off" : "Turn on"} ${lightName}"
                @click=${() => this.toggle(c.light)}><ha-icon icon=${c.icon ?? "mdi:lightbulb"}></ha-icon></button>`
            : html`<span class="ico"><ha-icon icon=${c.icon ?? "mdi:home"}></ha-icon></span>`}
          ${seen.length
            ? html`<div class="seen" aria-label="Seen now: ${seen.map((o) => OBJECT_NAME[o]).join(", ")}">
                ${seen.map((o) => html`<span class="chip ${seen.length > 1 ? "solo" : ""}" title=${OBJECT_NAME[o]}>
                  <ha-icon icon=${OBJECT_ICON[o]}></ha-icon>${seen.length > 1 ? nothing : OBJECT_NAME[o]}</span>`)}
              </div>`
            : nothing}
        </div>
        <div class="text">
          <span class="name">${c.name}</span>
          ${facts.length ? html`<span class="line num">${facts.join(" · ")}</span>` : nothing}
          ${offline ? html`<span class="line tone-error">Light offline</span>` : nothing}
          ${air ? html`<span class="line tone-${air.tone}">${air.text}</span>` : nothing}
        </div>
      </div>
    </ha-card>`;
  }
}
