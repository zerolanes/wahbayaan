import type { Metadata } from "next";
import { OrderCard } from "@/components/store/order-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { getBuyerOrders } from "@/lib/queries/account";

export const metadata: Metadata = { title: "Your orders", robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await getBuyerOrders(user.id, 200);
  const open = orders.filter((o) => !["completed", "cancelled", "refunded"].includes(o.status));
  const closed = orders.filter((o) => ["completed", "cancelled", "refunded"].includes(o.status));
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Your account" title="Orders" description="Every order, from the workshop to your door. Your payment is held by Wahbayaan until you confirm delivery." />
      {!orders.length ? (
        <EmptyState title="No orders yet" action={<ButtonLink href="/shop">Browse the crafts</ButtonLink>}>
          Pieces you order will appear here with their status, tracking and landed cost.
        </EmptyState>
      ) : null}
      {open.length ? (
        <section>
          <h2 className="text-xs font-semibold tracking-[0.2em] text-umber-500 uppercase">In progress ({open.length})</h2>
          <div className="mt-4 space-y-3">
            {open.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </section>
      ) : null}
      {closed.length ? (
        <section>
          <h2 className="text-xs font-semibold tracking-[0.2em] text-umber-500 uppercase">Past orders ({closed.length})</h2>
          <div className="mt-4 space-y-3">
            {closed.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
