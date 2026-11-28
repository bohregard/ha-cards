import { describe, expect, it } from "vitest";
import {
  headline,
  lgCycle,
  machineStatus,
  minutesText,
  parseDuration,
  runTimes,
  type MachineInput,
} from "../src/lib/laundry";

const MIN = 60_000;
const NOW = Date.parse("2026-11-28T15:00:00-05:00");
const at = (minAgo: number) => NOW - minAgo * MIN;
const iso = (t: number) => new Date(t).toISOString();

function lg(state: string, attrs: Record<string, unknown> = {}, updated = NOW) {
  return {
    entity_id: "sensor.washer",
    state,
    last_updated: iso(updated),
    attributes: { run_state: "-", current_course: "-", remain_time: "0:00:00", initial_time: "0:00:00",
      error_state: "off", error_message: "-", ...attrs },
  };
}

function machine(over: Partial<MachineInput>): MachineInput {
  return { name: "Washer", running: false, times: {}, now: NOW, doneMs: 4 * 60 * MIN, ...over };
}

describe("runTimes", () => {
  it("times the current run from its start, skipping restart blips", () => {
    const rows = [{ t: at(300), s: "off" }, { t: at(42), s: "on" }, { t: at(20), s: "unavailable" }, { t: at(20), s: "on" }];
    expect(runTimes(rows)).toEqual({ since: at(42), finished: undefined });
  });

  it("finds when the last run finished", () => {
    const rows = [{ t: at(300), s: "off" }, { t: at(200), s: "on" }, { t: at(150), s: "off" },
      { t: at(90), s: "on" }, { t: at(30), s: "unknown" }, { t: at(30), s: "on" }, { t: at(12), s: "off" }];
    expect(runTimes(rows)).toEqual({ since: undefined, finished: at(12) });
  });

  it("knows nothing without history", () => {
    expect(runTimes([])).toEqual({ since: undefined, finished: undefined });
  });

  it("goes by the live state when history hasn't caught up", () => {
    const old = [{ t: at(300), s: "off" }];
    expect(runTimes(old, { t: at(2), s: "on" })).toEqual({ since: at(2), finished: undefined });
    const running = [{ t: at(300), s: "off" }, { t: at(50), s: "on" }];
    expect(runTimes(running, { t: at(1), s: "off" })).toEqual({ since: undefined, finished: at(1) });
    // after a restart the live state's last_changed is new, but the state is the same: no new run
    expect(runTimes(running, { t: at(3), s: "on" })).toEqual({ since: at(50), finished: undefined });
  });
});

describe("parseDuration and minutesText", () => {
  it("reads LG's H:MM:SS", () => {
    expect([parseDuration("0:23:00"), parseDuration("1:05:30"), parseDuration("-"), parseDuration(undefined)]).toEqual(
      [23, 65, undefined, undefined]);
  });

  it("says minutes, then hours and minutes", () => {
    expect([minutesText(42), minutesText(60), minutesText(65), minutesText(0)]).toEqual(["42 min", "1 h", "1 h 5 min", "0 min"]);
  });
});

describe("lgCycle", () => {
  it("reads a real cycle", () => {
    const c = lgCycle(lg("on", { run_state: "Rinsing", current_course: "Normal", remain_time: "0:23:00", initial_time: "1:05:00" }));
    expect(c).toMatchObject({ course: "Normal", phase: "Rinsing", left: 23 });
    expect(c!.progress).toBeCloseTo(42 / 65);
  });

  it("has nothing when LG is off or has no cycle", () => {
    expect(lgCycle(lg("off", { run_state: "Rinsing" }))).toBeUndefined();
    expect(lgCycle(lg("on"))).toBeUndefined();
    expect(lgCycle(undefined)).toBeUndefined();
  });
});

describe("machineStatus", () => {
  it("runs on power alone, saying LG has no details", () => {
    expect(machineStatus(machine({ running: true, times: { since: at(42) }, watts: 1053.4, appliance: lg("off") }))).toMatchObject({
      state: "running", tone: "active", line: "Running · 42 min", elapsed: "42 min", power: 1053, noDetails: true,
    });
  });

  it("adds LG's cycle, time left and progress", () => {
    const s = machineStatus(machine({ running: true, times: { since: at(42) },
      appliance: lg("on", { run_state: "Rinsing", current_course: "Normal", remain_time: "0:23:00", initial_time: "1:05:00" }) }));
    expect(s).toMatchObject({ detail: "Normal · Rinsing", left: 23, noDetails: false });
    expect(s.progress).toBeCloseTo(42 / 65);
  });

  it("doesn't miss LG when there's no appliance to read", () => {
    expect(machineStatus(machine({ running: true })).noDetails).toBe(false);
    expect(machineStatus(machine({ running: true })).line).toBe("Running");
  });

  it("is done for 4 hours, then idle", () => {
    expect(machineStatus(machine({ times: { finished: at(12) } }))).toMatchObject({ state: "done", tone: "ok", line: "Done 12 min ago" });
    expect(machineStatus(machine({ times: { finished: at(241) } }))).toMatchObject({ state: "idle", line: "Idle" });
    expect(machineStatus(machine({}))).toMatchObject({ state: "idle", tone: "idle", line: "Idle" });
  });

  it("waits to be unloaded while LG, updated since it finished, says the door is shut", () => {
    const shut = lg("off", { door_open: "off" }, at(5));
    expect(machineStatus(machine({ times: { finished: at(12) }, appliance: shut }))).toMatchObject({
      state: "unload", tone: "warn", line: "Waiting to be unloaded", detail: "Done 12 min ago",
    });
    const opened = lg("off", { door_open: "on" }, at(5));
    expect(machineStatus(machine({ times: { finished: at(12) }, appliance: opened })).state).toBe("idle");
    const stale = lg("off", { door_open: "off" }, at(60));
    expect(machineStatus(machine({ times: { finished: at(12) }, appliance: stale })).state).toBe("done");
  });

  it("shows LG's error first", () => {
    expect(machineStatus(machine({ running: true, appliance: lg("on", { error_state: "on", error_message: "UE" }) })))
      .toMatchObject({ state: "error", tone: "error", line: "Error · UE" });
  });
});

describe("headline", () => {
  const s = (name: string, over: Partial<MachineInput>) => ({ name, status: machineStatus(machine({ name, ...over })) });

  it("puts an error, then an unload, then a run, then done", () => {
    const running = s("Washer", { running: true, times: { since: at(42) } });
    const unload = s("Dryer", { times: { finished: at(12) }, appliance: lg("off", { door_open: "off" }, at(5)) });
    const error = s("Dryer", { appliance: lg("off", { error_state: "on", error_message: "Filter" }) });
    const done = s("Dryer", { times: { finished: at(12) } });
    expect(headline([running, error])).toEqual({ tone: "error", text: "Dryer error · Filter" });
    expect(headline([running, unload])).toEqual({ tone: "warn", text: "Dryer done · waiting to be unloaded" });
    expect(headline([running, done])).toEqual({ tone: "active", text: "Washer running · 42 min" });
    expect(headline([s("Washer", {}), done])).toEqual({ tone: "ok", text: "Dryer done 12 min ago" });
  });

  it("says the time left when LG has it", () => {
    const lgRun = s("Washer", { running: true, times: { since: at(42) },
      appliance: lg("on", { run_state: "Washing", remain_time: "0:23:00", initial_time: "1:05:00" }) });
    expect(headline([lgRun]).text).toBe("Washer · 23 min left");
  });

  it("says when everything is idle", () => {
    expect(headline([s("Washer", {}), s("Dryer", {})])).toEqual({ tone: "idle", text: "Both idle" });
    expect(headline([s("Washer", {})]).text).toBe("Idle");
  });
});
