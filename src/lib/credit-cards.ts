/**
 * Credit cards from the credit_cards integration: one `date` sensor per card, whose state is the
 * current due date and whose attributes say whether it's paid, due soon or overdue.
 */
import type { HassEntity } from "./hass";
import type { EntityEntry } from "./vacuum";

export type CardStatus = "paid" | "upcoming" | "due_soon" | "due_today" | "overdue" | "autopay";
export type Tone = "error" | "warn" | "ok";

export interface CreditCard {
  entityId: string;
  id: string;
  name: string;
  status: CardStatus;
  /** The current due date, YYYY-MM-DD. When paid, already next month's. */
  due: string;
  daysUntil: number;
  dueDay: number;
  autopay: boolean;
  amountDue?: number;
  paymentUrl?: string;
  paidOn?: string;
}

/** The add/edit form, as typed. */
export interface CardForm {
  name: string;
  dueDay: string;
  amount: string;
  url: string;
  autopay: boolean;
}

const PLATFORM = "credit_cards";
const NO_READING = ["unavailable", "unknown", ""];
const URGENT: CardStatus[] = ["overdue", "due_today", "due_soon"];

export function readCards(states: Record<string, HassEntity>, entities: Record<string, EntityEntry>): CreditCard[] {
  const cards: CreditCard[] = [];
  for (const e of Object.values(entities)) {
    if (e.platform !== PLATFORM || !e.entity_id.startsWith("sensor.")) continue;
    const s = states[e.entity_id];
    if (!s || NO_READING.includes(s.state)) continue;
    const a = s.attributes;
    const card: CreditCard = {
      entityId: e.entity_id,
      id: String(a.card_id ?? e.entity_id),
      name: String(a.friendly_name ?? e.entity_id),
      status: a.status as CardStatus,
      due: s.state,
      daysUntil: Number(a.days_until ?? 0),
      dueDay: Number(a.due_day),
      autopay: a.autopay === true,
    };
    if (typeof a.amount_due === "number") card.amountDue = a.amount_due;
    if (typeof a.payment_url === "string" && a.payment_url) card.paymentUrl = a.payment_url;
    if (typeof a.paid_on === "string" && a.paid_on) card.paidOn = a.paid_on;
    cards.push(card);
  }
  return cards;
}

/** Earliest due date first: overdue cards lead, paid ones (already on next month) trail. */
export function sortCards(cards: CreditCard[]): CreditCard[] {
  return [...cards].sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
}

/** A YYYY-MM-DD date as "Nov 28", read as a local date. */
export function dateLabel(iso: string, lang?: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang, { month: "short", day: "numeric" });
}

/** Today as YYYY-MM-DD in local time. */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const soon = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${days(n)}`);

function toneOf(status: CardStatus): Tone {
  return status === "overdue" ? "error" : status === "due_today" || status === "due_soon" ? "warn" : "ok";
}

/** The card's one line: the most urgent card, or the next one due. */
export function headline(cards: CreditCard[], lang?: string): { tone: Tone; text: string } {
  if (!cards.length) return { tone: "ok", text: "No cards yet" };
  const sorted = sortCards(cards);
  const first = sorted[0];
  const urgent = sorted.filter((c) => URGENT.includes(c.status));
  if (urgent.length) {
    const c = urgent[0];
    const more = urgent.length > 1 ? ` · +${urgent.length - 1} more` : "";
    const text = c.status === "overdue" ? `${c.name} is ${days(-c.daysUntil)} overdue` : `${c.name} due ${soon(c.daysUntil)}`;
    return { tone: toneOf(c.status), text: text + more };
  }
  const unpaid = sorted.find((c) => c.status === "upcoming");
  if (unpaid) return { tone: "ok", text: `${unpaid.name} due ${dateLabel(unpaid.due, lang)}` };
  return { tone: "ok", text: `All paid · next ${first.name} ${dateLabel(first.due, lang)}` };
}

/** What a row says under the card's name. */
export function statusLine(card: CreditCard, lang?: string): { tone: Tone; text: string } {
  const due = dateLabel(card.due, lang);
  const tone = toneOf(card.status);
  switch (card.status) {
    case "overdue":
      return { tone, text: `${days(-card.daysUntil)} overdue · was due ${due}` };
    case "due_today":
      return { tone, text: "Due today" };
    case "paid":
      return { tone, text: `${card.paidOn ? `Paid ${dateLabel(card.paidOn, lang)}` : "Paid"} · next ${due}` };
    case "autopay":
      return { tone, text: `Autopay · ${due}` };
    default:
      return { tone, text: `Due ${due} · ${soon(card.daysUntil)}` };
  }
}

export function canPay(card: CreditCard): boolean {
  return card.status !== "paid" && card.status !== "autopay";
}

/** Undo is offered on the day a card was marked paid. */
export function canUndo(card: CreditCard, today: string): boolean {
  return card.paidOn === today;
}

export function formatAmount(n: number, currency: string | undefined, lang?: string): string {
  return currency
    ? new Intl.NumberFormat(lang, { style: "currency", currency }).format(n)
    : new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Checks the form; `data` is ready for credit_cards.add_card / update_card. */
export function validateForm(form: CardForm, others: string[]): { data?: Record<string, unknown>; error?: string } {
  const name = form.name.trim();
  if (!name) return { error: "Give the card a name" };
  if (others.some((o) => o.trim().toLowerCase() === name.toLowerCase())) return { error: `A card named ${name} already exists` };

  const day = form.dueDay.trim();
  if (!/^\d{1,2}$/.test(day) || Number(day) < 1 || Number(day) > 31) return { error: "Due day must be a number from 1 to 31" };

  const amount = form.amount.trim().replace(/[$€£,\s]/g, "");
  if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) return { error: "Amount due must be a number, like 120.50" };

  const url = form.url.trim();
  if (url && !/^https?:\/\/[^\s/]+\S*$/i.test(url)) return { error: "Payment link must start with https://" };

  return { data: { name, due_day: Number(day), amount_due: amount ? Number(amount) : null, payment_url: url, autopay: form.autopay } };
}

export function formFrom(card?: CreditCard): CardForm {
  return {
    name: card?.name ?? "",
    dueDay: card ? String(card.dueDay) : "",
    amount: card?.amountDue !== undefined ? card.amountDue.toFixed(2) : "",
    url: card?.paymentUrl ?? "",
    autopay: card?.autopay ?? false,
  };
}
