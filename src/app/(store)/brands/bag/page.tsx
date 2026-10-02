import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { BagQty, ShipToChoice } from "@/components/store/brands/bag-controls";
import { isSvg } from "@/components/store/illustration-tag";
import { LandedCostBreakdown } from "@/components/store/landed-cost";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, EmptyState } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { loadBrandBag } from "@/lib/brands/bag";
import { destinationName, formatMoney } from "@/lib/money/currency";

export const metadata: Metadata = { title: "Brand bag", robots: { index: false } };

export default async function BrandBagPage() {
  const [ctx, bag] = await Promise.all([getBuyerContext(), loadBrandBag()]);
  const quote = bag.quote;
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: "Bag" }]} />
      <h1 className="mt-6 font-display text-5xl text-umber-900">Your brand bag</h1>
      {!bag.lines.length ? (
        <EmptyState className="mt-10" icon={<ShoppingBag className="size-8" />} title="Your bag is empty" action={<ButtonLink href="/brands">Browse brands</ButtonLink>}>
          Pieces from Pakistani brands collect here — separate from handmade pieces in your main cart.
        </EmptyState>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="space-y-8">
            <ul className="divide-y divide-umber-200/60 rounded-[var(--radius-card)] bg-sand-50 ring-1 ring-umber-200/60">
              {bag.lines.map((l) => (
                <li key={l.id} className="flex gap-4 p-4">
                  <Link href={`/brands/${l.brandSlug}/${l.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                    {l.imageUrl ? <Image src={l.imageUrl} alt="" fill sizes="96px" unoptimized={isSvg(l.imageUrl) || /^https?:/.test(l.imageUrl)} className="object-cover" /> : null}
                  </Link>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs tracking-wide text-umber-500 uppercase">{l.brandName}</p>
                    <Link href={`/brands/${l.brandSlug}/${l.slug}`} className="block font-medium text-umber-900 hover:text-terracotta-700">
                      {l.title}
                    </Link>
                    <p className="text-sm text-umber-600">{[l.size && `Size ${l.size}`, l.colour].filter(Boolean).join(" · ")}</p>
                    {l.unavailableReason ? <p className="text-sm text-danger-700">{l.unavailableReason}</p> : null}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <BagQty itemId={l.id} qty={l.qty} />
                      {l.lineTotal != null ? <span className="font-medium text-umber-900 tabular-nums">{formatMoney(l.lineTotal, ctx.currency, { cents: true })}</span> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <section aria-labelledby="where-h" className="space-y-3">
              <h2 id="where-h" className="font-display text-2xl text-umber-900">
                Where should we deliver?
              </h2>
              {bag.canChooseShipTo ? (
                <ShipToChoice homeName={destinationName(ctx.destination)} value={bag.giftToPakistan ? "PK" : "home"} />
              ) : (
                <p className="text-sm text-umber-600">Delivered within Pakistan. Shopping from abroad? Change the destination at the top of the page.</p>
              )}
            </section>
          </div>
          <aside className="space-y-5">
            {quote ? <LandedCostBreakdown landed={quote} title="Your total" pricedBy="the brand" /> : <p className="text-sm text-umber-500">Prices can&apos;t be shown in your currency yet.</p>}
            <ButtonLink href="/brands/checkout" variant="accent" size="lg" className="w-full" aria-disabled={bag.lines.some((l) => l.unavailableReason)}>
              Checkout
            </ButtonLink>
            <p className="text-xs text-umber-500">We order from the brand after you pay and pack everything into one box. Pending lines are confirmed before you&apos;re charged.</p>
          </aside>
        </div>
      )}
    </Container>
  );
}
