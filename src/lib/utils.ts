export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function round(n: number, places = 2) {
  const p = Math.pow(10, places);
  return Math.round(n * p) / p;
}

export function fmtCurrency(n: number) {
  return `$${round(n, 2).toFixed(2)}/kWh`;
}

export function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

export function fmtSignedPct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function timeAgo(atMs: number, nowMs: number) {
  const s = Math.max(0, Math.floor((nowMs - atMs) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export const ACTIVITY_PRIORITY: Record<string, number> = {
  scout: 0,
  ethics: 0,
  grid: 1,
  migration: 2,
  purchase: 3,
  market: 4,
};
