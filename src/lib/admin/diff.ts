/**
 * Structural diff of two JSON values, used for audit entries ("before" →
 * "after") and for summarising settings changes. Objects are compared key by
 * key; arrays and scalars are compared as whole values.
 */
export type DiffEntry = { path: string; kind: "added" | "removed" | "changed"; before?: unknown; after?: unknown };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function jsonDiff(before: unknown, after: unknown, path = ""): DiffEntry[] {
  if (isObj(before) && isObj(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((k) => {
      const p = path ? `${path}.${k}` : k;
      if (!(k in before) || before[k] === undefined) return after[k] === undefined ? [] : [{ path: p, kind: "added" as const, after: after[k] }];
      if (!(k in after) || after[k] === undefined) return [{ path: p, kind: "removed" as const, before: before[k] }];
      return jsonDiff(before[k], after[k], p);
    });
  }
  if (same(before, after)) return [];
  if (before == null && after != null) return [{ path: path || "(value)", kind: "added", after }];
  if (after == null && before != null) return [{ path: path || "(value)", kind: "removed", before }];
  return [{ path: path || "(value)", kind: "changed", before, after }];
}

/** Audit payloads that carry `{ before, after }` get a field diff; anything else is shown raw. */
export function auditDiff(data: unknown): DiffEntry[] | null {
  if (!isObj(data) || !("before" in data) || !("after" in data)) return null;
  return jsonDiff(data.before ?? null, data.after ?? null);
}

/** Short value for tables and summaries. */
export function preview(v: unknown, max = 80): string {
  if (v === undefined) return "—";
  const s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** "name, supportEmail" — the top-level fields that changed. */
export function changedFields(before: unknown, after: unknown): string[] {
  return [...new Set(jsonDiff(before, after).map((d) => d.path.split(".")[0]))];
}
