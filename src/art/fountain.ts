import { svg } from "lit";
import type { PetTone } from "../lib/tone";

const TANK = { x: 16, y: 40, w: 68, h: 66 };

export interface Tick {
  /** 0..1 of the tank. */
  at: number;
  cls: "warn" | "error";
}

/**
 * A fountain on its dock: the tank shows the water level, ticks mark the low/empty
 * thresholds, and water runs over the top plate while the pump is running.
 */
export function fountainArt(o: { fraction?: number; tone: PetTone; flowing: boolean; ticks: Tick[] }) {
  const f = Math.max(0, Math.min(1, o.fraction ?? 0));
  const h = TANK.h * f;
  const top = TANK.y + TANK.h - h;
  const yAt = (frac: number) => TANK.y + TANK.h - TANK.h * Math.max(0, Math.min(1, frac));
  return svg`<svg viewBox="0 0 100 120" aria-hidden="true">
    <defs><clipPath id="tank"><rect x=${TANK.x} y=${TANK.y} width=${TANK.w} height=${TANK.h} rx="14"></rect></clipPath></defs>
    <rect class="shell" x="12" y="106" width="76" height="9" rx="4.5"></rect>
    <rect class="glass" x=${TANK.x} y=${TANK.y} width=${TANK.w} height=${TANK.h} rx="14"></rect>
    <g clip-path="url(#tank)">
      <rect class="fill ${o.fraction === undefined ? "unknown" : `tone-${o.tone}`}" x=${TANK.x} y=${top} width=${TANK.w} height=${h}></rect>
      ${h > 3 ? svg`<path class="detail" d=${`M${TANK.x + 8} ${top + 4}q6 -2.5 12 0t12 0t12 0t12 0`}></path>` : null}
    </g>
    ${o.ticks.map((t) => svg`<line class="tick ${t.cls}" x1=${TANK.x + TANK.w + 2} x2=${TANK.x + TANK.w + 8} y1=${yAt(t.at)} y2=${yAt(t.at)}></line>`)}
    <rect class="shell" x="8" y="32" width="84" height="10" rx="5"></rect>
    ${o.flowing ? svg`<rect class="fill tone-active" x="12" y="32" width="76" height="3" rx="1.5"></rect>` : null}
    <path class="shell" d="M38 33C38 19 62 19 62 33z"></path>
    ${o.flowing
      ? svg`<path class="flow" d="M50 21C43 21 33 24 25 32"></path><path class="flow" d="M50 21C57 21 67 24 75 32"></path>`
      : null}
  </svg>`;
}
