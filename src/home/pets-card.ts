import { css, html, nothing, type TemplateResult } from "lit";
import { feederArt } from "../art/feeder";
import { fountainArt } from "../art/fountain";
import { litterArt } from "../art/litter";
import { BaseCard } from "../lib/base-card";
import { findOnDevice } from "../lib/entities";
import { feederStatus, nextMeal, type Meal } from "../lib/feeder";
import { fountainStatus, pumpReason } from "../lib/fountain";
import { when } from "../lib/format";
import { litterStatus } from "../lib/litter";
import type { PetTone, Status } from "../lib/tone";
import { navigate } from "../lib/nav";
import { petStyles } from "../pets/pet-styles";
import { homeStyles } from "./home-styles";

export interface PetsCardConfig {
  type: string;
  name?: string;
  /** The Litter-Robot vacuum entity. */
  litter?: string;
  /** Any entity of each ESPHome feeder (e.g. its last-fed sensor). */
  feeders?: { entity: string; name?: string }[];
  /** Any entity of the fountain (e.g. its water weight sensor). */
  fountain?: string;
  capacity_grams?: number;
  navigation_path?: string;
}

interface Row {
  key: string;
  name: string;
  art: TemplateResult;
  status: Status;
  fact: TemplateResult | string;
}

/** "Tomorrow 9:00 AM" reads mid-sentence as "tomorrow 9:00 AM". */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const RANK: Partial<Record<PetTone, number>> = { error: 0, warn: 1 };

/**
 * Every pet device on one card: litter box, feeders and fountain, each with its drawing, its
 * status and one fact. Problems sort to the top. The card opens the Pets page.
 */
export class BrinstarPetsCard extends BaseCard<PetsCardConfig> {
  static styles = [
    petStyles,
    homeStyles,
    css`
      .rows { display: grid; grid-template-columns: 1fr; gap: 6px; }
      @container (min-width: 520px) { .rows { grid-template-columns: 1fr 1fr; gap: 10px 16px; } }
      .row { display: flex; align-items: center; gap: 12px; min-height: 64px; }
      .row + .row { border-top: 0; }
      .art { flex: none; width: 44px; height: 54px; }
      .facts { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .facts .dev { font-size: 0.9rem; font-weight: 600; }
      .status { font-size: 0.85rem; }
      .line { font-size: 0.8rem; }
    `,
  ];

  setConfig(config: PetsCardConfig) {
    if (!config?.litter && !config?.feeders?.length && !config?.fountain) throw new Error("Set litter, feeders or fountain");
    this.config = config;
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private on2(anchor: string | undefined, domain: string, key: string): string | undefined {
    return anchor && this.hass?.entities ? findOnDevice(this.hass.entities, anchor, domain, key) : undefined;
  }

  private ids() {
    const c = this.config!;
    const s = this.on2.bind(this);
    return {
      litter: c.litter && {
        level: s(c.litter, "sensor", "litter_level"),
        drawer: s(c.litter, "sensor", "waste_drawer"),
        code: s(c.litter, "sensor", "status_code"),
      },
      feeders: (c.feeders ?? []).map((f) => ({
        ...f,
        lastFed: s(f.entity, "sensor", "last_fed") ?? f.entity,
        signal: s(f.entity, "sensor", "signal"),
        low: s(f.entity, "binary_sensor", "food_low"),
        empty: s(f.entity, "binary_sensor", "food_empty"),
        jammed: s(f.entity, "binary_sensor", "jammed"),
        meals: [1, 2, 3, 4].map((i) => ({ time: s(f.entity, "time", `meal_${i}_time`), scoops: s(f.entity, "number", `meal_${i}_scoops`) })),
      })),
      fountain: c.fountain && {
        weight: s(c.fountain, "sensor", "water_weight") ?? c.fountain,
        low: s(c.fountain, "binary_sensor", "water_low"),
        empty: s(c.fountain, "binary_sensor", "water_empty"),
        running: s(c.fountain, "binary_sensor", "pump_running"),
        pump: s(c.fountain, "switch", "pump"),
        filter: s(c.fountain, "binary_sensor", "filter_due"),
      },
    };
  }

  protected watched() {
    const i = this.ids();
    return [
      this.config!.litter, ...Object.values(i.litter || {}),
      ...i.feeders.flatMap((f) => [f.lastFed, f.signal, f.low, f.empty, f.jammed, ...f.meals.flatMap((m) => [m.time, m.scoops])]),
      ...Object.values(i.fountain || {}),
    ];
  }

  private open(e: Event) {
    e.preventDefault();
    if (this.config?.navigation_path) navigate(this.config.navigation_path);
  }

  private rows(now: number): Row[] {
    const i = this.ids();
    const lang = this.language();
    const rows: Row[] = [];

    if (i.litter && this.config!.litter) {
      const vac = this.st(this.config!.litter);
      const online = !!vac && vac.state !== "unavailable";
      const drawer = this.num(i.litter.drawer);
      const level = this.num(i.litter.level);
      const status = litterStatus({ online, state: vac?.state ?? "", code: this.val(i.litter.code) ?? "", drawerPct: drawer ?? 0 });
      const drawerTone: PetTone = drawer === undefined ? "idle" : drawer > 80 ? "error" : drawer > 75 ? "warn" : "ok";
      rows.push({
        key: "litter",
        name: "Litter box",
        art: litterArt({ litter: level === undefined ? undefined : level / 100, drawer: drawer === undefined ? undefined : drawer / 100, tone: online ? status.tone : "idle", drawerTone }),
        status,
        fact: html`Drawer <b class="num">${drawer === undefined ? "–" : `${Math.round(drawer)}%`}</b> · litter <span class="num">${level === undefined ? "–" : `${Math.round(level)}%`}</span>`,
      });
    }

    for (const f of i.feeders) {
      const online = this.st(f.signal)?.state !== "unavailable" && this.st(f.lastFed)?.state !== "unavailable";
      const status = feederStatus({ online, jammed: this.on(f.jammed), empty: this.on(f.empty), low: this.on(f.low) });
      const meals: Meal[] = f.meals.map((m) => ({ time: this.val(m.time) ?? "", scoops: this.num(m.scoops) ?? 0 }));
      const next = nextMeal(meals, now);
      const last = Date.parse(this.val(f.lastFed) ?? "");
      const fallback = this.on(f.empty) ? 0.04 : this.on(f.low) ? 0.2 : 0.55;
      rows.push({
        key: f.entity,
        name: f.name ?? "Feeder",
        art: feederArt({ fallback, tone: online ? status.tone : "idle" }),
        status,
        fact: html`${Number.isNaN(last) ? "Not fed yet" : html`Fed <b>${lower(when(last, now, lang))}</b>`}${next ? html` · next ${lower(when(next.at, now, lang))}` : nothing}`,
      });
    }

    if (i.fountain) {
      const w = this.num(i.fountain.weight);
      const online = this.st(i.fountain.weight)?.state !== "unavailable";
      const status = fountainStatus({ online, empty: this.on(i.fountain.empty), low: this.on(i.fountain.low) });
      const cap = this.config!.capacity_grams ?? 3000;
      const running = this.on(i.fountain.running);
      rows.push({
        key: "fountain",
        name: "Fountain",
        art: fountainArt({ fraction: w === undefined ? undefined : w / cap, tone: online ? status.tone : "idle", flowing: running, ticks: [] }),
        status,
        fact: html`${w === undefined ? nothing : html`<b class="num">${(w / 1000).toFixed(1)} L</b> · `}${pumpReason({
          running,
          wanted: i.fountain.pump ? this.on(i.fountain.pump) : running,
          empty: this.on(i.fountain.empty),
        }).toLowerCase()}${this.on(i.fountain.filter) ? html` · <span class="tone-warn">filter due</span>` : nothing}`,
      });
    }

    return rows.sort((a, b) => (RANK[a.status.tone] ?? 2) - (RANK[b.status.tone] ?? 2));
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config;
    const rows = this.rows(Date.now());
    const problems = rows.filter((r) => r.status.tone === "error" || r.status.tone === "warn");
    const worst = problems.some((r) => r.status.tone === "error") ? "error" : problems.length ? "warn" : "ok";
    return html`<ha-card>
      ${c.navigation_path ? html`<a class="hit" href=${c.navigation_path} aria-label="Open ${c.name ?? "Pets"}" @click=${this.open}></a>` : nothing}
      <div class="body">
        <div class="title">
          <span class="ico ${problems.length ? "bad" : ""}"><ha-icon icon="mdi:paw"></ha-icon></span>
          <span class="name">${c.name ?? "Pets"}</span>
          <span class="aside tone-${worst}">${problems.length ? (problems.length === 1 ? "1 needs you" : `${problems.length} need you`) : "All good"}</span>
          ${c.navigation_path ? html`<ha-icon class="go" icon="mdi:chevron-right"></ha-icon>` : nothing}
        </div>
        <div class="rows">
          ${rows.map((r) => html`<div class="row">
            <div class="art">${r.art}</div>
            <div class="facts">
              <span class="dev">${r.name}</span>
              <span class="status" data-tone=${r.status.tone}>${r.status.label}</span>
              <span class="line">${r.fact}</span>
            </div>
          </div>`)}
        </div>
      </div>
    </ha-card>`;
  }
}
