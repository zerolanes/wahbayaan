/**
 * Pure helpers for presenting brand products: the price Wahbayaan charges for
 * the item (staff override or the brand's price — the service fee is always a
 * separate line), sale state, "new arrival" and listing filters.
 */
export type PriceSource = { pricePkr: number; compareAtPricePkr: number | null; priceOverridePkr: number | null };
export type VariantPriceSource = { pricePkr: number | null; compareAtPricePkr: number | null };

export function itemPricePkr(p: PriceSource, v?: VariantPriceSource | null): number {
  return p.priceOverridePkr ?? v?.pricePkr ?? p.pricePkr;
}

/** The brand's original price, only when it is above what we charge. */
export function wasPricePkr(p: PriceSource, v?: VariantPriceSource | null): number | null {
  const now = itemPricePkr(p, v);
  const was = v?.compareAtPricePkr ?? p.compareAtPricePkr;
  return was != null && was > now ? was : null;
}

export const NEW_ARRIVAL_DAYS = 30;

export function isNewArrival(publishedAt: Date | null, now = new Date()) {
  return !!publishedAt && now.getTime() - publishedAt.getTime() <= NEW_ARRIVAL_DAYS * 86_400_000;
}

export type ListingProduct = {
  audience: string;
  category: string | null;
  collection: string | null;
  priceNowPkr: number;
  onSale: boolean;
  isNew: boolean;
  sizes: string[];
  publishedAt: Date | null;
  title: string;
};

export type ListingFilters = {
  audience?: string;
  category?: string;
  collection?: string;
  size?: string;
  minPkr?: number | null;
  maxPkr?: number | null;
  sale?: boolean;
  newOnly?: boolean;
  sort?: "new" | "price_asc" | "price_desc" | "name";
};

export function filterListing<T extends ListingProduct>(rows: T[], f: ListingFilters): T[] {
  const out = rows.filter(
    (p) =>
      (!f.audience || p.audience === f.audience) &&
      (!f.category || p.category === f.category) &&
      (!f.collection || p.collection === f.collection) &&
      (!f.size || p.sizes.includes(f.size)) &&
      (f.minPkr == null || p.priceNowPkr >= f.minPkr) &&
      (f.maxPkr == null || p.priceNowPkr <= f.maxPkr) &&
      (!f.sale || p.onSale) &&
      (!f.newOnly || p.isNew),
  );
  const sort = f.sort ?? "new";
  return out.sort((a, b) =>
    sort === "price_asc"
      ? a.priceNowPkr - b.priceNowPkr
      : sort === "price_desc"
        ? b.priceNowPkr - a.priceNowPkr
        : sort === "name"
          ? a.title.localeCompare(b.title)
          : (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL"];

export function sortSizes(sizes: string[]) {
  return [...new Set(sizes)].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia >= 0 && ib >= 0) return ia - ib;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  });
}
