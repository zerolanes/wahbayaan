import Link from "next/link";
import { and, desc, eq, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { bulkShipmentsAction, vendorOrderStatusAction } from "@/app/actions/admin/orders";
import { ActionButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { DemoBadge, Empty, FilterBar, FilterSelect, MiniStat, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { orders, vendorOrders, vendors } from "@/lib/db/schema";
import { hrefWith, int, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { DESTINATIONS, destinationName } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Shipments" };

const TABS = [
  { value: "", label: "In transit" },
  { value: "ready", label: "Ready to ship" },
  { value: "overdue", label: "Overdue" },
  { value: "delivered", label: "Delivered" },
] as const;

export default async function ShipmentsPage(props: PageProps<"/admin/shipments">) {
  const user = await requireStaff("orders.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const tab = str(params, "overdue") === "1" ? "overdue" : str(params, "tab");
  const overdueDays = Math.min(120, Math.max(3, int(params, "days", 21)));
  const cutoff = new Date(Date.now() - overdueDays * 86_400_000);
  const d = await db();
  const base: SQL[] = [];
  const q = str(params, "q");
  if (q) base.push(or(ilike(orders.number, likeTerm(q)), ilike(vendorOrders.trackingNumber, likeTerm(q)), ilike(vendors.displayName, likeTerm(q)))!);
  if (str(params, "courier")) base.push(eq(vendorOrders.courier, str(params, "courier")));
  if (str(params, "destination")) base.push(eq(orders.destinationCountry, str(params, "destination")));
  const tabCond: Record<string, SQL> = {
    "": eq(vendorOrders.status, "shipped"),
    ready: eq(vendorOrders.status, "ready_to_ship"),
    overdue: and(eq(vendorOrders.status, "shipped"), lt(vendorOrders.shippedAt, cutoff))!,
    delivered: eq(vendorOrders.status, "delivered"),
  };
  const where = and(...base, tabCond[tab] ?? tabCond[""]);
  const q2 = () => d.select().from(vendorOrders).innerJoin(orders, eq(orders.id, vendorOrders.orderId)).innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId));
  const [rows, [{ n }], couriers, counts] = await Promise.all([
    q2().where(where).orderBy(tab === "ready" ? desc(vendorOrders.updatedAt) : desc(vendorOrders.shippedAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(vendorOrders).innerJoin(orders, eq(orders.id, vendorOrders.orderId)).innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId)).where(where),
    d.selectDistinct({ c: vendorOrders.courier }).from(vendorOrders).where(sql`${vendorOrders.courier} is not null`),
    Promise.all(
      Object.entries(tabCond).map(async ([k, c]) => {
        const [{ n: m }] = await d.select({ n: sql<number>`count(*)::int` }).from(vendorOrders).innerJoin(orders, eq(orders.id, vendorOrders.orderId)).innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId)).where(and(...base, c));
        return [k, Number(m)] as const;
      }),
    ).then((e) => Object.fromEntries(e) as Record<string, number>),
  ]);
  const canManage = user.permissions.has("orders.manage");


  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Orders & money" title="Shipments" description="Every parcel leaving an artisan's workshop, with courier and tracking. Delivery triggers the buyer-protection window." />
      <div className="grid gap-4 sm:grid-cols-4">
        <MiniStat label="In transit" value={counts[""] ?? 0} href="/admin/shipments" />
        <MiniStat label="Ready to ship" value={counts.ready ?? 0} href="/admin/shipments?tab=ready" />
        <MiniStat label={`Overdue (>${overdueDays} days)`} value={counts.overdue ?? 0} tone={counts.overdue ? "danger" : undefined} href="/admin/shipments?overdue=1" />
        <MiniStat label="Delivered" value={counts.delivered ?? 0} href="/admin/shipments?tab=delivered" />
      </div>
      <Tabs items={TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/shipments", params, { tab: t.value || null, overdue: null }), active: tab === t.value, count: counts[t.value] ?? 0 }))} />
      <FilterBar action="/admin/shipments" q={q} placeholder="Order, tracking number or artisan">
        {tab && tab !== "overdue" ? <input type="hidden" name="tab" value={tab} /> : null}
        {tab === "overdue" ? <input type="hidden" name="overdue" value="1" /> : null}
        <FilterSelect name="courier" label="Courier" value={str(params, "courier")} options={couriers.filter((c) => c.c).map((c) => ({ value: c.c!, label: c.c! }))} />
        <FilterSelect name="destination" label="Destination" value={str(params, "destination")} options={DESTINATIONS.map((x) => ({ value: x.code, label: x.name }))} />
        <FilterSelect name="days" label="Overdue after" value={str(params, "days")} options={[7, 14, 21, 30, 45].map((x) => ({ value: String(x), label: `${x} days` }))} />
      </FilterBar>
      <TableCard
        toolbar={
          canManage ? (
            <>
              <p className="text-sm text-umber-600">{Number(n)} parcels</p>
              <BulkBar formId="ship-bulk" action={bulkShipmentsAction} options={[{ value: "delivered", label: "Mark delivered", confirm: "Mark the selected parcels as delivered? This starts the buyer-protection window." }]} />
            </>
          ) : undefined
        }
        footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/shipments", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-8">
                    <SelectAll formId="ship-bulk" />
                  </Th>
                ) : null}
                <Th>Order</Th>
                <Th>Artisan → destination</Th>
                <Th>Courier & tracking</Th>
                <Th>Shipped</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {rows.map(({ vendor_orders: vo, orders: o, vendors: v }) => {
                const days = vo.shippedAt ? Math.floor((Date.now() - +vo.shippedAt) / 86_400_000) : null;
                return (
                  <Tr key={vo.id}>
                    {canManage ? (
                      <Td>
                        <RowCheck formId="ship-bulk" value={vo.id} />
                      </Td>
                    ) : null}
                    <Td className="whitespace-nowrap">
                      <Link href={`/admin/orders/${o.number}`} className="font-medium text-indigo-800 hover:underline">
                        {o.number}
                      </Link>{" "}
                      <DemoBadge show={o.isDemo} />
                      <p className="text-xs text-umber-500">{o.customerName}</p>
                    </Td>
                    <Td>
                      {v.displayName}
                      <p className="text-xs text-umber-500">
                        {v.workshopCity ?? "—"} → {destinationName(o.destinationCountry)}
                      </p>
                    </Td>
                    <Td>
                      {vo.courier ?? "—"}
                      <p className="text-xs">
                        {vo.trackingUrl ? (
                          <a href={vo.trackingUrl} target="_blank" rel="noreferrer" className="text-indigo-800 underline">
                            {vo.trackingNumber}
                          </a>
                        ) : (
                          <code>{vo.trackingNumber ?? "no tracking"}</code>
                        )}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(vo.shippedAt)}
                      {days != null && vo.status === "shipped" ? (
                        <p>
                          <Badge tone={days > overdueDays ? "danger" : days > overdueDays / 2 ? "warning" : "neutral"}>{days}d in transit</Badge>
                        </p>
                      ) : vo.deliveredAt ? (
                        <p className="text-xs text-umber-500">delivered {formatDate(vo.deliveredAt)}</p>
                      ) : null}
                    </Td>
                    <Td>
                      <StatusBadge kind="vendorOrder" status={vo.status} />
                    </Td>
                    <Td>
                      {canManage && vo.status === "shipped" ? (
                        <ActionButton action={vendorOrderStatusAction} fields={{ vendorOrderId: vo.id, type: "delivered" }} confirm="Mark delivered? The buyer-protection window starts now.">
                          Mark delivered
                        </ActionButton>
                      ) : canManage && vo.status === "ready_to_ship" ? (
                        <Link href={`/admin/orders/${o.number}`} className="text-sm text-terracotta-600 hover:underline">
                          Add tracking →
                        </Link>
                      ) : null}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No parcels here.</Empty>
        )}
      </TableCard>
    </div>
  );
}
