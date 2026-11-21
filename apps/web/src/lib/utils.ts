/** Small shared helpers for the web app (no dependencies). */

let counter = 0;

/** Short unique id for client-side objects (indicators, drawings, alerts, toasts). */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.floor(
    Math.random() * 0x10000,
  ).toString(16)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Format a percentage change with an explicit sign, e.g. "+1.23%". */
export function formatPct(changePct: number): string {
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}
