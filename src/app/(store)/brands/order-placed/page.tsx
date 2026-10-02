import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { BrandOrderItems } from "@/components/store/brands/brand-order-items";
import { OrderCostSummary } from "@/components/store/order-view";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { getOrderByNumber } from "@/lib/commerce/orders";
import { canViewOrder } from "@/lib/order-access";

export const metadata: Metadata = { title: "Order received", robots: { index: false } };

export default async function BrandOrderPlacedPage(props: PageProps<"/brands/order-placed">) {
  const sp = await props.searchParams;
  const number = typeof sp.order === "string" ? sp.order : "";
  const order = number ? await getOrderByNumber(number) : null;
  if (!order || order.kind !== "brand" || !(await canViewOrder(order))) notFound();
  const isRequest = order.brandFlow === "link_request";
  return (
    <Container className="max-w-3xl py-12 md:py-16">
      <CheckCircle2 className="size-10 text-success-600" aria-hidden />
      <h1 className="mt-4 font-display text-4xl text-umber-900">{isRequest ? "Request received" : "Order received"}</h1>
      <p className="mt-2 text-umber-600">
        {order.number} · we&apos;ve emailed {order.email}
      </p>
      {sp.payment === "unavailable" ? <p className="mt-4 rounded-xl bg-pending-50 px-4 py-3 text-sm text-umber-800">Payment couldn&apos;t start just now — you can pay from your order page.</p> : null}
      {!order.totalComplete ? (
        <div className="mt-6 flex gap-3 rounded-2xl bg-pending-50 p-4 text-sm text-umber-800 ring-1 ring-pending-600/20">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-pending-600" aria-hidden />
          <p>
            {isRequest
              ? "Our team checks each item and its price with the brand, then emails you a quote. You approve and pay only then — or cancel at no cost."
              : "Our team is confirming the costs still marked pending and will email you the exact total. You approve and pay only then — or cancel at no cost."}
          </p>
        </div>
      ) : null}
      <div className="mt-8 space-y-6">
        <BrandOrderItems items={order.brandItems} currency={order.currency} />
        {order.totalComplete || !isRequest ? <OrderCostSummary order={order} title="Your total" /> : null}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        {order.userId ? <ButtonLink href={`/account/orders/${order.number}`}>View order</ButtonLink> : <ButtonLink href={`/track/${order.number}`}>Track this order</ButtonLink>}
        <Link href="/brands" className="self-center text-sm text-terracotta-600 hover:underline">
          Back to Pakistani Brands
        </Link>
      </div>
    </Container>
  );
}
