import { describe, expect, it } from "vitest";
import {
  bankNote,
  canPay,
  canUndo,
  formatAmount,
  formFrom,
  headline,
  readCards,
  sortCards,
  statusLine,
  validateForm,
  type CreditCard,
} from "../src/lib/credit-cards";

const TODAY = "2026-11-27";

function sensor(id: string, due: string, attrs: Record<string, unknown>) {
  return {
    entity_id: id,
    state: due,
    last_updated: "",
    attributes: { friendly_name: "Card", card_id: id, status: "upcoming", days_until: 5, due_day: 2, autopay: false,
      amount_due: null, payment_url: null, paid_on: null, ...attrs },
  };
}

function card(over: Partial<CreditCard>): CreditCard {
  return { entityId: "sensor.credit_card_acme_visa", id: "a1", name: "Acme Visa", status: "upcoming", due: "2026-12-22",
    daysUntil: 25, dueDay: 22, autopay: false, ...over };
}

describe("readCards", () => {
  it("reads the credit_cards sensors and skips other platforms and missing or offline ones", () => {
    const states = {
      "sensor.credit_card_acme_visa": sensor("sensor.credit_card_acme_visa", "2026-11-28", {
        friendly_name: "Acme Visa", card_id: "a1", status: "due_soon", days_until: 1, due_day: 28,
        amount_due: 120.5, payment_url: "https://pay.example.com", paid_on: "2026-10-27",
      }),
      "sensor.credit_card_gone": sensor("sensor.credit_card_gone", "unavailable", {}),
      "sensor.other": sensor("sensor.other", "2026-11-28", {}),
    };
    const entities = {
      "sensor.credit_card_acme_visa": { entity_id: "sensor.credit_card_acme_visa", platform: "credit_cards" },
      "sensor.credit_card_gone": { entity_id: "sensor.credit_card_gone", platform: "credit_cards" },
      "sensor.credit_card_removed": { entity_id: "sensor.credit_card_removed", platform: "credit_cards" },
      "sensor.other": { entity_id: "sensor.other", platform: "template" },
    };
    expect(readCards(states, entities)).toEqual([
      {
        entityId: "sensor.credit_card_acme_visa", id: "a1", name: "Acme Visa", status: "due_soon", due: "2026-11-28",
        daysUntil: 1, dueDay: 28, autopay: false, amountDue: 120.5, paymentUrl: "https://pay.example.com", paidOn: "2026-10-27",
      },
    ]);
  });

  it("reads a bank-linked card's bank, sync status and whether it's waiting on the bank", () => {
    const linked = sensor("sensor.credit_card_linked", "2026-12-22", {
      friendly_name: "Linked", card_id: "l1", status: "paid", bank: "Northwind Bank", bank_status: "relink",
      synced_at: "2026-11-27T08:00:00-08:00", awaiting_bank: true,
    });
    const plain = sensor("sensor.credit_card_plain", "2026-12-02", { bank: null, bank_status: null, awaiting_bank: false });
    const entities = {
      "sensor.credit_card_linked": { entity_id: "sensor.credit_card_linked", platform: "credit_cards" },
      "sensor.credit_card_plain": { entity_id: "sensor.credit_card_plain", platform: "credit_cards" },
    };
    const [l, p] = readCards({ "sensor.credit_card_linked": linked, "sensor.credit_card_plain": plain }, entities);
    expect([l.bank, l.bankStatus, l.awaitingBank]).toEqual(["Northwind Bank", "relink", true]);
    expect("bank" in p || "bankStatus" in p || "awaitingBank" in p).toBe(false);
  });
});

describe("sortCards", () => {
  it("puts the earliest due date first, so overdue cards lead and paid ones trail", () => {
    const cards = [
      card({ name: "Paid", status: "paid", due: "2027-01-05" }),
      card({ name: "Later", due: "2026-12-22" }),
      card({ name: "Overdue", status: "overdue", due: "2026-11-22" }),
      card({ name: "Also later", due: "2026-12-22" }),
    ];
    expect(sortCards(cards).map((c) => c.name)).toEqual(["Overdue", "Also later", "Later", "Paid"]);
  });
});

describe("headline", () => {
  const lang = "en-US";

  it("names the most overdue card in ember, and counts the other urgent ones", () => {
    const cards = [
      card({ name: "Acme Visa", status: "overdue", due: "2026-11-22", daysUntil: -5 }),
      card({ name: "Northwind", status: "due_today", due: TODAY, daysUntil: 0 }),
      card({ name: "Later", due: "2026-12-22" }),
    ];
    expect(headline(cards, lang)).toEqual({ tone: "error", text: "Acme Visa is 5 days overdue · +1 more" });
    expect(headline([card({ status: "overdue", due: "2026-11-26", daysUntil: -1 })], lang).text).toBe("Acme Visa is 1 day overdue");
  });

  it("says due today, tomorrow or in a few days in amber", () => {
    expect(headline([card({ status: "due_today", due: TODAY, daysUntil: 0 })], lang)).toEqual({ tone: "warn", text: "Acme Visa due today" });
    expect(headline([card({ status: "due_soon", due: "2026-11-28", daysUntil: 1 })], lang).text).toBe("Acme Visa due tomorrow");
    expect(headline([card({ status: "due_soon", due: "2026-11-30", daysUntil: 3 })], lang).text).toBe("Acme Visa due in 3 days");
  });

  it("names the next one when nothing is due soon", () => {
    const cards = [card({ name: "Paid", status: "paid", due: "2026-12-02" }), card({ name: "Acme Visa", due: "2026-12-22" })];
    expect(headline(cards, lang)).toEqual({ tone: "ok", text: "Acme Visa due Dec 22" });
  });

  it("says all paid when every card is paid or on autopay", () => {
    const cards = [card({ name: "Auto", status: "autopay", due: "2026-12-02", autopay: true }), card({ name: "Paid", status: "paid", due: "2026-12-30" })];
    expect(headline(cards, lang)).toEqual({ tone: "ok", text: "All paid · next Auto Dec 2" });
  });

  it("has nothing to say without cards", () => {
    expect(headline([], lang)).toEqual({ tone: "ok", text: "No cards yet" });
  });
});

describe("statusLine", () => {
  const lang = "en-US";
  it("words each status", () => {
    expect(statusLine(card({ status: "overdue", due: "2026-11-22", daysUntil: -5 }), lang)).toEqual({ tone: "error", text: "5 days overdue · was due Nov 22" });
    expect(statusLine(card({ status: "due_today", due: TODAY, daysUntil: 0 }), lang)).toEqual({ tone: "warn", text: "Due today" });
    expect(statusLine(card({ status: "due_soon", due: "2026-11-28", daysUntil: 1 }), lang)).toEqual({ tone: "warn", text: "Due Nov 28 · tomorrow" });
    expect(statusLine(card({ due: "2026-12-22", daysUntil: 25 }), lang)).toEqual({ tone: "ok", text: "Due Dec 22 · in 25 days" });
    expect(statusLine(card({ status: "paid", due: "2026-12-22", paidOn: "2026-11-20" }), lang)).toEqual({ tone: "ok", text: "Paid Nov 20 · next Dec 22" });
    expect(statusLine(card({ status: "paid", due: "2026-12-22" }), lang).text).toBe("Paid · next Dec 22");
    expect(statusLine(card({ status: "autopay", due: "2026-12-02", autopay: true }), lang)).toEqual({ tone: "ok", text: "Autopay · Dec 2" });
  });

  it("says a tapped Paid is waiting on the bank", () => {
    const tapped = card({ status: "paid", due: "2027-01-22", paidOn: "2026-11-28", bank: "Northwind Bank", awaitingBank: true });
    expect(statusLine(tapped, lang)).toEqual({ tone: "ok", text: "Paid Nov 28 · waiting on bank" });
  });
});

describe("bankNote", () => {
  it("asks for a re-link when the bank needs signing in again, and is quiet otherwise", () => {
    expect(bankNote(card({ bank: "Northwind Bank", bankStatus: "relink" }))).toEqual({ tone: "warn", text: "Re-link Northwind Bank in Settings" });
    expect(bankNote(card({ bank: "Northwind Bank", bankStatus: "ok" }))).toBeUndefined();
    expect(bankNote(card({}))).toBeUndefined();
  });
});

describe("canPay and canUndo", () => {
  it("offers Paid on unpaid cards and Undo on a card paid today", () => {
    expect(canPay(card({ status: "overdue" }))).toBe(true);
    expect(canPay(card({ status: "upcoming" }))).toBe(true);
    expect(canPay(card({ status: "paid" }))).toBe(false);
    expect(canPay(card({ status: "autopay" }))).toBe(false);
    expect(canUndo(card({ status: "paid", paidOn: TODAY }), TODAY)).toBe(true);
    expect(canUndo(card({ status: "upcoming", paidOn: TODAY }), TODAY)).toBe(true);
    expect(canUndo(card({ status: "paid", paidOn: "2026-11-20" }), TODAY)).toBe(false);
    expect(canUndo(card({}), TODAY)).toBe(false);
  });
});

describe("formatAmount", () => {
  it("uses HA's currency", () => {
    expect(formatAmount(1234.5, "USD", "en-US")).toBe("$1,234.50");
    expect(formatAmount(80, "EUR", "en-US")).toBe("€80.00");
    expect(formatAmount(80, undefined, "en-US")).toBe("80.00");
  });
});

describe("validateForm", () => {
  const good = { name: " Acme Visa ", dueDay: "22", amount: "$1,234.50", url: " https://pay.example.com ", autopay: false };

  it("turns the form into service data", () => {
    expect(validateForm(good, [])).toEqual({
      data: { name: "Acme Visa", due_day: 22, amount_due: 1234.5, payment_url: "https://pay.example.com", autopay: false },
    });
    expect(validateForm({ ...good, amount: "", url: "" }, []).data).toMatchObject({ amount_due: null, payment_url: "" });
  });

  it("leaves out the due day and amount for a bank-linked card, which the bank sets", () => {
    expect(validateForm({ ...good, dueDay: "", amount: "abc" }, [], true)).toEqual({
      data: { name: "Acme Visa", payment_url: "https://pay.example.com", autopay: false },
    });
  });

  it("explains what's wrong", () => {
    expect(validateForm({ ...good, name: "  " }, []).error).toBe("Give the card a name");
    expect(validateForm(good, ["acme visa"]).error).toBe("A card named Acme Visa already exists");
    for (const dueDay of ["", "0", "32", "1.5", "x"]) {
      expect(validateForm({ ...good, dueDay }, []).error).toBe("Due day must be a number from 1 to 31");
    }
    for (const amount of ["abc", "-5", "1.234"]) {
      expect(validateForm({ ...good, amount }, []).error).toBe("Amount due must be a number, like 120.50");
    }
    for (const url of ["pay.example.com", "javascript:alert(1)", "ftp://x.example"]) {
      expect(validateForm({ ...good, url }, []).error).toBe("Payment link must start with https://");
    }
  });
});

describe("formFrom", () => {
  it("fills the form from a card, or leaves it empty for a new one", () => {
    expect(formFrom(card({ amountDue: 120.5, paymentUrl: "https://pay.example.com", autopay: true }))).toEqual({
      name: "Acme Visa", dueDay: "22", amount: "120.50", url: "https://pay.example.com", autopay: true,
    });
    expect(formFrom()).toEqual({ name: "", dueDay: "", amount: "", url: "", autopay: false });
  });
});
