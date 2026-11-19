import { describe, expect, it } from "vitest";
import fixture from "./fixtures/map.json";
import { mapToVacuum, roomAt, vacuumToMap } from "../src/lib/map";

const cal = fixture.calibration_points;

describe("vacuumToMap", () => {
  it("maps the calibration points onto their map pixels", () => {
    for (const p of cal) {
      expect(vacuumToMap(cal, p.vacuum)).toEqual(p.map);
    }
  });
});

describe("mapToVacuum", () => {
  it("inverts vacuumToMap", () => {
    const v = { x: -4000, y: 3500 };
    const back = mapToVacuum(cal, vacuumToMap(cal, v));
    expect(back.x).toBeCloseTo(v.x, 6);
    expect(back.y).toBeCloseTo(v.y, 6);
  });
});

describe("roomAt", () => {
  it("finds the room whose centre was tapped", () => {
    const study = fixture.rooms["1"];
    const tap = vacuumToMap(cal, { x: study.x, y: study.y });
    expect(roomAt(fixture.rooms, cal, tap)?.room_id).toBe(1);
  });

  it("returns undefined outside every room", () => {
    expect(roomAt(fixture.rooms, cal, { x: -10000, y: -10000 })).toBeUndefined();
  });

  it("prefers the smallest room when boxes overlap", () => {
    // A point inside both boxes should resolve to the smaller one.
    const rooms = {
      big: { room_id: 1, x0: 0, y0: 0, x1: 1000, y1: 1000 },
      small: { room_id: 2, x0: 400, y0: 400, x1: 600, y1: 600 },
    };
    const tap = vacuumToMap(cal, { x: 500, y: 500 });
    expect(roomAt(rooms, cal, tap)?.room_id).toBe(2);
  });
});
