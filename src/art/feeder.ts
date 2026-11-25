import { svg } from "lit";
import type { PetTone } from "../lib/tone";

const WIN = { x: 30, y: 22, w: 40, h: 56 };

/** Kibble positions inside the hopper window, staggered rows. */
const GRAINS = (() => {
  const out: [number, number][] = [];
  for (let row = 0; WIN.y + WIN.h - 3 - row * 6 > WIN.y; row++) {
    const y = WIN.y + WIN.h - 3 - row * 6;
    for (let x = WIN.x + 4 + (row % 2) * 4; x < WIN.x + WIN.w; x += 8) out.push([x, y]);
  }
  return out;
})();

/**
 * A gravity-hopper feeder with a window showing the food left. `fraction` is 0..1, or
 * undefined when there's no estimate (then `fallback` is drawn faintly).
 */
export function feederArt(o: { fraction?: number; fallback: number; tone: PetTone }) {
  const f = Math.max(0, Math.min(1, o.fraction ?? o.fallback));
  const h = WIN.h * f;
  const top = WIN.y + WIN.h - h;
  const known = o.fraction !== undefined;
  return svg`<svg viewBox="0 0 100 120" aria-hidden="true">
    <defs><clipPath id="hopper"><rect x=${WIN.x} y=${WIN.y} width=${WIN.w} height=${WIN.h} rx="9"></rect></clipPath></defs>
    <rect class="shell" x="20" y="12" width="60" height="82" rx="14"></rect>
    <rect class="shell" x="16" y="4" width="68" height="12" rx="6"></rect>
    <rect class="glass" x=${WIN.x} y=${WIN.y} width=${WIN.w} height=${WIN.h} rx="9"></rect>
    <g clip-path="url(#hopper)">
      <rect class="fill ${known ? `tone-${o.tone}` : "unknown"}" x=${WIN.x} y=${top} width=${WIN.w} height=${h}></rect>
      ${known ? GRAINS.filter(([, y]) => y > top + 2).map(([x, y]) => svg`<ellipse class="grain" cx=${x} cy=${y} rx="2.3" ry="1.7"></ellipse>`) : null}
    </g>
    <line class="detail" x1="34.5" y1="28" x2="34.5" y2="44"></line>
    <rect class="shell" x="12" y="90" width="76" height="16" rx="8"></rect>
    <circle class="lamp tone-${o.tone}" cx="50" cy="98" r="2.4"></circle>
    <path class="shell" d="M27 106h46c-1.5 8.5-8 12.5-23 12.5S28.5 114.5 27 106z"></path>
    <ellipse class="dark" cx="50" cy="106.5" rx="21" ry="2.6"></ellipse>
  </svg>`;
}
