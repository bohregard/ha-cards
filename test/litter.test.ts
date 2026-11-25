import { describe, expect, it } from "vitest";
import { assignCat, dailyWeights, litterStatus, visitsPerCat, weighings } from "../src/lib/litter";

const cats = [{ name: "Small", max_lb: 9 }, { name: "Medium", max_lb: 12.5 }, { name: "Large" }];

describe("assignCat", () => {
  it.each([
    [7.9, 0],
    [9, 0],
    [9.01, 1],
    [12.5, 1],
    [15.6, 2],
  ])("%s lb is cat %s", (lb, want) => {
    expect(assignCat(lb, cats)).toBe(want);
  });

  it("puts everything on the last cat when none has a limit", () => {
    expect(assignCat(30, [{ name: "Only" }])).toBe(0);
  });
});

describe("weighings", () => {
  it("keeps the numeric readings", () => {
    const rows = [
      { t: 1, s: "10.51" },
      { t: 2, s: "unavailable" },
      { t: 3, s: "15.4" },
    ];
    expect(weighings(rows)).toEqual([
      { t: 1, lb: 10.51 },
      { t: 3, lb: 15.4 },
    ]);
  });
});

const now = new Date(2026, 10, 24, 18, 0).getTime();
const at = (day: number, h: number) => new Date(2026, 10, day, h).getTime();

describe("visitsPerCat", () => {
  it("counts each cat's weighings per local day, oldest first", () => {
    const w = [
      { t: at(23, 8), lb: 8.1 },
      { t: at(23, 9), lb: 15.5 },
      { t: at(24, 7), lb: 8.0 },
      { t: at(24, 10), lb: 10.4 },
      { t: at(24, 12), lb: 7.9 },
    ];
    expect(visitsPerCat(w, cats, now, 2)).toEqual([
      [1, 2],
      [0, 1],
      [1, 0],
    ]);
  });
});

describe("litterStatus", () => {
  const ready = { online: true, state: "docked", code: "rdy", drawerPct: 15 };
  it.each([
    ["offline", { ...ready, online: false }, "Offline", "error"],
    ["a fault code", { ...ready, code: "csf" }, "Cat sensor fault", "error"],
    ["the vacuum reports an error", { ...ready, state: "error", code: "xyz" }, "Needs attention", "error"],
    ["the drawer-full code", { ...ready, code: "dfs" }, "Drawer full", "error"],
    ["the drawer gauge above 80 %", { ...ready, drawerPct: 81 }, "Drawer full", "error"],
    ["the drawer gauge above 75 %", { ...ready, drawerPct: 76 }, "Drawer almost full", "warn"],
    ["a clean cycle", { ...ready, state: "cleaning", code: "ccp" }, "Cycling", "active"],
    ["a cat inside", { ...ready, code: "cst" }, "Cat inside", "active"],
    ["ready", ready, "Ready", "ok"],
  ])("%s", (_, s, label, tone) => {
    expect(litterStatus(s)).toEqual({ label, tone });
  });
});

describe("dailyWeights", () => {
  it("averages each cat's weighings per local day, at local noon, skipping days without any", () => {
    const w = [
      { t: at(22, 8), lb: 8.0 },
      { t: at(22, 20), lb: 8.4 },
      { t: at(22, 9), lb: 15.0 },
      { t: at(24, 7), lb: 8.1 },
    ];
    expect(dailyWeights(w, cats, now, 3)).toEqual([
      [
        { t: at(22, 12), v: 8.2 },
        { t: at(24, 12), v: 8.1 },
      ],
      [],
      [{ t: at(22, 12), v: 15.0 }],
    ]);
  });
});
