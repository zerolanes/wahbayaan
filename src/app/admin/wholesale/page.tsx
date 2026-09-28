import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { setWholesaleAction } from "@/app/actions/admin/customers";
import { approveWholesaleAction, wholesaleNotesAction, wholesaleStatusAction } from "@/app/actions/admin/wholesale";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { TextArea } from "@/components/admin/controls";
import { Empty, FilterBar, FilterSelect, MiniStat, OrderAmount, StatusBadge, TableCard } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users, wholesaleApplications } from "@/lib/db/schema";
import { humanize } from "@/lib/admin/labels";
import { str } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { valueByCurrency } from "@/lib/admin/customers";
import { destinationName } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Wholesale" };

const UID = sql.raw(`"users"."id"`);

export default async function WholesalePage(props: PageProps<"/admin/wholesale">) {
  const staff = await requireStaff("requests.manage");
  const params = await props.searchParams;
  const view = str(params, "view") === "buyers" ? "buyers" : "leads";
  const status = str(params, "status");
  const q = str(params, "q");
  const d = await db();
  const cond: SQL[] = [];
  if (q) cond.push(or(ilike(wholesaleApplications.businessName, likeTerm(q)), ilike(wholesaleApplications.contactName, likeTerm(q)), ilike(wholesaleApplications.email, likeTerm(q)))!);
  if (str(params, "country")) cond.push(eq(wholesaleApplications.country, str(params, "country")));
  const [leads, counts, buyers] = await Promise.all([
    d
      .select({
        l: wholesaleApplications,
        accountId: sql<string | null>`(select u.id from users u where lower(u.email) = lower("wholesale_applications"."email") and u.role = 'buyer' limit 1)`,
        accountWholesale: sql<boolean | null>`(select u.is_wholesale from users u where lower(u.email) = lower("wholesale_applications"."email") and u.role = 'buyer' limit 1)`,
      })
      .from(wholesaleApplications)
      .where(and(...cond, ...(status ? [sql`${wholesaleApplications.status} = ${status}`] : [])))
      .orderBy(sql`case ${wholesaleApplications.status} when 'new' then 0 when 'contacted' then 1 else 2 end`, desc(wholesaleApplications.createdAt)),
    d.select({ s: wholesaleApplications.status, n: sql<number>`count(*)::int` }).from(wholesaleApplications).where(and(...cond)).groupBy(wholesaleApplications.status),
    d
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        country: users.country,
        createdAt: users.createdAt,
        status: users.status,
        orders: sql<number>`(select count(*)::int from orders o where o.user_id = ${UID} and o.paid_at is not null)`,
        pkr: sql<number>`(select coalesce(sum(round(o.total * o.fx_pkr_per_unit)), 0)::bigint from orders o where o.user_id = ${UID} and o.paid_at is not null and o.status <> 'refunded')`,
        last: sql<Date | null>`(select max(o.created_at) from orders o where o.user_id = ${UID})`,
      })
      .from(users)
      .where(and(eq(users.role, "buyer"), eq(users.isWholesale, true), q ? or(ilike(users.name, likeTerm(q)), ilike(users.email, likeTerm(q))) : undefined))
      .orderBy(desc(users.createdAt)),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.s, Number(x.n)])) as Record<string, number>;
  const values = await valueByCurrency(buyers.map((b) => b.id));
  const canGrant = staff.permissions.has("customers.manage");
  const approvedNoAccount = leads.filter((x) => x.l.status === "approved" && !x.accountWholesale).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Wholesale"
        description="Trade applications from designers, retailers and hotels. Approving one switches on wholesale pricing for the buyer account with the same email."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="New applications" value={String(c.new ?? 0)} tone={c.new ? "pending" : undefined} href="/admin/wholesale?status=new" />
        <MiniStat label="In conversation" value={String(c.contacted ?? 0)} href="/admin/wholesale?status=contacted" />
        <MiniStat label="Trade buyers" value={String(buyers.length)} hint="Accounts with wholesale pricing" href="/admin/wholesale?view=buyers" />
        <MiniStat label="Approved, no pricing yet" value={String(approvedNoAccount)} tone={approvedNoAccount ? "pending" : undefined} hint="No matching buyer account" href="/admin/wholesale?status=approved" />
      </div>
      <Tabs
        items={[
          { label: "Applications", href: "/admin/wholesale", active: view === "leads", count: Object.values(c).reduce((a, b) => a + b, 0) },
          { label: "Trade buyers", href: "/admin/wholesale?view=buyers", active: view === "buyers", count: buyers.length },
        ]}
      />
      <FilterBar action="/admin/wholesale" q={q} placeholder={view === "buyers" ? "Name or email" : "Business, contact or email"}>
        {view === "buyers" ? <input type="hidden" name="view" value="buyers" /> : null}
        {view === "leads" ? (
          <>
            <FilterSelect name="status" label="Status" value={status} options={["new", "contacted", "approved", "rejected"].map((s) => ({ value: s, label: humanize(s) }))} />
            <FilterSelect name="country" label="Country" value={str(params, "country")} options={["US", "GB", "CA"].map((x) => ({ value: x, label: destinationName(x) }))} />
          </>
        ) : null}
      </FilterBar>

      {view === "leads" ? (
        <TableCard toolbar={<p className="text-sm text-umber-600">{leads.length} application{leads.length === 1 ? "" : "s"}</p>}>
          {leads.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Business</Th>
                  <Th>Contact</Th>
                  <Th>Type · volume</Th>
                  <Th>Applied</Th>
                  <Th>Account</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Decision</Th>
                </tr>
              </THead>
              <TBody>
                {leads.map(({ l, accountId, accountWholesale }) => (
                  <Tr key={l.id} id={l.id} className="align-top">
                    <Td className="max-w-xs">
                      <p className="font-medium text-umber-900">{l.businessName}</p>
                      <p className="text-xs text-umber-500">
                        {destinationName(l.country)}
                        {l.website ? (
                          <>
                            {" · "}
                            <a href={/^https?:/.test(l.website) ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" className="hover:underline">
                              {l.website.replace(/^https?:\/\//, "")}
                            </a>
                          </>
                        ) : null}
                      </p>
                      <details className="mt-1 text-sm">
                        <summary className="cursor-pointer text-xs text-indigo-800">Message &amp; notes</summary>
                        {l.message ? <p className="mt-2 whitespace-pre-wrap text-umber-700">“{l.message}”</p> : <p className="mt-2 text-umber-400">No message.</p>}
                        <ActionForm action={wholesaleNotesAction} className="mt-2 space-y-1.5">
                          <input type="hidden" name="id" value={l.id} />
                          <TextArea name="notes" defaultValue={l.notes ?? ""} rows={2} className="min-h-14" placeholder="Internal notes" aria-label="Notes" />
                          <SubmitButton variant="ghost">Save notes</SubmitButton>
                        </ActionForm>
                      </details>
                    </Td>
                    <Td className="text-sm">
                      {l.contactName}
                      <p className="text-xs text-umber-500">
                        <a href={`mailto:${l.email}`} className="hover:underline">
                          {l.email}
                        </a>
                      </p>
                    </Td>
                    <Td className="text-sm">
                      {humanize(l.businessType)}
                      <p className="text-xs text-umber-500">{l.expectedVolume ?? "Volume not given"}</p>
                    </Td>
                    <Td className="text-sm whitespace-nowrap text-umber-600">{formatDate(l.createdAt)}</Td>
                    <Td className="text-sm whitespace-nowrap">
                      {accountId ? (
                        <Link href={`/admin/customers/${accountId}`} className="text-indigo-800 hover:underline">
                          {accountWholesale ? "Trade pricing on" : "Retail account"}
                        </Link>
                      ) : (
                        <span className="text-umber-400">No account</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge kind="lead" status={l.status} />
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {l.status !== "approved" || (accountId && !accountWholesale) ? (
                          canGrant ? (
                            <ActionButton action={approveWholesaleAction} fields={{ id: l.id, notify: "on" }} variant="primary" confirm={`Approve ${l.businessName} for trade pricing${l.status === "approved" ? "" : " and email them"}?`}>
                              {l.status === "approved" ? "Grant pricing" : "Approve"}
                            </ActionButton>
                          ) : (
                            <Badge tone="neutral" title="Needs customers.manage">Approval needs customers.manage</Badge>
                          )
                        ) : null}
                        {l.status === "new" ? (
                          <ActionButton action={wholesaleStatusAction} fields={{ id: l.id, status: "contacted" }}>
                            Contacted
                          </ActionButton>
                        ) : null}
                        {l.status !== "rejected" && l.status !== "approved" ? (
                          <ActionButton action={wholesaleStatusAction} fields={{ id: l.id, status: "rejected", notify: "on" }} variant="ghost" confirm={`Decline ${l.businessName} and email them?`}>
                            Decline
                          </ActionButton>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <Empty>No trade applications{status ? ` with status “${status}”` : ""}.</Empty>
          )}
        </TableCard>
      ) : (
        <TableCard toolbar={<p className="text-sm text-umber-600">{buyers.length} trade buyer{buyers.length === 1 ? "" : "s"}</p>}>
          {buyers.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Buyer</Th>
                  <Th>Country</Th>
                  <Th className="text-right">Paid orders</Th>
                  <Th className="text-right">Lifetime value</Th>
                  <Th>Last order</Th>
                  <Th className="text-right" />
                </tr>
              </THead>
              <TBody>
                {buyers.map((b) => (
                  <Tr key={b.id}>
                    <Td>
                      <Link href={`/admin/customers/${b.id}`} className="font-medium text-umber-900 hover:underline">
                        {b.name}
                      </Link>
                      <p className="text-xs text-umber-500">{b.email}</p>
                    </Td>
                    <Td className="text-sm">{b.country ? destinationName(b.country) : "—"}</Td>
                    <Td className="text-right tabular-nums">{b.orders}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {(values.get(b.id) ?? []).map((v) => (
                        <div key={v.currency}>
                          <OrderAmount amount={v.total} currency={v.currency} />
                        </div>
                      ))}
                      {Number(b.pkr) ? (
                        <p className="text-xs text-umber-500">
                          ≈ <SellerPrice pkr={Number(b.pkr)} />
                        </p>
                      ) : (
                        <span className="text-umber-400">—</span>
                      )}
                    </Td>
                    <Td className="text-sm text-umber-600">{b.last ? formatDate(b.last) : "—"}</Td>
                    <Td className="text-right">
                      {canGrant ? (
                        <ActionButton action={setWholesaleAction} fields={{ userId: b.id, on: "0" }} variant="ghost" confirm={`Revoke wholesale pricing for ${b.name}?`}>
                          Revoke
                        </ActionButton>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <Empty>No trade buyers yet. Approve an application to add one.</Empty>
          )}
        </TableCard>
      )}
    </div>
  );
}
