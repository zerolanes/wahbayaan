import { describe, expect, it } from "vitest";
import { auditDiff, changedFields, jsonDiff, preview } from "@/lib/admin/diff";
import { FLAG_KEYS, FLAG_META } from "@/lib/admin/flags";
import { SETTING_DEFAULTS } from "@/lib/settings";

describe("jsonDiff", () => {
  it("reports changed, added and removed fields with dotted paths", () => {
    const d = jsonDiff({ a: 1, b: { c: "x", d: true }, gone: 1 }, { a: 2, b: { c: "x", d: false }, added: [1] });
    expect(d).toEqual([
      { path: "a", kind: "changed", before: 1, after: 2 },
      { path: "added", kind: "added", after: [1] },
      { path: "b.d", kind: "changed", before: true, after: false },
      { path: "gone", kind: "removed", before: 1 },
    ]);
  });
  it("compares arrays as whole values and ignores identical input", () => {
    expect(jsonDiff({ ids: ["a", "b"] }, { ids: ["a", "b"] })).toEqual([]);
    expect(jsonDiff({ ids: ["a"] }, { ids: ["a", "b"] })).toEqual([{ path: "ids", kind: "changed", before: ["a"], after: ["a", "b"] }]);
  });
  it("handles null on either side", () => {
    expect(jsonDiff(null, { a: 1 })).toEqual([{ path: "(value)", kind: "added", after: { a: 1 } }]);
    expect(jsonDiff({ status: "pending" }, { status: "pending", amount: null })).toEqual([{ path: "amount", kind: "added", after: null }]);
  });
});

describe("auditDiff", () => {
  it("diffs only payloads that carry before/after", () => {
    expect(auditDiff({ before: { x: 1 }, after: { x: 2 } })).toEqual([{ path: "x", kind: "changed", before: 1, after: 2 }]);
    expect(auditDiff({ ids: ["a"] })).toBeNull();
    expect(auditDiff(null)).toBeNull();
  });
  it("lists top-level changed fields and truncates previews", () => {
    expect(changedFields({ name: "A", seo: { t: 1 } }, { name: "B", seo: { t: 2 } })).toEqual(["name", "seo"]);
    expect(preview("x".repeat(200), 10)).toHaveLength(10);
    expect(preview(undefined)).toBe("—");
  });
});

describe("feature flag metadata", () => {
  it("describes every flag in the settings shape, and nothing else", () => {
    expect(FLAG_KEYS.sort()).toEqual(Object.keys(SETTING_DEFAULTS.feature_flags).sort());
    for (const k of FLAG_KEYS) expect(FLAG_META[k].description.length).toBeGreaterThan(20);
  });
});
