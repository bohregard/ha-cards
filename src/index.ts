import { BrinstarFeederCard } from "./pets/feeder-card";
import { BrinstarFountainCard } from "./pets/fountain-card";
import { BrinstarLitterCard } from "./pets/litter-card";
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
  ["brinstar-feeder-card", BrinstarFeederCard, "Brinstar Feeder Card", "Food left, last and next meal, feed now and meal times for an ESPHome cat feeder."],
  [
    "brinstar-fountain-card",
    BrinstarFountainCard,
    "Brinstar Fountain Card",
    "Water level, pump state, water used per day and filter for a scale-based ESPHome water fountain.",
  ],
  ["brinstar-litter-card", BrinstarLitterCard, "Brinstar Litter Card", "Litter and drawer levels, weight and visits per cat, and settings for a Litter-Robot."],
];

window.customCards = window.customCards ?? [];
for (const [type, element, name, description] of CARDS) {
  if (!customElements.get(type)) customElements.define(type, element);
  window.customCards.push({ type, name, description, preview: false });
}

console.info(`%c BRINSTAR-CARDS %c ${__VERSION__} `, "background:#F4B650;color:#1E1B17;font-weight:700", "background:#2E2A24;color:#F1ECE3");
