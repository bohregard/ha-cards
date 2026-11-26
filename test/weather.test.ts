import { describe, expect, it } from "vitest";
import { compass, conditionIcon, conditionLabel, pressureTrend, rainPerHour } from "../src/lib/weather";

describe("compass", () => {
  it.each([
    [0, "N"],
    [351, "N"],
    [22.5, "NNE"],
    [90, "E"],
    [200, "SSW"],
    [337, "NNW"],
    [360, "N"],
  ])("%s° is %s", (deg, want) => {
    expect(compass(deg)).toBe(want);
  });
});

describe("condition", () => {
  it.each([
    ["fog", "weather-fog", "Fog"],
    ["partlycloudy", "weather-partly-cloudy", "Partly cloudy"],
    ["clear-night", "weather-night", "Clear"],
    ["lightning-rainy", "weather-lightning-rainy", "Thunderstorms"],
    ["snowy-rainy", "weather-snowy-rainy", "Sleet"],
    ["something-new", "weather-cloudy", "Something new"],
  ])("%s has icon %s and reads %s", (state, icon, label) => {
    expect(conditionIcon(state)).toBe(icon);
    expect(conditionLabel(state)).toBe(label);
  });
});

describe("pressureTrend", () => {
  const h = 3_600_000;
  const now = 10 * h;
  const pts = (then: number, latest: number) => [
    { t: now - 4 * h, v: then - 0.01 },
    { t: now - 3 * h, v: then },
    { t: now - 1 * h, v: (then + latest) / 2 },
    { t: now, v: latest },
  ];

  it("compares the latest reading with the one 3 hours ago", () => {
    expect(pressureTrend(pts(29.6, 29.65), now)).toBe("rising");
    expect(pressureTrend(pts(29.7, 29.62), now)).toBe("falling");
    expect(pressureTrend(pts(29.62, 29.63), now)).toBe("steady");
  });

  it("is undefined without readings that far back", () => {
    expect(pressureTrend([{ t: now, v: 29.6 }], now)).toBeUndefined();
  });
});

describe("rainPerHour", () => {
  it("turns an hourly running total into rain per hour, starting over when the total resets at midnight", () => {
    const pts = [0.1, 0.1, 0.3, 0.3, 0.2].map((v, i) => ({ t: i, v }));
    expect(rainPerHour(pts)).toEqual([
      { t: 1, v: 0 },
      { t: 2, v: 0.2 },
      { t: 3, v: 0 },
      { t: 4, v: 0.2 },
    ]);
  });

  it("is empty with fewer than two readings", () => {
    expect(rainPerHour([{ t: 0, v: 0.1 }])).toEqual([]);
  });
});
