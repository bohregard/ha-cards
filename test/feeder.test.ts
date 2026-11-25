import { describe, expect, it } from "vitest";
import { feedKind, feederStatus, feedsFromHistory, foodEstimate, nextMeal } from "../src/lib/feeder";

const T = (iso: string) => Date.parse(iso);

describe("feedsFromHistory", () => {
  const lastFed = [
    { t: T("2026-11-24T14:00:13Z"), s: "2026-11-24T14:00:13+00:00" },
    { t: T("2026-11-24T15:00:00Z"), s: "unavailable" },
    // reconnect republishes the same feed
    { t: T("2026-11-24T15:01:00Z"), s: "2026-11-24T14:00:13+00:00" },
    { t: T("2026-11-24T17:00:12Z"), s: "2026-11-24T17:00:12+00:00" },
    { t: T("2026-11-24T22:00:13Z"), s: "2026-11-24T22:00:13+00:00" },
  ];
  const scoops = [
    { t: T("2026-11-24T10:00:00Z"), s: "1" },
    // the scoop count lands a few seconds after last_fed
    { t: T("2026-11-24T14:00:18Z"), s: "2" },
    { t: T("2026-11-24T17:00:20Z"), s: "1" },
  ];

  it("makes one feed per distinct last-fed time, with the scoops reported for it", () => {
    expect(feedsFromHistory(lastFed, scoops)).toEqual([
      { at: T("2026-11-24T14:00:13Z"), scoops: 2 },
      { at: T("2026-11-24T17:00:12Z"), scoops: 1 },
      // no new scoops row: the count didn't change, so it's still 1
      { at: T("2026-11-24T22:00:13Z"), scoops: 1 },
    ]);
  });

  it("does not take a scoop count reported more than a minute after the feed", () => {
    const late = [{ t: T("2026-11-24T14:05:00Z"), s: "3" }];
    expect(feedsFromHistory([lastFed[0]], late)).toEqual([{ at: T("2026-11-24T14:00:13Z"), scoops: 0 }]);
  });
});

describe("foodEstimate", () => {
  const now = T("2026-11-24T23:00:00Z");
  const feeds = [
    { at: T("2026-11-20T14:00:00Z"), scoops: 4 }, // before the refill
    { at: T("2026-11-23T14:00:00Z"), scoops: 3 },
    { at: T("2026-11-24T14:00:00Z"), scoops: 2 },
  ];
  const base = { feeds, hopperGrams: 1000, gramsPerScoop: 10, now };

  it("is unknown until the hopper has been marked refilled", () => {
    expect(foodEstimate({ ...base, refillAt: undefined })).toBeUndefined();
  });

  it("subtracts only the scoops dispensed since the refill", () => {
    const e = foodEstimate({ ...base, refillAt: T("2026-11-21T00:00:00Z") })!;
    expect(e.leftGrams).toBe(950);
    expect(e.fraction).toBeCloseTo(0.95);
  });

  it("never goes below empty", () => {
    const e = foodEstimate({ ...base, hopperGrams: 30, refillAt: T("2026-11-21T00:00:00Z") })!;
    expect(e.leftGrams).toBe(0);
    expect(e.fraction).toBe(0);
  });

  it("projects days left from the last 7 days of feeding", () => {
    // 4 + 3 + 2 scoops in the last 7 days = 90 g, about 12.86 g a day; 950 g lasts ~73.9 days
    const e = foodEstimate({ ...base, refillAt: T("2026-11-21T00:00:00Z") })!;
    expect(e.daysLeft).toBeCloseTo(950 / (90 / 7));
  });

  it("has no days-left figure when nothing was dispensed in the last week", () => {
    const e = foodEstimate({ ...base, feeds: [], refillAt: T("2026-11-21T00:00:00Z") })!;
    expect(e.leftGrams).toBe(1000);
    expect(e.daysLeft).toBeUndefined();
  });
});

const local = (h: number, m: number, day = 24) => new Date(2026, 10, day, h, m).getTime();
const meals = [
  { time: "09:00", scoops: 2 },
  { time: "12:00", scoops: 0 },
  { time: "17:00", scoops: 2 },
  { time: "23:59", scoops: 1 },
];

describe("feedKind", () => {
  it.each([
    ["a feed a minute after a meal time", local(17, 1), 2],
    ["a feed a minute before a meal time", local(8, 59), 0],
    ["a feed at a meal set to 0 scoops", local(12, 0), undefined],
    ["a feed three minutes off any meal", local(17, 3), undefined],
    ["a feed just after midnight for a 23:59 meal", local(0, 0, 25), 3],
  ])("%s", (_, at, want) => {
    expect(feedKind(at, meals)).toBe(want);
  });
});

describe("nextMeal", () => {
  it("is the next meal with scoops later today", () => {
    expect(nextMeal(meals, local(9, 30))).toEqual({ index: 2, at: local(17, 0), scoops: 2 });
  });

  it("wraps to tomorrow's first meal after the last one", () => {
    expect(nextMeal(meals.slice(0, 3), local(18, 0))).toEqual({ index: 0, at: local(9, 0, 25), scoops: 2 });
  });

  it("is undefined when every meal is skipped", () => {
    expect(nextMeal([{ time: "09:00", scoops: 0 }], local(8, 0))).toBeUndefined();
  });
});

describe("feederStatus", () => {
  const ok = { online: true, jammed: false, empty: false, low: false };
  it.each([
    ["offline", { ...ok, online: false }, "Offline", "error"],
    ["jammed", { ...ok, jammed: true, empty: true }, "Jammed", "error"],
    ["empty", { ...ok, empty: true, low: true }, "Out of food", "error"],
    ["low", { ...ok, low: true }, "Food low", "warn"],
    ["fine", ok, "Food OK", "ok"],
  ])("%s", (_, flags, label, tone) => {
    expect(feederStatus(flags)).toEqual({ label, tone });
  });
});
