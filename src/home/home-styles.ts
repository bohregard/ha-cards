import { css } from "lit";

/**
 * Shared look for the Home cards (Lamplight: colour is state). Each card's body is one link
 * to its page (`.hit` covers the card); its one action is a button above that link.
 */
export const homeStyles = css`
  :host {
    --bp-amber: var(--warning-color, #f4b650);
    --bp-lamp: var(--state-light-on-color, #f4b650);
    --bp-active: var(--state-fan-on-color, #5fc3cf);
    --bp-ok: var(--success-color, #8cc59a);
    --bp-error: var(--error-color, #f07a5f);
    --bp-text: var(--primary-text-color, #f1ece3);
    --bp-muted: var(--secondary-text-color, #ada394);
    --bp-line: var(--divider-color, #2e2a24);
    --bp-card: var(--ha-card-background, var(--card-background-color, #1e1b17));
    --bp-well: color-mix(in srgb, var(--bp-text) 7%, var(--bp-card));
    --bp-radius: var(--ha-card-border-radius, 24px);
    display: block;
    /* Fill the grid cell, so cards side by side in a sections row share one height. */
    height: 100%;
    container-type: inline-size;
  }
  ha-card { position: relative; height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
  .hit { position: absolute; inset: 0; z-index: 0; border-radius: var(--bp-radius); cursor: pointer; }
  .hit:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: -2px; }
  .body { position: relative; z-index: 1; pointer-events: none; display: flex; flex-direction: column; gap: 14px; }
  .body button, .body a { pointer-events: auto; }
  .num { font-variant-numeric: tabular-nums; }
  .muted { color: var(--bp-muted); }

  .title { display: flex; align-items: center; gap: 10px; }
  .title .name { flex: 1; min-width: 0; font-size: 1rem; font-weight: 600; }
  .title .go { --mdc-icon-size: 22px; color: var(--bp-muted); }
  .title .aside { font-size: 0.85rem; font-weight: 500; color: var(--bp-muted); text-align: right; }
  .title .aside b { color: var(--bp-text); font-weight: 600; }

  .ico {
    flex: none; width: 40px; height: 40px; border-radius: 50%; border: 0; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--bp-well); color: var(--bp-muted); --mdc-icon-size: 22px;
  }
  .ico.lit { background: color-mix(in srgb, var(--bp-lamp) 18%, transparent); color: var(--bp-lamp); }
  .ico.air { background: color-mix(in srgb, var(--bp-active) 16%, transparent); color: var(--bp-active); }
  .ico.bad { background: color-mix(in srgb, var(--bp-error) 15%, transparent); color: var(--bp-error); }
  button.ico { cursor: pointer; transition: transform 0.15s ease, background 0.2s ease; font: inherit; }
  button.ico:active { transform: scale(0.92); }
  button.ico:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; }
  button.ico:disabled { opacity: 0.45; cursor: default; }

  .big { font-size: 3rem; font-weight: 300; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .big small { font-size: 1rem; font-weight: 500; letter-spacing: 0; color: var(--bp-muted); margin-left: 4px; }
  .sub { margin-top: 6px; font-size: 0.9rem; font-weight: 500; color: var(--bp-muted); }
  .sub b { color: var(--bp-text); font-weight: 600; }

  .tone-warn { color: var(--bp-amber); }
  .tone-error { color: var(--bp-error); }
  .tone-ok { color: var(--bp-muted); }

  section { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--bp-line); padding-top: 12px; }
  h3 { margin: 0; display: flex; justify-content: space-between; gap: 12px; font-size: 0.8rem; font-weight: 600; color: var(--bp-muted); }
  h3 .hint { font-weight: 500; color: var(--bp-text); }

  .chart { width: 100%; display: block; overflow: visible; }
  .chart .line { fill: none; stroke: var(--bp-muted); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .chart .area { fill: color-mix(in srgb, var(--bp-muted) 14%, transparent); stroke: none; }
  .chart .rain { fill: color-mix(in srgb, var(--bp-active) 60%, transparent); }
  .chart .grid { stroke: var(--bp-line); stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
  .axis { display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 500; color: var(--bp-muted); }
  .empty { color: var(--bp-muted); font-size: 0.85rem; padding: 8px 0; }

  /* fold: shut by default, opened by the button under the card */
  .fold { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.32s cubic-bezier(0.16, 1, 0.3, 1), margin 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
  .fold:not(.open) { margin-top: -14px; }
  .fold.open { grid-template-rows: 1fr; }
  .fold-inner { min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 14px; }
  .expand {
    align-self: center; display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 10px 0 14px;
    border: 1px solid var(--bp-line); border-radius: 18px; background: none; color: var(--bp-muted);
    font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; --mdc-icon-size: 18px;
  }
  .expand:hover { color: var(--bp-text); border-color: color-mix(in srgb, var(--bp-muted) 50%, var(--bp-line)); }
  .expand:focus-visible { outline: 2px solid var(--bp-lamp); outline-offset: 2px; }
  .expand ha-icon { transition: transform 0.25s ease; }
  .expand[aria-expanded="true"] ha-icon { transform: rotate(180deg); }
  @media (prefers-reduced-motion: reduce) { .fold, .expand ha-icon { transition: none; } }

  .meter { height: 8px; border-radius: 4px; background: var(--bp-well); overflow: hidden; }
  .meter i { display: block; height: 100%; border-radius: 4px; background: var(--bp-muted); transition: width 0.4s ease; }
  .meter.warn i { background: var(--bp-amber); }
  .meter.error i { background: var(--bp-error); }
`;
