import { describe, expect, it } from "vitest";
import { formatPower, rankCircuits } from "../src/lib/energy";

describe("formatPower", () => {
  it.each([
    [0.8, "1 W"],
    [508.4, "508 W"],
    [2348.5, "2,349 W"],
    [12_400, "12.4 kW"],
  ])("%s W reads %s", (w, want) => {
    expect(formatPower(w)).toBe(want);
  });
});

describe("rankCircuits", () => {
  const circuits = [
    { name: "Server", watts: 424 },
    { name: "Living room", watts: 508 },
    { name: "Dryer", watts: 3 },
    { name: "Offline", watts: undefined },
  ];

  it("ranks measured circuits by watts with their share of the total, then what no clamp sees", () => {
    expect(rankCircuits(1000, circuits)).toEqual([
      { name: "Living room", watts: 508, share: 0.508, kind: "circuit" },
      { name: "Server", watts: 424, share: 0.424, kind: "circuit" },
      { name: "Dryer", watts: 3, share: 0.003, kind: "circuit" },
      { name: "Rest of the house", watts: 65, share: 0.065, kind: "unmeasured" },
    ]);
  });

  it("folds circuits past the top N into one row", () => {
    const rows = rankCircuits(1000, circuits, 1);
    expect(rows.map((r) => [r.name, r.watts, r.kind])).toEqual([
      ["Living room", 508, "circuit"],
      ["2 more circuits", 427, "other"],
      ["Rest of the house", 65, "unmeasured"],
    ]);
  });

  it("leaves out the unmeasured row when the circuits add up to the total or more", () => {
    expect(rankCircuits(900, circuits).some((r) => r.kind === "unmeasured")).toBe(false);
  });

  it("gives every share as 0 when the total is 0", () => {
    expect(rankCircuits(0, [{ name: "A", watts: 0 }])).toEqual([{ name: "A", watts: 0, share: 0, kind: "circuit" }]);
  });
});
