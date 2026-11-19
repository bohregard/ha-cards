import { BrinstarVacuumStatusCard } from "./vacuum/status-card";
import { BrinstarVacuumCard } from "./vacuum/vacuum-card";

declare const __VERSION__: string;

declare global {
  interface Window {
    customCards?: { type: string; name: string; description?: string; preview?: boolean }[];
  }
}

const CARDS: [string, CustomElementConstructor, string, string][] = [
  ["brinstar-vacuum-card", BrinstarVacuumCard, "Brinstar Vacuum Card", "Map, room cleaning and settings for a Dreame vacuum."],
  [
    "brinstar-vacuum-status-card",
    BrinstarVacuumStatusCard,
    "Brinstar Vacuum Status Card",
    "Consumables with reset, last clean, and dock and tank status for a Dreame vacuum.",
  ],
];

window.customCards = window.customCards ?? [];
for (const [type, element, name, description] of CARDS) {
  if (!customElements.get(type)) customElements.define(type, element);
  window.customCards.push({ type, name, description, preview: false });
}

console.info(`%c BRINSTAR-CARDS %c ${__VERSION__} `, "background:#F4B650;color:#1E1B17;font-weight:700", "background:#2E2A24;color:#F1ECE3");
