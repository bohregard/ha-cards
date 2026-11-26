/**
 * What a security card shows and offers for each device. The safe direction (lock, close, arm
 * home, stop) is one tap; the unsafe one (unlock, open, arm away, disarm) asks for a second tap.
 */

export type SecurityTone = "ok" | "error" | "active" | "idle";

export interface SecurityAction {
  /** `domain.service`. */
  service: string;
  label: string;
  /** Needs a second tap. */
  confirm: boolean;
}

export interface DeviceView {
  tone: SecurityTone;
  label: string;
  /** Set when the device isn't secure: "unlocked", "open", "offline"… */
  problem?: string;
  action?: SecurityAction;
}

export interface AlarmView {
  tone: SecurityTone;
  label: string;
  problem?: string;
  actions: SecurityAction[];
}

const LOCK: SecurityAction = { service: "lock.lock", label: "Lock", confirm: false };
const UNLOCK: SecurityAction = { service: "lock.unlock", label: "Unlock", confirm: true };
const CLOSE: SecurityAction = { service: "cover.close_cover", label: "Close", confirm: false };
const OPEN: SecurityAction = { service: "cover.open_cover", label: "Open", confirm: true };
const ARM_HOME: SecurityAction = { service: "alarm_control_panel.alarm_arm_home", label: "Arm home", confirm: false };
const ARM_AWAY: SecurityAction = { service: "alarm_control_panel.alarm_arm_away", label: "Arm away", confirm: true };
const DISARM: SecurityAction = { service: "alarm_control_panel.alarm_disarm", label: "Disarm", confirm: true };

function offline(state: string): DeviceView {
  return { tone: "error", label: state === "unavailable" ? "Offline" : "No reading", problem: "offline" };
}

export function lockView(state: string): DeviceView {
  switch (state) {
    case "locked":
      return { tone: "ok", label: "Locked", action: UNLOCK };
    case "unlocked":
      return { tone: "error", label: "Unlocked", problem: "unlocked", action: LOCK };
    case "jammed":
      return { tone: "error", label: "Jammed", problem: "jammed", action: LOCK };
    case "open":
      return { tone: "error", label: "Open", problem: "open", action: LOCK };
    case "locking":
      return { tone: "active", label: "Locking…" };
    case "unlocking":
      return { tone: "active", label: "Unlocking…" };
    case "opening":
      return { tone: "active", label: "Opening…" };
    default:
      return offline(state);
  }
}

/** A garage door; `fallback` is a door sensor to report while the opener is offline. */
export function coverView(state: string, fallback?: { name: string; open: boolean }): DeviceView {
  switch (state) {
    case "closed":
      return { tone: "ok", label: "Closed", action: OPEN };
    case "open":
      return { tone: "error", label: "Open", problem: "open", action: CLOSE };
    case "opening":
      return { tone: "active", label: "Opening…" };
    case "closing":
      return { tone: "active", label: "Closing…" };
    default: {
      const v = offline(state);
      return fallback ? { ...v, label: `Offline · ${fallback.name} ${fallback.open ? "open" : "closed"}` } : { ...v, label: "Offline" };
    }
  }
}

const ARMED: Record<string, string> = {
  armed_home: "Armed home",
  armed_away: "Armed away",
  armed_night: "Armed night",
  armed_vacation: "Armed vacation",
  armed_custom_bypass: "Armed",
};

export function alarmView(state: string): AlarmView {
  if (state === "disarmed") return { tone: "idle", label: "Disarmed", actions: [ARM_HOME, ARM_AWAY] };
  if (ARMED[state]) return { tone: "ok", label: ARMED[state], actions: [DISARM] };
  if (state === "arming") return { tone: "active", label: "Arming…", actions: [DISARM] };
  if (state === "disarming") return { tone: "active", label: "Disarming…", actions: [] };
  if (state === "pending") return { tone: "error", label: "Entry delay", problem: "counting down", actions: [DISARM] };
  if (state === "triggered") return { tone: "error", label: "Triggered", problem: "triggered", actions: [DISARM] };
  return { tone: "error", label: "Offline", problem: "offline", actions: [] };
}

/** One line for every door and window contact. */
export function contactsLine(open: string[], total: number): { tone: "ok" | "error"; text: string } {
  if (!open.length) return { tone: "ok", text: `All ${total} doors and windows closed` };
  if (open.length === 1) return { tone: "error", text: `${open[0]} open` };
  if (open.length === 2) return { tone: "error", text: `${open[0]} and ${open[1]} open` };
  return { tone: "error", text: `${open[0]}, ${open[1]} and ${open.length - 2} more open` };
}

const RANK: Record<string, number> = { triggered: 0, "counting down": 0, unlocked: 1, jammed: 1, open: 2, offline: 3 };

/** The card's headline: "All secure", or the worst problem and how many more there are. */
export function securityVerdict(
  devices: { name: string; problem?: string }[],
  openContacts: string[],
): { tone: "ok" | "error"; text: string; problems: string[] } {
  const problems = devices
    .filter((d): d is { name: string; problem: string } => !!d.problem)
    .sort((a, b) => (RANK[a.problem] ?? 3) - (RANK[b.problem] ?? 3))
    .map((d) => `${d.name} ${d.problem}`);
  if (openContacts.length === 1) problems.push(`${openContacts[0]} open`);
  else if (openContacts.length > 1) problems.push(`${openContacts.length} doors or windows open`);
  if (!problems.length) return { tone: "ok", text: "All secure", problems };
  return { tone: "error", text: problems[0] + (problems.length > 1 ? ` +${problems.length - 1}` : ""), problems };
}
