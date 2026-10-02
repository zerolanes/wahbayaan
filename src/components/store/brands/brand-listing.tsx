import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { filterListing, sortSizes, type ListingFilters } from "@/lib/brands/catalog";
import { convertToPkr } from "@/lib/money/currency";
import type { PublicBrandProduct } from "@/lib/queries/brands";
import { cn } from "@/lib/utils/cn";
import { BrandProductCard } from "./brand-product-card";

type Params = Record<string, string | string[] | undefined>;
const str = (p: Params, k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");

const selectClass =
  "h-10 rounded-full border border-umber-200 bg-white/90 pr-8 pl-3.5 text-sm text-umber-900 focus:border-gold-500 focus:outline-none";

/** Filterable grid of brand products: women / men, category, size, price, new arrivals, sale. State lives in the URL. */
export async function BrandListing({ products, params, action, showAudience = true }: { products: PublicBrandProduct[]; params: Params; action: string; showAudience?: boolean }) {
  const ctx = await getBuyerContext();
  const toPkr = (v: string) => {
    const n = Number(v);
    if (!v || !Number.isFinite(n) || n < 0 || !ctx.fx) return null;
    return convertToPkr(Math.round(n * 100), ctx.fx);
  };
  const sort = str(params, "sort");
  const filters: ListingFilters = {
    audience: str(params, "for") || undefined,
    category: str(params, "category") || undefined,
    collection: str(params, "collection") || undefined,
    size: str(params, "size") || undefined,
    minPkr: toPkr(str(params, "min")),
    maxPkr: toPkr(str(params, "max")),
    sale: str(params, "sale") === "1",
    newOnly: str(params, "new") === "1",
    sort: (["new", "price_asc", "price_desc", "name"] as const).find((s) => s === sort) ?? "new",
  };
  const list = filterListing(products, filters);
  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort();
  const collections = [...new Set(products.map((p) => p.collection).filter((c): c is string => !!c))].sort();
  const sizes = sortSizes(products.flatMap((p) => p.sizes));
  const audiences = [...new Set(products.map((p) => p.audience))];
  const active = Object.entries(params).some(([k, v]) => k !== "sort" && v);

  return (
    <div className="space-y-8">
      {collections.length ? (
        <nav aria-label="Collections" className="flex flex-wrap gap-2">
          {collections.map((c) => (
            <Link
              key={c}
              href={`${action}?collection=${encodeURIComponent(c)}`}
              className={cn("rounded-full px-3.5 py-1.5 text-sm ring-1 transition", filters.collection === c ? "bg-indigo-900 text-sand-50 ring-indigo-900" : "text-umber-700 ring-umber-200 hover:ring-umber-400")}
            >
              {c}
            </Link>
          ))}
        </nav>
      ) : null}

      <form method="get" action={action} className="flex flex-wrap items-center gap-2 rounded-2xl bg-sand-50/70 p-3 ring-1 ring-umber-200/60">
        <SlidersHorizontal className="ml-1 size-4 text-umber-500" aria-hidden />
        {filters.collection ? <input type="hidden" name="collection" value={filters.collection} /> : null}
        {showAudience && audiences.length > 1 ? (
          <select name="for" defaultValue={filters.audience ?? ""} aria-label="For" className={selectClass}>
            <option value="">Women &amp; men</option>
            {audiences.includes("women") ? <option value="women">Women</option> : null}
            {audiences.includes("men") ? <option value="men">Men</option> : null}
            {audiences.includes("kids") ? <option value="kids">Kids</option> : null}
          </select>
        ) : null}
        {categories.length > 1 ? (
          <select name="category" defaultValue={filters.category ?? ""} aria-label="Category" className={selectClass}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
        {sizes.length ? (
          <select name="size" defaultValue={filters.size ?? ""} aria-label="Size" className={selectClass}>
            <option value="">Any size</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex items-center gap-1.5 text-sm text-umber-700">
          <span className="sr-only">Minimum price</span>
          <input name="min" defaultValue={str(params, "min")} inputMode="decimal" placeholder={`Min ${ctx.currency}`} className={cn(selectClass, "w-28 pr-3")} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-umber-700">
          <span className="sr-only">Maximum price</span>
          <input name="max" defaultValue={str(params, "max")} inputMode="decimal" placeholder={`Max ${ctx.currency}`} className={cn(selectClass, "w-28 pr-3")} />
        </label>
        <label className="flex items-center gap-1.5 px-1 text-sm text-umber-800">
          <input type="checkbox" name="new" value="1" defaultChecked={filters.newOnly} className="size-4 accent-indigo-800" /> New arrivals
        </label>
        <label className="flex items-center gap-1.5 px-1 text-sm text-umber-800">
          <input type="checkbox" name="sale" value="1" defaultChecked={filters.sale} className="size-4 accent-indigo-800" /> Sale
        </label>
        <select name="sort" defaultValue={filters.sort} aria-label="Sort" className={selectClass}>
          <option value="new">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name">Name</option>
        </select>
        <button className="h-10 rounded-full bg-indigo-900 px-4 text-sm font-medium text-sand-50">Apply</button>
        {active ? (
          <Link href={action} className="px-2 text-sm text-terracotta-600 hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      <p className="text-sm text-umber-500">
        {list.length} {list.length === 1 ? "piece" : "pieces"}
      </p>
      {list.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
          {list.map((p, i) => (
            <BrandProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing matches those filters">Try another size or clear the filters.</EmptyState>
      )}
    </div>
  );
}
