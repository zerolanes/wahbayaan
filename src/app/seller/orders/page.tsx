import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { SellerPrice } from "@/components/money/seller-price";
import { FUNDS_LABEL, VendorOrderBadge } from "@/components/seller/status";
import { Card, EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { requireSeller } from "@/lib/auth/session";
import { listSellerOrders, type SellerOrderFilter } from "@/lib/seller/queries";
import { destinationName } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Orders" };

const FILTERS: { key: SellerOrderFilter; label: string }[] = [
  { key: "action", label: "Needs action" },
  { key: "in_progress", label: "In progress" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "all", label: "All" },
];

export default async function SellerOrders(props: PageProps<"/seller/orders">) {
  const user = await requireSeller();
  const sp = await props.searchParams;
  const filter = (FILTERS.find((f) => f.key === sp.status)?.key ?? "action") as SellerOrderFilter;
  const orders = await listSellerOrders(user.vendorId, filter);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workshop"
        title="Orders"
        description="Every parcel you send, from acceptance to delivery. Amounts are what the buyer paid for your pieces, in rupees."
      />
      <Tabs items={FILTERS.map((f) => ({ label: f.label, href: `/seller/orders?status=${f.key}`, active: f.key === filter }))} />
      {orders.length ? (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Pieces</Th>
                <Th>Ship to</Th>
                <Th>Payment</Th>
                <Th className="text-right">Your pieces</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {orders.map((o) => (
                <Tr key={o.vo.id}>
                  <Td>
                    <Link href={`/seller/orders/${o.vo.id}`} className="text-umber-900 hover:text-terracotta-700 font-medium">
                      {o.number}
                    </Link>
                    <p className="text-umber-500 text-xs">{formatDate(o.createdAt)}</p>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {o.items.slice(0, 3).map((i) =>
                          i.imageUrl ? (
                            <span key={i.id} className="ring-sand-50 relative size-9 overflow-hidden rounded-lg ring-2">
                              <Image src={i.imageUrl} alt="" fill sizes="36px" unoptimized={i.imageUrl.endsWith(".svg")} className="object-cover" />
                            </span>
                          ) : null,
                        )}
                      </div>
                      <span className="line-clamp-2 max-w-xs text-sm">{o.items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.title}` : i.title)).join(", ")}</span>
                    </div>
                  </Td>
                  <Td>
                    {destinationName(o.destination)}
                    {o.isGift ? <p className="text-gold-700 text-xs">Gift</p> : null}
                  </Td>
                  <Td className="text-umber-600 text-xs">{FUNDS_LABEL[o.fundsState] ?? o.fundsState}</Td>
                  <Td className="text-right">
                    <SellerPrice pkr={o.vo.subtotalPkr} className="font-medium" />
                  </Td>
                  <Td>
                    <VendorOrderBadge status={o.vo.status} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <EmptyState icon={<Package className="size-8" />} title="No orders here yet">
          When a buyer pays for one of your pieces, the order appears under “Needs action” for you to accept.
        </EmptyState>
      )}
    </div>
  );
}
