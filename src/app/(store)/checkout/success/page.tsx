import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, CreditCard, Gift, Mail } from "lucide-react";
import { ScallopDivider } from "@/components/brand/logo";
import { isSvg } from "@/components/store/illustration-tag";
import { OrderCostSummary, OrderJourney } from "@/components/store/order-view";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrderByNumber } from "@/lib/commerce/orders";
import { destinationName, formatMoney, type Currency } from "@/lib/money/currency";
import { canViewOrder } from "@/lib/order-access";
import { payOrder } from "@/app/actions/checkout";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function CheckoutSuccessPage(props: PageProps<"/checkout/success">) {
  const sp = await props.searchParams;
  const number = typeof sp.order === "string" ? sp.order : "";
  const order = number ? await getOrderByNumber(number) : null;
  if (!order || !(await canViewOrder(order))) notFound();
  const user = await getCurrentUser();
  const currency = order.currency as Currency;
  const paid = order.paymentStatus === "paid";
  const quoting = order.status === "awaiting_quote";
  const payable = !paid && order.totalComplete && ["awaiting_payment", "quote_sent"].includes(order.status);
  const firstName = order.customerName.split(/\s+/)[0];

  const hero = paid
    ? {
        icon: CheckCircle2,
        eyebrow: "Payment received",
        title: `Thank you, ${firstName}. Your payment is held safely.`,
        text: `We've let the artisan${order.vendorOrders.length > 1 ? "s" : ""} know. Your ${formatMoney(order.total, currency, { cents: true })} stays with Wahbayaan — not the artisan — until you confirm your piece arrived as described.`,
      }
    : quoting
      ? {
          icon: Clock3,
          eyebrow: "Order placed — nothing charged yet",
          title: `Thank you, ${firstName}. We're confirming your costs.`,
          text: `Your pieces are reserved. Our team is confirming shipping and import costs for ${destinationName(order.destinationCountry)} and will email ${order.email} the exact total. You approve it before anything is charged — or cancel at no cost.`,
        }
      : {
          icon: CreditCard,
          eyebrow: "Order reserved",
          title: "Your payment isn't complete yet",
          text: "Your pieces are reserved. Finish payment to start your order — your payment is held until delivery.",
        };

  return (
    <>
      <section className="night">
        <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
          <div className="animate-fade-up">
            <hero.icon className="size-12 text-gold-300" aria-hidden />
            <p className="mt-5 text-xs font-semibold tracking-[0.25em] text-gold-300 uppercase">
              {hero.eyebrow} · {order.number}
            </p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] text-balance text-sand-50 md:text-6xl">{hero.title}</h1>
            <p className="mt-5 max-w-2xl text-lg text-sand-200/80">{hero.text}</p>
            {sp.payment === "unavailable" ? (
              <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-gold-100">We couldn&apos;t reach the payment page just now. Your order is reserved — please try again.</p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              {payable ? (
                <form action={payOrder}>
                  <input type="hidden" name="order" value={order.number} />
                  <button className="inline-flex h-13 items-center gap-2 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-7 text-base font-medium text-ink shadow-glow">
                    <CreditCard className="size-4" aria-hidden /> Pay {formatMoney(order.total, currency, { cents: true })}
                  </button>
                </form>
              ) : null}
              {user && order.userId === user.id ? (
                <ButtonLink href={`/account/orders/${order.number}`} variant={payable ? "light" : "gold"} size="lg">
                  Track this order
                </ButtonLink>
              ) : (
                <ButtonLink href={`/register?next=${encodeURIComponent("/account")}`} variant="light" size="lg">
                  Create an account for next time
                </ButtonLink>
              )}
              <ButtonLink href="/shop" variant="light" size="lg">
                Keep browsing
              </ButtonLink>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-sand-200/60">
              <Mail className="size-4" aria-hidden /> A copy is on its way to {order.email}. Keep your order number, {order.number}, for any questions.
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] bg-white/[0.04] p-6 ring-1 ring-white/10 md:p-8">
            <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">What happens next</p>
            <OrderJourney status={order.status} dark />
          </div>
        </Container>
      </section>
      <ScallopDivider />

      <Container className="grid gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <h2 className="font-display text-3xl text-umber-900">Your pieces</h2>
          <ul className="mt-6 divide-y divide-umber-200/60 rounded-[var(--radius-card)] bg-sand-50 ring-1 ring-umber-200/60">
            {order.items.map((i) => {
              const vo = order.vendorOrders.find((v) => v.id === i.vendorOrderId);
              return (
                <li key={i.id} className="flex items-center gap-4 p-5">
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                    {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="80px" unoptimized={isSvg(i.imageUrl)} className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg text-umber-900">{i.title}</span>
                    <span className="block text-sm text-umber-500">
                      By {vo?.vendor.displayName} · qty {i.qty}
                      {Object.values(i.customization).length ? ` · ${Object.values(i.customization).join(", ")}` : ""}
                    </span>
                  </span>
                  <span className="font-medium text-umber-900 tabular-nums">{formatMoney(i.unitPrice * i.qty, currency, { cents: true })}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
              <p className="text-xs font-semibold tracking-wider text-umber-500 uppercase">Delivering to</p>
              <p className="mt-2 text-sm text-umber-800">
                {order.shippingAddress.fullName}
                <br />
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
                <br />
                {order.shippingAddress.city} {order.shippingAddress.region ?? ""} {order.shippingAddress.postalCode ?? ""}
                <br />
                {destinationName(order.shippingAddress.country)}
              </p>
            </div>
            {order.isGift ? (
              <div className="rounded-2xl bg-terracotta-50/70 p-5 ring-1 ring-terracotta-200/70">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-terracotta-700 uppercase">
                  <Gift className="size-4" aria-hidden /> Gift
                </p>
                <p className="mt-2 text-sm text-umber-800">{order.giftMessage ? `“${order.giftMessage}”` : "No message"}</p>
                <p className="mt-1 text-xs text-umber-500">{order.giftWrap ? "Gift wrapped · " : ""}Prices are left off the packing slip.</p>
              </div>
            ) : null}
          </div>
        </div>
        <aside>
          <OrderCostSummary order={order} title={paid ? "Paid — held until delivery" : "Landed cost"} />
          <p className="mt-4 text-sm text-umber-600">
            Questions? <Link href="/contact" className="text-terracotta-600 hover:underline">Contact us</Link> with your order number, or read{" "}
            <Link href="/how-importing-works" className="text-terracotta-600 hover:underline">how importing works</Link>.
          </p>
        </aside>
      </Container>
    </>
  );
}
