import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowRight, Hammer, Heart, Lock, Minus, Package, Plus, ShoppingBag, Truck } from "lucide-react";
import { CouponForm, GiftForm } from "@/components/store/cart-forms";
import { DestinationPicker } from "@/components/store/destination-picker";
import { isSvg } from "@/components/store/illustration-tag";
import { DeliveryEstimateLine, LandedCostBreakdown } from "@/components/store/landed-cost";
import { ProductGrid } from "@/components/store/product-grid";
import { BuyerProtectionBox } from "@/components/store/protection";
import { ButtonLink } from "@/components/ui/button";
import { joinCostLabels } from "@/lib/commerce/order-view";
import { Breadcrumbs, Container, EmptyState, SectionHeading } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { loadCart, type CartLine } from "@/lib/commerce/cart";
import { getFxTable } from "@/lib/commerce/rates";
import { convert, formatMoney } from "@/lib/money/currency";
import { activeProvider } from "@/lib/payments";
import { getPublicProducts, getPublicVendors } from "@/lib/queries/catalog";
import { getSetting } from "@/lib/settings";
import { removeCartLine, saveLineForLater, updateCartQty } from "@/app/actions/cart";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const [ctx, cart, vendors, giftWrap, fxTable] = await Promise.all([getBuyerContext(), loadCart(), getPublicVendors(), getSetting("gift_wrap"), getFxTable()]);
  const count = cart.lines.reduce((a, l) => a + l.qty, 0);

  if (!cart.lines.length) {
    const featured = await getPublicProducts({ featured: true, limit: 4 });
    return (
      <Container className="py-12 md:py-16">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
        <h1 className="mt-6 font-display text-5xl text-umber-900 md:text-6xl">Your cart</h1>
        <EmptyState
          className="mt-10"
          icon={<ShoppingBag className="size-10" aria-hidden />}
          title="Your cart is empty"
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/shop">Browse the crafts</ButtonLink>
              <ButtonLink href="/wishlist" variant="outline">
                <Heart className="size-4" aria-hidden /> Your wishlist
              </ButtonLink>
            </div>
          }
        >
          When you add a piece you&apos;ll see its full landed cost here — item, shipping, duty and tax for your country — before you check out.
        </EmptyState>
        {featured.items.length ? (
          <section className="mt-20">
            <SectionHeading eyebrow="Featured" title="Pieces with a maker's name" />
            <ProductGrid products={featured.items} columns="four" className="mt-10" />
          </section>
        ) : null}
      </Container>
    );
  }

  const groups = new Map<string, CartLine[]>();
  for (const l of cart.lines) groups.set(l.vendorId, [...(groups.get(l.vendorId) ?? []), l]);
  const landed = cart.landed;
  const provider = activeProvider();
  const money = (n: number) => (ctx.fx ? formatMoney(n, ctx.currency, { cents: true }) : "Price on request");
  const unavailable = cart.lines.filter((l) => l.unavailableReason);
  const wrapNote =
    giftWrap.status === "active"
      ? (() => {
          const from = fxTable[giftWrap.currency];
          return from && ctx.fx ? `${formatMoney(convert(giftWrap.amount, from, ctx.fx), ctx.currency)} per order` : "Price confirmed before you're charged";
        })()
      : giftWrap.status === "pending"
        ? "Gift-wrap price pending — confirmed before you're charged"
        : "Gift wrap isn't available right now";

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl text-umber-900 md:text-6xl">Your cart</h1>
          <p className="mt-2 text-umber-600">
            {count} {count === 1 ? "piece" : "pieces"} from {groups.size} {groups.size === 1 ? "workshop" : "workshops"}
            {groups.size > 1 ? " — each ships separately from its workshop" : ""}
          </p>
        </div>
        <Link href="/shop" className="text-sm font-medium text-terracotta-600 hover:underline">
          Continue shopping
        </Link>
      </div>

      {unavailable.length ? (
        <div className="mt-6 flex gap-3 rounded-2xl bg-danger-50 px-5 py-4 text-sm text-danger-700 ring-1 ring-danger-600/20" role="alert">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            {unavailable.length === 1 ? "One piece" : `${unavailable.length} pieces`} can&apos;t be ordered as they are. Adjust or remove {unavailable.length === 1 ? "it" : "them"} to
            check out.
          </p>
        </div>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <div className="space-y-6">
          {[...groups].map(([vendorId, lines]) => {
            const v = vendors.find((x) => x.id === vendorId);
            const shipment = landed?.shipments.find((s) => s.vendorId === vendorId);
            return (
              <section key={vendorId} className="overflow-hidden rounded-[var(--radius-card)] bg-sand-50 shadow-soft ring-1 ring-umber-200/60" aria-label={`From ${lines[0].vendorName}`}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-umber-200/60 bg-sand-100/60 px-5 py-3.5">
                  <Link href={`/artisans/${lines[0].vendorSlug}`} className="group flex items-center gap-3">
                    <span className="relative size-9 overflow-hidden rounded-full bg-sand-200">
                      {v?.profilePhotoUrl ? <Image src={v.profilePhotoUrl} alt="" fill sizes="36px" unoptimized={isSvg(v.profilePhotoUrl)} className="object-cover" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-umber-900 group-hover:text-terracotta-700">From {lines[0].vendorName}</span>
                      <span className="text-xs text-umber-500">{v?.workshopCity ? `${v.workshopCity}, Pakistan` : "Pakistan"}</span>
                    </span>
                  </Link>
                  <p className="flex items-center gap-1.5 text-xs text-umber-600">
                    <Truck className="size-3.5 text-gold-600" aria-hidden />
                    {shipment?.status === "known"
                      ? `${shipment.courier}${shipment.transitDaysMax ? ` · ${shipment.transitDaysMin && shipment.transitDaysMin !== shipment.transitDaysMax ? `${shipment.transitDaysMin}–` : ""}${shipment.transitDaysMax} days in transit` : ""}`
                      : "Ships separately · courier rate pending"}
                  </p>
                </header>
                <ul className="divide-y divide-umber-200/60">
                  {lines.map((l) => (
                    <li key={l.id} className="flex gap-4 p-5 sm:gap-5">
                      <Link href={`/product/${l.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-sand-200 sm:size-32">
                        {l.imageUrl ? <Image src={l.imageUrl} alt={l.title} fill sizes="128px" unoptimized={isSvg(l.imageUrl)} className="object-cover" /> : null}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs tracking-wide text-umber-500 uppercase">{l.categoryName}</p>
                            <h2 className="mt-0.5 font-display text-lg leading-snug text-umber-900">
                              <Link href={`/product/${l.slug}`} className="hover:text-terracotta-700">
                                {l.title}
                              </Link>
                            </h2>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-umber-900 tabular-nums">{money(l.lineTotal)}</p>
                            {l.qty > 1 ? <p className="text-xs text-umber-500 tabular-nums">{money(l.unitPrice)} each</p> : null}
                          </div>
                        </div>
                        {l.customizationLabels.length ? (
                          <dl className="mt-2 space-y-0.5 rounded-lg bg-sand-100/80 px-3 py-2 text-xs">
                            {l.customizationLabels.map((c) => (
                              <div key={c.label} className="flex gap-2">
                                <dt className="text-umber-500">{c.label}:</dt>
                                <dd className="font-medium text-umber-800">{c.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-umber-600">
                          {l.availability === "made_to_order" ? (
                            <>
                              <Hammer className="size-3.5 text-indigo-600" aria-hidden /> Made to order{l.timeToMakeDays ? ` · about ${l.timeToMakeDays} days to make` : ""}
                            </>
                          ) : (
                            <>
                              <Package className="size-3.5 text-success-600" aria-hidden /> Ready to ship{l.dispatchDays ? ` · leaves within ${l.dispatchDays} days` : ""}
                            </>
                          )}
                        </p>
                        {l.unavailableReason ? (
                          <p className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger-700">
                            <AlertCircle className="size-3.5" aria-hidden /> {l.unavailableReason}
                          </p>
                        ) : null}
                        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
                          {l.maxQty > 1 ? (
                            <form action={updateCartQty} className="flex h-9 items-center rounded-full border border-umber-300/70 bg-white/70">
                              <input type="hidden" name="lineId" value={l.id} />
                              <button name="qty" value={l.qty - 1} disabled={l.qty <= 1} className="grid size-9 place-items-center rounded-full text-umber-700 hover:text-umber-900 disabled:opacity-30" aria-label={`Decrease quantity of ${l.title}`}>
                                <Minus className="size-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-label="Quantity">
                                {l.qty}
                              </span>
                              <button name="qty" value={l.qty + 1} disabled={l.qty >= l.maxQty} className="grid size-9 place-items-center rounded-full text-umber-700 hover:text-umber-900 disabled:opacity-30" aria-label={`Increase quantity of ${l.title}`}>
                                <Plus className="size-3.5" />
                              </button>
                            </form>
                          ) : (
                            <span className="text-xs text-umber-500">Qty 1{l.maxQty === 1 && l.availability === "ready_to_ship" ? " · only one exists" : ""}</span>
                          )}
                          <form action={saveLineForLater}>
                            <input type="hidden" name="lineId" value={l.id} />
                            <button className="text-sm text-umber-600 underline-offset-4 hover:text-umber-900 hover:underline">Save for later</button>
                          </form>
                          <form action={removeCartLine}>
                            <input type="hidden" name="lineId" value={l.id} />
                            <button className="text-sm text-umber-600 underline-offset-4 hover:text-danger-700 hover:underline">Remove</button>
                          </form>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <BuyerProtectionBox className="hidden lg:block" />
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-5 rounded-[var(--radius-card)] bg-sand-50/60 p-5 ring-1 ring-umber-200/60 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans text-base font-semibold tracking-normal text-umber-900">Order summary</h2>
              <DestinationPicker destination={ctx.destination} />
            </div>
            {landed ? (
              <>
                <LandedCostBreakdown landed={landed} title="Landed cost" />
                <DeliveryEstimateLine delivery={landed.delivery} />
                {!landed.complete ? (
                  <div className="rounded-2xl bg-pending-50 p-4 text-sm text-umber-800 ring-1 ring-pending-600/20">
                    <p className="font-semibold">Some costs are confirmed before you&apos;re charged</p>
                    <p className="mt-1 text-umber-700">
                      We don&apos;t have confirmed rates for {joinCostLabels(landed.pendingLines.map((l) => l.label))} yet. Place your order and our team sends you the
                      exact total to approve — nothing is charged until you do.
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-xl bg-pending-50 px-4 py-3 text-sm text-umber-800">
                {ctx.fx ? "Remove unavailable pieces to see your landed cost." : `Exchange rates aren't set yet, so we can't price your cart in ${ctx.currency}.`}
              </p>
            )}
            <CouponForm code={cart.couponCode} error={cart.couponError} />
            <GiftForm isGift={cart.isGift} giftWrap={cart.giftWrap} message={cart.giftMessage} wrapNote={wrapNote} />
            {unavailable.length || !landed ? (
              <p className="flex h-13 w-full items-center justify-center rounded-full bg-umber-200 text-sm font-medium text-umber-600">Resolve the items above to check out</p>
            ) : (
              <ButtonLink href="/checkout" variant="accent" size="lg" className="w-full">
                <Lock className="size-4" aria-hidden />
                {landed.complete ? "Checkout securely" : "Continue to checkout"}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            )}
            <p className="text-center text-xs text-umber-500">
              {provider.id === "test" ? (
                <span className="font-medium text-pending-600">Payments are in test mode — no money moves.</span>
              ) : (
                <>Charged in {ctx.currency} by card. </>
              )}{" "}
              Your payment is held until your piece arrives.
            </p>
          </div>
          <BuyerProtectionBox className="mt-5 lg:hidden" compact />
        </aside>
      </div>
    </Container>
  );
}
