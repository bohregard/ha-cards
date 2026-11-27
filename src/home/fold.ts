import { html, type TemplateResult } from "lit";

/**
 * The part of a card that stays folded until asked for: it animates open, and while shut its
 * contents are inert so focus and screen readers skip them.
 */
export function fold(open: boolean, id: string, content: TemplateResult): TemplateResult {
  return html`<div class="fold ${open ? "open" : ""}" id=${id} ?inert=${!open} aria-hidden=${open ? "false" : "true"}>
    <div class="fold-inner">${content}</div>
  </div>`;
}

/** The button under a card that opens or closes its fold. `labels`: [when shut, when open]. */
export function foldButton(
  open: boolean,
  controls: string,
  onToggle: () => void,
  labels: [string, string] = ["Show details", "Hide details"],
): TemplateResult {
  return html`<button class="expand" aria-expanded=${open ? "true" : "false"} aria-controls=${controls} @click=${onToggle}>
    ${open ? labels[1] : labels[0]}<ha-icon icon="mdi:chevron-down"></ha-icon>
  </button>`;
}
