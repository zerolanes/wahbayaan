import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { createCouponAction, toggleCouponAction } from "@/app/actions/admin/coupons";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { CouponFields } from "@/components/admin/coupon-fields";
import { Empty, FilterBar, FilterSelect, MiniStat, OrderAmount, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { coupons } from "@/lib/db/schema";
import { COUPON_STATE_TONE, couponState, describeCoupon, usageShare } from "@/lib/admin/coupons";
import { str } from "@/lib/admin/params";
import { query } from "@/lib/admin/sql";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Coupons" };

export default async function CouponsPage(props: PageProps<"/admin/coupons">) {
  await requireStaff("marketing.manage");
  const params = await props.searchParams;
  const d = await db();
  const [rows, usage] = await Promise.all([
    d.select().from(coupons).orderBy(desc(coupons.createdAt)),
    query<{ code: string; currency: string; orders: number; paid: number; discount: string; gross: string }>(sql`
      select coupon_code as code, currency, count(*)::int as orders, count(*) filter (where paid_at is not null)::int as paid,
        coalesce(sum(discount_amount) filter (where paid_at is not null), 0)::bigint as discount,
        coalesce(sum(total) filter (where paid_at is not null), 0)::bigint as gross
      from orders where coupon_code is not null group by 1, 2`),
  ]);
  const now = new Date();
  const q = str(params, "q").toUpperCase();
  const state = str(params, "state");
  const list = rows
    .map((c) => ({ ...c, state: couponState(c, now), usage: usage.filter((u) => u.code === c.code) }))
    .filter((c) => (!q || c.code.includes(q) || (c.description ?? "").toUpperCase().includes(q)) && (!state || c.state === state));
  const all = rows.map((c) => couponState(c, now));
  const paidOrders = usage.reduce((a, u) => a + u.paid, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Growth"
        title="Coupons"
        description="Discount codes buyers enter at checkout. Percentage codes apply to the items subtotal; fixed codes are set in one buyer currency and converted at the live rate for the others."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Live now" value={String(all.filter((s) => s === "active").length)} hint={`${all.filter((s) => s === "scheduled").length} scheduled`} href="/admin/coupons?state=active" />
        <MiniStat label="Codes" value={String(rows.length)} hint={`${all.filter((s) => s === "disabled").length} disabled · ${all.filter((s) => s === "expired").length} expired`} />
        <MiniStat label="Redemptions" value={String(rows.reduce((a, c) => a + c.usedCount, 0))} hint="Counted when an order is placed" />
        <MiniStat label="Paid orders with a code" value={String(paidOrders)} />
      </div>

      <TableCard
        toolbar={
          <FilterBar action="/admin/coupons" q={str(params, "q")} placeholder="Code or description">
            <FilterSelect name="state" label="State" value={state} options={["active", "scheduled", "expired", "exhausted", "disabled"].map((s) => ({ value: s, label: s }))} />
          </FilterBar>
        }
      >
        {list.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th>Window</Th>
                <Th>Usage</Th>
                <Th className="text-right">Discount given (paid)</Th>
                <Th>State</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {list.map((c) => {
                const share = usageShare(c);
                return (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`/admin/coupons/${c.id}`} className="font-mono font-medium text-indigo-800 hover:underline">
                        {c.code}
                      </Link>
                      {c.description ? <p className="text-xs text-umber-500">{c.description}</p> : null}
                    </Td>
                    <Td className="text-sm">{describeCoupon(c)}</Td>
                    <Td className="text-sm whitespace-nowrap text-umber-600">
                      {c.startsAt || c.endsAt ? `${c.startsAt ? formatDate(c.startsAt) : "Now"} → ${c.endsAt ? formatDate(c.endsAt) : "no end"}` : "Always"}
                    </Td>
                    <Td className="min-w-32 text-sm">
                      <span className="tabular-nums">
                        {c.usedCount}
                        {c.maxUses ? ` / ${c.maxUses}` : ""}
                      </span>
                      {share != null ? (
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-[#f0f0f0]">
                          <div className="h-full rounded-full bg-[#404040]" style={{ width: `${Math.max(3, share * 100)}%` }} />
                        </div>
                      ) : (
                        <span className="ml-1 text-xs text-umber-400">unlimited</span>
                      )}
                    </Td>
                    <Td className="text-right text-sm whitespace-nowrap">
                      {c.usage.filter((u) => Number(u.discount) > 0).length ? (
                        c.usage
                          .filter((u) => Number(u.discount) > 0)
                          .map((u) => (
                            <div key={u.currency}>
                              <OrderAmount amount={Number(u.discount)} currency={u.currency} />
                            </div>
                          ))
                      ) : (
                        <span className="text-umber-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={COUPON_STATE_TONE[c.state]}>{c.state}</Badge>
                    </Td>
                    <Td className="text-right">
                      <ActionButton action={toggleCouponAction} fields={{ id: c.id }} variant="ghost" confirm={c.isActive ? `Disable ${c.code}? Carts using it will lose the discount.` : undefined}>
                        {c.isActive ? "Disable" : "Enable"}
                      </ActionButton>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>{rows.length ? "No coupons match." : "No coupons yet — create the first one below."}</Empty>
        )}
      </TableCard>

      <Panel title="New coupon" description="Creates the code immediately; untick “Enabled” to prepare it without going live.">
        <ActionForm action={createCouponAction} inline className="space-y-4">
          <CouponFields />
          <SubmitButton variant="primary">Create coupon</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
