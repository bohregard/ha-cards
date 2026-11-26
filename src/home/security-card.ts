import { css, html, nothing, type TemplateResult } from "lit";
import { BaseCard } from "../lib/base-card";
import { ago } from "../lib/format";
import { alarmView, contactsLine, coverView, lockView, securityVerdict, type DeviceView, type SecurityAction } from "../lib/security";
import { homeStyles } from "./home-styles";

export interface SecurityCardConfig {
  type: string;
  name?: string;
  alarm?: string;
  locks?: { entity: string; name?: string }[];
  /** Garage doors. `fallback` is a door sensor to report while the opener is offline. */
  covers?: { entity: string; name?: string; fallback?: string; fallback_name?: string }[];
  /** Every door and window contact, for the "all closed" line. */
  contacts?: { entity: string; name?: string }[];
}

const LOCK_ICON: Record<string, string> = { locked: "mdi:lock", unlocked: "mdi:lock-open-variant", jammed: "mdi:lock-alert", open: "mdi:lock-open-variant" };
const ALARM_ICON: Record<string, string> = { disarmed: "mdi:shield-off-outline", triggered: "mdi:shield-alert", pending: "mdi:shield-alert-outline" };
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * The alarm, the locks, the garage door and every door and window on one card. Each device
 * offers only its next action: the safe direction (lock, close, arm home) takes one tap, the
 * other (unlock, open, arm away, disarm) a second tap within 4 seconds.
 */
export class BrinstarSecurityCard extends BaseCard<SecurityCardConfig> {
  static styles = [
    homeStyles,
    css`
      .ico.ok { background: color-mix(in srgb, var(--bp-ok) 16%, transparent); color: var(--bp-ok); }
      .ico.active { background: color-mix(in srgb, var(--bp-active) 16%, transparent); color: var(--bp-active); }
      .secure { color: var(--bp-ok); }
      .rows { display: flex; flex-direction: column; }
      .dev { display: flex; align-items: center; gap: 12px; min-height: 56px; }
      .dev + .dev, .acts + .dev { border-top: 1px solid var(--bp-line); }
      .dev .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .dev b { font-size: 0.95rem; font-weight: 600; }
      .dev .state { font-size: 0.82rem; font-weight: 500; color: var(--bp-muted); }
      .dev .state.error { color: var(--bp-error); }
      .dev .state.active { color: var(--bp-active); }
      .acts { display: flex; gap: 8px; padding: 0 0 12px 52px; }
      .acts .act { flex: 1; }
      .act {
        flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        min-height: 40px; padding: 0 16px; border-radius: 20px; border: 1px solid var(--bp-line);
        background: none; color: var(--bp-text); font: inherit; font-size: 0.85rem; font-weight: 600;
        white-space: nowrap; cursor: pointer; transition: background 0.2s ease, transform 0.15s ease;
      }
      .act:active { transform: scale(0.96); }
      .act:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; }
      .act.fix { background: var(--bp-error); border-color: var(--bp-error); color: var(--text-primary-color, #1e1b17); }
      .act.armed { border-color: var(--bp-error); color: var(--bp-error); background: color-mix(in srgb, var(--bp-error) 8%, transparent); }
      .act ha-icon { --mdc-icon-size: 18px; }
      .contacts { display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--bp-line); padding-top: 12px; font-size: 0.85rem; font-weight: 500; color: var(--bp-muted); --mdc-icon-size: 18px; }
      .contacts ha-icon { color: var(--bp-ok); }
      .contacts.error { color: var(--bp-error); }
      .contacts.error ha-icon { color: var(--bp-error); }
    `,
  ];

  setConfig(config: SecurityCardConfig) {
    if (!config?.alarm && !config?.locks?.length && !config?.covers?.length) throw new Error("Set an alarm, locks or covers");
    this.config = config;
  }

  getCardSize() {
    return 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  protected watched() {
    const c = this.config!;
    return [c.alarm, ...(c.locks ?? []).map((l) => l.entity), ...(c.covers ?? []).flatMap((x) => [x.entity, x.fallback]), ...(c.contacts ?? []).map((x) => x.entity)];
  }

  private name(id: string, given?: string) {
    return given ?? this.st(id)?.attributes.friendly_name ?? id;
  }

  /** "Locked for 4 h", "Unlocked just now"; moving states and the offline fallback read alone. */
  private since(id: string, v: { tone: string; label: string }): string {
    const changed = Date.parse(this.st(id)?.last_changed ?? "");
    if (v.tone === "active" || v.label.includes(" · ") || Number.isNaN(changed)) return v.label;
    const d = ago(changed, Date.now());
    return d === "just now" ? `${v.label} just now` : `${v.label} for ${d.replace(/ ago$/, "")}`;
  }

  private run(id: string, a: SecurityAction) {
    const [domain, service] = a.service.split(".");
    const go = () => this.call(domain, service, { entity_id: id });
    if (a.confirm) this.confirm(`${id}|${a.service}`, go);
    else go();
  }

  private button(id: string, a: SecurityAction, fix: boolean, name: string): TemplateResult {
    const armed = this.confirming === `${id}|${a.service}`;
    const label = armed ? `Tap again to ${lower(a.label)}` : a.label;
    return html`<button class="act ${armed ? "armed" : fix && !a.confirm ? "fix" : ""}" aria-label="${label}: ${name}" @click=${() => this.run(id, a)}>${label}</button>`;
  }

  private row(id: string, name: string, icon: string, v: DeviceView): TemplateResult {
    return html`<div class="dev">
      <span class="ico ${v.tone === "error" ? "bad" : v.tone}"><ha-icon icon=${icon}></ha-icon></span>
      <div class="txt"><b>${name}</b><span class="state ${v.tone}">${this.since(id, v)}</span></div>
      ${v.action ? this.button(id, v.action, !!v.problem, name) : nothing}
    </div>`;
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config;
    const devices: { name: string; problem?: string }[] = [];
    const rows: TemplateResult[] = [];

    if (c.alarm) {
      const state = this.st(c.alarm)?.state ?? "unavailable";
      const v = alarmView(state);
      devices.push({ name: "Alarm", problem: v.problem });
      const icon = ALARM_ICON[state] ?? (v.tone === "ok" ? "mdi:shield-lock" : v.tone === "active" ? "mdi:shield-sync-outline" : "mdi:shield-off-outline");
      rows.push(html`<div class="dev">
        <span class="ico ${v.tone === "error" ? "bad" : v.tone}"><ha-icon icon=${icon}></ha-icon></span>
        <div class="txt"><b>Alarm</b><span class="state ${v.tone}">${this.since(c.alarm, v)}</span></div>
      </div>
      ${v.actions.length ? html`<div class="acts">${v.actions.map((a) => this.button(c.alarm!, a, !!v.problem, "Alarm"))}</div>` : nothing}`);
    }
    for (const l of c.locks ?? []) {
      const state = this.st(l.entity)?.state ?? "unavailable";
      const v = lockView(state);
      const name = this.name(l.entity, l.name);
      devices.push({ name, problem: v.problem });
      rows.push(this.row(l.entity, name, LOCK_ICON[state] ?? (v.tone === "active" ? "mdi:lock-clock" : "mdi:lock-alert"), v));
    }
    for (const g of c.covers ?? []) {
      const state = this.st(g.entity)?.state ?? "unavailable";
      const fb = g.fallback && this.st(g.fallback) && this.st(g.fallback)!.state !== "unavailable"
        ? { name: g.fallback_name ?? "door sensor", open: this.on(g.fallback) }
        : undefined;
      const v = coverView(state, fb);
      const name = this.name(g.entity, g.name);
      devices.push({ name, problem: v.problem });
      rows.push(this.row(g.entity, name, state === "closed" ? "mdi:garage-variant" : v.problem === "offline" ? "mdi:garage-alert-variant" : "mdi:garage-open-variant", v));
    }

    const contacts = c.contacts ?? [];
    const open = contacts.filter((x) => this.on(x.entity)).map((x) => this.name(x.entity, x.name));
    const line = contacts.length ? contactsLine(open, contacts.length) : undefined;
    const verdict = securityVerdict(devices, open);

    return html`<ha-card>
      <div class="body">
        <div class="title">
          <span class="ico ${verdict.tone === "ok" ? "ok" : "bad"}"><ha-icon icon=${verdict.tone === "ok" ? "mdi:shield-check" : "mdi:shield-alert"}></ha-icon></span>
          <span class="name">${c.name ?? "Security"}</span>
          <span class="aside ${verdict.tone === "ok" ? "secure" : "tone-error"}">${verdict.text}</span>
        </div>
        <div class="rows">${rows}</div>
        ${line
          ? html`<div class="contacts ${line.tone}"><ha-icon icon=${line.tone === "ok" ? "mdi:check" : "mdi:door-open"}></ha-icon><span>${line.text}</span></div>`
          : nothing}
      </div>
    </ha-card>`;
  }
}
