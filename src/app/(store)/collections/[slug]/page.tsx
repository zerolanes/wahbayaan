import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Package, Truck } from "lucide-react";
import { ScallopDivider } from "@/components/brand/logo";
import { IllustrationTag, isSvg } from "@/components/store/illustration-tag";
import { ProductGrid } from "@/components/store/product-grid";
import { AddCollectionButton } from "@/components/store/wishlist-actions";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { bundleSavingFor } from "@/lib/commerce/bundles";
import { buyerUnitPrice } from "@/lib/commerce/landed-cost";
import { formatMoney } from "@/lib/money/currency";
import { getPublicCollection } from "@/lib/queries/storefront";

export async function generateMetadata(props: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = await getPublicCollection(slug);
  if (!c) return { title: "Collection not found" };
  return { title: c.title, description: c.description ?? undefined, openGraph: { images: c.coverImageUrl ? [c.coverImageUrl] : undefined } };
}

export default async function CollectionPage(props: PageProps<"/collections/[slug]">) {
  const { slug } = await props.params;
  const [collection, ctx] = await Promise.all([getPublicCollection(slug), getBuyerContext()]);
  if (!collection) notFound();
  const isBundle = collection.kind === "bundle";
  const prices = ctx.fx ? collection.products.map((p) => buyerUnitPrice(p.pricePkr, ctx.fx!)) : [];
  const combined = prices.reduce((a, b) => a + b, 0);
  const saving = bundleSavingFor(prices, collection.bundleDiscountBps);
  const workshops = new Set(collection.products.map((p) => p.vendorId)).size;
  const money = (n: number) => formatMoney(n, ctx.currency, { cents: true });

  return (
    <>
      <section className="relative isolate flex min-h-[64svh] items-end overflow-hidden bg-indigo-950">
        {collection.coverImageUrl ? <Image src={collection.coverImageUrl} alt="" fill priority sizes="100vw" unoptimized={isSvg(collection.coverImageUrl)} className="-z-10 object-cover" /> : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-indigo-950 via-indigo-950/50 to-indigo-950/10" />
        <Container className="pt-24 pb-14 md:pb-20">
          <Breadcrumbs items={[{ label: "Collections", href: "/collections" }, { label: collection.title }]} className="mb-8 text-sand-200/70 [&_a:hover]:text-sand-50 [&_span[aria-current]]:text-sand-50" />
          <p className="text-xs font-semibold tracking-[0.25em] text-gold-300 uppercase">
            {isBundle ? "Bundle" : "Collection"} · {collection.products.length} pieces · {workshops} {workshops === 1 ? "workshop" : "workshops"}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.02] text-sand-50 md:text-7xl">{collection.title}</h1>
          {collection.description ? <p className="mt-5 max-w-2xl text-xl text-sand-100/85">{collection.description}</p> : null}
        </Container>
        {isSvg(collection.coverImageUrl) ? <IllustrationTag className="absolute right-4 bottom-4" /> : null}
      </section>
      <ScallopDivider className="-mt-px" />

      {isBundle ? (
        <Container className="mt-12">
          <div className="night grid gap-8 rounded-[var(--radius-card)] p-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-center md:p-10">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">The whole set</p>
              {ctx.fx ? (
                <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="font-display text-5xl text-sand-50 tabular-nums">{money(combined - saving)}</p>
                  {saving > 0 ? (
                    <>
                      <p className="text-xl text-sand-200/50 tabular-nums line-through">{money(combined)}</p>
                      <p className="rounded-full bg-gold-400/20 px-3 py-1 text-sm font-medium text-gold-200">
                        Save {money(saving)} ({(collection.bundleDiscountBps ?? 0) / 100}%)
                      </p>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sand-200/80">Prices appear once exchange rates are set.</p>
              )}
              <p className="mt-3 text-sm text-sand-200/75">
                Item prices for all {collection.products.length} pieces{saving > 0 ? "; the bundle saving is applied in your cart once every piece is in it" : ""}. Shipping and import costs for your
                country are itemised in the cart — each workshop ships its own parcel.
              </p>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sand-100/80">
                <li className="flex items-center gap-2">
                  <Package className="size-4 text-gold-300" aria-hidden /> {collection.products.length} handmade pieces
                </li>
                <li className="flex items-center gap-2">
                  <Truck className="size-4 text-gold-300" aria-hidden /> {workshops} {workshops === 1 ? "parcel" : "parcels"}, tracked separately
                </li>
              </ul>
            </div>
            <div className="md:justify-self-end">
              <AddCollectionButton slug={collection.slug} label="Add all to cart" tone="dark" />
            </div>
          </div>
        </Container>
      ) : null}

      <Container className="py-16 md:py-20">
        <ProductGrid products={collection.products} columns={collection.products.length === 4 ? "four" : "default"} priorityCount={3} />
      </Container>
    </>
  );
}
