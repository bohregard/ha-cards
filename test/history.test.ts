import { describe, expect, it } from "vitest";
import { countPerDay, fetchStatistics, onTimes, parseHistory, parseStatistics, sumPerDay } from "../src/lib/history";

describe("parseHistory", () => {
  it("reads compressed rows, preferring last_changed over last_updated", () => {
    const resp = {
      "sensor.a": [
        { s: "1", lu: 1700000010.5, lc: 1700000000 },
        { s: "2", lu: 1700000100.25 },
      ],
    };
    expect(parseHistory(resp, "sensor.a")).toEqual([
      { t: 1700000000000, s: "1" },
      { t: 1700000100250, s: "2" },
    ]);
  });

  it("returns an empty list for an entity with no rows", () => {
    expect(parseHistory({}, "sensor.a")).toEqual([]);
  });
});

describe("parseStatistics", () => {
  it("keeps rows with a numeric mean", () => {
    const resp = {
      "sensor.w": [
        { start: 1700000000000, end: 1700000300000, mean: 1449.5 },
        { start: 1700000300000, end: 1700000600000, mean: null },
        { start: 1700000600000, end: 1700000900000, mean: 1440 },
      ],
    };
    expect(parseStatistics(resp, "sensor.w")).toEqual([
      { t: 1700000000000, v: 1449.5 },
      { t: 1700000600000, v: 1440 },
    ]);
  });
});

describe("onTimes", () => {
  it("returns the times a binary sensor turned on", () => {
    const rows = [
      { t: 1, s: "off" },
      { t: 2, s: "on" },
      { t: 3, s: "on" },
      { t: 4, s: "off" },
      { t: 5, s: "unavailable" },
      { t: 6, s: "on" },
    ];
    expect(onTimes(rows)).toEqual([2, 6]);
  });

  it("does not count a sensor that was already on when the window began", () => {
    expect(onTimes([{ t: 1, s: "on" }, { t: 2, s: "off" }, { t: 3, s: "on" }])).toEqual([3]);
  });
});

// Local-time fixtures so the day buckets don't depend on the machine's time zone.
const now = new Date(2026, 10, 24, 18, 0).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime();

describe("countPerDay", () => {
  it("buckets times into local days, oldest first, ending today", () => {
    const times = [at(24, 9), at(24, 17), at(23, 23, 59), at(22, 0, 0), at(20, 12)];
    expect(countPerDay(times, now, 3)).toEqual([1, 1, 2]);
  });
});

describe("sumPerDay", () => {
  it("adds values per local day and ignores items outside the window", () => {
    const items = [
      { t: at(24, 9), v: 2 },
      { t: at(24, 12), v: 1 },
      { t: at(23, 9), v: 2 },
      { t: at(21, 9), v: 9 },
    ];
    expect(sumPerDay(items, now, 2)).toEqual([2, 3]);
  });
});

describe("parseStatistics with a field", () => {
  it("reads another statistic field, such as max for a running total", () => {
    const resp = { "sensor.rain": [{ start: 1, mean: null, max: 0.2 }, { start: 2, max: 0.3 }, { start: 3 }] };
    expect(parseStatistics(resp, "sensor.rain", "max")).toEqual([
      { t: 1, v: 0.2 },
      { t: 2, v: 0.3 },
    ]);
  });
});

describe("fetchStatistics with a field", () => {
  it("asks for that statistic type and reads it back", async () => {
    let sent: Record<string, unknown> = {};
    const hass = {
      callWS: async <T>(msg: Record<string, unknown>) => {
        sent = msg;
        return { "sensor.rain": [{ start: 5, max: 0.4 }] } as T;
      },
    };
    const out = await fetchStatistics(hass, ["sensor.rain"], 0, 10, "hour", "max");
    expect(sent.types).toEqual(["max"]);
    expect(out["sensor.rain"]).toEqual([{ t: 5, v: 0.4 }]);
  });
});

describe("parseStatistics for a running total", () => {
  it("reads the state at the end of each period, which is all HA keeps for total sensors", () => {
    const resp = { "sensor.rain": [{ start: 1, state: 0.1 }, { start: 2, state: 0.3 }, { start: 3 }] };
    expect(parseStatistics(resp, "sensor.rain", "state")).toEqual([
      { t: 1, v: 0.1 },
      { t: 2, v: 0.3 },
    ]);
  });
});
