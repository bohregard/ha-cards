import { css } from "lit";

export const statusStyles = css`
  :host {
    --bv-amber: var(--warning-color, #f4b650);
    --bv-ok: var(--success-color, #8cc59a);
    --bv-error: var(--error-color, #f07a5f);
    --bv-muted: var(--secondary-text-color, #ada394);
    --bv-line: var(--divider-color, #2e2a24);
  }
  ha-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  h2 .hint { color: var(--bv-muted); font-size: 0.85rem; font-weight: 500; }
  h2 .hint.warn { color: var(--bv-amber); }
  h2 .hint.error { color: var(--bv-error); }
  h3 {
    margin: 0 0 8px;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--bv-muted);
  }
  section + section { border-top: 1px solid var(--bv-line); padding-top: 14px; }

  /* consumables */
  .parts { display: flex; flex-direction: column; gap: 12px; }
  .part {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: "name action" "meter action";
    column-gap: 12px;
    row-gap: 6px;
    align-items: center;
  }
  .part .name { grid-area: name; display: flex; justify-content: space-between; gap: 8px; font-size: 0.95rem; }
  .part .name .value { color: var(--bv-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .part .meter { grid-area: meter; height: 6px; border-radius: 3px; background: var(--bv-line); overflow: hidden; }
  .part .meter > div { height: 100%; background: var(--bv-muted); transition: width 0.4s ease; }
  .part[data-tone="warn"] .value { color: var(--bv-amber); }
  .part[data-tone="warn"] .meter > div { background: var(--bv-amber); }
  .part[data-tone="error"] .value { color: var(--bv-error); }
  .part[data-tone="error"] .meter > div { background: var(--bv-error); }
  .reset {
    grid-area: action;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 44px;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 22px;
    border: 1px solid var(--bv-line);
    background: none;
    color: var(--bv-muted);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }
  .reset ha-icon { --mdc-icon-size: 20px; }
  .reset.confirm { border-color: var(--bv-error); color: var(--bv-error); }

  /* last clean */
  .facts { display: flex; flex-wrap: wrap; gap: 8px 20px; }
  .fact { display: flex; flex-direction: column; gap: 2px; }
  .fact .big { font-size: 1.15rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .fact .small { color: var(--bv-muted); font-size: 0.8rem; }

  /* dock */
  .rows { display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; font-size: 0.95rem; }
  .rows .value { color: var(--bv-muted); text-align: right; }
  .rows .value.warn { color: var(--bv-amber); font-weight: 600; }
`;
