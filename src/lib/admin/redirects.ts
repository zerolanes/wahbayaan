/**
 * Redirect rules for paths that no longer exist. `not-found.tsx` looks up the
 * requested path (trailing slash removed) and follows the matching rule, so
 * these helpers normalise paths the same way and catch chains and loops
 * before they are saved.
 */
export type RedirectRule = { id?: string; fromPath: string; toPath: string; permanent?: boolean };

const RESERVED = [/^\/admin(\/|$)/, /^\/api(\/|$)/, /^\/_next(\/|$)/, /^\/seller(\/|$)/, /^\/media\//];

export function isExternal(to: string) {
  return /^https?:\/\//i.test(to);
}

/** "/Old-Page/?x=1#top" → "/Old-Page"; full URLs are reduced to their path. */
export function normalizePath(input: string): string {
  let p = input.trim();
  if (isExternal(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      return p;
    }
  }
  p = p.split(/[?#]/)[0] ?? "";
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/** Normalise a destination: external URLs stay as typed, internal paths keep their query string. */
export function normalizeTarget(input: string): string {
  const t = input.trim();
  if (isExternal(t)) return t;
  const [path, ...rest] = t.split(/(?=[?#])/);
  return normalizePath(path ?? "/") + rest.join("");
}

export type Resolution = { matched: boolean; hops: RedirectRule[]; final: string; loop: boolean; tooLong: boolean };

/** Follow rules from `path` the way repeated 404 → redirect would. */
export function resolveRedirect(path: string, rules: readonly RedirectRule[], maxHops = 10): Resolution {
  const byFrom = new Map(rules.map((r) => [normalizePath(r.fromPath), r]));
  const hops: RedirectRule[] = [];
  const seen = new Set<string>();
  let current = normalizePath(path);
  while (true) {
    const rule = byFrom.get(current);
    if (!rule) break;
    if (seen.has(current)) return { matched: true, hops, final: current, loop: true, tooLong: false };
    seen.add(current);
    hops.push(rule);
    if (isExternal(rule.toPath)) return { matched: true, hops, final: rule.toPath, loop: false, tooLong: false };
    current = normalizePath(rule.toPath);
    if (hops.length > maxHops) return { matched: true, hops, final: current, loop: false, tooLong: true };
  }
  return { matched: hops.length > 0, hops, final: current, loop: false, tooLong: false };
}

/** Problems that should stop a rule from being saved. `existing` excludes the rule being edited. */
export function validateRedirect(rule: RedirectRule, existing: readonly RedirectRule[]): string | null {
  const from = normalizePath(rule.fromPath);
  const to = normalizeTarget(rule.toPath);
  if (from === "/") return "The homepage can't be redirected.";
  if (RESERVED.some((re) => re.test(from))) return "Admin, seller, API and media paths can't be redirected.";
  const raw = rule.toPath.trim();
  if (!isExternal(raw) && !raw.startsWith("/")) return "The destination must be a path starting with / or a full https:// URL.";
  if (!isExternal(to) && normalizePath(to) === from) return "A path can't redirect to itself.";
  if (existing.some((r) => normalizePath(r.fromPath) === from)) return `A redirect from ${from} already exists.`;
  const res = resolveRedirect(from, [...existing, { fromPath: from, toPath: to }]);
  if (res.loop) return `This would create a redirect loop (${[from, ...res.hops.map((h) => normalizePath(h.toPath))].join(" → ")}).`;
  return null;
}

/** Rules whose destination is itself redirected (worth collapsing into one hop). */
export function chainedRules(rules: readonly RedirectRule[]): RedirectRule[] {
  const froms = new Set(rules.map((r) => normalizePath(r.fromPath)));
  return rules.filter((r) => !isExternal(r.toPath) && froms.has(normalizePath(r.toPath)));
}
