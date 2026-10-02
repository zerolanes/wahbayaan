import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { CheckoutForm } from "@/components/store/checkout-form";
import { CheckoutSteps } from "@/components/store/checkout-steps";
import { isSvg } from "@/components/store/illustration-tag";
import { DeliveryEstimateLine, LandedCostBreakdown } from "@/components/store/landed-cost";
import { BuyerProtectionBox } from "@/components/store/protection";
import { joinCostLabels } from "@/lib/commerce/order-view";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { loadCart, type CartView } from "@/lib/commerce/cart";
import { destinationName, formatMoney } from "@/lib/money/currency";
import { activeProvider } from "@/lib/payments";
import { getAddresses } from "@/lib/queries/account";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

function Summary({ cart }: { cart: CartView }) {
  const landed = cart.landed!;
  return (
    <div className="space-y-5">
      <ul className="space-y-4">
        {cart.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-4">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-sand-200">
              {l.imageUrl ? <Image src={l.imageUrl} alt="" fill sizes="64px" unoptimized={isSvg(l.imageUrl)} className="object-cover" /> : null}
              {l.qty > 1 ? <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-indigo-900 text-[10px] font-semibold text-sand-50">{l.qty}</span> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-umber-900">{l.title}</span>
              <span className="block text-xs text-umber-600">
                {l.vendorName}
                {l.customizationLabels.length ? ` · ${l.customizationLabels.map((c) => c.value).join(", ")}` : ""}
              </span>
            </span>
            <span className="text-sm font-medium text-umber-900 tabular-nums">{formatMoney(l.lineTotal, landed.currency, { cents: true })}</span>
          </li>
        ))}
      </ul>
      <LandedCostBreakdown landed={landed} title="Landed cost" />
      <DeliveryEstimateLine delivery={landed.delivery} />
      {!landed.complete ? (
        <div className="flex gap-3 rounded-[var(--radius-card)] bg-pending-50 p-4 text-sm text-umber-800 ring-1 ring-pending-600/20">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-pending-600" aria-hidden />
          <div>
            <p className="font-semibold">What happens next</p>
            <p className="mt-1 text-umber-700">
              Your pieces are reserved when you place the order. Our team confirms the {joinCostLabels(landed.pendingLines.map((l) => l.label))} for{" "}
              {destinationName(landed.destination)} and emails you the exact total. You approve and pay only then — or cancel at no cost.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default async function CheckoutPage() {
  const [ctx, cart, user] = await Promise.all([getBuyerContext(), loadCart(), getCurrentUser()]);
  if (!cart.lines.length || !cart.landed || cart.lines.some((l) => l.unavailableReason)) redirect("/cart");
  const landed = cart.landed;
  const addresses = user ? await getAddresses(user.id) : [];
  const provider = activeProvider();
  const total = formatMoney(landed.knownTotal, landed.currency, { cents: true });

  return (
    <Container className="pt-6 pb-12 md:py-12">
      <CheckoutSteps current="details" />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl tracking-[-0.035em] text-umber-900 md:text-6xl">Checkout</h1>
        <p className="flex items-center gap-2 text-sm text-umber-700">
          <ShieldCheck className="size-4 text-success-600" aria-hidden /> Payment held until delivery · verified artisans
        </p>
      </div>

      <details className="group mt-6 rounded-[var(--radius-panel)] bg-white shadow-[0_0_0_0.5px_rgb(34_26_19/0.1)] lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between rounded-[var(--radius-panel)] px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold text-umber-900">
            Order summary <span className="font-normal text-umber-700 group-open:hidden">· show</span>
          </span>
          <span className="font-display text-xl tracking-[-0.02em] text-umber-900 tabular-nums">
            {total}
            {!landed.complete ? <span className="text-umber-600"> +</span> : null}
          </span>
        </summary>
        <div className="border-t border-umber-900/[0.07] p-5">
          <Summary cart={cart} />
        </div>
      </details>

      <div className="mt-6 grid gap-10 lg:mt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <CheckoutForm
          destination={ctx.destination}
          destinationName={destinationName(ctx.destination)}
          signedIn={!!user}
          defaults={{ email: user?.email ?? "", name: user?.name ?? "" }}
          addresses={addresses}
          isGift={cart.isGift}
          giftMessage={cart.giftMessage}
          submitLabel={landed.complete ? `Pay ${total} securely` : "Place order — confirm costs first"}
          providerLabel={provider.label}
          testMode={provider.id === "test"}
          complete={landed.complete}
        />
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5 rounded-[var(--radius-panel)] bg-sand-50 p-6 shadow-[0_0_0_0.5px_rgb(34_26_19/0.1)]">
            <h2 className="font-sans text-base font-semibold tracking-normal text-umber-900">Your order</h2>
            <Summary cart={cart} />
          </div>
          <BuyerProtectionBox className="mt-5" compact />
        </aside>
      </div>
    </Container>
  );
}
