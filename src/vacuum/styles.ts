import { css } from "lit";

export const styles = css`
  :host {
    --bv-amber: var(--primary-color, #f4b650);
    --bv-active: var(--state-vacuum-on-color, #5fc3cf);
    --bv-ok: var(--success-color, #8cc59a);
    --bv-error: var(--error-color, #f07a5f);
    --bv-muted: var(--secondary-text-color, #ada394);
    --bv-line: var(--divider-color, #2e2a24);
    --bv-radius: var(--ha-card-border-radius, 24px);
  }
  ha-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
  }

  /* header */
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .head ha-icon {
    --mdc-icon-size: 28px;
    color: var(--bv-muted);
  }
  .head[data-tone="active"] ha-icon { color: var(--bv-active); }
  .head[data-tone="ok"] ha-icon { color: var(--bv-ok); }
  .head[data-tone="error"] ha-icon { color: var(--bv-error); }
  .title { flex: 1; min-width: 0; }
  .name { font-size: 1.1rem; font-weight: 600; }
  .status {
    color: var(--bv-muted);
    font-size: 0.95rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .battery {
    display: flex;
    align-items: center;
    gap: 2px;
    color: var(--bv-muted);
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
  .battery ha-icon { --mdc-icon-size: 20px; }
  .progress {
    height: 4px;
    border-radius: 2px;
    background: var(--bv-line);
    overflow: hidden;
  }
  .progress > div {
    height: 100%;
    background: var(--bv-active);
    transition: width 0.6s ease;
  }
  ha-alert { display: block; }

  /* map */
  .map {
    position: relative;
    border-radius: calc(var(--bv-radius) - 8px);
    overflow: hidden;
    background: var(--bv-line);
    cursor: pointer;
    touch-action: manipulation;
  }
  .map img { display: block; width: 100%; height: auto; user-select: none; -webkit-user-drag: none; }
  .map svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .map .pin .halo { fill: color-mix(in srgb, var(--bv-amber) 35%, transparent); }
  .map .pin .dot { fill: var(--bv-amber); stroke: var(--ha-card-background, #1e1b17); }
  .map-empty { padding: 32px 16px; text-align: center; color: var(--bv-muted); }

  /* rooms */
  .rooms { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 14px 0 10px;
    border-radius: 18px;
    border: 1px solid var(--bv-line);
    background: none;
    color: inherit;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }
  .chip ha-icon { --mdc-icon-size: 18px; color: var(--bv-muted); }
  .chip[aria-pressed="true"] {
    border-color: var(--bv-amber);
    background: color-mix(in srgb, var(--bv-amber) 22%, transparent);
  }
  .chip[aria-pressed="true"] ha-icon { color: var(--bv-amber); }

  /* actions */
  .actions { display: flex; gap: 8px; }
  .btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 22px;
    border: 1px solid var(--bv-line);
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .btn ha-icon { --mdc-icon-size: 20px; }
  .btn.primary {
    flex: 2;
    border-color: transparent;
    background: var(--bv-amber);
    color: var(--text-primary-color, #1e1b17);
  }
  .btn.confirm { border-color: var(--bv-error); color: var(--bv-error); }
  .btn.icon { flex: 0 0 44px; padding: 0; }
  .btn:disabled { opacity: 0.4; cursor: default; }

  /* settings */
  .settings { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .setting { display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: 0.8rem; color: var(--bv-muted); }
  .setting select {
    width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 0 10px;
    border-radius: 12px;
    border: 1px solid var(--bv-line);
    background: var(--ha-card-background, #1e1b17);
    color: var(--primary-text-color, #f1ece3);
    font: inherit;
    font-size: 0.9rem;
  }

  /* details */
  details { border-top: 1px solid var(--bv-line); padding-top: 10px; }
  summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    min-height: 32px;
  }
  summary::-webkit-details-marker { display: none; }
  summary .hint { color: var(--bv-muted); font-weight: 500; font-size: 0.85rem; }
  summary .hint.warn { color: var(--bv-error); }
  .rows { display: flex; flex-direction: column; gap: 10px; padding-top: 8px; }
  .row { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; align-items: center; font-size: 0.9rem; }
  .row .value { color: var(--bv-muted); font-variant-numeric: tabular-nums; }
  .row .meter { grid-column: 1 / -1; height: 4px; border-radius: 2px; background: var(--bv-line); overflow: hidden; }
  .row .meter > div { height: 100%; background: var(--bv-muted); }
  .row.low .value { color: var(--bv-error); }
  .row.low .meter > div { background: var(--bv-error); }
`;
