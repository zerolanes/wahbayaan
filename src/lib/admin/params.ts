/**
 * URL search-param helpers for admin list pages. Every list keeps its search,
 * filters, sort and page in the URL so views can be bookmarked and shared.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export function str(params: SearchParams, key: string): string {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function oneOf<T extends string>(params: SearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = str(params, key);
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function int(params: SearchParams, key: string, fallback: number): number {
  const n = Number.parseInt(str(params, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function pageOf(params: SearchParams): number {
  return Math.max(1, int(params, "page", 1));
}

/** Build a URL from the current params with some keys replaced (null/"" removes the key). */
export function hrefWith(path: string, params: SearchParams, patch: Record<string, string | number | null | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || k in patch) continue;
    const first = Array.isArray(v) ? v[0] : v;
    if (first !== undefined && first !== "") q.set(k, first);
  }
  for (const [k, v] of Object.entries(patch)) if (v != null && v !== "") q.set(k, String(v));
  // Changing a filter always returns to the first page.
  if (!("page" in patch)) q.delete("page");
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Date range from `from`/`to` (YYYY-MM-DD, inclusive). Defaults to the last
 * `defaultDays` days. `toExclusive` is the start of the day after `to`.
 */
export function dateRange(params: SearchParams, defaultDays = 30, now = new Date()) {
  const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null);
  const today = new Date(`${isoDay(now)}T00:00:00.000Z`);
  let to = parse(str(params, "to")) ?? today;
  let from = parse(str(params, "from")) ?? new Date(to.getTime() - (defaultDays - 1) * 86_400_000);
  if (from > to) [from, to] = [to, from];
  const toExclusive = new Date(to.getTime() + 86_400_000);
  const days = Math.round((toExclusive.getTime() - from.getTime()) / 86_400_000);
  return { from, to, toExclusive, days, fromStr: isoDay(from), toStr: isoDay(to) };
}

export const PAGE_SIZE = 25;

export function pageCount(total: number, size = PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / size));
}
