import { describe, expect, it } from "vitest";
import { barRects, linePath, stackedRects, stepPath } from "../src/lib/chart";

describe("linePath", () => {
  it("maps time to x and value to y (y grows downwards)", () => {
    const pts = [
      { t: 0, v: 0 },
      { t: 5, v: 10 },
      { t: 10, v: 5 },
    ];
    expect(linePath(pts, { w: 100, h: 50, t0: 0, t1: 10, v0: 0, v1: 10 })).toBe("M0,50L50,0L100,25");
  });

  it("is empty with fewer than two points", () => {
    expect(linePath([{ t: 0, v: 1 }], { w: 100, h: 50, t0: 0, t1: 10, v0: 0, v1: 10 })).toBe("");
  });

  it("draws a flat series in the middle instead of dividing by zero", () => {
    const pts = [
      { t: 0, v: 7 },
      { t: 10, v: 7 },
    ];
    expect(linePath(pts, { w: 100, h: 50, t0: 0, t1: 10, v0: 7, v1: 7 })).toBe("M0,25L100,25");
  });
});

describe("barRects", () => {
  it("scales bars to the largest value with a gap between them", () => {
    expect(barRects([1, 2], { w: 100, h: 40, gap: 10 })).toEqual([
      { x: 0, y: 20, w: 45, h: 20 },
      { x: 55, y: 0, w: 45, h: 40 },
    ]);
  });

  it("gives all-zero data zero-height bars", () => {
    expect(barRects([0, 0], { w: 100, h: 40, gap: 10 }).map((r) => r.h)).toEqual([0, 0]);
  });
});

describe("stackedRects", () => {
  it("stacks each day's series bottom-up, scaled to the tallest day", () => {
    // two series over two days: day 0 = 1 + 1, day 1 = 0 + 4 (tallest)
    const rects = stackedRects(
      [
        [1, 0],
        [1, 4],
      ],
      { w: 100, h: 40, gap: 10 },
    );
    expect(rects).toEqual([
      [
        { x: 0, y: 30, w: 45, h: 10 },
        { x: 55, y: 40, w: 45, h: 0 },
      ],
      [
        { x: 0, y: 20, w: 45, h: 10 },
        { x: 55, y: 0, w: 45, h: 40 },
      ],
    ]);
  });
});

describe("stepPath", () => {
  const box = { w: 100, h: 50, t0: 0, t1: 10, v0: 0, v1: 10 };

  it("holds each value flat and steps between touching segments", () => {
    const segs = [
      { t0: 0, t1: 5, v: 10 },
      { t0: 5, t1: 10, v: 0 },
    ];
    expect(stepPath(segs, box)).toBe("M0,0L50,0L50,50L100,50");
  });

  it("lifts the pen over a gap", () => {
    const segs = [
      { t0: 0, t1: 2, v: 5 },
      { t0: 6, t1: 10, v: 5 },
    ];
    expect(stepPath(segs, box)).toBe("M0,25L20,25M60,25L100,25");
  });

  it("clips segments to the window and drops ones outside it", () => {
    const segs = [
      { t0: -5, t1: -1, v: 5 },
      { t0: -5, t1: 15, v: 5 },
    ];
    expect(stepPath(segs, box)).toBe("M0,25L100,25");
  });

  it("is empty with nothing to draw", () => {
    expect(stepPath([], box)).toBe("");
  });
});
