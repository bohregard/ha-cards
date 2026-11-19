import { BrinstarVacuumCard } from "./vacuum/vacuum-card";

declare const __VERSION__: string;

declare global {
  interface Window {
    customCards?: { type: string; name: string; description?: string; preview?: boolean }[];
  }
}

if (!customElements.get("brinstar-vacuum-card")) {
  customElements.define("brinstar-vacuum-card", BrinstarVacuumCard);
}

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: "brinstar-vacuum-card",
  name: "Brinstar Vacuum Card",
  description: "Map, room cleaning, settings and maintenance for a Dreame vacuum.",
  preview: false,
});

console.info(`%c BRINSTAR-CARDS %c ${__VERSION__} `, "background:#F4B650;color:#1E1B17;font-weight:700", "background:#2E2A24;color:#F1ECE3");
