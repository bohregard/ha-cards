import { svg } from "lit";
import type { PetTone } from "../lib/tone";

/**
 * A self-cleaning globe box: litter level inside the globe, waste drawer level in the
 * drawer gauge, and the status light on top.
 */
export function litterArt(o: { litter?: number; drawer?: number; tone: PetTone; drawerTone: PetTone }) {
  const litter = Math.max(0, Math.min(1, o.litter ?? 0));
  const drawer = Math.max(0, Math.min(1, o.drawer ?? 0));
  const bed = 82 - 24 * litter;
  return svg`<svg viewBox="0 0 100 120" aria-hidden="true">
    <defs><clipPath id="globe"><circle cx="50" cy="48" r="33"></circle></clipPath></defs>
    <rect class="shell" x="10" y="6" width="80" height="108" rx="20"></rect>
    <rect class="lamp tone-${o.tone}" x="43" y="9.5" width="14" height="3" rx="1.5"></rect>
    <circle class="glass" cx="50" cy="48" r="33"></circle>
    <ellipse class="dark" cx="50" cy="45" rx="24" ry="20"></ellipse>
    <g clip-path="url(#globe)">
      ${o.litter === undefined ? null : svg`<rect class="fill" x="14" y=${bed} width="72" height=${84 - bed}></rect>`}
    </g>
    <circle class="detail" cx="50" cy="48" r="33"></circle>
    <rect class="shell" x="18" y="88" width="64" height="20" rx="6"></rect>
    <line class="detail" x1="42" y1="92" x2="58" y2="92"></line>
    <rect class="glass" x="24" y="97" width="52" height="6" rx="3"></rect>
    ${o.drawer === undefined ? null : svg`<rect class="fill tone-${o.drawerTone}" x="24" y="97" width=${52 * drawer} height="6" rx="3"></rect>`}
  </svg>`;
}
