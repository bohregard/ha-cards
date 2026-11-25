import { describe, expect, it } from "vitest";
import { findOnDevice } from "../src/lib/entities";

const e = (entity_id: string, device_id?: string, translation_key?: string) => ({ entity_id, device_id, translation_key });
const entities = Object.fromEntries(
  [
    // ESPHome fountain: no translation keys
    e("sensor.cat_fountain_water_weight", "fountain"),
    e("switch.cat_fountain_pump", "fountain"),
    e("switch.cat_fountain_pump_boost", "fountain"),
    e("binary_sensor.cat_fountain_water_low", "fountain"),
    e("number.cat_fountain_water_low_threshold", "fountain"),
    // another device with the same object ids
    e("switch.other_fountain_pump", "other"),
    // Litter-Robot: translation keys, entity ids that don't follow them
    e("vacuum.litter_robot_litter_box", "lr4", "litter_box"),
    e("sensor.litter_robot_waste_drawer", "lr4", "waste_drawer"),
    e("binary_sensor.hallway_litter_robot_laser_dirty", "lr4", "laser_dirty"),
  ].map((x) => [x.entity_id, x]),
);

describe("findOnDevice", () => {
  it("matches by translation key when the integration provides one", () => {
    expect(findOnDevice(entities, "vacuum.litter_robot_litter_box", "binary_sensor", "laser_dirty")).toBe(
      "binary_sensor.hallway_litter_robot_laser_dirty",
    );
  });

  it("falls back to the entity-id suffix for ESPHome entities", () => {
    expect(findOnDevice(entities, "sensor.cat_fountain_water_weight", "binary_sensor", "water_low")).toBe(
      "binary_sensor.cat_fountain_water_low",
    );
  });

  it("matches the whole suffix, not a longer object id that starts the same", () => {
    expect(findOnDevice(entities, "sensor.cat_fountain_water_weight", "switch", "pump")).toBe("switch.cat_fountain_pump");
  });

  it("only matches a suffix that starts at a word boundary (after an underscore)", () => {
    expect(findOnDevice(entities, "sensor.cat_fountain_water_weight", "switch", "boost")).toBe(
      "switch.cat_fountain_pump_boost",
    );
    expect(findOnDevice(entities, "sensor.cat_fountain_water_weight", "switch", "ump")).toBeUndefined();
  });

  it("only looks at the anchor's device", () => {
    expect(findOnDevice(entities, "switch.other_fountain_pump", "binary_sensor", "water_low")).toBeUndefined();
  });

  it("returns undefined when the anchor has no device", () => {
    expect(findOnDevice({}, "sensor.nothing", "switch", "pump")).toBeUndefined();
  });
});
