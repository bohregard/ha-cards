import { describe, expect, it } from "vitest";
import { detections } from "../src/lib/frigate";

const states = (on: string[]) =>
  Object.fromEntries(
    ["porch_person", "porch_cat", "porch_dog", "yard_person", "yard_cat", "yard_dog"].map((k) => {
      const id = `binary_sensor.${k}_occupancy`;
      return [id, { state: on.includes(k) ? "on" : "off" }];
    }),
  );

describe("detections", () => {
  it("is empty when nothing is detected", () => {
    expect(detections(states([]), ["porch", "yard"])).toEqual([]);
  });

  it("lists what any of the room's cameras sees right now, once each, person first", () => {
    expect(detections(states(["yard_cat", "porch_cat", "yard_person"]), ["porch", "yard"])).toEqual(["person", "cat"]);
  });

  it("ignores cameras that are not in the room", () => {
    expect(detections(states(["yard_dog"]), ["porch"])).toEqual([]);
  });

  it("treats a missing or unavailable sensor as nothing detected", () => {
    expect(detections({ "binary_sensor.porch_person_occupancy": { state: "unavailable" } }, ["porch", "attic"])).toEqual([]);
  });
});
