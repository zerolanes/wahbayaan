import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { removeFromCompare } from "@/app/actions/compare";
import { BuyerPrice } from "@/components/money/buyer-price";
import { isSvg } from "@/components/store/illustration-tag";
import type { BuyerContext } from "@/lib/buyer-context";
import { computeBrandQuote } from "@/lib/brands/pricing";
import { getBrandPricingContext } from "@/lib/brands/rates";
import { sortSizes } from "@/lib/brands/catalog";
import { COMPARE_MAX, valuesDiffer } from "@/lib/compare";
import { destinationName, formatMoney, isDomestic } from "@/lib/money/currency";
import type { PublicBrandProduct } from "@/lib/queries/brands";
import { cn } from "@/lib/utils/cn";

type Row = { label: string; values: ReactNode[]; keys: (string | number | null)[] };

/**
 * Side-by-side comparison for Pakistani Brands pieces: price range across
 * variants, sizes in stock, colours, fabric and delivery. Delivery and the
 * service fee come from the same quote engine as the product page — pending
 * stays pending.
 */
export async function BrandCompareTable({ products, ctx, onlyDiff }: { products: PublicBrandProduct[]; ctx: BuyerContext; onlyDiff: boolean }) {
  const shipTo = isDomestic(ctx.destination) ? "PK" : ctx.destination;
  const pricing = ctx.fx ? await getBrandPricingContext(shipTo) : null;
  const quotes = products.map((p) =>
    pricing && ctx.fx
      ? computeBrandQuote({ ...pricing, items: [{ key: p.id, title: p.title, unitPricePkr: p.priceNowPkr, qty: 1, weightG: p.weightG ?? p.brand.defaultWeightG }], shipTo, fx: ctx.fx })
      : null,
  );
  const ranges = products.map((p) => {
    const prices = p.variants.map((v) => v.pricePkr ?? p.pricePkr).map((x) => p.priceOverridePkr ?? x);
    return { min: prices.length ? Math.min(...prices) : p.priceNowPkr, max: prices.length ? Math.max(...prices) : p.priceNowPkr };
  });
  const inStockSizes = products.map((p) => sortSizes(p.variants.filter((v) => v.available && v.stockQty !== 0 && v.size).map((v) => v.size!)));
  const line = (i: number, key: string) => quotes[i]?.lines.find((l) => l.key === key) ?? null;

  const rows: Row[] = [];
  const add = (label: string, keys: (string | number | null)[], values?: ReactNode[]) => rows.push({ label, keys, values: values ?? keys.map((k) => k ?? "—") });
  add(
    `Price (${ctx.currency})`,
    ranges.map((r) => `${r.min}-${r.max}`),
    ranges.map((r, i) => (
      <span key={i} className="font-display text-xl text-umber-900">
        <BuyerPrice pkr={r.min} />
        {r.max !== r.min ? (
          <>
            {" – "}
            <BuyerPrice pkr={r.max} />
          </>
        ) : null}
      </span>
    )),
  );
  add(
    "Brand",
    products.map((p) => p.brand.name),
    products.map((p) => (
      <Link key={p.id} href={`/brands/${p.brand.slug}`} className="font-medium text-umber-900 hover:text-terracotta-700">
        {p.brand.name}
      </Link>
    )),
  );
  add("Sizes in stock", inStockSizes.map((s) => s.join(", ") || null), inStockSizes.map((s, i) => (s.length ? s.join(", ") : <span key={i} className="text-umber-500">{products[i].inStock ? "One size" : "Sold out"}</span>)));
  add("Colours", products.map((p) => p.colours.join(", ") || null));
  add("Fabric / material", products.map((p) => p.fabric));
  add("Collection", products.map((p) => p.collection ?? p.category));
  add(
    `Delivery to ${destinationName(ctx.destination)}`,
    products.map((_, i) => {
      const l = line(i, "shipping");
      return l ? `${l.status}-${l.amount}` : null;
    }),
    products.map((_, i) => {
      const l = line(i, "shipping");
      if (!l) return "—";
      return l.status === "known" && l.amount != null ? (
        <span key={i} className="tabular-nums">{formatMoney(l.amount, ctx.currency, { cents: true })}</span>
      ) : (
        <span key={i} className="text-pending-600">Pending real rate data</span>
      );
    }),
  );
  add(
    "Service fee",
    products.map((_, i) => {
      const l = line(i, "service_fee");
      return l ? `${l.status}-${l.amount}` : null;
    }),
    products.map((_, i) => {
      const l = line(i, "service_fee");
      if (!l) return "—";
      return l.status === "known" && l.amount != null ? <span key={i} className="tabular-nums">{formatMoney(l.amount, ctx.currency, { cents: true })}</span> : <span key={i} className="text-pending-600">Pending</span>;
    }),
  );

  const shown = onlyDiff ? rows.filter((r) => valuesDiffer(r.keys)) : rows;
  return (
    <section aria-labelledby="brand-compare-h" className="mt-12">
      <h2 id="brand-compare-h" className="font-display text-3xl text-umber-900">
        Pakistani Brands
      </h2>
      <p className="mt-1 text-sm text-umber-600">
        {products.length} of {COMPARE_MAX}. Delivery and service fee for one piece, shown as separate lines at checkout.
      </p>
      <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] bg-sand-50 ring-1 ring-umber-200/60">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <caption className="sr-only">Side-by-side comparison of {products.length} brand pieces</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-40 bg-sand-50 p-4 text-left align-bottom text-xs font-semibold tracking-wider text-umber-500 uppercase md:w-48">
                Piece
              </th>
              {products.map((p) => (
                <th key={p.id} scope="col" className="min-w-52 border-l border-umber-200/60 p-4 text-left align-top font-normal">
                  <div className="relative">
                    <Link href={`/brands/${p.brand.slug}/${p.slug}`} className="group block">
                      <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-sand-200">
                        {p.images[0] ? <Image src={p.images[0].url} alt={p.images[0].alt ?? p.title} fill sizes="240px" unoptimized={isSvg(p.images[0].url) || /^https?:/.test(p.images[0].url)} className="object-cover" /> : null}
                      </span>
                      <span className="mt-3 line-clamp-2 block font-display text-lg leading-snug text-umber-900 group-hover:text-terracotta-700">{p.title}</span>
                    </Link>
                    <form action={removeFromCompare} className="absolute top-2 right-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="kind" value="brand" />
                      <button className="grid size-8 place-items-center rounded-full bg-sand-50/90 text-umber-700 shadow-soft hover:text-danger-700" aria-label={`Remove ${p.title} from comparison`}>
                        <X className="size-4" />
                      </button>
                    </form>
                  </div>
                </th>
              ))}
              {products.length < COMPARE_MAX ? (
                <th scope="col" className="hidden min-w-44 border-l border-umber-200/60 p-4 align-middle md:table-cell">
                  <Link href="/brands/shop" className="grid aspect-[4/5] place-items-center rounded-2xl border border-dashed border-umber-300 text-center text-sm font-normal text-umber-500 transition hover:border-umber-500 hover:text-umber-800">
                    <span>
                      + Add a piece
                      <span className="block text-xs">from Pakistani Brands</span>
                    </span>
                  </Link>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const differs = valuesDiffer(r.keys);
              return (
                <tr key={r.label} className={cn("border-t border-umber-200/60", differs && "bg-gold-50/70")}>
                  <th scope="row" className={cn("sticky left-0 z-10 p-4 text-left align-top text-xs font-semibold tracking-wider text-umber-500 uppercase", differs ? "bg-gold-50" : "bg-sand-50")}>
                    {r.label}
                    {differs ? <span className="mt-1 block text-[10px] font-medium tracking-normal text-gold-700 normal-case">Differs</span> : null}
                  </th>
                  {r.values.map((v, i) => (
                    <td key={i} className="border-l border-umber-200/60 p-4 align-top text-umber-800">
                      {v}
                    </td>
                  ))}
                  {products.length < COMPARE_MAX ? <td className="hidden border-l border-umber-200/60 md:table-cell" /> : null}
                </tr>
              );
            })}
            {!shown.length ? (
              <tr>
                <td colSpan={products.length + 2} className="p-8 text-center text-umber-600">
                  These pieces match on every row.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
