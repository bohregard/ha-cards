const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function ago(t: number, now: number): string {
  const d = now - t;
  if (d < MIN) return "just now";
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)} h ago`;
  const days = Math.floor(d / DAY);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** A time, with "Yesterday"/"Tomorrow" or a short weekday when it isn't today. */
export function when(t: number, now: number, lang?: string): string {
  const d = new Date(t);
  const time = d.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });
  const n = new Date(now);
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) /
      DAY,
  );
  if (dayDiff === 0) return time;
  if (dayDiff === -1) return `Yesterday ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString(lang, { weekday: "short" })} ${time}`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
