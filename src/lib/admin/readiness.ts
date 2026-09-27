/**
 * Launch-readiness scoring (pure). The data is gathered in readiness-data.ts;
 * this module decides what counts as pass / warn / fail and the overall score.
 */
export type CheckStatus = "pass" | "warn" | "fail";

export type ReadinessItem = {
  id: string;
  group: string;
  title: string;
  status: CheckStatus;
  count: number;
  /** One line explaining the result. */
  detail: string;
  href: string;
  fixLabel?: string;
  /** Up to a handful of offending rows. */
  examples?: { label: string; href?: string; reasons?: string[] }[];
};

export function statusFromCount(count: number, whenFound: Exclude<CheckStatus, "pass">): CheckStatus {
  return count > 0 ? whenFound : "pass";
}

const WEIGHT: Record<CheckStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

export function scoreReadiness(items: ReadonlyArray<Pick<ReadinessItem, "status">>) {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const i of items) counts[i.status]++;
  const score = items.length ? Math.round((items.reduce((a, i) => a + WEIGHT[i.status], 0) / items.length) * 100) : 0;
  const verdict = counts.fail === 0 && counts.warn === 0 ? "ready" : counts.fail === 0 ? "almost" : "not_ready";
  return { score, ...counts, total: items.length, verdict } as const;
}

export function groupItems<T extends { group: string }>(items: readonly T[]) {
  const map = new Map<string, T[]>();
  for (const i of items) map.set(i.group, [...(map.get(i.group) ?? []), i]);
  return [...map.entries()].map(([group, list]) => ({ group, items: list }));
}

/** Copy that must not ship: lorem ipsum, TODO/TBD markers, "coming soon", dummy text. */
const PLACEHOLDER_SCAN: { re: RegExp; label: string }[] = [
  { re: /lorem ipsum|dolor sit amet/i, label: "lorem ipsum" },
  { re: /\b(TODO|TBD|FIXME)\b/, label: "TODO / TBD marker" },
  { re: /coming soon/i, label: "“coming soon”" },
  { re: /\bplaceholder\b/i, label: "“placeholder”" },
  { re: /\b(dummy|sample) (text|copy|description)\b/i, label: "dummy/sample text" },
  { re: /wah\s*bayaan marketplace/i, label: "template banner text" },
  { re: /\[(insert|your) [^\]]+\]/i, label: "[insert …] template slot" },
];

export function scanPlaceholderCopy(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const p of PLACEHOLDER_SCAN) if (p.re.test(t)) found.add(p.label);
  }
  return [...found];
}

/** Policy pages still marked as drafts or waiting on a business decision. */
export function policyDraftMarkers(body: string): string[] {
  const out: string[] = [];
  if (/\bdraft\b/i.test(body)) out.push("Draft");
  if (/\bpending\b/i.test(body)) out.push("Pending");
  if (/legal review/i.test(body)) out.push("Awaiting legal review");
  return out;
}
