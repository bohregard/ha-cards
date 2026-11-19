import { describe, expect, it } from "vitest";
import { cleanCall, findSibling, stateTone } from "../src/lib/vacuum";

const entities = {
  "vacuum.robot": { entity_id: "vacuum.robot", device_id: "dev1" },
  "select.robot_suction_level": { entity_id: "select.robot_suction_level", device_id: "dev1", translation_key: "suction_level" },
  "select.robot_room_1_suction_level": { entity_id: "select.robot_room_1_suction_level", device_id: "dev1", translation_key: "suction_level" },
  "select.other_suction_level": { entity_id: "select.other_suction_level", device_id: "dev2", translation_key: "suction_level" },
  "camera.robot_map": { entity_id: "camera.robot_map", device_id: "dev1", translation_key: "map" },
};

describe("findSibling", () => {
  it("finds the device-wide entity, not a per-room one", () => {
    expect(findSibling(entities, "vacuum.robot", "select", "suction_level")).toBe("select.robot_suction_level");
  });

  it("ignores entities on other devices", () => {
    expect(findSibling(entities, "vacuum.robot", "sensor", "suction_level")).toBeUndefined();
  });

  it("returns undefined when the vacuum has no device", () => {
    expect(findSibling({}, "vacuum.robot", "camera", "map")).toBeUndefined();
  });
});

describe("cleanCall", () => {
  it("cleans the selected rooms by segment id", () => {
    expect(cleanCall("vacuum.robot", [3, 1])).toEqual({
      domain: "dreame_vacuum",
      service: "vacuum_clean_segment",
      data: { entity_id: "vacuum.robot", segments: [3, 1] },
    });
  });

  it("starts a full clean when no rooms are selected", () => {
    expect(cleanCall("vacuum.robot", [])).toEqual({
      domain: "vacuum",
      service: "start",
      data: { entity_id: "vacuum.robot" },
    });
  });
});

describe("stateTone", () => {
  it.each([
    ["cleaning", {}, "active"],
    ["returning", {}, "active"],
    ["docked", {}, "ok"],
    ["error", {}, "error"],
    ["docked", { has_error: true }, "error"],
    ["paused", {}, "idle"],
    ["unavailable", {}, "idle"],
  ])("%s %o is %s", (state, attrs, tone) => {
    expect(stateTone(state, attrs)).toBe(tone);
  });
});
