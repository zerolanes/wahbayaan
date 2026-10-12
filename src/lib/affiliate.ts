/**
 * Affiliate programmes: outbound "Shop at {Brand}" partner links. Pure.
 *
 * - Feed products (and their images) are shown only when the programme is
 *   active AND an admin recorded that the programme's terms allow displaying
 *   feed products and images (who, when, note). Otherwise nothing is public.
 * - Cards open the programme's tracking link for the product. They are never
 *   added to the Wahbayaan cart and are labelled "Partner link".
 * - Import is CSV upload or a CSV feed URL. No network-specific APIs.
 */
import { parseCsvRows } from "@/lib/brands/adapters/csv";
import { parsePkr } from "@/lib/brands/adapters/normalize";
import { AdapterError } from "@/lib/brands/types";
import type { GateResult } from "@/lib/brands/permission";

export const AFFILIATE_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "ended", label: "Ended" },
] as const;
export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number]["key"];

export const PARTNER_LINK_LABEL = "Partner link";

const URL_TOKEN = "{url}";

/** A tracking-link template must be https and contain exactly one {url} placeholder. */
export function validateTrackingTemplate(template: string | null | undefined): GateResult {
  const t = (template ?? "").trim();
  if (!t) return { ok: false, reason: "Add the tracking-link template from the programme (with {url} where the product link goes)." };
  if (t.split(URL_TOKEN).length !== 2) return { ok: false, reason: "The template must contain {url} exactly once." };
  try {
    const u = new URL(t.replace(URL_TOKEN, "x"));
    if (u.protocol !== "https:") return { ok: false, reason: "The tracking link must start with https://" };
  } catch {
    return { ok: false, reason: "The template isn't a valid link." };
  }
  return { ok: true };
}

export function isHttpsUrl(u: string | null | undefined) {
  if (!u) return false;
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

/** The outbound link for one product: the template with the encoded product URL in place of {url}. */
export function buildTrackingLink(template: string | null | undefined, productUrl: string): string | null {
  if (!validateTrackingTemplate(template).ok || !isHttpsUrl(productUrl)) return null;
  return template!.trim().replace(URL_TOKEN, encodeURIComponent(productUrl));
}

export type ProgrammeGateInput = {
  status: string;
  trackingTemplate: string | null;
  displayAllowed: boolean;
  displayAllowedAt: Date | null;
  displayAllowedById: string | null;
  displayAllowedNote: string | null;
};

export function hasDisplayPermission(p: ProgrammeGateInput) {
  return p.displayAllowed && !!p.displayAllowedAt && !!p.displayAllowedById && !!p.displayAllowedNote?.trim();
}

/** May this programme's feed products and images be shown on the storefront? */
export function affiliateDisplayGate(p: ProgrammeGateInput): GateResult {
  if (!hasDisplayPermission(p)) return { ok: false, reason: "No record that the programme's terms allow displaying feed products and images." };
  if (p.status !== "active") return { ok: false, reason: `The programme is ${p.status}.` };
  const t = validateTrackingTemplate(p.trackingTemplate);
  if (!t.ok) return t;
  return { ok: true };
}

export type AffiliateProductLike = { title: string; productUrl: string; imageUrl: string | null; isHidden: boolean };

export function isAffiliateProductDisplayable(programme: ProgrammeGateInput, p: AffiliateProductLike) {
  return affiliateDisplayGate(programme).ok && !p.isHidden && !!p.title.trim() && isHttpsUrl(p.productUrl) && isHttpsUrl(p.imageUrl);
}

// ── Feed parsing (CSV upload or CSV feed URL) ───────────────────────────────

export type FeedProduct = { externalId: string; title: string; productUrl: string; imageUrl: string | null; pricePkr: number | null; category: string | null };
export type FeedResult = { products: FeedProduct[]; errors: { line: number; message: string }[] };

const ALIASES: Record<keyof Omit<FeedProduct, "pricePkr"> | "price", string[]> = {
  externalId: ["id", "sku", "product_id", "external_id"],
  title: ["title", "name", "product_name"],
  productUrl: ["url", "link", "product_url", "product_link"],
  imageUrl: ["image", "image_url", "image_link"],
  price: ["price_pkr", "price"],
  category: ["category", "product_type"],
};

export const AFFILIATE_FEED_MAX_ROWS = 5000;

export function parseAffiliateFeed(text: string): FeedResult {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new AdapterError("The feed needs a header row and at least one product.");
  const header = rows[0].cells.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const idx = (k: keyof typeof ALIASES) => header.findIndex((h) => ALIASES[k].includes(h));
  const at = { externalId: idx("externalId"), title: idx("title"), productUrl: idx("productUrl"), imageUrl: idx("imageUrl"), price: idx("price"), category: idx("category") };
  if (at.title < 0 || at.productUrl < 0) throw new AdapterError("The feed needs at least a title (or name) column and a url (or link) column.");
  if (rows.length - 1 > AFFILIATE_FEED_MAX_ROWS) throw new AdapterError(`The feed has more than ${AFFILIATE_FEED_MAX_ROWS} products.`);
  const get = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
  const out: FeedResult = { products: [], errors: [] };
  const seen = new Set<string>();
  for (const r of rows.slice(1)) {
    const title = get(r.cells, at.title);
    const productUrl = get(r.cells, at.productUrl);
    const imageUrl = get(r.cells, at.imageUrl);
    if (!title) {
      out.errors.push({ line: r.line, message: "Missing title." });
      continue;
    }
    if (!isHttpsUrl(productUrl)) {
      out.errors.push({ line: r.line, message: "The product link must be an https:// URL." });
      continue;
    }
    const externalId = (get(r.cells, at.externalId) || productUrl).slice(0, 300);
    if (seen.has(externalId)) {
      out.errors.push({ line: r.line, message: `Duplicate product id “${externalId.slice(0, 60)}”.` });
      continue;
    }
    seen.add(externalId);
    const priceText = get(r.cells, at.price);
    out.products.push({
      externalId,
      title: title.slice(0, 200),
      productUrl,
      imageUrl: isHttpsUrl(imageUrl) ? imageUrl : null,
      pricePkr: priceText ? parsePkr(priceText) : null,
      category: get(r.cells, at.category).slice(0, 80) || null,
    });
  }
  return out;
}
