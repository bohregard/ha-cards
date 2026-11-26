import { describe, expect, it } from "vitest";
import { alarmView, contactsLine, coverView, lockView, securityVerdict } from "../src/lib/security";

describe("lockView", () => {
  it("offers Unlock behind a second tap when locked", () => {
    expect(lockView("locked")).toEqual({ tone: "ok", label: "Locked", action: { service: "lock.unlock", label: "Unlock", confirm: true } });
  });

  it("offers Lock in one tap when unlocked, and calls it a problem", () => {
    expect(lockView("unlocked")).toEqual({
      tone: "error", label: "Unlocked", problem: "unlocked", action: { service: "lock.lock", label: "Lock", confirm: false },
    });
  });

  it("offers Lock again when jammed or open", () => {
    expect(lockView("jammed")).toMatchObject({ tone: "error", label: "Jammed", problem: "jammed", action: { service: "lock.lock" } });
    expect(lockView("open")).toMatchObject({ tone: "error", label: "Open", problem: "open", action: { service: "lock.lock" } });
  });

  it("offers nothing while it moves", () => {
    expect(lockView("locking")).toEqual({ tone: "active", label: "Locking…" });
    expect(lockView("unlocking")).toEqual({ tone: "active", label: "Unlocking…" });
  });

  it("is a problem with nothing to press when it isn't reporting", () => {
    expect(lockView("unavailable")).toEqual({ tone: "error", label: "Offline", problem: "offline" });
    expect(lockView("unknown")).toEqual({ tone: "error", label: "No reading", problem: "offline" });
  });
});

describe("coverView", () => {
  it("offers Open behind a second tap when closed", () => {
    expect(coverView("closed")).toEqual({ tone: "ok", label: "Closed", action: { service: "cover.open_cover", label: "Open", confirm: true } });
  });

  it("offers Close in one tap when open", () => {
    expect(coverView("open")).toEqual({
      tone: "error", label: "Open", problem: "open", action: { service: "cover.close_cover", label: "Close", confirm: false },
    });
  });

  it("offers nothing while it moves", () => {
    expect(coverView("opening")).toEqual({ tone: "active", label: "Opening…" });
    expect(coverView("closing")).toEqual({ tone: "active", label: "Closing…" });
  });

  it("falls back to a door sensor when offline", () => {
    expect(coverView("unavailable", { name: "exterior door", open: false })).toEqual({
      tone: "error", label: "Offline · exterior door closed", problem: "offline",
    });
    expect(coverView("unavailable", { name: "exterior door", open: true }).label).toBe("Offline · exterior door open");
    expect(coverView("unavailable")).toEqual({ tone: "error", label: "Offline", problem: "offline" });
  });
});

describe("alarmView", () => {
  it("offers Arm home in one tap and Arm away behind a second when disarmed", () => {
    expect(alarmView("disarmed")).toEqual({
      tone: "idle",
      label: "Disarmed",
      actions: [
        { service: "alarm_control_panel.alarm_arm_home", label: "Arm home", confirm: false },
        { service: "alarm_control_panel.alarm_arm_away", label: "Arm away", confirm: true },
      ],
    });
  });

  it.each([
    ["armed_home", "Armed home"],
    ["armed_away", "Armed away"],
    ["armed_night", "Armed night"],
  ])("%s reads %s and offers Disarm behind a second tap", (state, label) => {
    expect(alarmView(state)).toEqual({
      tone: "ok", label, actions: [{ service: "alarm_control_panel.alarm_disarm", label: "Disarm", confirm: true }],
    });
  });

  it("can be disarmed while arming", () => {
    expect(alarmView("arming")).toMatchObject({ tone: "active", label: "Arming…", actions: [{ label: "Disarm" }] });
  });

  it("is a problem when triggered or counting down to it", () => {
    expect(alarmView("triggered")).toMatchObject({ tone: "error", label: "Triggered", problem: "triggered", actions: [{ label: "Disarm" }] });
    expect(alarmView("pending")).toMatchObject({ tone: "error", label: "Entry delay", problem: "counting down", actions: [{ label: "Disarm" }] });
  });

  it("offers nothing when offline", () => {
    expect(alarmView("unavailable")).toEqual({ tone: "error", label: "Offline", problem: "offline", actions: [] });
  });
});

describe("contactsLine", () => {
  it("says they are all closed", () => {
    expect(contactsLine([], 16)).toEqual({ tone: "ok", text: "All 16 doors and windows closed" });
  });

  it("names up to two open ones, then counts the rest", () => {
    expect(contactsLine(["Patio door"], 16)).toEqual({ tone: "error", text: "Patio door open" });
    expect(contactsLine(["Patio door", "Kitchen window 2"], 16).text).toBe("Patio door and Kitchen window 2 open");
    expect(contactsLine(["Patio door", "Kitchen window 2", "Bath window", "Office window"], 16).text).toBe(
      "Patio door, Kitchen window 2 and 2 more open",
    );
  });
});

describe("securityVerdict", () => {
  it("is all secure with no problems", () => {
    expect(securityVerdict([{ name: "Front door" }, { name: "Alarm" }], [])).toEqual({ tone: "ok", text: "All secure", problems: [] });
  });

  it("puts the alarm first, then locks, then open covers and offline devices, then doors and windows", () => {
    const v = securityVerdict(
      [
        { name: "Garage door", problem: "offline" },
        { name: "Garage door 2", problem: "open" },
        { name: "Garage lock", problem: "unlocked" },
        { name: "Alarm", problem: "triggered" },
      ],
      ["Patio door"],
    );
    expect(v.problems).toEqual(["Alarm triggered", "Garage lock unlocked", "Garage door 2 open", "Garage door offline", "Patio door open"]);
    expect(v).toMatchObject({ tone: "error", text: "Alarm triggered +4" });
  });

  it("counts several open doors and windows as one problem", () => {
    expect(securityVerdict([], ["A", "B", "C"]).problems).toEqual(["3 doors or windows open"]);
  });
});
