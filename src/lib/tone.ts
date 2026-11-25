/** Lamplight colour role for a pet device: sage ok, amber warn, ember error, teal active (moving water). */
export type PetTone = "ok" | "warn" | "error" | "active" | "idle";

export interface Status {
  label: string;
  tone: PetTone;
}
