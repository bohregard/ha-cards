import { describe, expect, it } from "vitest";
import { ago, plural, when } from "../src/lib/format";

const now = new Date(2026, 10, 24, 18, 0).getTime();
const min = 60_000;

describe("ago", () => {
  it.each([
    [20_000, "just now"],
    [12 * min, "12 min ago"],
    [90 * min, "1 h ago"],
    [23 * 60 * min, "23 h ago"],
    [25 * 60 * min, "1 day ago"],
    [3 * 24 * 60 * min, "3 days ago"],
  ])("%s ms ago reads %s", (delta, want) => {
    expect(ago(now - delta, now)).toBe(want);
  });
});

describe("when", () => {
  const at = (day: number, h: number) => new Date(2026, 10, day, h, 0).getTime();
  it.each([
    ["today", at(24, 17), "5:00 PM"],
    ["yesterday", at(23, 9), "Yesterday 9:00 AM"],
    ["tomorrow", at(25, 9), "Tomorrow 9:00 AM"],
    ["earlier this week", at(21, 9), "Sat 9:00 AM"],
  ])("%s", (_, t, want) => {
    expect(when(t, now, "en-US")).toBe(want);
  });
});

describe("plural", () => {
  it.each([
    [1, "1 scoop"],
    [0, "0 scoops"],
    [2, "2 scoops"],
  ])("%s", (n, want) => {
    expect(plural(n, "scoop")).toBe(want);
  });
});
