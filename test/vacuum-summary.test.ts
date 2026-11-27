import { describe, expect, it } from "vitest";
import { batteryIcon } from "../src/lib/vacuum";
import { clock, lowParts, nextScheduled, runFacts, vacuumSummary } from "../src/lib/vacuum-summary";

const fine = { error: "No error", has_error: false, charging: false };

describe("vacuumSummary", () => {
  it("is docked, with nothing to tap", () => {
    expect(vacuumSummary({ state: "docked", attrs: fine })).toEqual({
      tone: "ok",
      headline: "Docked",
      running: false,
      problems: [],
    });
  });

  it("says when it's charging on the dock", () => {
    expect(vacuumSummary({ state: "docked", attrs: { ...fine, charging: true } }).headline).toBe("Docked · charging");
  });

  it("names the room it's cleaning and offers pause", () => {
    expect(vacuumSummary({ state: "cleaning", attrs: fine, room: "Kitchen" })).toEqual({
      tone: "active",
      headline: "Cleaning Kitchen",
      action: "pause",
      running: true,
      problems: [],
    });
    expect(vacuumSummary({ state: "cleaning", attrs: fine }).headline).toBe("Cleaning");
  });

  it("offers to send it home while it's paused or stopped off the dock", () => {
    const paused = vacuumSummary({ state: "paused", attrs: fine, room: "Kitchen" });
    expect([paused.headline, paused.action, paused.running, paused.tone]).toEqual(["Paused in Kitchen", "home", true, "idle"]);
    const idle = vacuumSummary({ state: "idle", attrs: fine });
    expect([idle.headline, idle.action, idle.running]).toEqual(["Stopped off the dock", "home", false]);
  });

  it("is heading home, with nothing to tap", () => {
    const s = vacuumSummary({ state: "returning", attrs: fine });
    expect([s.headline, s.action, s.running, s.tone]).toEqual(["Heading home", undefined, true, "active"]);
  });

  it("is offline when it has no state", () => {
    expect(vacuumSummary({ state: "unavailable", attrs: {} })).toEqual({
      tone: "error",
      headline: "Offline",
      running: false,
      problems: [{ text: "Offline", tone: "error" }],
    });
  });

  it("puts the robot's error in the headline and drops the action", () => {
    const s = vacuumSummary({ state: "error", attrs: { error: "Wheel stuck", has_error: true }, room: "Kitchen" });
    expect([s.tone, s.headline, s.action]).toEqual(["error", "Wheel stuck", undefined]);
    expect(vacuumSummary({ state: "error", attrs: { error: "No error", has_error: false } }).headline).toBe("Needs help");
  });

  it("reports a dock problem, but not a busy base", () => {
    const s = vacuumSummary({
      state: "docked",
      attrs: fine,
      dock: [
        { label: "Dirty water tank", state: "not_installed_or_full" },
        { label: "Dust bag", state: "installed" },
      ],
    });
    expect([s.tone, s.headline]).toEqual(["warn", "Dirty water tank: not installed or full"]);
    expect(vacuumSummary({ state: "docked", attrs: fine, dock: [{ label: "Dust bag", state: "unavailable" }] }).problems).toEqual([]);
  });

  it("reports a part under 10% as due", () => {
    const s = vacuumSummary({ state: "docked", attrs: fine, parts: [{ label: "Sensors", pct: 6 }, { label: "Filter", pct: 15 }] });
    expect(s.problems).toEqual([{ text: "Sensors 6% left", tone: "warn" }]);
    expect(s.headline).toBe("Sensors 6% left");
  });

  it("lists an error before warnings", () => {
    const s = vacuumSummary({
      state: "docked",
      attrs: { error: "Dust bag full", has_error: true },
      dock: [{ label: "Clean water tank", state: "not_installed" }],
      parts: [{ label: "Wheel", pct: 3 }],
    });
    expect(s.problems.map((p) => p.text)).toEqual(["Dust bag full", "Clean water tank: not installed", "Wheel 3% left"]);
  });

  it("keeps saying what it's doing while it runs, with problems listed under it", () => {
    const s = vacuumSummary({ state: "cleaning", attrs: fine, room: "Kitchen", dock: [{ label: "Clean water tank", state: "low_water" }] });
    expect([s.headline, s.tone, s.action]).toEqual(["Cleaning Kitchen", "active", "pause"]);
    expect(s.problems).toEqual([{ text: "Clean water tank: low water", tone: "warn" }]);
  });
});

describe("nextScheduled", () => {
  const rooms = { "Map 1": [{ id: 1, name: "Office" }, { id: 3, name: "Kitchen" }, { id: 5, name: "Living Room" }] };
  // 2026-11-27 11:00 local
  const now = new Date(2026, 10, 27, 11, 0).getTime();
  const task = { enabled: true, invalid: false, time: "14:00", repeats: "1111111", once: false, options: ["5", "3", "9"] };

  it("is later today for a daily task that hasn't run yet, with its rooms by name", () => {
    expect(nextScheduled([task], rooms, "Map 1", now)).toEqual({
      at: new Date(2026, 10, 27, 14, 0).getTime(),
      time: "14:00",
      rooms: ["Living Room", "Kitchen"],
    });
  });

  it("is tomorrow once today's time has passed", () => {
    expect(nextScheduled([{ ...task, time: "09:30" }], rooms, "Map 1", now)?.at).toBe(new Date(2026, 10, 28, 9, 30).getTime());
  });

  it("treats a one-off task like a daily one", () => {
    expect(nextScheduled([{ ...task, repeats: "0000000", once: true }], rooms, "Map 1", now)?.at).toBe(
      new Date(2026, 10, 27, 14, 0).getTime(),
    );
  });

  it("gives only the time when the repeat days aren't every day", () => {
    expect(nextScheduled([{ ...task, repeats: "0111110" }], rooms, "Map 1", now)).toEqual({
      time: "14:00",
      rooms: ["Living Room", "Kitchen"],
    });
  });

  it("picks the soonest enabled, valid task", () => {
    const tasks = [
      { ...task, time: "18:00" },
      { ...task, time: "12:00", enabled: false },
      { ...task, time: "12:30", invalid: true },
      { ...task, time: "15:00", options: null },
    ];
    expect(nextScheduled(tasks, rooms, "Map 1", now)).toEqual({ at: new Date(2026, 10, 27, 15, 0).getTime(), time: "15:00", rooms: [] });
  });

  it("is undefined without a usable task, and reads the first map when none is selected", () => {
    expect(nextScheduled([], rooms, "Map 1", now)).toBeUndefined();
    expect(nextScheduled(undefined, rooms, "Map 1", now)).toBeUndefined();
    expect(nextScheduled([{ ...task, time: "" }], rooms, "Map 1", now)).toBeUndefined();
    expect(nextScheduled([task], rooms, undefined, now)?.rooms).toEqual(["Living Room", "Kitchen"]);
  });
});

describe("clock", () => {
  it("formats a schedule time in the locale", () => {
    expect(clock("14:00", "en-US")).toBe("2:00 PM");
    expect(clock("09:05", "en-US")).toBe("9:05 AM");
  });
});

describe("lowParts", () => {
  it("lists parts from 10% up to 20%", () => {
    expect(
      lowParts([
        { label: "Sensors", pct: 15.4 },
        { label: "Wheel", pct: 12 },
        { label: "Filter", pct: 87 },
        { label: "Side brush", pct: 6 },
        { label: "Main brush", pct: 20 },
      ]),
    ).toEqual(["Sensors 15%", "Wheel 12%"]);
  });
});

describe("runFacts", () => {
  it("says how long it ran and how much it covered", () => {
    expect(runFacts(41, 25, "m²")).toBe("41 min · 25 m²");
    expect(runFacts(65, 40.4, "m²")).toBe("1 h 5 min · 40 m²");
    expect(runFacts(undefined, 12, "ft²")).toBe("12 ft²");
    expect(runFacts(undefined, undefined, undefined)).toBe("");
  });
});

describe("batteryIcon", () => {
  it("rounds to the nearest ten and shows charging", () => {
    expect(batteryIcon(100, false)).toBe("mdi:battery");
    expect(batteryIcon(46, false)).toBe("mdi:battery-50");
    expect(batteryIcon(3, false)).toBe("mdi:battery-outline");
    expect(batteryIcon(100, true)).toBe("mdi:battery-charging-100");
    expect(batteryIcon(72, true)).toBe("mdi:battery-charging-70");
  });
});
