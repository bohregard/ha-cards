import { css } from "lit";

/** Shared look for the feeder, fountain and litter cards (Lamplight: colour is state). */
export const petStyles = css`
  :host {
    --bp-amber: var(--warning-color, #f4b650);
    --bp-primary: var(--primary-color, #f4b650);
    --bp-active: var(--state-fan-on-color, #5fc3cf);
    --bp-ok: var(--success-color, #8cc59a);
    --bp-error: var(--error-color, #f07a5f);
    --bp-text: var(--primary-text-color, #f1ece3);
    --bp-muted: var(--secondary-text-color, #ada394);
    --bp-line: var(--divider-color, #2e2a24);
    --bp-card: var(--ha-card-background, var(--card-background-color, #1e1b17));
    --bp-radius: var(--ha-card-border-radius, 24px);
  }
  ha-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
  }
  ha-alert { display: block; }

  /* header: drawing + facts */
  .head { display: flex; gap: 14px; align-items: flex-start; }
  .art { flex: none; width: 92px; height: 112px; }
  .art svg { width: 100%; height: 100%; overflow: visible; }
  .facts { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .title { display: flex; align-items: center; gap: 8px; }
  .name { flex: 1; min-width: 0; font-size: 1.1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.95rem; }
  .status::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--bp-muted); flex: none; }
  .status[data-tone="ok"]::before { background: var(--bp-ok); }
  .status[data-tone="warn"] { color: var(--bp-amber); }
  .status[data-tone="warn"]::before { background: var(--bp-amber); }
  .status[data-tone="error"] { color: var(--bp-error); }
  .status[data-tone="error"]::before { background: var(--bp-error); }
  .status[data-tone="active"]::before { background: var(--bp-active); }
  .line { color: var(--bp-muted); font-size: 0.9rem; line-height: 1.35; }
  .line b { color: var(--bp-text); font-weight: 500; }
  .line.warn { color: var(--bp-amber); }
  .num { font-variant-numeric: tabular-nums; }

  /* sections */
  section { display: flex; flex-direction: column; gap: 6px; }
  section + section, .head + section { border-top: 1px solid var(--bp-line); padding-top: 12px; }
  h3 {
    margin: 0;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--bp-muted);
  }
  h3 .hint { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--bp-text); }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 0.8rem; color: var(--bp-muted); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }

  /* charts */
  .chart { width: 100%; height: 64px; display: block; overflow: visible; }
  .chart.tall { height: 84px; }
  .chart .line { fill: none; stroke: var(--bp-muted); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .chart .area { fill: color-mix(in srgb, var(--bp-muted) 14%, transparent); stroke: none; }
  .chart .mark { stroke: var(--bp-line); stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
  .chart .mark.warn { stroke: color-mix(in srgb, var(--bp-amber) 60%, transparent); }
  .chart .mark.error { stroke: color-mix(in srgb, var(--bp-error) 60%, transparent); }
  .chart .bar { fill: color-mix(in srgb, var(--bp-muted) 40%, transparent); }
  .chart .bar.today { fill: var(--bp-muted); }
  .chart .s0 { fill: var(--bp-muted); stroke: var(--bp-muted); }
  .chart .s1 { fill: color-mix(in srgb, var(--bp-muted) 55%, transparent); stroke: color-mix(in srgb, var(--bp-muted) 60%, transparent); }
  .chart .s2 { fill: color-mix(in srgb, var(--bp-muted) 25%, transparent); stroke: color-mix(in srgb, var(--bp-muted) 35%, transparent); }
  .chart path.s0, .chart path.s1, .chart path.s2 { fill: none; stroke-width: 2; vector-effect: non-scaling-stroke; }
  .chart path.s1 { stroke-dasharray: 6 3; }
  .chart path.s2 { stroke-dasharray: 2 3; }
  .legend .s0 { background: var(--bp-muted); }
  .legend .s1 { background: color-mix(in srgb, var(--bp-muted) 55%, transparent); }
  .legend .s2 { background: color-mix(in srgb, var(--bp-muted) 25%, transparent); outline: 1px solid color-mix(in srgb, var(--bp-muted) 40%, transparent); }
  .days { display: grid; font-size: 0.7rem; color: var(--bp-muted); text-align: center; }
  .days .today { color: var(--bp-text); font-weight: 600; }
  .empty { color: var(--bp-muted); font-size: 0.85rem; padding: 8px 0; }

  /* buttons */
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 22px;
    border: 1px solid var(--bp-line);
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
  .btn ha-icon { --mdc-icon-size: 20px; }
  .btn.primary { flex: 2; border-color: transparent; background: var(--bp-primary); color: var(--text-primary-color, #1e1b17); }
  .btn.confirm, .btn.primary.confirm { background: none; border-color: var(--bp-error); color: var(--bp-error); }
  .btn.icon { flex: 0 0 44px; padding: 0; }
  .btn[aria-pressed="true"] { border-color: var(--bp-active); background: color-mix(in srgb, var(--bp-active) 18%, transparent); }
  .btn[aria-pressed="true"] ha-icon { color: var(--bp-active); }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .gear {
    flex: none;
    width: 36px;
    height: 36px;
    margin: -6px -6px 0 0;
    border: none;
    border-radius: 18px;
    background: none;
    color: var(--bp-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .gear ha-icon { --mdc-icon-size: 22px; }

  /* stepper */
  .stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--bp-line);
    border-radius: 22px;
    min-height: 44px;
  }
  .stepper button {
    width: 40px;
    height: 42px;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .stepper button:disabled { opacity: 0.3; cursor: default; }
  .stepper span { min-width: 64px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
  .stepper.compact button { width: 34px; }
  .stepper.compact span { min-width: 24px; }

  /* settings view */
  .rows { display: flex; flex-direction: column; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; }
  .row + .row { border-top: 1px solid var(--bp-line); }
  .row .label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .row .label.short { white-space: nowrap; flex: none; }
  .row .label small { color: var(--bp-muted); font-size: 0.8rem; }
  .row .controls { display: flex; align-items: center; gap: 8px; flex: none; }
  .row input[type="time"], .row input[type="number"], .row select {
    min-height: 40px;
    padding: 0 10px;
    border-radius: 12px;
    border: 1px solid var(--bp-line);
    background: var(--bp-card);
    color: var(--bp-text);
    font: inherit;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }
  .row input[type="number"] { width: 84px; }
  .row select { max-width: 180px; }
  .toggle {
    position: relative;
    width: 48px;
    height: 28px;
    border-radius: 14px;
    border: 1px solid var(--bp-line);
    background: color-mix(in srgb, var(--bp-muted) 20%, transparent);
    cursor: pointer;
    flex: none;
  }
  .toggle::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--bp-muted);
    transition: transform 0.15s ease;
  }
  .toggle[aria-checked="true"] { background: color-mix(in srgb, var(--bp-active) 35%, transparent); border-color: var(--bp-active); }
  .toggle[aria-checked="true"]::after { transform: translateX(20px); background: var(--bp-active); }
  .toggle.confirm { border-color: var(--bp-error); }
  .note { color: var(--bp-muted); font-size: 0.8rem; }

  /* drawings */
  .art .shell { fill: color-mix(in srgb, var(--bp-text) 5%, var(--bp-card)); stroke: color-mix(in srgb, var(--bp-muted) 70%, transparent); stroke-width: 1.5; }
  .art .glass { fill: color-mix(in srgb, var(--bp-text) 4%, transparent); stroke: color-mix(in srgb, var(--bp-muted) 55%, transparent); stroke-width: 1.2; }
  .art .dark { fill: color-mix(in srgb, var(--bp-text) 14%, var(--bp-card)); stroke: none; }
  .art .detail { fill: none; stroke: color-mix(in srgb, var(--bp-muted) 45%, transparent); stroke-width: 1.2; stroke-linecap: round; }
  .art .fill { fill: color-mix(in srgb, var(--bp-muted) 45%, transparent); transition: y 0.6s ease, height 0.6s ease, width 0.6s ease; }
  .art .fill.unknown { fill: color-mix(in srgb, var(--bp-muted) 18%, transparent); }
  .art .grain { fill: color-mix(in srgb, var(--bp-card) 55%, transparent); }
  .art .tone-warn { fill: color-mix(in srgb, var(--bp-amber) 70%, transparent); }
  .art .tone-error { fill: color-mix(in srgb, var(--bp-error) 70%, transparent); }
  .art .tone-active { fill: color-mix(in srgb, var(--bp-active) 55%, transparent); }
  .art .tone-ok { fill: color-mix(in srgb, var(--bp-muted) 45%, transparent); }
  .art .lamp { fill: var(--bp-muted); }
  .art .lamp.tone-ok { fill: var(--bp-ok); }
  .art .lamp.tone-warn { fill: var(--bp-amber); }
  .art .lamp.tone-error { fill: var(--bp-error); }
  .art .lamp.tone-active { fill: var(--bp-active); }
  .art .tick { stroke: var(--bp-muted); stroke-width: 1.2; }
  .art .tick.warn { stroke: var(--bp-amber); }
  .art .tick.error { stroke: var(--bp-error); }
  .art .flow { fill: none; stroke: var(--bp-active); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 4 6; animation: flow 1.2s linear infinite; }
  @keyframes flow { to { stroke-dashoffset: -20; } }
  @media (prefers-reduced-motion: reduce) { .art .flow { animation: none; } }
`;
