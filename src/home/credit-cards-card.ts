import { css, html, nothing, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { BaseCard } from "../lib/base-card";
import {
  bankNote,
  canPay,
  canUndo,
  formatAmount,
  formFrom,
  headline,
  localToday,
  readCards,
  sortCards,
  statusLine,
  validateForm,
  type CardForm,
  type CreditCard,
} from "../lib/credit-cards";
import { fold, foldButton } from "./fold";
import { homeStyles } from "./home-styles";

export interface CreditCardsCardConfig {
  type: string;
  title?: string;
}

const NEW = "new";
const ICON_CLASS = { error: "bad", warn: "due", ok: "" } as const;

/**
 * Credit card payments from the credit_cards integration: the most urgent card up top, then each
 * card with when it's due and a one-tap Paid (Undo the same day). The fold adds, edits and
 * removes cards. A card linked to its bank gets its due day and amount from the bank, so those
 * are locked in its form.
 */
export class BrinstarCreditCardsCard extends BaseCard<CreditCardsCardConfig> {
  @state() private manage = false;
  /** The card being edited (its entity id), or "new". */
  @state() private editing?: string;
  @state() private form: CardForm = formFrom();
  @state() private error?: string;
  @state() private saving = false;
  /** Rows rendered last time, so a removed card's row goes away too. */
  private shown: string[] = [];

  static styles = [
    homeStyles,
    css`
      .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .who .name { font-size: 1rem; font-weight: 600; }
      .head { font-size: 0.88rem; font-weight: 600; color: var(--bp-muted); overflow-wrap: anywhere; }
      /* Tone text is mixed toward the text colour so it stays readable in light themes. */
      .head.warn, .line.warn { color: color-mix(in srgb, var(--bp-amber) 70%, var(--bp-text)); }
      .head.error, .line.error { color: var(--bp-error); }
      .ico.due { background: color-mix(in srgb, var(--bp-amber) 16%, transparent); color: color-mix(in srgb, var(--bp-amber) 80%, var(--bp-text)); }

      .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border-top: 1px solid var(--bp-line); }
      .row { display: flex; align-items: center; gap: 10px; min-height: 58px; padding: 6px 0; }
      .row + .row { border-top: 1px solid var(--bp-line); }
      .row .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .nm { font-size: 0.95rem; font-weight: 600; color: var(--bp-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none; }
      a.nm { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; --mdc-icon-size: 14px; }
      a.nm span { overflow: hidden; text-overflow: ellipsis; }
      a.nm ha-icon { flex: none; color: var(--bp-muted); }
      a.nm:hover span { text-decoration: underline; }
      a.nm:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; border-radius: 4px; }
      .line { font-size: 0.8rem; font-weight: 500; color: var(--bp-muted); }
      .line b { color: var(--bp-text); font-weight: 600; }

      .pill {
        flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 0 14px;
        border-radius: 20px; border: 1px solid var(--bp-line); background: none; color: var(--bp-muted);
        font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; --mdc-icon-size: 18px;
        transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
      }
      .pill:hover:not(:disabled) { color: var(--bp-text); border-color: color-mix(in srgb, var(--bp-muted) 50%, var(--bp-line)); }
      .pill:active:not(:disabled) { transform: scale(0.96); }
      .pill:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; }
      .pill:disabled { opacity: 0.45; cursor: default; }
      .pill.strong { color: var(--bp-text); background: var(--bp-well); border-color: color-mix(in srgb, var(--bp-text) 30%, var(--bp-line)); }
      .pill.danger { color: var(--bp-error); border-color: color-mix(in srgb, var(--bp-error) 45%, var(--bp-line)); }
      .pill.danger.armed { background: color-mix(in srgb, var(--bp-error) 14%, transparent); }

      .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .list li { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 6px 0; }
      .list li + li { border-top: 1px solid var(--bp-line); }
      .list .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .list small { font-size: 0.78rem; font-weight: 500; color: var(--bp-muted); overflow-wrap: anywhere; }
      .add { align-self: flex-start; }
      p.empty { margin: 0; padding: 0; line-height: 1.45; }

      form { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 16px; background: var(--bp-well); }
      form h4 { margin: 0; font-size: 0.9rem; font-weight: 600; }
      label { display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; font-weight: 600; color: var(--bp-muted); }
      .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
      input.text {
        box-sizing: border-box; width: 100%; min-height: 44px; padding: 0 12px; border-radius: 12px;
        border: 1px solid var(--bp-line); background: var(--bp-card); color: var(--bp-text);
        /* 16px keeps iOS from zooming into the field */
        font: inherit; font-size: 1rem; font-weight: 500;
      }
      input.text::placeholder { color: var(--bp-muted); opacity: 0.7; }
      input.text:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 0; border-color: transparent; }
      /* Set by the bank: still readable, plainly not a field to type in. */
      input.text:disabled { background: transparent; border-style: dashed; border-color: color-mix(in srgb, var(--bp-muted) 45%, transparent); color: var(--bp-muted); -webkit-text-fill-color: var(--bp-muted); opacity: 1; cursor: default; }
      .hint { margin: -4px 0 0; font-size: 0.75rem; font-weight: 500; color: var(--bp-muted); }
      .switch { flex-direction: row; align-items: center; justify-content: space-between; min-height: 44px; font-size: 0.9rem; font-weight: 600; color: var(--bp-text); cursor: pointer; }
      .switch small { display: block; margin-top: 2px; font-size: 0.75rem; font-weight: 500; color: var(--bp-muted); }
      .switch input {
        appearance: none; flex: none; position: relative; width: 46px; height: 28px; margin: 0; border-radius: 14px; cursor: pointer;
        border: 1px solid var(--bp-line); background: var(--bp-card); transition: background 0.2s ease;
      }
      .switch input::before {
        content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
        background: var(--bp-muted); transition: transform 0.2s ease, background 0.2s ease;
      }
      .switch input:checked { background: color-mix(in srgb, var(--bp-text) 28%, var(--bp-card)); }
      .switch input:checked::before { transform: translateX(18px); background: var(--bp-text); }
      .switch input:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; }
      .err { margin: 0; font-size: 0.82rem; font-weight: 600; color: var(--bp-error); }
      .acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .acts .grow { flex: 1; }
      @media (prefers-reduced-motion: reduce) { .pill, .switch input, .switch input::before { transition: none; } }
    `,
  ];

  static getStubConfig() {
    return {};
  }

  setConfig(config: CreditCardsCardConfig) {
    this.config = config ?? { type: "custom:brinstar-credit-cards-card" };
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private cards(): CreditCard[] {
    return this.hass ? sortCards(readCards(this.hass.states, this.hass.entities ?? {})) : [];
  }

  protected watched() {
    return [...new Set([...this.cards().map((c) => c.entityId), ...this.shown])];
  }

  private pay(c: CreditCard) {
    this.call("credit_cards", "mark_paid", { entity_id: c.entityId });
  }

  private undo(c: CreditCard) {
    this.call("credit_cards", "mark_unpaid", { entity_id: c.entityId });
  }

  private edit(key: string, card?: CreditCard) {
    this.manage = true;
    this.editing = key;
    this.form = formFrom(card);
    this.error = undefined;
    this.updateComplete.then(() => this.renderRoot.querySelector<HTMLInputElement>("form input")?.focus());
  }

  private closeForm() {
    this.editing = undefined;
    this.error = undefined;
  }

  private setField(field: keyof CardForm, value: string | boolean) {
    this.form = { ...this.form, [field]: value };
  }

  private async save(e: Event) {
    e.preventDefault();
    const cards = this.cards();
    const others = cards.filter((c) => c.entityId !== this.editing).map((c) => c.name);
    const linked = Boolean(cards.find((c) => c.entityId === this.editing)?.bank);
    const { data, error } = validateForm(this.form, others, linked);
    if (!data) {
      this.error = error;
      return;
    }
    this.saving = true;
    this.error = undefined;
    try {
      if (this.editing === NEW) await this.call("credit_cards", "add_card", data);
      else await this.call("credit_cards", "update_card", { entity_id: this.editing, ...data });
      this.closeForm();
    } catch (err) {
      this.error = (err as { message?: string })?.message ?? String(err);
    } finally {
      this.saving = false;
    }
  }

  private removeCard(c: CreditCard) {
    this.confirm(`remove:${c.entityId}`, async () => {
      try {
        await this.call("credit_cards", "remove_card", { entity_id: c.entityId });
        this.closeForm();
      } catch (err) {
        this.error = (err as { message?: string })?.message ?? String(err);
      }
    });
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const cards = this.cards();
    this.shown = cards.map((c) => c.entityId);
    const lang = this.language();
    const head = headline(cards, lang);
    const today = localToday();
    const currency = this.hass.config?.currency;

    return html`<ha-card>
      <div class="title">
        <span class="ico ${ICON_CLASS[head.tone]}"><ha-icon icon="mdi:credit-card-outline"></ha-icon></span>
        <div class="who">
          <span class="name">${this.config.title ?? "Credit cards"}</span>
          ${cards.length ? html`<span class="head ${head.tone}">${head.text}</span>` : nothing}
        </div>
      </div>
      ${cards.length
        ? html`<ul class="rows">${cards.map((c) => this.renderRow(c, today, currency, lang))}</ul>`
        : html`<p class="empty">No cards yet. Add one with its monthly due day, and you'll get reminders before it's due.</p>`}
      ${fold(this.manage || !cards.length, "cc-manage", this.renderManage(cards))}
      ${cards.length
        ? foldButton(this.manage, "cc-manage", () => { this.manage = !this.manage; if (!this.manage) this.closeForm(); }, ["Manage cards", "Done"])
        : nothing}
    </ha-card>`;
  }

  private renderRow(c: CreditCard, today: string, currency: string | undefined, lang?: string): TemplateResult {
    const line = statusLine(c, lang);
    const note = bankNote(c);
    const amount = c.amountDue !== undefined && canPay(c) ? formatAmount(c.amountDue, currency, lang) : undefined;
    return html`<li class="row">
      <div class="txt">
        ${c.paymentUrl
          ? html`<a class="nm" href=${c.paymentUrl} target="_blank" rel="noopener noreferrer" aria-label="${c.name}, open the payment page">
              <span>${c.name}</span><ha-icon icon="mdi:open-in-new"></ha-icon></a>`
          : html`<span class="nm">${c.name}</span>`}
        <span class="line num ${line.tone}">${line.text}${amount ? html` · <b>${amount}</b>` : nothing}</span>
        ${note ? html`<span class="line ${note.tone}">${note.text}</span>` : nothing}
      </div>
      ${canUndo(c, today)
        ? html`<button class="pill" aria-label="Undo paid for ${c.name}" @click=${() => this.undo(c)}>Undo</button>`
        : canPay(c)
          ? html`<button class="pill strong" aria-label="Mark ${c.name} paid" @click=${() => this.pay(c)}>
              <ha-icon icon="mdi:check"></ha-icon>Paid</button>`
          : nothing}
    </li>`;
  }

  private renderManage(cards: CreditCard[]): TemplateResult {
    return html`
      ${cards.length
        ? html`<ul class="list">
            ${cards.map((c) => this.editing === c.entityId
              ? html`<li>${this.renderForm(c)}</li>`
              : html`<li>
                  <span class="txt">
                    <span class="nm">${c.name}</span>
                    <small class="num">Due day ${c.dueDay}${c.bank ? ` · ${c.bank}` : ""}${c.autopay ? " · autopay" : ""}</small>
                  </span>
                  <button class="pill" aria-label="Edit ${c.name}" @click=${() => this.edit(c.entityId, c)}>Edit</button>
                </li>`)}
          </ul>`
        : nothing}
      ${this.editing === NEW
        ? this.renderForm()
        : html`<button class="pill add" @click=${() => this.edit(NEW)}><ha-icon icon="mdi:plus"></ha-icon>Add card</button>`}
    `;
  }

  private renderForm(card?: CreditCard): TemplateResult {
    const f = this.form;
    const armed = card && this.confirming === `remove:${card.entityId}`;
    const id = card?.id ?? NEW;
    const bank = card?.bank;
    return html`<form @submit=${this.save} novalidate aria-label=${card ? `Edit ${card.name}` : "Add a card"}>
      <h4>${card ? `Edit ${card.name}` : "Add a card"}</h4>
      <label for="cc-name-${id}">Name
        <input id="cc-name-${id}" class="text" autocomplete="off" maxlength="60" placeholder="e.g. the bank or store"
          .value=${f.name} @input=${(e: Event) => this.setField("name", (e.target as HTMLInputElement).value)} />
      </label>
      <div class="two">
        <label for="cc-day-${id}">Due day
          <input id="cc-day-${id}" class="text num" inputmode="numeric" autocomplete="off" placeholder="1–31" ?disabled=${Boolean(bank)}
            aria-describedby=${bank ? `cc-bank-${id}` : nothing} .value=${f.dueDay} @input=${(e: Event) => this.setField("dueDay", (e.target as HTMLInputElement).value)} />
        </label>
        <label for="cc-amt-${id}">Amount due
          <input id="cc-amt-${id}" class="text num" inputmode="decimal" autocomplete="off" placeholder=${bank ? "None" : "Optional"} ?disabled=${Boolean(bank)}
            aria-describedby=${bank ? `cc-bank-${id}` : nothing} .value=${f.amount} @input=${(e: Event) => this.setField("amount", (e.target as HTMLInputElement).value)} />
        </label>
      </div>
      ${bank ? html`<p class="hint" id="cc-bank-${id}">Set by ${bank}</p>` : nothing}
      <label for="cc-url-${id}">Payment link
        <input id="cc-url-${id}" class="text" type="url" inputmode="url" autocomplete="off" placeholder="Optional, https://…"
          .value=${f.url} @input=${(e: Event) => this.setField("url", (e.target as HTMLInputElement).value)} />
      </label>
      <label class="switch" for="cc-auto-${id}">
        <span>Autopay<small>Pays itself: no Paid button, no reminders</small></span>
        <input id="cc-auto-${id}" type="checkbox" role="switch" .checked=${f.autopay}
          @change=${(e: Event) => this.setField("autopay", (e.target as HTMLInputElement).checked)} />
      </label>
      ${this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing}
      <div class="acts">
        ${card
          ? html`<button type="button" class="pill danger ${armed ? "armed" : ""}" @click=${() => this.removeCard(card)}>
              ${armed ? "Tap again to delete" : "Delete"}</button>`
          : nothing}
        <span class="grow"></span>
        <button type="button" class="pill" @click=${() => this.closeForm()}>Cancel</button>
        <button type="submit" class="pill strong" ?disabled=${this.saving}>${this.saving ? "Saving…" : "Save"}</button>
      </div>
    </form>`;
  }
}
