import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CreditCard, FlaskConical, XCircle } from "lucide-react";
import { OrderCostSummary } from "@/components/store/order-view";
import { Container } from "@/components/ui/misc";
import { getOrderByNumber } from "@/lib/commerce/orders";
import { formatMoney, type Currency } from "@/lib/money/currency";
import { canViewOrder } from "@/lib/order-access";
import { activeProvider, testPaymentsAllowed } from "@/lib/payments";
import { SIMULATED_PROVIDERS } from "@/lib/payments/methods";
import { payOrder, simulatePaymentFailure, simulatePaymentSuccess } from "@/app/actions/checkout";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

/**
 * Built-in payment simulator, used only when no real provider is configured
 * (and never in production unless explicitly allowed). No money moves.
 */
export default async function TestPaymentPage(props: PageProps<"/checkout/test-payment">) {
  if (!testPaymentsAllowed()) notFound();
  const sp = await props.searchParams;
  const number = typeof sp.order === "string" ? sp.order : "";
  const order = number ? await getOrderByNumber(number) : null;
  if (!order || !(await canViewOrder(order))) notFound();

  const payable = order.totalComplete && ["awaiting_payment", "quote_sent"].includes(order.status) && order.paymentStatus !== "paid";
  const pending = [...order.payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).find((p) => SIMULATED_PROVIDERS.includes(p.provider) && p.status === "pending");
  if (activeProvider().id !== "test" && !pending) notFound();
  const sandboxLabel = pending?.provider === "jazzcash-sandbox" ? "JazzCash sandbox" : pending?.provider === "easypaisa-sandbox" ? "Easypaisa sandbox" : null;
  const failed = sp.failed === "1";
  const currency = order.currency as Currency;

  return (
    <div className="py-10 md:py-16">
      <Container className="max-w-2xl">
        <div className="overflow-hidden rounded-[var(--radius-card)] bg-sand-50 shadow-lift ring-1 ring-umber-200/60">
          <div className="bg-[repeating-linear-gradient(135deg,#b8893b_0_14px,#a9502e_14px_28px)] px-5 py-3 text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-black/30 px-4 py-1.5 text-sm font-semibold text-white">
              <FlaskConical className="size-4" aria-hidden /> {sandboxLabel ? `${sandboxLabel} — simulated, no money moves` : "Test payment — no money moves"}
            </p>
          </div>
          <div className="p-6 md:p-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-umber-500 uppercase">Wahbayaan test checkout</p>
            <h1 className="mt-2 font-display text-3xl text-umber-900">Order {order.number}</h1>
            <p className="mt-1 text-sm text-umber-600">
              {order.customerName} · {order.email}
            </p>
            <div className="mt-6 flex items-end justify-between gap-4 rounded-2xl bg-indigo-950 px-5 py-4 text-sand-50">
              <div>
                <p className="text-xs tracking-wider text-sand-200/70 uppercase">Amount</p>
                <p className="font-display text-4xl tabular-nums">{formatMoney(order.total, currency, { cents: true })}</p>
              </div>
              <CreditCard className="size-8 text-gold-300" aria-hidden />
            </div>

            <p className="mt-5 text-sm leading-relaxed text-umber-600">
              No payment provider is configured, so this simulator stands in for the card page. Choosing an outcome below behaves exactly like the provider&apos;s
              confirmation: a successful payment is <strong className="text-umber-900">held by Wahbayaan</strong> until the buyer confirms delivery.
            </p>

            {failed ? (
              <p className="mt-5 flex gap-2 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> Simulated decline — nothing was charged. The order is still reserved; you can try again.
              </p>
            ) : null}

            {!payable ? (
              <div className="mt-6 flex gap-2 rounded-xl bg-pending-50 px-4 py-3 text-sm text-umber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-pending-600" aria-hidden />
                <p>
                  This order isn&apos;t waiting for payment ({order.paymentStatus === "paid" ? "already paid" : "costs still being confirmed"}).{" "}
                  <Link href={`/checkout/success?order=${order.number}`} className="font-medium text-terracotta-600 hover:underline">
                    View order
                  </Link>
                </p>
              </div>
            ) : pending ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <form action={simulatePaymentSuccess}>
                  <input type="hidden" name="order" value={order.number} />
                  <button className="inline-flex h-13 w-full items-center justify-center rounded-full bg-success-600 px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-success-700">
                    Simulate successful payment
                  </button>
                </form>
                <form action={simulatePaymentFailure}>
                  <input type="hidden" name="order" value={order.number} />
                  <button className="inline-flex h-13 w-full items-center justify-center rounded-full border border-danger-600/40 px-5 text-sm font-semibold text-danger-700 transition hover:bg-danger-50">
                    Simulate failure
                  </button>
                </form>
              </div>
            ) : (
              <form action={payOrder} className="mt-6">
                <input type="hidden" name="order" value={order.number} />
                <button className="inline-flex h-13 w-full items-center justify-center rounded-full bg-indigo-900 px-5 text-sm font-semibold text-sand-50 shadow-soft transition hover:bg-indigo-800">
                  Try the payment again
                </button>
              </form>
            )}
          </div>
        </div>
        <OrderCostSummary order={order} className="mt-6" title="What this payment covers" />
      </Container>
    </div>
  );
}
