import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Columns3, X } from "lucide-react";
import { BuyerPrice } from "@/components/money/buyer-price";
import { isSvg } from "@/components/store/illustration-tag";
import { StarRating, VerifiedBadge } from "@/components/store/trust";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, EmptyState } from "@/components/ui/misc";
import { estimateForProduct } from "@/lib/commerce/cart";
import { COMPARE_MAX, valuesDiffer } from "@/lib/compare";
import { destinationName, formatMoney } from "@/lib/money/currency";
import { getBuyerContext } from "@/lib/buyer-context";
import { getCompareDetails, getCompareIds, getPublicProductsByIds } from "@/lib/queries/storefront";
import { cn } from "@/lib/utils/cn";
import { formatDims, formatWeight, regionLabel } from "@/lib/utils/format";
import { clearCompare, removeFromCompare } from "@/app/actions/compare";

export const metadata: Metadata = { title: "Compare pieces", robots: { index: false } };

type Row = { label: string; values: ReactNode[]; keys: (string | number | null)[] };

export default async function ComparePage(props: PageProps<"/compare">) {
  const sp = await props.searchParams;
  const onlyDiff = sp.diff === "1";
  const [ctx, ids] = await Promise.all([getBuyerContext(), getCompareIds()]);
  const products = await getPublicProductsByIds(ids);
  const [details, estimates] = await Promise.all([getCompareDetails(products.map((p) => p.id)), Promise.all(products.map((p) => estimateForProduct(p.id)))]);

  if (!products.length)
    return (
      <Container className="py-12 md:py-16">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Compare" }]} />
        <h1 className="mt-6 font-display text-5xl text-umber-900 md:text-6xl">Compare pieces</h1>
        <EmptyState className="mt-10" icon={<Columns3 className="size-10" aria-hidden />} title="Nothing to compare yet" action={<ButtonLink href="/shop">Browse the crafts</ButtonLink>}>
          Tap “Compare” on up to {COMPARE_MAX} pieces to see their size, materials, making time and landed cost side by side.
        </EmptyState>
      </Container>
    );

  const rows: Row[] = [];
  const add = (label: string, keys: (string | number | null)[], values?: ReactNode[]) => rows.push({ label, keys, values: values ?? keys.map((k) => k ?? "—") });

  add(
    `Price (${ctx.currency})`,
    products.map((p) => p.pricePkr),
    products.map((p) => <BuyerPrice key={p.id} pkr={p.pricePkr} className="font-display text-xl text-umber-900" />),
  );
  add(
    "Landed cost known so far",
    estimates.map((e) => (e ? `${e.knownTotal}-${e.complete}` : null)),
    estimates.map((e, i) =>
      e ? (
        <span key={i}>
          <span className="font-semibold text-umber-900 tabular-nums">{formatMoney(e.knownTotal, e.currency, { cents: true })}</span>
          {!e.complete ? <span className="block text-xs text-pending-600">+ {e.pendingLines.length} pending lines</span> : <span className="block text-xs text-success-700">Complete</span>}
        </span>
      ) : (
        "—"
      ),
    ),
  );
  add(
    "Artisan",
    products.map((p) => p.vendorName),
    products.map((p) => (
      <span key={p.id} className="flex flex-col gap-0.5">
        <Link href={`/artisans/${p.vendorSlug}`} className="font-medium text-umber-900 hover:text-terracotta-700">
          {p.vendorName}
        </Link>
        {p.vendorVerified ? <VerifiedBadge size="xs" /> : null}
      </span>
    )),
  );
  add("Craft", products.map((p) => p.categoryName));
  add("Made in", products.map((p) => regionLabel(p.region)));
  add(
    "Dimensions",
    products.map((p) => {
      const d = details.get(p.id);
      return formatDims(d?.widthCm, d?.heightCm, d?.depthCm)?.cm ?? null;
    }),
    products.map((p) => {
      const d = details.get(p.id);
      const dims = formatDims(d?.widthCm, d?.heightCm, d?.depthCm);
      return dims ? (
        <span key={p.id}>
          {dims.cm}
          <span className="block text-xs text-umber-500">{dims.inches}</span>
        </span>
      ) : (
        "—"
      );
    }),
  );
  add(
    "Weight",
    products.map((p) => details.get(p.id)?.weightG ?? null),
    products.map((p) => {
      const w = formatWeight(details.get(p.id)?.weightG);
      return w ? (
        <span key={p.id}>
          {w.metric} <span className="text-xs text-umber-500">· {w.imperial}</span>
        </span>
      ) : (
        <span key={p.id} className="text-pending-600">
          Not listed
        </span>
      );
    }),
  );
  add("Materials", products.map((p) => p.materials.join(", ") || null));
  add(
    "Availability",
    products.map((p) =>
      p.availability === "made_to_order" ? `Made to order${p.timeToMakeDays ? ` · about ${p.timeToMakeDays} days` : ""}` : `Ready to ship${details.get(p.id)?.dispatchDays ? ` · within ${details.get(p.id)?.dispatchDays} days` : ""}`,
    ),
  );
  add(
    "Rating",
    products.map((p) => (p.rating.average ? p.rating.average.toFixed(1) : null)),
    products.map((p) => <StarRating key={p.id} average={p.rating.average} count={p.rating.count} emptyLabel="No reviews yet" />),
  );
  add("One of a kind", products.map((p) => (p.isOneOfAKind ? "Yes — with certificate" : "No")));

  const shown = onlyDiff ? rows.filter((r) => valuesDiffer(r.keys)) : rows;
  const diffCount = rows.filter((r) => valuesDiffer(r.keys)).length;

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Compare" }]} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl text-umber-900 md:text-6xl">Compare pieces</h1>
          <p className="mt-2 text-umber-600">
            {products.length} of {COMPARE_MAX} · landed cost for {destinationName(ctx.destination)} in {ctx.currency}. Rows that differ are highlighted.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={onlyDiff ? "/compare" : "/compare?diff=1"}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-umber-300/70 px-4 text-sm font-medium text-umber-900 transition hover:border-umber-900"
            aria-pressed={onlyDiff}
          >
            {onlyDiff ? "Show all rows" : `Only differences (${diffCount})`}
          </Link>
          <form action={clearCompare}>
            <button className="h-10 rounded-full px-4 text-sm text-umber-600 hover:text-danger-700">Clear all</button>
          </form>
        </div>
      </div>

      <div className="mt-10 overflow-x-auto rounded-[var(--radius-card)] bg-sand-50 ring-1 ring-umber-200/60">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <caption className="sr-only">Side-by-side comparison of {products.length} pieces</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-40 bg-sand-50 p-4 text-left align-bottom text-xs font-semibold tracking-wider text-umber-500 uppercase md:w-48">
                Piece
              </th>
              {products.map((p) => (
                <th key={p.id} scope="col" className="min-w-52 border-l border-umber-200/60 p-4 text-left align-top font-normal">
                  <div className="relative">
                    <Link href={`/product/${p.slug}`} className="group block">
                      <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-sand-200">
                        <Image src={p.imageUrl} alt={p.imageAlt ?? p.title} fill sizes="240px" unoptimized={isSvg(p.imageUrl)} className="object-cover transition duration-700 group-hover:scale-105" />
                        {p.imageKind === "illustration" ? <span className="absolute right-2 bottom-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/90">Illustration</span> : null}
                      </span>
                      <span className="mt-3 line-clamp-2 block font-display text-lg leading-snug text-umber-900 group-hover:text-terracotta-700">{p.title}</span>
                    </Link>
                    <form action={removeFromCompare} className="absolute top-2 right-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <button className="grid size-8 place-items-center rounded-full bg-sand-50/90 text-umber-700 shadow-soft backdrop-blur hover:text-danger-700" aria-label={`Remove ${p.title} from comparison`}>
                        <X className="size-4" />
                      </button>
                    </form>
                  </div>
                </th>
              ))}
              {products.length < COMPARE_MAX ? (
                <th scope="col" className="hidden min-w-44 border-l border-umber-200/60 p-4 align-middle md:table-cell">
                  <Link href="/shop" className="grid aspect-[4/5] place-items-center rounded-2xl border border-dashed border-umber-300 text-center text-sm font-normal text-umber-500 transition hover:border-umber-500 hover:text-umber-800">
                    <span>
                      + Add a piece
                      <span className="block text-xs">from the shop</span>
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
      <p className="mt-4 text-xs text-umber-500">
        Landed cost shows what&apos;s known for {destinationName(ctx.destination)} today; pending lines are confirmed before you&apos;re charged. Change the destination from the header.
      </p>
    </Container>
  );
}
