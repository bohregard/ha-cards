import { BrinstarEnergyCard } from "./home/energy-card";
import { BrinstarLightsCard } from "./home/lights-card";
import { BrinstarClimateCard } from "./home/climate-card";
import { BrinstarCreditCardsCard } from "./home/credit-cards-card";
import { BrinstarPetsCard } from "./home/pets-card";
import { BrinstarRoomCard } from "./home/room-card";
import { BrinstarSecurityCard } from "./home/security-card";
import { BrinstarWeatherCard } from "./home/weather-card";
import { BrinstarFeederCard } from "./pets/feeder-card";
import { BrinstarFountainCard } from "./pets/fountain-card";
import { BrinstarLitterCard } from "./pets/litter-card";
import { BrinstarVacuumStatusCard } from "./vacuum/status-card";
import { BrinstarVacuumCompactCard } from "./home/vacuum-compact-card";
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
  [
    "brinstar-vacuum-compact-card",
    BrinstarVacuumCompactCard,
    "Brinstar Vacuum Compact Card",
    "A Dreame vacuum at a glance: what it's doing, battery, last and next clean, parts running low; opens the full card.",
  ],
  ["brinstar-feeder-card", BrinstarFeederCard, "Brinstar Feeder Card", "Food left, last and next meal, feed now and meal times for an ESPHome cat feeder."],
  [
    "brinstar-fountain-card",
    BrinstarFountainCard,
    "Brinstar Fountain Card",
    "Water level, pump state, water used per day and filter for a scale-based ESPHome water fountain.",
  ],
  ["brinstar-litter-card", BrinstarLitterCard, "Brinstar Litter Card", "Litter and drawer levels, weight and visits per cat, and settings for a Litter-Robot."],
  ["brinstar-room-card", BrinstarRoomCard, "Brinstar Room Card", "A room at a glance: its main light, temperature, humidity, what Frigate sees now and the air."],
  ["brinstar-pets-card", BrinstarPetsCard, "Brinstar Pets Card", "Litter box, feeders and fountain on one card, problems first."],
  ["brinstar-weather-card", BrinstarWeatherCard, "Brinstar Weather Card", "Conditions from your own weather station, the last 24 hours and the next hours."],
  ["brinstar-lights-card", BrinstarLightsCard, "Brinstar Lights Card", "The lights that are on, with switches, brightness and All off, and favourites to turn on."],
  ["brinstar-climate-card", BrinstarClimateCard, "Brinstar Climate Card", "The thermostat and fans: what it's doing, target, mode, fan speeds and the last 24 hours."],
  ["brinstar-security-card", BrinstarSecurityCard, "Brinstar Security Card", "Alarm, locks, garage doors and every door and window; unsafe actions take a second tap."],
  [
    "brinstar-credit-cards-card",
    BrinstarCreditCardsCard,
    "Brinstar Credit Cards Card",
    "Credit card due dates from the credit_cards integration: what's due or overdue, one-tap Paid, and add, edit or remove cards.",
  ],
  ["brinstar-energy-card", BrinstarEnergyCard, "Brinstar Energy Card", "Whole-house power, amps, legs, today's energy and the circuits using it, from a CT energy monitor."],
];

window.customCards = window.customCards ?? [];
for (const [type, element, name, description] of CARDS) {
  if (!customElements.get(type)) customElements.define(type, element);
  window.customCards.push({ type, name, description, preview: false });
}

console.info(`%c BRINSTAR-CARDS %c ${__VERSION__} `, "background:#F4B650;color:#1E1B17;font-weight:700", "background:#2E2A24;color:#F1ECE3");
