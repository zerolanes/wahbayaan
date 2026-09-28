import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { deleteCouponAction, toggleCouponAction, updateCouponAction } from "@/app/actions/admin/coupons";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { CouponFields } from "@/components/admin/coupon-fields";
import { AuditTrail } from "@/components/admin/notes-panel";
import { DetailGrid, KV, OrderAmount, Panel } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { coupons, orders } from "@/lib/db/schema";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/orders";
import { COUPON_STATE_TONE, couponState, describeCoupon } from "@/lib/admin/coupons";
import { sumByCurrency } from "@/lib/admin/money";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Coupon" };

export default async function CouponDetail(props: PageProps<"/admin/coupons/[id]">) {
  await requireStaff("marketing.manage");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const c = await d.query.coupons.findFirst({ where: eq(coupons.id, id) });
  if (!c) notFound();
  const used = await d.select().from(orders).where(eq(orders.couponCode, c.code)).orderBy(desc(orders.createdAt)).limit(200);
  const paid = used.filter((o) => o.paidAt);
  const state = couponState(c);
  const discount = sumByCurrency(paid, (o) => o.currency, (o) => o.discountAmount);
  const gross = sumByCurrency(paid, (o) => o.currency, (o) => o.total);
  const discountPkr = paid.reduce((a, o) => a + Math.round(o.discountAmount * Number(o.fxPkrPerUnit)), 0);

  const main = (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Performance" description="Paid orders only; PKR at each order's recorded rate.">
          <KV
            items={[
              ["Orders placed with the code", String(used.length)],
              ["Paid orders", String(paid.length)],
              ["Discount given", discount.length ? <span key="d" className="flex flex-col items-end">{discount.map((x) => <OrderAmount key={x.currency} amount={x.total} currency={x.currency} />)}</span> : "—"],
              ["Discount (PKR)", <SellerPrice key="p" pkr={discountPkr} />],
              ["Revenue on those orders", gross.length ? <span key="g" className="flex flex-col items-end">{gross.map((x) => <OrderAmount key={x.currency} amount={x.total} currency={x.currency} />)}</span> : "—"],
            ]}
          />
        </Panel>
        <Panel title="Rules">
          <KV
            items={[
              ["Discount", describeCoupon(c)],
              ["Starts", c.startsAt ? formatDateTime(c.startsAt) : "Immediately"],
              ["Ends", c.endsAt ? formatDateTime(c.endsAt) : "No end date"],
              ["Uses", `${c.usedCount}${c.maxUses ? ` of ${c.maxUses}` : " (unlimited)"}`],
              ["Created", formatDate(c.createdAt)],
            ]}
          />
        </Panel>
      </div>
      <Panel title="Edit coupon">
        <ActionForm action={updateCouponAction} inline className="space-y-4">
          <input type="hidden" name="id" value={c.id} />
          <CouponFields c={c} />
          <SubmitButton variant="primary">Save</SubmitButton>
        </ActionForm>
      </Panel>
      <Panel title={`Orders using ${c.code}`} bodyClassName="p-0">
        {used.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Placed</Th>
                <Th>Customer</Th>
                <Th className="text-right">Discount</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {used.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <Link href={`/admin/orders/${o.number}`} className="font-medium text-indigo-800 hover:underline">
                      {o.number}
                    </Link>
                  </Td>
                  <Td className="text-sm text-umber-600">{formatDate(o.createdAt)}</Td>
                  <Td className="text-sm">{o.customerName}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <OrderAmount amount={o.discountAmount} currency={o.currency} />
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <OrderAmount amount={o.total} currency={o.currency} />
                  </Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONE[o.status] ?? "neutral"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="px-5 py-6 text-sm text-umber-500">Not used on any order yet.</p>
        )}
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="State">
        <div className="flex items-center justify-between gap-3">
          <Badge tone={COUPON_STATE_TONE[state]}>{state}</Badge>
          <ActionButton action={toggleCouponAction} fields={{ id: c.id }} confirm={c.isActive ? `Disable ${c.code}?` : undefined}>
            {c.isActive ? "Disable" : "Enable"}
          </ActionButton>
        </div>
      </Panel>
      {c.usedCount === 0 && used.length === 0 ? (
        <Panel title="Danger zone">
          <ActionButton action={deleteCouponAction} fields={{ id: c.id }} variant="danger" confirm={`Delete ${c.code}? It has never been used.`}>
            Delete coupon
          </ActionButton>
        </Panel>
      ) : null}
      <AuditTrail entity="coupon" entityId={c.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Coupons", href: "/admin/coupons" }, { label: c.code }]} />
      <PageHeader title={<span className="font-mono">{c.code}</span>} description={c.description ?? describeCoupon(c)} />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
