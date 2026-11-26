export interface LightRef {
  entity: string;
  name: string;
  /** The icon of the area the light is in. */
  icon: string;
}

export interface LightOn extends LightRef {
  dimmable: boolean;
  /** Brightness 1-100, for dimmers. */
  pct?: number;
}

type States = Record<string, { state: string; attributes: Record<string, any> } | undefined>;

const isDimmer = (attrs: Record<string, any>) =>
  ((attrs.supported_color_modes as string[] | undefined) ?? []).some((m) => m !== "onoff");

/** The lights that are on, in the configured order, with brightness for dimmers. */
export function lightsOn(lights: LightRef[], states: States): LightOn[] {
  return lights
    .filter((l) => states[l.entity]?.state === "on")
    .map((l) => {
      const attrs = states[l.entity]!.attributes ?? {};
      if (!isDimmer(attrs)) return { ...l, dimmable: false };
      const b = attrs.brightness;
      return { ...l, dimmable: true, pct: typeof b === "number" ? Math.max(1, Math.round(b / 2.55)) : 100 };
    });
}

/** Favourites to offer as "turn on" buttons: in the light list, off, and reachable. */
export function favouritesOff(favourites: string[], lights: LightRef[], states: States): LightRef[] {
  return favourites
    .map((id) => lights.find((l) => l.entity === id))
    .filter((l): l is LightRef => !!l && states[l.entity]?.state === "off");
}

export function lightsHeadline(on: number): string {
  if (!on) return "All lights off";
  return `${on} light${on === 1 ? "" : "s"} on`;
}
