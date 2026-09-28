import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { adjustLoyaltyAction, setRedemptionStatusAction } from "@/app/actions/admin/referrals";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { Empty, ExportLink, MiniStat, Panel, PendingBadge, TableCard } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { loyaltyLedger, users } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { query } from "@/lib/admin/sql";
import { formatDate, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Referrals & loyalty" };

export default async function ReferralsPage() {
  await requireStaff("marketing.manage");
  const d = await db();
  const [settings, top, redemptions, [totals], balances, ledger] = await Promise.all([
    getSettings(["referral", "loyalty"]),
    query<{ code: string; user_id: string; name: string; email: string; uses: number; orders: number; paid: number; pkr: string; awarded: number }>(sql`
      select rc.code, rc.user_id, u.name, u.email, rc.uses,
        (select count(*)::int from orders o where o.referral_code = rc.code) as orders,
        (select count(*)::int from orders o where o.referral_code = rc.code and o.paid_at is not null) as paid,
        (select coalesce(sum(round(o.total * o.fx_pkr_per_unit)), 0)::bigint from orders o where o.referral_code = rc.code and o.paid_at is not null and o.status <> 'refunded') as pkr,
        (select count(*)::int from referral_redemptions r where r.code = rc.code and r.status = 'awarded') as awarded
      from referral_codes rc join users u on u.id = rc.user_id
      order by paid desc, rc.uses desc limit 25`),
    query<{ id: string; code: string; status: string; created_at: Date; referrer: string | null; referrer_id: string | null; referred: string | null; referred_id: string | null; order_number: string | null }>(sql`
      select r.id, r.code, r.status, r.created_at, a.name as referrer, a.id as referrer_id, b.name as referred, b.id as referred_id, o.number as order_number
      from referral_redemptions r
      left join users a on a.id = r.referrer_user_id
      left join users b on b.id = r.referred_user_id
      left join orders o on o.id = r.order_id
      order by (r.status = 'pending') desc, r.created_at desc limit 50`),
    query<{ codes: number; visits: number; orders: number; paid: number; pending: number; awarded: number; issued: number; spent: number; balance: number }>(sql`
      select
        (select count(*)::int from referral_codes) as codes,
        (select coalesce(sum(uses), 0)::int from referral_codes) as visits,
        (select count(*)::int from orders where referral_code is not null) as orders,
        (select count(*)::int from orders where referral_code is not null and paid_at is not null) as paid,
        (select count(*)::int from referral_redemptions where status = 'pending') as pending,
        (select count(*)::int from referral_redemptions where status = 'awarded') as awarded,
        (select coalesce(sum(points) filter (where points > 0), 0)::int from loyalty_ledger) as issued,
        (select coalesce(-sum(points) filter (where points < 0), 0)::int from loyalty_ledger) as spent,
        (select coalesce(sum(points), 0)::int from loyalty_ledger) as balance`),
    query<{ user_id: string; name: string; email: string; balance: number; last: Date }>(sql`
      select l.user_id, u.name, u.email, sum(l.points)::int as balance, max(l.created_at) as last
      from loyalty_ledger l join users u on u.id = l.user_id group by l.user_id, u.name, u.email having sum(l.points) <> 0 order by balance desc limit 10`),
    d
      .select({ l: loyaltyLedger, name: users.name })
      .from(loyaltyLedger)
      .innerJoin(users, eq(users.id, loyaltyLedger.userId))
      .orderBy(desc(loyaltyLedger.createdAt))
      .limit(30),
  ]);
  const ref = settings.referral;
  const loy = settings.loyalty;
  const pointValue = loy.status === "active" && loy.pointValueMinor > 0 ? loy.pointValueMinor : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Growth"
        title="Referrals & loyalty"
        description="Referral links, the rewards they earn and every loyalty point movement. Manual adjustments are recorded in the audit log with their reason."
        actions={<ExportLink href="/admin/export/loyalty">Export ledger</ExportLink>}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-card)] border border-umber-200 bg-white px-4 py-3 text-sm">
          <span className="font-medium text-umber-900">Referral programme</span>
          {ref.status === "active" ? (
            <span className="text-umber-700">
              Referrer {ref.referrerPoints} pts · new buyer {ref.refereePoints} pts
            </span>
          ) : ref.status === "disabled" ? (
            <Badge>Disabled</Badge>
          ) : (
            <PendingBadge>Reward pending — set in Settings</PendingBadge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-card)] border border-umber-200 bg-white px-4 py-3 text-sm">
          <span className="font-medium text-umber-900">Loyalty</span>
          {loy.status === "active" ? (
            <span className="text-umber-700">
              {loy.pointsPerUnit} pts per unit spent · 1 pt worth {loy.pointValueMinor} minor units
            </span>
          ) : loy.status === "disabled" ? (
            <Badge>Disabled</Badge>
          ) : (
            <PendingBadge>Earn &amp; point value pending — set in Settings</PendingBadge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Referral codes" value={String(totals.codes)} />
        <MiniStat label="Link visits" value={String(totals.visits)} />
        <MiniStat label="Referred orders" value={String(totals.orders)} hint={`${totals.paid} paid`} />
        <MiniStat label="Rewards to review" value={String(totals.pending)} tone={totals.pending ? "pending" : undefined} hint={`${totals.awarded} awarded`} />
        <MiniStat label="Points issued · spent" value={`${totals.issued.toLocaleString("en-US")} · ${totals.spent.toLocaleString("en-US")}`} />
        <MiniStat label="Points outstanding" value={totals.balance.toLocaleString("en-US")} hint={pointValue ? "Unredeemed liability" : "Point value pending"} />
      </div>

      <TableCard toolbar={<p className="text-sm font-medium text-umber-900">Top referrers</p>}>
        {top.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Referrer</Th>
                <Th>Code</Th>
                <Th className="text-right">Visits</Th>
                <Th className="text-right">Orders · paid</Th>
                <Th className="text-right">Conversion</Th>
                <Th className="text-right">Referred revenue (PKR)</Th>
                <Th className="text-right">Rewards</Th>
              </tr>
            </THead>
            <TBody>
              {top.map((r) => (
                <Tr key={r.code}>
                  <Td>
                    <Link href={`/admin/customers/${r.user_id}`} className="font-medium text-umber-900 hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-xs text-umber-500">{r.email}</p>
                  </Td>
                  <Td>
                    <code className="text-sm">{r.code}</code>
                  </Td>
                  <Td className="text-right tabular-nums">{r.uses}</Td>
                  <Td className="text-right tabular-nums">
                    {r.orders} · {r.paid}
                  </Td>
                  <Td className="text-right tabular-nums">{r.uses ? `${Math.round((r.paid / r.uses) * 100)}%` : "—"}</Td>
                  <Td className="text-right">
                    <SellerPrice pkr={Number(r.pkr)} />
                  </Td>
                  <Td className="text-right tabular-nums">{r.awarded}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No referral codes yet. Buyers get one from Account → Refer a friend.</Empty>
        )}
      </TableCard>

      <TableCard toolbar={<p className="text-sm font-medium text-umber-900">Referral rewards</p>}>
        {redemptions.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Code</Th>
                <Th>Referrer → new buyer</Th>
                <Th>Order</Th>
                <Th>When</Th>
                <Th>Status</Th>
                <Th className="text-right">Review</Th>
              </tr>
            </THead>
            <TBody>
              {redemptions.map((r) => (
                <Tr key={r.id}>
                  <Td className="whitespace-nowrap">
                    <code className="text-sm">{r.code}</code>
                  </Td>
                  <Td className="text-sm">
                    {r.referrer_id ? <Link href={`/admin/customers/${r.referrer_id}`} className="hover:underline">{r.referrer}</Link> : "Deleted account"} →{" "}
                    {r.referred_id ? <Link href={`/admin/customers/${r.referred_id}`} className="hover:underline">{r.referred}</Link> : "—"}
                  </Td>
                  <Td className="text-sm whitespace-nowrap">{r.order_number ? <Link href={`/admin/orders/${r.order_number}`} className="text-indigo-800 hover:underline">{r.order_number}</Link> : "—"}</Td>
                  <Td className="text-sm whitespace-nowrap text-umber-600">{formatDate(r.created_at)}</Td>
                  <Td>
                    <Badge tone={r.status === "awarded" ? "success" : r.status === "void" ? "neutral" : "pending"}>{r.status}</Badge>
                  </Td>
                  <Td className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <ActionForm action={setRedemptionStatusAction} className="flex gap-1.5">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value="awarded" />
                          <div className="w-24">
                            <TextInput name="points" placeholder={ref.status === "active" ? String(ref.referrerPoints) : "Points"} inputMode="numeric" aria-label="Points to award" className="h-8" />
                          </div>
                          <SubmitButton>Award</SubmitButton>
                        </ActionForm>
                        <ActionButton action={setRedemptionStatusAction} fields={{ id: r.id, status: "void" }} variant="ghost" confirm="Void this referral reward?">
                          Void
                        </ActionButton>
                      </div>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No referral rewards yet.</Empty>
        )}
      </TableCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <TableCard toolbar={<p className="text-sm font-medium text-umber-900">Loyalty ledger · latest 30</p>}>
          {ledger.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Reason</Th>
                  <Th>When</Th>
                  <Th className="text-right">Points</Th>
                </tr>
              </THead>
              <TBody>
                {ledger.map(({ l, name }) => (
                  <Tr key={l.id}>
                    <Td className="text-sm">
                      <Link href={`/admin/customers/${l.userId}`} className="hover:underline">
                        {name}
                      </Link>
                    </Td>
                    <Td className="text-sm text-umber-700">{l.reason}</Td>
                    <Td className="text-sm text-umber-500">{timeAgo(l.createdAt)}</Td>
                    <Td className={`text-right font-medium tabular-nums ${l.points < 0 ? "text-danger-700" : "text-success-700"}`}>
                      {l.points > 0 ? "+" : ""}
                      {l.points}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <Empty>No points have moved yet.</Empty>
          )}
        </TableCard>
        <div className="space-y-6">
          <Panel title="Adjust points" description="Goodwill credits or corrections. Audited with your reason; balances can't go below zero.">
            <ActionForm action={adjustLoyaltyAction} inline resetOnSuccess className="space-y-3">
              <FieldRow label="Customer email">
                <TextInput name="who" type="email" placeholder="buyer@example.com" required />
              </FieldRow>
              <FieldRow label="Points" hint="Negative to debit, e.g. -200">
                <TextInput name="points" inputMode="numeric" required />
              </FieldRow>
              <FieldRow label="Reason">
                <TextInput name="reason" placeholder="e.g. Delayed shipment goodwill" required />
              </FieldRow>
              <SubmitButton variant="primary">Apply adjustment</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel title="Highest balances" bodyClassName="p-0">
            {balances.length ? (
              <ul className="divide-y divide-umber-200/60 text-sm">
                {balances.map((b) => (
                  <li key={b.user_id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <Link href={`/admin/customers/${b.user_id}`} className="truncate hover:underline">
                      {b.name}
                    </Link>
                    <span className="font-medium tabular-nums">{b.balance.toLocaleString("en-US")} pts</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-umber-500">No balances.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
