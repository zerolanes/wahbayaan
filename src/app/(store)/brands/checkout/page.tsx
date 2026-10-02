import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandCheckoutForm } from "@/components/store/brands/brand-checkout-form";
import { LandedCostBreakdown } from "@/components/store/landed-cost";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { loadBrandBag } from "@/lib/brands/bag";
import { destinationName, formatMoney } from "@/lib/money/currency";
import { paymentOptionsFor } from "@/lib/payments/options";

export const metadata: Metadata = { title: "Brand checkout", robots: { index: false } };

export default async function BrandCheckoutPage() {
  const [bag, user] = await Promise.all([loadBrandBag(), getCurrentUser()]);
  if (!bag.lines.length || !bag.quote || bag.lines.some((l) => l.unavailableReason)) redirect("/brands/bag");
  const quote = bag.quote;
  const payment = await paymentOptionsFor(quote.currency);
  const total = formatMoney(quote.knownTotal, quote.currency, { cents: true });
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: "Bag", href: "/brands/bag" }, { label: "Checkout" }]} />
      <h1 className="mt-6 font-display text-5xl text-umber-900">Checkout</h1>
      <p className="mt-2 text-umber-600">
        {bag.giftToPakistan ? "A gift delivered within Pakistan" : `Delivering to ${destinationName(bag.shipTo)}`} · paying in {quote.currency}
      </p>
      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <BrandCheckoutForm
          country={bag.shipTo}
          countryName={destinationName(bag.shipTo)}
          gift={bag.giftToPakistan}
          defaults={{ email: user?.email ?? "", name: user?.name ?? "" }}
          payment={payment}
          complete={quote.complete}
          submitLabel={quote.complete ? `Continue to pay ${total}` : "Place order — confirm costs first"}
        />
        <aside className="space-y-4">
          <ul className="space-y-2 text-sm">
            {bag.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-4">
                <span className="text-umber-800">
                  {l.qty} × {l.title} <span className="text-umber-500">· {l.brandName}{l.size ? ` · ${l.size}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
          <LandedCostBreakdown landed={quote} title="Your total" pricedBy="the brand" />
          <p className="text-xs text-umber-500">Delivery is priced from your city at the next step; if a cost is still pending we email you the confirmed total to approve first.</p>
        </aside>
      </div>
    </Container>
  );
}
