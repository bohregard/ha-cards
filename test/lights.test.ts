import { describe, expect, it } from "vitest";
import { favouritesOff, lightsHeadline, lightsOn } from "../src/lib/lights";

const st = (state: string, attributes: Record<string, unknown> = {}) => ({ state, attributes });
const lights = [
  { entity: "light.sofa", name: "Sofa", icon: "mdi:sofa" },
  { entity: "light.desk", name: "Desk", icon: "mdi:desk" },
  { entity: "switch.shelf", name: "Shelf", icon: "mdi:sofa" },
  { entity: "light.porch", name: "Porch", icon: "mdi:door" },
];

describe("lightsOn", () => {
  it("lists the lights that are on, in config order, with brightness for dimmers", () => {
    const states = {
      "light.sofa": st("on", { supported_color_modes: ["brightness"], brightness: 153 }),
      "light.desk": st("off", { supported_color_modes: ["brightness"] }),
      "switch.shelf": st("on"),
      "light.porch": st("on", { supported_color_modes: ["onoff"] }),
    };
    expect(lightsOn(lights, states)).toEqual([
      { entity: "light.sofa", name: "Sofa", icon: "mdi:sofa", dimmable: true, pct: 60 },
      { entity: "switch.shelf", name: "Shelf", icon: "mdi:sofa", dimmable: false },
      { entity: "light.porch", name: "Porch", icon: "mdi:door", dimmable: false },
    ]);
  });

  it("treats a dimmer with no brightness reported as full", () => {
    const states = { "light.sofa": st("on", { supported_color_modes: ["color_temp"] }) };
    expect(lightsOn(lights, states)).toEqual([{ entity: "light.sofa", name: "Sofa", icon: "mdi:sofa", dimmable: true, pct: 100 }]);
  });

  it("skips lights it has no state for", () => {
    expect(lightsOn(lights, {})).toEqual([]);
  });
});

describe("favouritesOff", () => {
  it("offers favourites that are off, leaving out ones that are on or offline", () => {
    const states = { "light.sofa": st("off"), "light.desk": st("on"), "light.porch": st("unavailable") };
    expect(favouritesOff(["light.sofa", "light.desk", "light.porch"], lights, states)).toEqual([
      { entity: "light.sofa", name: "Sofa", icon: "mdi:sofa" },
    ]);
  });

  it("ignores favourites that aren't in the light list", () => {
    expect(favouritesOff(["light.attic"], lights, { "light.attic": st("off") })).toEqual([]);
  });
});

describe("lightsHeadline", () => {
  it.each([
    [0, "All lights off"],
    [1, "1 light on"],
    [11, "11 lights on"],
  ])("%s on reads %s", (n, want) => {
    expect(lightsHeadline(n)).toBe(want);
  });
});
