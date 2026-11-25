import { describe, expect, it } from "vitest";
import { fountainStatus, pumpReason, waterUsedPerDay } from "../src/lib/fountain";

describe("fountainStatus", () => {
  const ok = { online: true, empty: false, low: false };
  it.each([
    ["offline", { ...ok, online: false, empty: true }, "Offline", "error"],
    ["below the empty threshold", { ...ok, empty: true, low: true }, "Refill now", "error"],
    ["below the low threshold", { ...ok, low: true }, "Water low", "warn"],
    ["fine", ok, "Water OK", "ok"],
  ])("%s", (_, flags, label, tone) => {
    expect(fountainStatus(flags)).toEqual({ label, tone });
  });
});

describe("pumpReason", () => {
  it.each([
    ["the motor is on", { running: true, wanted: true, empty: false }, "Pump running"],
    ["the pump is switched off", { running: false, wanted: false, empty: true }, "Pump off"],
    ["the scale holds it off", { running: false, wanted: true, empty: true }, "Pump stopped"],
    ["it waits for the radar", { running: false, wanted: true, empty: false }, "Waiting for a cat"],
  ])("%s", (_, s, want) => {
    expect(pumpReason(s)).toBe(want);
  });
});

const now = new Date(2026, 10, 24, 18, 0).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime();

describe("waterUsedPerDay", () => {
  it("adds up the drop in weight through the day", () => {
    const pts = [
      { t: at(24, 8), v: 1500 },
      { t: at(24, 12), v: 1450 },
      { t: at(24, 16), v: 1400 },
    ];
    expect(waterUsedPerDay(pts, now, 1)).toEqual([100]);
  });

  it("ignores a refill instead of letting it cancel the drinking", () => {
    const pts = [
      { t: at(24, 8), v: 1400 },
      { t: at(24, 9), v: 1350 },
      { t: at(24, 10), v: 2500 },
      { t: at(24, 11), v: 2450 },
    ];
    expect(waterUsedPerDay(pts, now, 1)).toEqual([100]);
  });

  it("lets small rises from sloshing cancel the matching drops", () => {
    const pts = [
      { t: at(24, 8), v: 1500 },
      { t: at(24, 8, 5), v: 1490 },
      { t: at(24, 8, 10), v: 1495 },
      { t: at(24, 8, 15), v: 1480 },
    ];
    expect(waterUsedPerDay(pts, now, 1)).toEqual([20]);
  });

  it("splits the use by local day and never reports a negative day", () => {
    const pts = [
      { t: at(22, 20), v: 1500 },
      { t: at(22, 22), v: 1520 },
      { t: at(23, 9), v: 1440 },
      { t: at(23, 23, 55), v: 1400 },
      { t: at(24, 0, 5), v: 1390 },
    ];
    expect(waterUsedPerDay(pts, now, 3)).toEqual([0, 120, 10]);
  });
});
