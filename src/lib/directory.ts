/**
 * Text-only brand directory: Pakistani brands that are not on Wahbayaan. Pure.
 *
 * Each entry is a name, a category, one factual line and the brand's own
 * website — no logo, photo, products or contact details, and no claim of any
 * relationship. "Shop with Wahbayaan" pre-fills the shop-by-link form.
 *
 * The seed file (docs/outreach/pakistani-brands.csv) also holds researched
 * emails, phone numbers and notes for outreach. Only the `brand`, `category`
 * and `website` columns are ever read from it.
 */
import { parseCsv } from "@/lib/brands/adapters/csv";
import { slugify } from "@/lib/brands/adapters/normalize";

export const DIRECTORY_CATEGORIES = [
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "women_men", label: "Women & men" },
  { key: "kids", label: "Kids" },
  { key: "footwear", label: "Footwear" },
  { key: "accessories", label: "Accessories" },
  { key: "home", label: "Home" },
  { key: "other", label: "Other" },
] as const;
export type DirectoryCategory = (typeof DIRECTORY_CATEGORIES)[number]["key"];

export function categoryLabel(key: string) {
  return DIRECTORY_CATEGORIES.find((c) => c.key === key)?.label ?? "Other";
}

export function normalizeCategory(raw: string | null | undefined): DirectoryCategory {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "both" || v === "women & men" || v === "unisex") return "women_men";
  if (v === "womenswear" || v === "ladies") return "women";
  if (v === "menswear") return "men";
  if (v === "shoes") return "footwear";
  return (DIRECTORY_CATEGORIES.find((c) => c.key === v)?.key ?? "other") as DirectoryCategory;
}

const DEFAULT_LINES: Record<DirectoryCategory, string> = {
  women: "Pakistani womenswear brand.",
  men: "Pakistani menswear brand.",
  women_men: "Pakistani clothing brand for women and men.",
  kids: "Pakistani kidswear brand.",
  footwear: "Pakistani footwear brand.",
  accessories: "Pakistani accessories brand.",
  home: "Pakistani home and lifestyle brand.",
  other: "Pakistani brand.",
};

/** A neutral, factual one-liner from the category alone (admins can edit it). */
export function defaultDescription(category: DirectoryCategory) {
  return DEFAULT_LINES[category];
}

/** Only an http(s) website, normalised to https where given as http. */
export function cleanWebsite(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** The only fields a directory entry can hold. */
export type DirectorySeedEntry = { slug: string; name: string; category: DirectoryCategory; description: string; websiteUrl: string | null };

/** Parse the outreach CSV, reading ONLY brand, category and website. Every other column is dropped here. */
export function parseDirectorySeed(csvText: string): DirectorySeedEntry[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h === "brand" || h === "name");
  const catIdx = header.indexOf("category");
  const webIdx = header.findIndex((h) => h === "website" || h === "website_url");
  if (nameIdx < 0) return [];
  const seen = new Set<string>();
  const out: DirectorySeedEntry[] = [];
  for (const r of rows.slice(1)) {
    const name = (r[nameIdx] ?? "").trim().replace(/\s+/g, " ");
    const slug = slugify(name);
    if (!name || !slug || seen.has(slug)) continue;
    seen.add(slug);
    const category = normalizeCategory(catIdx >= 0 ? r[catIdx] : null);
    out.push({ slug, name: name.slice(0, 80), category, description: defaultDescription(category), websiteUrl: cleanWebsite(webIdx >= 0 ? r[webIdx] : null) });
  }
  return out;
}

export type PublicDirectoryEntry = { slug: string; name: string; category: DirectoryCategory; categoryLabel: string; description: string; websiteUrl: string | null; shopHref: string };

/** Whitelist the public fields (defence in depth: nothing else can leak through). */
export function toPublicEntry(e: { slug: string; name: string; category: string; description: string | null; websiteUrl: string | null }): PublicDirectoryEntry {
  const category = normalizeCategory(e.category);
  return {
    slug: e.slug,
    name: e.name,
    category,
    categoryLabel: categoryLabel(category),
    description: (e.description ?? "").trim() || defaultDescription(category),
    websiteUrl: cleanWebsite(e.websiteUrl),
    shopHref: shopWithWahbayaanHref(e.name),
  };
}

/** Pre-fills the shop-by-link form with the brand name. */
export function shopWithWahbayaanHref(brandName: string) {
  return `/brands/request?brand=${encodeURIComponent(brandName.slice(0, 80))}`;
}

/** Hide directory entries for brands that already have a public page on Wahbayaan. */
export function excludeListedBrands<T extends { slug: string; name: string }>(entries: T[], listed: { slug: string; name: string }[]): T[] {
  const slugs = new Set(listed.map((b) => b.slug));
  const names = new Set(listed.map((b) => slugify(b.name)));
  return entries.filter((e) => !slugs.has(e.slug) && !names.has(slugify(e.name)));
}

/** Patterns that look like contact details; the admin form refuses them in descriptions. */
export function looksLikeContactDetail(text: string | null | undefined) {
  if (!text) return false;
  return /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text) || /(\+?\d[\d\s().-]{7,}\d)/.test(text);
}
