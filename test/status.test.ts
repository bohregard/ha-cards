import { describe, expect, it } from "vitest";
import { consumableParts, dayLabel, formatRemaining, partTone, statusTone } from "../src/lib/status";

const dev = (id: string, tk: string) => ({ entity_id: id, device_id: "d", translation_key: tk });
const entities = Object.fromEntries(
  [
    dev("vacuum.robot", "x"),
    dev("sensor.robot_filter_left", "filter_left"),
    dev("sensor.robot_filter_time_left", "filter_time_left"),
    dev("button.robot_reset_filter", "reset_filter"),
    dev("sensor.robot_wheel_dirty_left", "wheel_dirty_left"),
  ].map((e) => [e.entity_id, e]),
);

describe("consumableParts", () => {
  it("links each part's level, time-left sensor and reset button", () => {
    const filter = consumableParts(entities, "vacuum.robot").find((p) => p.key === "filter");
    expect(filter).toEqual({
      key: "filter",
      label: "Filter",
      level: "sensor.robot_filter_left",
      remaining: "sensor.robot_filter_time_left",
      reset: "button.robot_reset_filter",
    });
  });

  it("keeps a part whose time-left sensor and reset button are missing", () => {
    const wheel = consumableParts(entities, "vacuum.robot").find((p) => p.key === "wheel");
    expect(wheel).toMatchObject({ level: "sensor.robot_wheel_dirty_left", remaining: undefined, reset: undefined });
  });

  it("drops parts the vacuum doesn't have", () => {
    expect(consumableParts(entities, "vacuum.robot").map((p) => p.key)).toEqual(["filter", "wheel"]);
  });
});

describe("formatRemaining", () => {
  it.each([
    [17, "h", "17 h"],
    [0.708333333333333, "d", "17 h"],
    [287, "h", "12 days"],
    [563, "d", "18 months"],
    [0, "h", "Due now"],
    [-3, "h", "Due now"],
    [36, "min", "1 h"],
  ])("%s %s → %s", (value, unit, text) => {
    expect(formatRemaining(value, unit)).toBe(text);
  });

  it("returns undefined for a value it can't read", () => {
    expect(formatRemaining(Number.NaN, "h")).toBeUndefined();
    expect(formatRemaining(5, "weeks")).toBeUndefined();
  });
});

describe("partTone", () => {
  it.each([
    [50, "ok"],
    [20, "ok"],
    [19, "warn"],
    [10, "warn"],
    [9, "error"],
    [0, "error"],
  ])("%s%% is %s", (pct, tone) => {
    expect(partTone(pct)).toBe(tone);
  });
});

describe("statusTone", () => {
  it.each([
    ["installed", "ok"],
    ["enabled", "ok"],
    ["idle", "ok"],
    ["not_installed", "warn"],
    ["low_detergent", "warn"],
    ["unavailable", undefined],
    ["unknown", undefined],
  ])("%s is %s", (state, tone) => {
    expect(statusTone(state)).toBe(tone);
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 10, 18, 21, 0);
  it.each([
    [new Date(2026, 10, 18, 13, 2), "Today"],
    [new Date(2026, 10, 17, 23, 59), "Yesterday"],
    [new Date(2026, 10, 14, 9, 0), "Sat"],
    [new Date(2026, 9, 2, 9, 0), "Oct 2"],
  ])("%s → %s", (when, label) => {
    expect(dayLabel(when, now, "en-US")).toBe(label);
  });
});
