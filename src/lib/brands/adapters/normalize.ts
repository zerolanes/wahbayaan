import type { BrandAudienceValue } from "../types";

/** Helpers shared by the adapters. Pure. */

/** "3,490.00" / "3490" / 3490 → 349000 paisa. Null when not a positive amount. */
export function parsePkr(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[,\s]|Rs\.?|PKR/gi, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** Brand descriptions arrive as HTML; we store plain text only. */
export function htmlToText(html: string | null | undefined, max = 5000): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? (e.startsWith("#") ? String.fromCharCode(Number(e.slice(1))) : m))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  return text ? text.slice(0, max) : null;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/**
 * Who a product is for, from the brand's tags, type and title. Checked in this
 * order so "women" never matches the "men" rule.
 */
export function detectAudience(hints: string[], fallback: BrandAudienceValue): BrandAudienceValue {
  const text = hints.join(" ").toLowerCase();
  if (/\b(kids?|girls?|boys?|children)\b/.test(text)) return "kids";
  if (/\b(women|womens|women's|ladies|woman|female)\b/.test(text)) return "women";
  if (/\b(men|mens|men's|gents|man|male)\b/.test(text)) return "men";
  if (/\bunisex\b/.test(text)) return "unisex";
  return fallback;
}

/** `collection:Summer Lawn '26` / `fabric:Lawn` style tags. */
export function tagValue(tags: string[], key: string): string | null {
  const re = new RegExp(`^${key}\\s*[:_]\\s*(.+)$`, "i");
  for (const t of tags) {
    const m = re.exec(t.trim());
    if (m) return m[1].trim();
  }
  return null;
}

export function splitTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map(String).map((t) => t.trim()).filter(Boolean);
  if (typeof tags === "string") return tags.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

const SIZE_RE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|small|medium|large|free size|one size|\d{1,3}(\.\d)?|\d{1,2}-\d{1,2}\s*(y|yrs|years)?)$/i;

export function looksLikeSize(value: string) {
  return SIZE_RE.test(value.trim());
}

/** Resolve an image src from a feed: protocol-relative, absolute or root-relative. */
export function resolveUrl(src: unknown, origin: string): string | null {
  if (typeof src !== "string" || !src.trim()) return null;
  const s = src.trim();
  if (s.startsWith("//")) return `https:${s}`;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return origin ? `${origin.replace(/\/$/, "")}${s}` : s;
  return null;
}
