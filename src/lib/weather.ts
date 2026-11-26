import type { ValuePoint } from "./history";

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** 16-point compass name for a wind direction in degrees. */
export function compass(deg: number): string {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

const CONDITIONS: Record<string, [string, string]> = {
  "clear-night": ["weather-night", "Clear"],
  cloudy: ["weather-cloudy", "Cloudy"],
  exceptional: ["alert-circle-outline", "Severe weather"],
  fog: ["weather-fog", "Fog"],
  hail: ["weather-hail", "Hail"],
  lightning: ["weather-lightning", "Lightning"],
  "lightning-rainy": ["weather-lightning-rainy", "Thunderstorms"],
  partlycloudy: ["weather-partly-cloudy", "Partly cloudy"],
  pouring: ["weather-pouring", "Heavy rain"],
  rainy: ["weather-rainy", "Rain"],
  snowy: ["weather-snowy", "Snow"],
  "snowy-rainy": ["weather-snowy-rainy", "Sleet"],
  sunny: ["weather-sunny", "Sunny"],
  windy: ["weather-windy", "Windy"],
  "windy-variant": ["weather-windy-variant", "Windy"],
};

/** MDI icon name for a Home Assistant weather condition. */
export function conditionIcon(state: string): string {
  return CONDITIONS[state]?.[0] ?? "weather-cloudy";
}

/** Plain words for a Home Assistant weather condition. */
export function conditionLabel(state: string): string {
  const known = CONDITIONS[state]?.[1];
  if (known) return known;
  const words = state.replace(/[-_]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Barometric tendency: the latest reading against the one `hours` ago, by more than `threshold`. */
export function pressureTrend(
  points: ValuePoint[],
  now: number,
  hours = 3,
  threshold = 0.03,
): "rising" | "falling" | "steady" | undefined {
  if (points.length < 2) return undefined;
  const latest = points[points.length - 1];
  const then = [...points].reverse().find((p) => p.t <= now - hours * 3_600_000);
  if (!then) return undefined;
  const d = latest.v - then.v;
  return d >= threshold ? "rising" : d <= -threshold ? "falling" : "steady";
}

/**
 * Rain per hour from an hourly running total (e.g. the max of a daily-rain sensor per hour).
 * A drop means the total reset at midnight, so that hour's rain is the new total.
 */
export function rainPerHour(points: ValuePoint[]): ValuePoint[] {
  const out: ValuePoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = points[i].v - points[i - 1].v;
    out.push({ t: points[i].t, v: Math.round((d < 0 ? points[i].v : d) * 1000) / 1000 });
  }
  return out;
}
