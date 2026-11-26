export interface CircuitRow {
  name: string;
  watts: number;
  share: number;
  kind: "circuit" | "other" | "unmeasured";
}

/** Watts as people read them: "508 W", "2,349 W", then kW from 10 kW up. */
export function formatPower(w: number, lang = "en-US"): string {
  if (w >= 10_000) return `${(w / 1000).toLocaleString(lang, { maximumFractionDigits: 1 })} kW`;
  return `${Math.round(w).toLocaleString(lang)} W`;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Circuits by what they draw now, each with its share of the whole house. Past `topN` they fold
 * into one row; what the main clamps see but no circuit clamp does ("Rest of the house") comes last.
 */
export function rankCircuits(total: number, circuits: { name: string; watts?: number }[], topN = 6): CircuitRow[] {
  const share = (w: number) => (total > 0 ? round3(w / total) : 0);
  const measured = circuits
    .filter((c): c is { name: string; watts: number } => typeof c.watts === "number" && Number.isFinite(c.watts))
    .sort((a, b) => b.watts - a.watts);
  const rows: CircuitRow[] = measured.slice(0, topN).map((c) => ({ name: c.name, watts: c.watts, share: share(c.watts), kind: "circuit" }));
  const rest = measured.slice(topN);
  if (rest.length) {
    const w = rest.reduce((s, c) => s + c.watts, 0);
    rows.push({ name: `${rest.length} more circuit${rest.length === 1 ? "" : "s"}`, watts: w, share: share(w), kind: "other" });
  }
  const unmeasured = total - measured.reduce((s, c) => s + c.watts, 0);
  if (unmeasured > 0) rows.push({ name: "Rest of the house", watts: unmeasured, share: share(unmeasured), kind: "unmeasured" });
  return rows;
}
