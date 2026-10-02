import type { BrandSizeGuide } from "@/lib/db/schema";

/**
 * Staff edit a brand's size chart as a small grid: the first line holds the
 * headings (the first one is the size), then one size per line; comma or tab
 * separated. Pure.
 */
export function parseSizeGuide(text: string, unit: "in" | "cm", note: string | null): { ok: true; guide: BrandSizeGuide | null } | { ok: false; error: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\t|,/).map((c) => c.trim()));
  if (!lines.length) return { ok: true, guide: null };
  const [head, ...rows] = lines;
  if (head.length < 2 || !rows.length) return { ok: false, error: "Enter a heading line (e.g. “Size, Chest, Waist”) and at least one size." };
  return { ok: true, guide: { unit, columns: head.slice(1), rows: rows.map((r) => ({ size: r[0], values: head.slice(1).map((_, i) => r[i + 1] ?? "") })), note } };
}

export function sizeGuideToText(g: BrandSizeGuide | null): string {
  if (!g) return "";
  return [["Size", ...g.columns].join(", "), ...g.rows.map((r) => [r.size, ...r.values].join(", "))].join("\n");
}
