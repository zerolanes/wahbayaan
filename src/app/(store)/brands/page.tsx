import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Link2, PackageCheck, Truck } from "lucide-react";
import { BrandProductCard } from "@/components/store/brands/brand-product-card";
import { BrandTile } from "@/components/store/brands/brand-tile";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState, SectionHeading } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { SHOP_BY_LINK_LINE } from "@/lib/brands/permission";
import { featureFlags } from "@/lib/features";
import { destinationName, isDomestic } from "@/lib/money/currency";
import { getPublicBrandProducts, getPublicBrands } from "@/lib/queries/brands";

export const metadata: Metadata = {
  title: "Pakistani Brands",
  description: "Fashion and lifestyle from Pakistani brands, ordered for you and delivered in Pakistan or abroad.",
};

export default async function BrandsPage() {
  const flags = await featureFlags();
  if (!flags.pakistaniBrands) notFound();
  const [ctx, brands, products] = await Promise.all([getBuyerContext(), getPublicBrands(), getPublicBrandProducts()]);
  const fresh = products.filter((p) => p.isNew).slice(0, 8);
  const domestic = isDomestic(ctx.destination);

  return (
    <div className="pb-20">
      <section className="border-b border-umber-200/60 bg-sand-50/60">
        <Container className="grid gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-gold-600 uppercase">Pakistani Brands</p>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] text-umber-900 md:text-6xl">Your favourite labels, delivered.</h1>
            <p className="mt-5 max-w-xl text-lg text-umber-600">
              Lawn, pret, formals and menswear from Pakistani brands. We order from the brand and deliver {domestic ? "across Pakistan" : `to ${destinationName(ctx.destination)} — or to family in Pakistan`}, with every cost shown before you pay.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/brands/shop?for=women" variant="primary">
                Shop women
              </ButtonLink>
              <ButtonLink href="/brands/shop?for=men" variant="outline">
                Shop men
              </ButtonLink>
            </div>
          </div>
          {flags.brandRequests ? (
            <Link href="/brands/request" className="group rounded-[var(--radius-card)] bg-indigo-950 p-6 text-sand-50 shadow-lift">
              <Link2 className="size-6 text-gold-300" aria-hidden />
              <p className="mt-4 font-display text-3xl">Shop any brand by link</p>
              <p className="mt-2 text-sand-200/80">Paste product links from any Pakistani brand&apos;s website — several brands, one box. {SHOP_BY_LINK_LINE}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-200">
                Start a request <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          ) : null}
        </Container>
      </section>

      <Container className="mt-14 space-y-16">
        <section aria-labelledby="dir-h">
          <SectionHeading eyebrow="Brand partners" title={<span id="dir-h">Shop by brand</span>} />
          {brands.length ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((b) => (
                <BrandTile key={b.id} brand={b} />
              ))}
            </div>
          ) : (
            <EmptyState className="mt-8" title="Brand collections are on their way">
              {flags.brandRequests ? (
                <>
                  Meanwhile you can <Link href="/brands/request" className="text-terracotta-600 underline">shop any brand by link</Link>.
                </>
              ) : null}
            </EmptyState>
          )}
        </section>

        {fresh.length ? (
          <section aria-labelledby="new-h">
            <SectionHeading
              eyebrow="Just in"
              title={<span id="new-h">New arrivals</span>}
              action={
                <Link href="/brands/shop?new=1" className="text-sm font-medium text-terracotta-600 hover:underline">
                  See all new
                </Link>
              }
            />
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {fresh.map((p) => (
                <BrandProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 md:grid-cols-3" aria-label="How it works">
          {[
            { icon: <PackageCheck className="size-5" />, t: "We order for you", d: "After you pay, we buy your pieces from the brand and check them at Wahbayaan." },
            { icon: <Truck className="size-5" />, t: "One box, delivered", d: "Everything ships together — within Pakistan, or abroad with import costs shown up front." },
            { icon: <ArrowRight className="size-5" />, t: "A clear service fee", d: "Our fee is its own line at checkout — never hidden in the price." },
          ].map((s) => (
            <div key={s.t} className="rounded-[var(--radius-card)] bg-sand-50 p-5 ring-1 ring-umber-200/60">
              <span className="text-gold-600">{s.icon}</span>
              <p className="mt-3 font-semibold text-umber-900">{s.t}</p>
              <p className="mt-1 text-sm text-umber-600">{s.d}</p>
            </div>
          ))}
        </section>
      </Container>
    </div>
  );
}
