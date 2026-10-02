/**
 * Shopify-style `products.json` adapter.
 *
 * Many Pakistani fashion brands run storefronts that expose the generic
 * `/products.json` listing. This adapter reads that shape — but only for a brand
 * whose permission is recorded (the sync engine enforces it before calling us),
 * only where the site's robots.txt allows it, and never faster than one request
 * per second (or the site's Crawl-delay, whichever is slower).
 *
 * `parseShopifyProducts` is pure and tested against recorded fixtures in
 * `tests/fixtures/brands/`. `fetchShopifyCatalog` adds transport, robots.txt and
 * rate limiting around it; the transport is injected so tests never touch the
 * network.
 */
import { AdapterError, type BrandAudienceValue, type NormalizedProduct, type NormalizedVariant, type ParseResult } from "../types";
import { detectAudience, htmlToText, parsePkr, resolveUrl, splitTags, tagValue } from "./normalize";
import { BOT_TOKEN, crawlDelay, isAllowed, parseRobots } from "./robots";

type ShopifyOption = { name?: string; position?: number; values?: string[] };
type ShopifyVariant = {
  id?: number | string;
  title?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  sku?: string | null;
  available?: boolean;
  price?: string | number;
  compare_at_price?: string | number | null;
  grams?: number | null;
  inventory_quantity?: number | null;
  position?: number;
};
type ShopifyImage = { src?: string; alt?: string | null; position?: number };
type ShopifyProduct = {
  id?: number | string;
  title?: string;
  handle?: string;
  body_html?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  product_type?: string | null;
  tags?: string[] | string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  options?: ShopifyOption[];
};

export type ShopifyParseOptions = {
  /** Origin of the brand's storefront, for links back to the product page. */
  storefrontOrigin: string;
  /** Origin images are relative to ("" keeps root-relative paths as they are). */
  assetOrigin: string;
  defaultAudience: BrandAudienceValue;
};

function optionIndex(options: ShopifyOption[], re: RegExp) {
  const i = options.findIndex((o) => re.test(o.name ?? ""));
  return i >= 0 ? i : null;
}

function variantOption(v: ShopifyVariant, idx: number | null) {
  if (idx == null) return null;
  const value = [v.option1, v.option2, v.option3][idx];
  return value && value !== "Default Title" ? String(value).trim() : null;
}

export function parseShopifyProduct(p: ShopifyProduct, opts: ShopifyParseOptions): NormalizedProduct {
  if (p.id == null) throw new AdapterError("missing product id");
  const title = (p.title ?? "").trim();
  if (!title) throw new AdapterError("missing title");
  const handle = (p.handle ?? "").trim() || String(p.id);
  const tags = splitTags(p.tags);
  const options = p.options ?? [];

  let sizeIdx = optionIndex(options, /size/i);
  let colourIdx = optionIndex(options, /colou?r|shade/i);
  // A single option with another name ("Title", "Style"…) is still what the buyer picks:
  // treat it as the size choice (e.g. "Stitched" / "Unstitched", or "S"/"M"/"L").
  if (sizeIdx == null && colourIdx == null && options.length === 1 && (options[0].values ?? []).some((v) => v !== "Default Title")) {
    sizeIdx = 0;
  }
  if (sizeIdx != null && sizeIdx === colourIdx) colourIdx = null;

  const variants: NormalizedVariant[] = [];
  for (const v of p.variants ?? []) {
    const price = parsePkr(v.price);
    if (v.id == null || price == null) continue;
    const compare = parsePkr(v.compare_at_price);
    variants.push({
      externalId: String(v.id),
      sku: v.sku?.trim() || null,
      size: variantOption(v, sizeIdx),
      colour: variantOption(v, colourIdx),
      pricePkr: price,
      compareAtPricePkr: compare != null && compare > price ? compare : null,
      available: v.available !== false,
      stockQty: typeof v.inventory_quantity === "number" ? Math.max(0, v.inventory_quantity) : null,
      weightG: typeof v.grams === "number" && v.grams > 0 ? Math.round(v.grams) : null,
    });
  }
  if (!variants.length) throw new AdapterError("no variant with a valid price");

  const cheapest = variants.reduce((a, b) => (b.pricePkr < a.pricePkr ? b : a));
  const onSale = variants.some((v) => v.compareAtPricePkr != null);
  const weights = variants.map((v) => v.weightG).filter((w): w is number => w != null);
  const images = (p.images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => ({ url: resolveUrl(i.src, opts.assetOrigin), alt: i.alt?.trim() || null }))
    .filter((i): i is { url: string; alt: string | null } => !!i.url);
  const published = p.published_at ?? p.created_at ?? null;
  const publishedAt = published && !Number.isNaN(Date.parse(published)) ? new Date(published) : null;

  return {
    externalId: String(p.id),
    handle,
    title,
    description: htmlToText(p.body_html),
    audience: detectAudience([...tags, p.product_type ?? "", title], opts.defaultAudience),
    category: p.product_type?.trim() || null,
    collection: tagValue(tags, "collection"),
    fabric: tagValue(tags, "fabric"),
    tags: tags.filter((t) => !/^(collection|fabric)\s*[:_]/i.test(t)),
    sourceUrl: opts.storefrontOrigin ? `${opts.storefrontOrigin.replace(/\/$/, "")}/products/${encodeURIComponent(handle)}` : null,
    images,
    variants,
    pricePkr: cheapest.pricePkr,
    compareAtPricePkr: cheapest.compareAtPricePkr,
    onSale,
    weightG: weights.length ? Math.max(...weights) : null,
    publishedAt,
  };
}

/** Parse one products.json page. Bad products are reported, not fatal. */
export function parseShopifyProducts(json: unknown, opts: ShopifyParseOptions): ParseResult {
  if (!json || typeof json !== "object" || !Array.isArray((json as { products?: unknown }).products))
    throw new AdapterError("Not a products.json document (expected an object with a `products` array)");
  const result: ParseResult = { products: [], failures: [] };
  for (const p of (json as { products: ShopifyProduct[] }).products) {
    try {
      result.products.push(parseShopifyProduct(p, opts));
    } catch (e) {
      result.failures.push({ ref: String(p?.title ?? p?.handle ?? p?.id ?? "unknown product"), reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}

// ── Fetching ────────────────────────────────────────────────────────────────

export type TransportResponse = { status: number; body: string; header: (name: string) => string | null };
export type Transport = (url: string, init: { userAgent: string }) => Promise<TransportResponse>;

export type FetchOptions = ShopifyParseOptions & {
  /** e.g. https://brand.example/products.json */
  url: string;
  transport: Transport;
  sleep: (ms: number) => Promise<void>;
  rateLimitMs?: number;
  maxPages?: number;
  userAgent?: string;
  onRequest?: (url: string) => void;
};

export const MIN_DELAY_MS = 1000;
const PAGE_SIZE = 250;

export type FetchResult = ParseResult & {
  /** False when we stopped early (page cap) — products missing from the feed must not be treated as removed. */
  complete: boolean;
  pages: number;
  requests: number;
};

export async function fetchShopifyCatalog(o: FetchOptions): Promise<FetchResult> {
  let base: URL;
  try {
    base = new URL(o.url);
  } catch {
    throw new AdapterError(`Invalid source URL: ${o.url}`);
  }
  if (base.protocol !== "https:") throw new AdapterError("The source URL must use https.");
  const ua = o.userAgent ?? `${BOT_TOKEN}/1.0 (+https://wahbayaan.com/brands; personal-shopping catalogue sync with the brand's permission)`;
  let requests = 0;
  const get = async (url: string) => {
    requests++;
    o.onRequest?.(url);
    return o.transport(url, { userAgent: ua });
  };

  // 1. robots.txt — a missing file (4xx) allows everything; a server error means "try later".
  const robotsRes = await get(`${base.origin}/robots.txt`);
  if (robotsRes.status >= 500) throw new AdapterError(`robots.txt returned HTTP ${robotsRes.status} — not fetching until the site is reachable.`);
  const robots = parseRobots(robotsRes.status === 200 ? robotsRes.body : "");
  const delayMs = Math.max(MIN_DELAY_MS, o.rateLimitMs ?? 2000, (crawlDelay(robots) ?? 0) * 1000);
  const maxPages = Math.max(1, Math.min(o.maxPages ?? 10, 50));

  const result: FetchResult = { products: [], failures: [], complete: false, pages: 0, requests: 0 };
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(base.toString());
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    const path = `${url.pathname}${url.search}`;
    if (!isAllowed(robots, path)) throw new AdapterError(`robots.txt on ${base.host} disallows ${url.pathname} for automated agents — not fetching.`);
    await o.sleep(delayMs);
    const res = await get(url.toString());
    if (res.status === 429) {
      const retry = res.header("retry-after");
      throw new AdapterError(`Rate limited by ${base.host} (HTTP 429${retry ? `, retry after ${retry}s` : ""}). Stopped; try again later.`);
    }
    if (res.status !== 200) throw new AdapterError(`${base.host} returned HTTP ${res.status} for page ${page}.`);
    let json: unknown;
    try {
      json = JSON.parse(res.body);
    } catch {
      throw new AdapterError(`Page ${page} from ${base.host} is not valid JSON.`);
    }
    const parsed = parseShopifyProducts(json, o);
    result.products.push(...parsed.products);
    result.failures.push(...parsed.failures);
    result.pages = page;
    const count = (json as { products: unknown[] }).products.length;
    if (count < PAGE_SIZE) {
      result.complete = true;
      break;
    }
  }
  result.requests = requests;
  return result;
}
