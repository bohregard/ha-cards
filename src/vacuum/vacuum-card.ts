import { LitElement, html, nothing, svg, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { roomAt, vacuumToMap, type CalibrationPoint, type RoomBox } from "../lib/map";
import type { Hass, HassEntity } from "../lib/hass";
import { cleanCall, findSibling, stateTone, type ServiceCall } from "../lib/vacuum";
import { styles } from "./styles";

export interface VacuumCardConfig {
  type: string;
  entity: string;
  map_entity?: string;
  name?: string;
}

interface MapRoom extends RoomBox {
  name: string;
  icon?: string;
  x: number;
  y: number;
  order?: number;
  visibility?: string;
}

const CONFIRM_MS = 4000;

export class BrinstarVacuumCard extends LitElement {
  static styles = styles;

  @property({ attribute: false }) hass?: Hass;
  @state() private config?: VacuumCardConfig;
  @state() private selected: number[] = [];
  @state() private confirming = false;
  private confirmTimer?: number;

  static getStubConfig(hass: Hass) {
    const entity = Object.keys(hass.states).find((e) => e.startsWith("vacuum.")) ?? "vacuum.example";
    return { entity };
  }

  setConfig(config: VacuumCardConfig) {
    if (!config?.entity?.startsWith("vacuum.")) {
      throw new Error("Set `entity` to a vacuum entity, e.g. vacuum.my_robot");
    }
    this.config = config;
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as Hass | undefined;
    if (!old || !this.hass) return true;
    return this.watched().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.confirmTimer);
  }

  // ---------------------------------------------------------------- lookup --
  private sibling(domain: string, key: string): string | undefined {
    if (!this.hass?.entities || !this.config) return undefined;
    return findSibling(this.hass.entities, this.config.entity, domain, key);
  }

  private mapId(): string | undefined {
    return this.config?.map_entity ?? this.sibling("camera", "map");
  }

  private watched(): string[] {
    const ids = [this.config!.entity, this.mapId()];
    for (const key of ["current_room", "cleaning_progress"]) {
      ids.push(this.sibling("sensor", key));
    }
    for (const key of ["cleangenius", "cleangenius_mode", "suction_level", "cleaning_mode"]) {
      ids.push(this.sibling("select", key));
    }
    return ids.filter((x): x is string => !!x);
  }

  private stateOf(id?: string): HassEntity | undefined {
    return id ? this.hass?.states[id] : undefined;
  }

  private fmt(entity: HassEntity): string {
    return this.hass?.formatEntityState?.(entity) ?? entity.state;
  }

  private rooms(): MapRoom[] {
    const raw = (this.stateOf(this.mapId())?.attributes.rooms ?? {}) as Record<string, MapRoom>;
    return Object.values(raw)
      .filter((r) => r.visibility !== "Hidden")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // --------------------------------------------------------------- actions --
  private call(c: ServiceCall) {
    return this.hass?.callService(c.domain, c.service, c.data);
  }

  private vacuum(service: string) {
    return this.call({ domain: "vacuum", service, data: { entity_id: this.config!.entity } });
  }

  private toggleRoom(id: number) {
    this.selected = this.selected.includes(id) ? this.selected.filter((x) => x !== id) : [...this.selected, id];
  }

  private onMapTap(ev: MouseEvent) {
    const img = (ev.currentTarget as HTMLElement).querySelector("img");
    const cal = this.stateOf(this.mapId())?.attributes.calibration_points as CalibrationPoint[] | undefined;
    if (!img || !cal || !img.naturalWidth) return;
    const box = img.getBoundingClientRect();
    const pixel = {
      x: ((ev.clientX - box.left) * img.naturalWidth) / box.width,
      y: ((ev.clientY - box.top) * img.naturalHeight) / box.height,
    };
    const room = roomAt(
      Object.fromEntries(this.rooms().map((r) => [String(r.room_id), r])),
      cal,
      pixel,
    );
    if (room) this.toggleRoom(room.room_id);
  }

  private clean() {
    // Only send rooms that still exist on the current map.
    const valid = new Set(this.rooms().map((r) => r.room_id));
    this.call(cleanCall(this.config!.entity, this.selected.filter((id) => valid.has(id))));
    this.selected = [];
  }

  /** Docking mid-clean ends the job, so it takes a second tap. */
  private dock(running: boolean) {
    if (running && !this.confirming) {
      this.confirming = true;
      this.confirmTimer = window.setTimeout(() => (this.confirming = false), CONFIRM_MS);
      return;
    }
    window.clearTimeout(this.confirmTimer);
    this.confirming = false;
    this.vacuum("return_to_base");
  }

  private selectOption(entityId: string, option: string) {
    this.call({ domain: "select", service: "select_option", data: { entity_id: entityId, option } });
  }

  // ---------------------------------------------------------------- render --
  render() {
    if (!this.config || !this.hass) return nothing;
    const vac = this.stateOf(this.config.entity);
    if (!vac) {
      return html`<ha-card><ha-alert alert-type="warning">Entity not found: ${this.config.entity}</ha-alert></ha-card>`;
    }
    return html`<ha-card>
      ${this.renderHeader(vac)} ${this.renderMap()} ${this.renderRooms()} ${this.renderActions(vac)}
      ${this.renderSettings()}
    </ha-card>`;
  }

  private renderHeader(vac: HassEntity) {
    const a = vac.attributes;
    const tone = stateTone(vac.state, a);
    const room = this.stateOf(this.sibling("sensor", "current_room"));
    const running = vac.state === "cleaning";
    const progress = Number(this.stateOf(this.sibling("sensor", "cleaning_progress"))?.state ?? a.cleaning_progress);
    const battery = Number(a.battery ?? a.battery_level);
    const status = [
      capitalize(String(a.status ?? this.fmt(vac))),
      running && room && !["unknown", "unavailable", ""].includes(room.state) ? room.state : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const error = a.has_error && a.error && a.error !== "No error" ? String(a.error) : null;
    return html`
      <div class="head" data-tone=${tone}>
        <ha-icon icon=${a.icon ?? "mdi:robot-vacuum"}></ha-icon>
        <div class="title">
          <div class="name">${this.config!.name ?? a.friendly_name ?? "Vacuum"}</div>
          <div class="status">${status}</div>
        </div>
        ${Number.isFinite(battery)
          ? html`<div class="battery" aria-label="Battery ${battery}%">
              <ha-icon icon=${batteryIcon(battery, a.charging === true)}></ha-icon>${battery}%
            </div>`
          : nothing}
      </div>
      ${running && Number.isFinite(progress)
        ? html`<div class="progress" role="progressbar" aria-valuenow=${progress} aria-valuemin="0" aria-valuemax="100">
            <div style="width:${Math.max(0, Math.min(100, progress))}%"></div>
          </div>`
        : nothing}
      ${error ? html`<ha-alert alert-type="error">${error}</ha-alert>` : nothing}
    `;
  }

  private renderMap() {
    const cam = this.stateOf(this.mapId());
    const pic = cam?.attributes.entity_picture as string | undefined;
    if (!cam || !pic || cam.attributes.is_empty) {
      return html`<div class="map map-empty">No map yet</div>`;
    }
    // entity_picture already carries a changing `v=` cache-buster from the integration.
    const src = this.hass!.hassUrl(pic);
    const cal = cam.attributes.calibration_points as CalibrationPoint[] | undefined;
    const img = this.renderRoot.querySelector<HTMLImageElement>(".map img");
    const w = img?.naturalWidth;
    const h = img?.naturalHeight;
    const pins =
      cal && w && h
        ? this.rooms()
            .filter((r) => this.selected.includes(r.room_id))
            .map((r) => {
              const p = vacuumToMap(cal, { x: r.x, y: r.y });
              const s = w / 60; // scale pins with the image so they read the same at any width
              // The map already labels rooms, so a selected room only gets a marker.
              return svg`<g class="pin">
                <circle class="halo" cx=${p.x} cy=${p.y} r=${s * 2.4}></circle>
                <circle class="dot" cx=${p.x} cy=${p.y} r=${s * 0.9} stroke-width=${s * 0.25}></circle>
              </g>`;
            })
        : [];
    return html`<div class="map" @click=${this.onMapTap} role="group" aria-label="Map. Tap a room to select it.">
      <img src=${src} alt="Map of ${this.config!.name ?? "vacuum"}" @load=${() => this.requestUpdate()} />
      ${w && h ? html`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${pins}</svg>` : nothing}
    </div>`;
  }

  private renderRooms() {
    const rooms = this.rooms();
    if (!rooms.length) return nothing;
    return html`<div class="rooms" role="group" aria-label="Rooms">
      ${rooms.map(
        (r) => html`<button
          class="chip"
          aria-pressed=${this.selected.includes(r.room_id) ? "true" : "false"}
          @click=${() => this.toggleRoom(r.room_id)}
        >
          <ha-icon icon=${r.icon ?? "mdi:floor-plan"}></ha-icon>${r.name}
        </button>`,
      )}
    </div>`;
  }

  private renderActions(vac: HassEntity) {
    const s = vac.state;
    const unavailable = s === "unavailable";
    const running = s === "cleaning" || s === "returning";
    const n = this.selected.length;
    const primary =
      s === "cleaning"
        ? html`<button class="btn primary" @click=${() => this.vacuum("pause")}>
            <ha-icon icon="mdi:pause"></ha-icon>Pause
          </button>`
        : s === "paused"
          ? html`<button class="btn primary" @click=${() => this.vacuum("start")}>
              <ha-icon icon="mdi:play"></ha-icon>Resume
            </button>`
          : html`<button class="btn primary" ?disabled=${unavailable || s === "returning"} @click=${this.clean}>
              <ha-icon icon="mdi:play"></ha-icon>${n ? `Clean ${n} room${n > 1 ? "s" : ""}` : "Clean all"}
            </button>`;
    return html`<div class="actions">
      ${primary}
      <button
        class="btn ${this.confirming ? "confirm" : ""}"
        ?disabled=${unavailable || s === "docked"}
        @click=${() => this.dock(s === "cleaning" || s === "paused")}
      >
        <ha-icon icon="mdi:home-import-outline"></ha-icon>${this.confirming ? "Tap to stop" : "Dock"}
      </button>
      <button class="btn icon" aria-label="Locate" ?disabled=${unavailable || running} @click=${() => this.vacuum("locate")}>
        <ha-icon icon="mdi:map-marker-radius-outline"></ha-icon>
      </button>
    </div>`;
  }

  private renderSettings() {
    // With CleanGenius on, Dreame manages suction and mode and marks those selects unavailable,
    // so whichever set is live is the one shown.
    const items = [
      ["cleangenius", "CleanGenius"],
      ["cleangenius_mode", "Genius mode"],
      ["suction_level", "Suction"],
      ["cleaning_mode", "Mode"],
    ]
      .map(([key, label]) => ({ label, entity: this.stateOf(this.sibling("select", key)) }))
      .filter((x): x is { label: string; entity: HassEntity } => !!x.entity && x.entity.state !== "unavailable");
    if (!items.length) return nothing;
    return html`<div class="settings">
      ${items.map(
        ({ label, entity }) => html`<label class="setting"
          >${label}
          <select @change=${(e: Event) => this.selectOption(entity.entity_id, (e.target as HTMLSelectElement).value)}>
            ${(entity.attributes.options as string[]).map(
              (o) => html`<option value=${o} ?selected=${o === entity.state}>${this.hass!.formatEntityState?.(entity, o) ?? o}</option>`,
            )}
          </select>
        </label>`,
      )}
    </div>`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function batteryIcon(pct: number, charging: boolean): string {
  const step = Math.round(pct / 10) * 10;
  const base = charging ? "mdi:battery-charging" : "mdi:battery";
  if (step >= 100) return charging ? "mdi:battery-charging-100" : "mdi:battery";
  if (step <= 0) return charging ? "mdi:battery-charging-outline" : "mdi:battery-outline";
  return `${base}-${step}`;
}
