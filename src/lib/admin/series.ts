/** Pure helpers that shape query rows into chart series and report tables. */

export type Point = { key: string; label: string; value: number };

const DAY = 86_400_000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * One point per UTC day from `from` (inclusive) for `days` days, filling gaps
 * with zero. `rows` carry a date and a value to add to that day.
 */
export function dailySeries(rows: ReadonlyArray<{ at: Date | string; value?: number }>, from: Date, days: number): Point[] {
  const start = new Date(`${dayKey(from)}T00:00:00.000Z`).getTime();
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) buckets.set(dayKey(new Date(start + i * DAY)), 0);
  for (const r of rows) {
    const k = dayKey(typeof r.at === "string" ? new Date(r.at) : r.at);
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + (r.value ?? 1));
  }
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return [...buckets.entries()].map(([key, value]) => ({ key, label: fmt.format(new Date(`${key}T00:00:00Z`)), value }));
}

/** Group into weeks (Mon-start) when a range is long, so bars stay legible. */
export function rollup(points: Point[], size: number): Point[] {
  if (size <= 1) return points;
  const out: Point[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    out.push({ key: chunk[0].key, label: chunk[0].label, value: chunk.reduce((a, p) => a + p.value, 0) });
  }
  return out;
}

/** A "nice" axis maximum (1, 2, 2.5, 5 × 10^n) at or above `n`. */
export function niceMax(n: number): number {
  if (!(n > 0)) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) if (m * base >= n) return m * base;
  return 10 * base;
}

export function groupSum<T>(rows: readonly T[], key: (r: T) => string, value: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + value(r));
  return [...m.entries()].map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value);
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function percent(r: number | null, digits = 1): string {
  return r == null ? "—" : `${(r * 100).toFixed(digits)}%`;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function daysBetween(a: Date | string, b: Date | string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAY;
}

/** Fixed series shades by entity: monochrome to match the neutral admin theme (legends always label each part). */
export const SERIES_COLORS = ["#0a0a0a", "#525252", "#a3a3a3", "#d4d4d4"] as const;
export const CURRENCY_COLORS: Record<string, string> = { USD: SERIES_COLORS[0], GBP: SERIES_COLORS[1], CAD: SERIES_COLORS[2], PKR: SERIES_COLORS[3] };
