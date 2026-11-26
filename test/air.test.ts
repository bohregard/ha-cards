import { describe, expect, it } from "vitest";
import { airSummary, pm25Level, vocLevel } from "../src/lib/air";

describe("pm25Level (2024 EPA breakpoints, µg/m³)", () => {
  it.each([
    [0, "ok", "Good"],
    [9, "ok", "Good"],
    [9.1, "warn", "Moderate"],
    [35.4, "warn", "Moderate"],
    [35.5, "error", "Unhealthy for sensitive groups"],
    [55.5, "error", "Unhealthy"],
  ])("%s reads %s / %s", (v, tone, label) => {
    expect(pm25Level(v)).toEqual({ tone, label });
  });
});

describe("vocLevel (Sensirion VOC index)", () => {
  it.each([
    [41, "ok", "Normal"],
    [150, "ok", "Normal"],
    [151, "warn", "Elevated"],
    [251, "error", "High"],
  ])("%s reads %s / %s", (v, tone, label) => {
    expect(vocLevel(v)).toEqual({ tone, label });
  });
});

describe("airSummary", () => {
  it("is undefined when the room has no air sensors", () => {
    expect(airSummary({})).toBeUndefined();
  });

  it("says the air is good when every reading is good", () => {
    expect(airSummary({ pm25: 1, voc: 41 })).toEqual({ tone: "ok", text: "Air good" });
  });

  it("names the worst reading with its value", () => {
    expect(airSummary({ pm25: 31, voc: 41 })).toEqual({ tone: "warn", text: "PM2.5 31 · moderate" });
    expect(airSummary({ pm25: 31, voc: 260 })).toEqual({ tone: "error", text: "VOC 260 · high" });
  });

  it("keeps the worst PM2.5 bands short enough for a small card", () => {
    expect(airSummary({ pm25: 41 })).toEqual({ tone: "error", text: "PM2.5 41 · unhealthy for some" });
    expect(airSummary({ pm25: 80 })).toEqual({ tone: "error", text: "PM2.5 80 · unhealthy" });
  });

  it("works with only one sensor", () => {
    expect(airSummary({ voc: 200 })).toEqual({ tone: "warn", text: "VOC 200 · elevated" });
  });
});
