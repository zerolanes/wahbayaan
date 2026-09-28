/**
 * Catalogue filters as URL search params — pure so it can be unit-tested and
 * shared by /shop, /category/[slug] and /search. Every filter is a plain link
 * or GET form, so browsing works without JavaScript.
 */
import type { ProductFilters, ProductSort } from "@/lib/queries/catalog";
import { formatMoney, type BuyerCurrency, type FxQuote } from "@/lib/money/currency";
import { REGION_LABELS } from "@/lib/utils/format";

export const PAGE_SIZE = 24;

export const SORTS: { id: ProductSort; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "rating", label: "Highest rated" },
];

export type Availability = "ready_to_ship" | "made_to_order";

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  ready_to_ship: "Ready to ship",
  made_to_order: "Made to order",
};

/**
 * Price bands in the buyer's own currency (major units). USD, GBP and CAD share
 * round bands; PKR — only shown when the buyer chose it — gets rupee bands.
 */
const MAJOR_BANDS: Record<"default" | "PKR", { id: string; min?: number; max?: number }[]> = {
  default: [
    { id: "under-250", max: 250 },
    { id: "250-500", min: 250, max: 500 },
    { id: "500-1000", min: 500, max: 1000 },
    { id: "1000-2000", min: 1000, max: 2000 },
    { id: "2000-plus", min: 2000 },
  ],
  PKR: [
    { id: "under-75k", max: 75_000 },
    { id: "75k-150k", min: 75_000, max: 150_000 },
    { id: "150k-300k", min: 150_000, max: 300_000 },
    { id: "300k-600k", min: 300_000, max: 600_000 },
    { id: "600k-plus", min: 600_000 },
  ],
};

export type PriceBand = { id: string; label: string; minMinor?: number; maxMinor?: number };

export function priceBands(currency: BuyerCurrency): PriceBand[] {
  const bands = currency === "PKR" ? MAJOR_BANDS.PKR : MAJOR_BANDS.default;
  const fmt = (major: number) => formatMoney(major * 100, currency, { cents: false });
  return bands.map((b) => ({
    id: b.id,
    label: b.min == null ? `Under ${fmt(b.max!)}` : b.max == null ? `${fmt(b.min)} and above` : `${fmt(b.min)} – ${fmt(b.max)}`,
    minMinor: b.min == null ? undefined : b.min * 100,
    maxMinor: b.max == null ? undefined : b.max * 100,
  }));
}

export type ShopQuery = {
  q?: string;
  category?: string;
  region?: string;
  material?: string;
  price?: string;
  availability?: Availability;
  customizable?: boolean;
  sort: ProductSort;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export function parseShopQuery(sp: RawSearchParams): ShopQuery {
  const sort = first(sp.sort);
  const availability = first(sp.availability);
  const region = first(sp.region);
  const page = Number(first(sp.page) ?? "1");
  const price = first(sp.price);
  const allBandIds = [...MAJOR_BANDS.default, ...MAJOR_BANDS.PKR].map((b) => b.id);
  return {
    q: first(sp.q)?.slice(0, 100),
    category: first(sp.category)?.slice(0, 80),
    region: region && region in REGION_LABELS ? region : undefined,
    material: first(sp.material)?.slice(0, 80),
    price: price && allBandIds.includes(price) ? price : undefined,
    availability: availability === "ready_to_ship" || availability === "made_to_order" ? availability : undefined,
    customizable: first(sp.customizable) === "1" ? true : undefined,
    sort: SORTS.some((s) => s.id === sort) ? (sort as ProductSort) : "featured",
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
  };
}

/** Link to the same listing with some params changed. Changing any filter resets to page 1. */
export function shopHref(basePath: string, query: ShopQuery, patch: Partial<Record<keyof ShopQuery, string | number | boolean | undefined | null>> = {}) {
  const next: Record<string, string | number | boolean | undefined | null> = { ...query, ...patch };
  const filterChanged = Object.keys(patch).some((k) => k !== "page" && k !== "sort");
  if (filterChanged && !("page" in patch)) next.page = 1;
  const params = new URLSearchParams();
  const order: (keyof ShopQuery)[] = ["q", "category", "region", "material", "price", "availability", "customizable", "sort", "page"];
  for (const key of order) {
    const v = next[key];
    if (v == null || v === "" || v === false) continue;
    if (key === "sort" && v === "featured") continue;
    if (key === "page" && Number(v) <= 1) continue;
    params.set(key, key === "customizable" ? "1" : String(v));
  }
  const s = params.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export type FilterLabels = {
  categories?: { slug: string; name: string }[];
  currency: BuyerCurrency;
};

export type ActiveChip = { key: keyof ShopQuery; label: string; href: string };

/** Removable chips for every active filter (sort and page aren't filters). */
export function activeChips(basePath: string, query: ShopQuery, labels: FilterLabels): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const remove = (key: keyof ShopQuery) => shopHref(basePath, query, { [key]: undefined });
  if (query.q) chips.push({ key: "q", label: `“${query.q}”`, href: remove("q") });
  if (query.category)
    chips.push({ key: "category", label: labels.categories?.find((c) => c.slug === query.category)?.name ?? query.category, href: remove("category") });
  if (query.region) chips.push({ key: "region", label: REGION_LABELS[query.region] ?? query.region, href: remove("region") });
  if (query.material) chips.push({ key: "material", label: capitalize(query.material), href: remove("material") });
  if (query.price) {
    const band = priceBands(labels.currency).find((b) => b.id === query.price);
    if (band) chips.push({ key: "price", label: band.label, href: remove("price") });
  }
  if (query.availability) chips.push({ key: "availability", label: AVAILABILITY_LABELS[query.availability], href: remove("availability") });
  if (query.customizable) chips.push({ key: "customizable", label: "Customizable", href: remove("customizable") });
  return chips;
}

export function clearFiltersHref(basePath: string, query: ShopQuery) {
  return shopHref(basePath, { sort: query.sort, page: 1 });
}

/** Translate URL params into catalogue query filters (price band → buyer-currency minor units). */
export function toProductFilters(query: ShopQuery, ctx: { currency: BuyerCurrency; fx: FxQuote | null }): ProductFilters {
  const band = query.price ? priceBands(ctx.currency).find((b) => b.id === query.price) : undefined;
  return {
    q: query.q,
    categorySlug: query.category,
    region: query.region,
    material: query.material,
    availability: query.availability,
    customizable: query.customizable,
    sort: query.sort,
    fx: ctx.fx,
    minPrice: band?.minMinor,
    maxPrice: band?.maxMinor,
    limit: PAGE_SIZE,
    offset: (query.page - 1) * PAGE_SIZE,
  };
}

export function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
