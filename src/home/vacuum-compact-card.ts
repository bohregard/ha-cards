import { css, html, nothing } from "lit";
import { BaseCard } from "../lib/base-card";
import { consumableParts, dayLabel, DOCK_SENSORS } from "../lib/status";
import { batteryIcon, findSibling } from "../lib/vacuum";
import { clock, lowParts, nextScheduled, runFacts, vacuumSummary, type ScheduleTask, type SummaryTone } from "../lib/vacuum-summary";
import { navigate } from "../lib/nav";
import { homeStyles } from "./home-styles";

export interface VacuumCompactCardConfig {
  type: string;
  /** The robot vacuum. Its other sensors are found on the same device. */
  entity: string;
  name?: string;
  /** Where the card goes when tapped: the page with the full vacuum card. */
  navigation_path?: string;
}

/** Dock statuses that mean someone has to do something (tanks, bag, detergent, water). */
const PROBLEM_KEYS = ["clean_water_tank_status", "dirty_water_tank_status", "dust_bag_status", "detergent_status", "low_water_warning"];
const RUN_KEYS = ["current_room", "cleaning_progress", "cleaning_history", "cleaning_time", "cleaned_area"];

const ICON_CLASS: Record<SummaryTone, string> = { active: "air", error: "bad", warn: "", ok: "", idle: "" };

/**
 * The robot vacuum at a glance: what it's doing (or its worst problem) and its battery, the
 * run's progress while it cleans, and otherwise the last clean, the next scheduled one and any
 * parts running low. The icon pauses a clean or sends it home; the rest opens the vacuum page.
 */
export class BrinstarVacuumCompactCard extends BaseCard<VacuumCompactCardConfig> {
  static styles = [
    homeStyles,
    css`
      .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .who .name { font-size: 1rem; font-weight: 600; }
      .head { font-size: 0.88rem; font-weight: 600; color: var(--bp-muted); }
      /* Tone text is mixed toward the text colour so it stays readable in light themes. */
      .head.active { color: color-mix(in srgb, var(--bp-active) 55%, var(--bp-text)); }
      .head.warn { color: color-mix(in srgb, var(--bp-amber) 70%, var(--bp-text)); }
      .head.error { color: var(--bp-error); }
      .batt { display: inline-flex; align-items: center; gap: 2px; --mdc-icon-size: 18px; }
      .batt.low { color: var(--bp-error); }
      .rest { display: flex; flex-direction: column; gap: 8px; }
      .meter.run i { background: var(--bp-active); }
      .facts dd small { display: block; margin-top: 2px; font-size: inherit; color: var(--bp-muted); }
      .line { font-size: 0.82rem; font-weight: 500; color: var(--bp-muted); }
      .line b { color: var(--bp-text); font-weight: 600; }
      .line.warn { color: color-mix(in srgb, var(--bp-amber) 70%, var(--bp-text)); }
      .line.error { color: var(--bp-error); }
      .facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 14px; margin: 0; font-size: 0.82rem; font-weight: 500; }
      .facts dt { color: var(--bp-muted); }
      .facts dd { margin: 0; }
      .facts dd.warn { color: color-mix(in srgb, var(--bp-amber) 70%, var(--bp-text)); }
    `,
  ];

  static getStubConfig(hass: { states: Record<string, unknown> }) {
    return { entity: Object.keys(hass.states).find((e) => e.startsWith("vacuum.")) ?? "vacuum.example" };
  }

  setConfig(config: VacuumCompactCardConfig) {
    if (!config?.entity?.startsWith("vacuum.")) throw new Error("Set `entity` to a vacuum entity, e.g. vacuum.my_robot");
    this.config = config;
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private sib(key: string): string | undefined {
    return this.hass?.entities ? findSibling(this.hass.entities, this.config!.entity, "sensor", key) : undefined;
  }

  private parts() {
    return this.hass?.entities ? consumableParts(this.hass.entities, this.config!.entity) : [];
  }

  protected watched() {
    return [this.config!.entity, ...RUN_KEYS.map((k) => this.sib(k)), ...PROBLEM_KEYS.map((k) => this.sib(k)), ...this.parts().map((p) => p.level)];
  }

  private open(e: Event) {
    e.preventDefault();
    if (this.config?.navigation_path) navigate(this.config.navigation_path);
  }

  private act(action: "pause" | "home") {
    this.call("vacuum", action === "pause" ? "pause" : "return_to_base", { entity_id: this.config!.entity });
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config;
    const vac = this.st(c.entity);
    const a = vac?.attributes ?? {};
    const name = c.name ?? (a.friendly_name as string | undefined) ?? "Vacuum";
    const label = new Map(DOCK_SENSORS);
    const dock = PROBLEM_KEYS.map((k) => ({ label: label.get(k) ?? k, state: this.st(this.sib(k))?.state ?? "" }));
    const parts = this.parts()
      .map((p) => ({ label: p.label, pct: this.num(p.level) }))
      .filter((p): p is { label: string; pct: number } => p.pct !== undefined);
    const s = vacuumSummary({ state: vac?.state ?? "unavailable", attrs: a, room: this.val(this.sib("current_room")), dock, parts });
    const offline = s.headline === "Offline" && s.tone === "error";

    const battery = typeof a.battery === "number" ? a.battery : undefined;
    const charging = a.charging === true;
    const icon = s.action === "pause" ? "mdi:pause" : s.action === "home" ? "mdi:home-import-outline"
      : s.tone === "error" ? "mdi:robot-vacuum-alert" : "mdi:robot-vacuum";
    const actionLabel = s.action === "pause" ? `Pause ${name}` : `Send ${name} home`;
    const listed = s.problems.filter((p, i) => !(i === 0 && p.text === s.headline));

    return html`<ha-card>
      ${c.navigation_path ? html`<a class="hit" href=${c.navigation_path} aria-label="Open ${name}" @click=${this.open}></a>` : nothing}
      <div class="body">
        <div class="title">
          ${s.action
            ? html`<button class="ico ${ICON_CLASS[s.tone]}" aria-label=${actionLabel} title=${actionLabel}
                @click=${() => this.act(s.action!)}><ha-icon icon=${icon}></ha-icon></button>`
            : html`<span class="ico ${ICON_CLASS[s.tone]}"><ha-icon icon=${icon}></ha-icon></span>`}
          <div class="who">
            <span class="name">${name}</span>
            <span class="head ${s.tone}">${s.headline}</span>
          </div>
          ${battery !== undefined && !offline
            ? html`<span class="aside batt num ${battery < 20 ? "low" : ""}" aria-label="Battery ${battery}%">
                <ha-icon icon=${batteryIcon(battery, charging)}></ha-icon>${battery}%</span>`
            : nothing}
          ${c.navigation_path ? html`<ha-icon class="go" icon="mdi:chevron-right"></ha-icon>` : nothing}
        </div>
        ${s.running || listed.length || vac?.state === "error" || (!s.problems.length && !offline) ? html`<div class="rest">
          ${s.running ? this.renderRun(s.tone === "active") : nothing}
          ${vac?.state === "error" && this.val(this.sib("current_room")) ? html`<span class="line">In ${this.val(this.sib("current_room"))}</span>` : nothing}
          ${listed.map((p) => html`<span class="line ${p.tone}">${p.text}</span>`)}
          ${!s.running && !s.problems.length ? this.renderDocked(parts) : nothing}
        </div>` : nothing}
      </div>
    </ha-card>`;
  }

  private renderRun(moving: boolean) {
    const a = this.st(this.config!.entity)?.attributes ?? {};
    const progress = this.num(this.sib("cleaning_progress")) ?? (typeof a.cleaning_progress === "number" ? a.cleaning_progress : undefined);
    const facts = runFacts(this.num(this.sib("cleaning_time")), this.num(this.sib("cleaned_area")), this.st(this.sib("cleaned_area"))?.attributes.unit_of_measurement as string | undefined);
    const pct = progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(progress)));
    return html`
      ${pct !== undefined
        ? html`<div class="meter ${moving ? "run" : ""}" role="progressbar" aria-label="Progress" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`
        : nothing}
      ${pct !== undefined || facts
        ? html`<span class="line num">${pct !== undefined ? html`<b>${pct}%</b>` : nothing}${pct !== undefined && facts ? " · " : ""}${facts ? `${facts} so far` : ""}</span>`
        : nothing}
    `;
  }

  private renderDocked(parts: { label: string; pct: number }[]) {
    const a = this.st(this.config!.entity)?.attributes ?? {};
    const lang = this.language();
    const now = Date.now();
    const lastAt = Date.parse(this.val(this.sib("cleaning_history")) ?? "");
    const area = this.sib("cleaned_area");
    const lastFacts = runFacts(this.num(this.sib("cleaning_time")), this.num(area), this.st(area)?.attributes.unit_of_measurement as string | undefined);
    const next = nextScheduled(a.schedule as ScheduleTask[] | undefined, a.rooms as never, a.selected_map as string | undefined, now);
    const low = lowParts(parts);
    const time = (t: number) => new Date(t).toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });
    const nextDay = next?.at === undefined ? undefined : new Date(next.at).getDate() === new Date(now).getDate() ? "Today" : "Tomorrow";

    return html`<dl class="facts num">
      ${Number.isNaN(lastAt) ? nothing : html`<dt>Last clean</dt>
        <dd>${dayLabel(new Date(lastAt), new Date(now), lang)} ${time(lastAt)}${lastFacts ? ` · ${lastFacts}` : ""}</dd>`}
      ${next ? html`<dt>Next</dt>
        <dd>${nextDay ? `${nextDay} ${clock(next.time, lang)}` : `${clock(next.time, lang)} on scheduled days`}${next.rooms.length ? html`<small>${next.rooms.join(", ")}</small>` : nothing}</dd>` : nothing}
      ${low.length ? html`<dt>Parts</dt><dd class="warn">${low.join(" · ")}</dd>` : nothing}
    </dl>`;
  }
}
