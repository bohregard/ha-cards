import { describe, expect, it } from "vitest";
import {
  climateView,
  fanSpeedIndex,
  fanSpeeds,
  modeButtons,
  parseClimateHistory,
  runHint,
  runTime,
  stepTarget,
} from "../src/lib/climate";

describe("modeButtons", () => {
  it("orders the modes Off, Cool, Heat, Auto whatever order the thermostat gives", () => {
    expect(modeButtons(["heat", "cool", "heat_cool", "off"])).toEqual([
      { mode: "off", label: "Off" },
      { mode: "cool", label: "Cool" },
      { mode: "heat", label: "Heat" },
      { mode: "heat_cool", label: "Auto" },
    ]);
  });

  it("calls heat_cool Heat/Cool when the thermostat also has its own auto mode", () => {
    expect(modeButtons(["off", "heat_cool", "auto"]).map((b) => b.label)).toEqual(["Off", "Heat/Cool", "Auto"]);
  });

  it("puts modes it has no name for last, labelled from their id", () => {
    expect(modeButtons(["fan_only", "dry", "cool", "turbo"]).map((b) => b.label)).toEqual(["Cool", "Dry", "Fan", "Turbo"]);
  });
});

describe("climateView", () => {
  it("is cooling toward the target", () => {
    expect(climateView("cool", { hvac_action: "cooling", temperature: 75 })).toEqual({
      tone: "cool",
      headline: "Cooling to 75°",
      running: true,
      targets: [{ key: "temperature", label: "Cool to", value: 75 }],
    });
  });

  it("is heating toward the target", () => {
    const v = climateView("heat", { hvac_action: "heating", temperature: 68 });
    expect([v.tone, v.headline, v.running]).toEqual(["heat", "Heating to 68°", true]);
    expect(v.targets).toEqual([{ key: "temperature", label: "Heat to", value: 68 }]);
  });

  it("says when an idle thermostat will start", () => {
    expect(climateView("cool", { hvac_action: "idle", temperature: 75 }).headline).toBe("Idle · cools above 75°");
    expect(climateView("heat", { hvac_action: "idle", temperature: 68 }).headline).toBe("Idle · heats below 68°");
    expect(climateView("cool", { hvac_action: "idle", temperature: 75 }).tone).toBe("idle");
  });

  it("keeps a range in heat_cool, with a target for each end", () => {
    const v = climateView("heat_cool", { hvac_action: "idle", target_temp_low: 68, target_temp_high: 75 });
    expect(v.headline).toBe("Idle · keeps 68–75°");
    expect(v.targets).toEqual([
      { key: "target_temp_low", label: "Heat to", value: 68 },
      { key: "target_temp_high", label: "Cool to", value: 75 },
    ]);
  });

  it("aims at the right end of the range while it runs in heat_cool", () => {
    const range = { target_temp_low: 68, target_temp_high: 75 };
    expect(climateView("heat_cool", { ...range, hvac_action: "cooling" }).headline).toBe("Cooling to 75°");
    expect(climateView("heat_cool", { ...range, hvac_action: "heating" }).headline).toBe("Heating to 68°");
  });

  it("shows the fan running as moving air", () => {
    const v = climateView("cool", { hvac_action: "fan", temperature: 75 });
    expect([v.tone, v.headline, v.running]).toEqual(["cool", "Fan running", true]);
  });

  it("is off, with nothing to set", () => {
    expect(climateView("off", { hvac_action: "off", temperature: 75 })).toEqual({ tone: "off", headline: "Off", running: false, targets: [] });
  });

  it("is offline when the thermostat has no state", () => {
    expect(climateView("unavailable", {})).toEqual({ tone: "error", headline: "Thermostat offline", running: false, targets: [] });
    expect(climateView("unknown", {}).tone).toBe("error");
  });

  it("drops the target from the headline when the thermostat doesn't report one", () => {
    expect(climateView("cool", { hvac_action: "cooling" }).headline).toBe("Cooling");
    expect(climateView("cool", { hvac_action: "idle" }).headline).toBe("Idle");
    expect(climateView("cool", {}).targets).toEqual([]);
  });

  it("keeps half degrees", () => {
    expect(climateView("heat", { hvac_action: "heating", temperature: 20.5 }).headline).toBe("Heating to 20.5°");
  });
});

describe("stepTarget", () => {
  it("moves by one step", () => {
    expect(stepTarget(75, 1, 1, 50, 90)).toBe(76);
    expect(stepTarget(75, -1, 1, 50, 90)).toBe(74);
  });

  it("snaps to the step without float noise", () => {
    expect(stepTarget(20.5, 0.5, 0.5, 7, 35)).toBe(21);
    expect(stepTarget(20.3, 0.5, 0.5, 7, 35)).toBe(21);
    expect(stepTarget(0.1, 0.2, 0.1, 0, 1)).toBe(0.3);
  });

  it("stays within the thermostat's range", () => {
    expect(stepTarget(90, 1, 1, 50, 90)).toBe(90);
    expect(stepTarget(50, -1, 1, 50, 90)).toBe(50);
  });
});

describe("fanSpeeds", () => {
  it("names three speeds Low, Med, High at the percentages HA maps to them", () => {
    expect(fanSpeeds(100 / 3)).toEqual([
      { label: "Low", pct: 33 },
      { label: "Med", pct: 67 },
      { label: "High", pct: 100 },
    ]);
  });

  it("names two and four speeds", () => {
    expect(fanSpeeds(50).map((s) => s.label)).toEqual(["Low", "High"]);
    expect(fanSpeeds(25).map((s) => s.label)).toEqual(["Low", "Med", "High", "Max"]);
  });

  it("uses percentages for five or six speeds", () => {
    expect(fanSpeeds(20)).toEqual([
      { label: "20%", pct: 20 },
      { label: "40%", pct: 40 },
      { label: "60%", pct: 60 },
      { label: "80%", pct: 80 },
      { label: "100%", pct: 100 },
    ]);
  });

  it("offers four quarter steps for a fan with fine-grained speed", () => {
    expect(fanSpeeds(1).map((s) => s.pct)).toEqual([25, 50, 75, 100]);
  });

  it("is a single On for a fan without speeds", () => {
    expect(fanSpeeds(undefined)).toEqual([{ label: "On", pct: 100 }]);
  });
});

describe("fanSpeedIndex", () => {
  const three = fanSpeeds(100 / 3);

  it("is -1 (Off) while the fan is off", () => {
    expect(fanSpeedIndex("off", 0, three)).toBe(-1);
    expect(fanSpeedIndex("unavailable", undefined, three)).toBe(-1);
  });

  it("picks the nearest speed to the reported percentage", () => {
    expect(fanSpeedIndex("on", 33, three)).toBe(0);
    expect(fanSpeedIndex("on", 66, three)).toBe(1);
    expect(fanSpeedIndex("on", 100, three)).toBe(2);
  });

  it("treats an on fan without a percentage as its top speed", () => {
    expect(fanSpeedIndex("on", undefined, three)).toBe(2);
    expect(fanSpeedIndex("on", undefined, fanSpeeds(undefined))).toBe(0);
  });
});

describe("parseClimateHistory", () => {
  const S = 1000;
  const row = (lu: number, s: string, a: Record<string, unknown>) => ({ s, a, lu, lc: 1 });

  it("reads the inside temperature, the target and when it ran, using each row's update time", () => {
    const rows = [
      row(0, "cool", { current_temperature: 76, temperature: 75, hvac_action: "cooling" }),
      row(60, "cool", { current_temperature: 75, temperature: 75, hvac_action: "idle" }),
      row(120, "cool", { current_temperature: 74, temperature: 73, hvac_action: "idle" }),
      row(180, "cool", { current_temperature: 75, temperature: 73, hvac_action: "cooling" }),
    ];
    expect(parseClimateHistory(rows, 240 * S)).toEqual({
      temps: [
        { t: 0, v: 76 },
        { t: 60 * S, v: 75 },
        { t: 120 * S, v: 74 },
        { t: 180 * S, v: 75 },
      ],
      targets: [
        { t0: 0, t1: 120 * S, v: 75 },
        { t0: 120 * S, t1: 240 * S, v: 73 },
      ],
      runs: [
        { t0: 0, t1: 60 * S, kind: "cool" },
        { t0: 180 * S, t1: 240 * S, kind: "cool" },
      ],
    });
  });

  it("has no target while it's off, and takes heating runs", () => {
    const rows = [
      row(0, "heat", { current_temperature: 66, temperature: 68, hvac_action: "heating" }),
      row(60, "off", { current_temperature: 68, temperature: 68, hvac_action: "off" }),
      row(120, "heat", { current_temperature: 67, temperature: 68, hvac_action: "idle" }),
    ];
    const h = parseClimateHistory(rows, 180 * S);
    expect(h.targets).toEqual([
      { t0: 0, t1: 60 * S, v: 68 },
      { t0: 120 * S, t1: 180 * S, v: 68 },
    ]);
    expect(h.runs).toEqual([{ t0: 0, t1: 60 * S, kind: "heat" }]);
  });

  it("skips rows without a reading and an offline thermostat", () => {
    const rows = [
      row(0, "unavailable", {}),
      row(60, "cool", { current_temperature: null, temperature: 75, hvac_action: "idle" }),
    ];
    const h = parseClimateHistory(rows, 120 * S);
    expect(h.temps).toEqual([]);
    expect(h.targets).toEqual([{ t0: 60 * S, t1: 120 * S, v: 75 }]);
  });
});

describe("runTime", () => {
  it("adds up cooling and heating separately, clipped to the window", () => {
    const runs = [
      { t0: 0, t1: 100, kind: "cool" as const },
      { t0: 150, t1: 200, kind: "heat" as const },
      { t0: 250, t1: 400, kind: "cool" as const },
    ];
    expect(runTime(runs, 50, 300)).toEqual({ cool: 100, heat: 50 });
  });
});

describe("runHint", () => {
  const MIN = 60_000;
  it("says how long it ran", () => {
    expect(runHint({ cool: 200 * MIN, heat: 0 })).toBe("Cooled 3 h 20 min");
    expect(runHint({ cool: 0, heat: 45 * MIN })).toBe("Heated 45 min");
    expect(runHint({ cool: 120 * MIN, heat: 60 * MIN })).toBe("Cooled 2 h · heated 1 h");
  });

  it("says when it didn't run, and rounds a short run up to a minute", () => {
    expect(runHint({ cool: 0, heat: 0 })).toBe("Didn't run");
    expect(runHint({ cool: 20_000, heat: 0 })).toBe("Cooled 1 min");
  });
});
