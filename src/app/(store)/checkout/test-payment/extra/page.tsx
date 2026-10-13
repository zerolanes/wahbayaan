import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { FlaskConical } from "lucide-react";
import { simulateExtraShippingPaid } from "@/app/actions/fulfilment";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { fulfilmentQuotes } from "@/lib/db/schema";
import { formatMoney, type Currency } from "@/lib/money/currency";
import { activeProvider, testPaymentsAllowed } from "@/lib/payments";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

/** Simulator for an approved extra-shipping charge (only when no payment provider is configured). */
export default async function ExtraTestPaymentPage(props: PageProps<"/checkout/test-payment/extra">) {
  if (!testPaymentsAllowed() || activeProvider().id !== "test") notFound();
  const { quote } = await props.searchParams;
  const user = await getCurrentUser();
  if (!user || typeof quote !== "string" || !/^[0-9a-f-]{36}$/.test(quote)) notFound();
  const d = await db();
  const q = await d.query.fulfilmentQuotes.findFirst({ where: eq(fulfilmentQuotes.id, quote), with: { order: true } });
  if (!q || q.order.userId !== user.id) notFound();
  return (
    <div className="py-10 md:py-16">
      <Container className="max-w-xl">
        <div className="overflow-hidden rounded-[var(--radius-card)] bg-sand-50 shadow-lift ring-1 ring-umber-200/60">
          <div className="bg-[repeating-linear-gradient(135deg,#b8893b_0_14px,#a9502e_14px_28px)] px-5 py-3 text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-black/30 px-4 py-1.5 text-sm font-semibold text-white">
              <FlaskConical className="size-4" aria-hidden /> Test payment — no money moves
            </p>
          </div>
          <div className="space-y-5 p-6 md:p-8">
            <h1 className="font-display text-3xl text-umber-900">Extra shipping for {q.order.number}</h1>
            <p className="font-display text-4xl text-umber-900 tabular-nums">{formatMoney(q.amount, q.currency as Currency, { cents: true })}</p>
            {q.status === "approved" ? (
              <form action={simulateExtraShippingPaid}>
                <input type="hidden" name="quoteId" value={q.id} />
                <button className="inline-flex h-12 items-center rounded-full bg-umber-900 px-6 text-sm font-semibold text-sand-50">Simulate successful payment</button>
              </form>
            ) : (
              <p className="text-sm text-umber-700">This charge isn&apos;t waiting for payment.</p>
            )}
            <Link href={`/account/orders/${q.order.number}`} className="text-sm text-terracotta-600 hover:underline">
              Back to the order
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
