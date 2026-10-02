import Link from "next/link";
import { Flag } from "lucide-react";
import { bulkCustomersAction } from "@/app/actions/admin/customers";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { DemoBadge, Empty, ExportLink, FilterBar, FilterDate, FilterSelect, MiniStat, OrderAmount, StatusBadge, TableCard } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { CUSTOMER_SORTS, customerStats, listCustomers } from "@/lib/admin/customers";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { percent, ratio } from "@/lib/admin/series";
import { BUYER_DESTINATIONS, destinationName } from "@/lib/money/currency";
import { formatDate, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Customers" };

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  const user = await requireStaff("customers.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const [{ rows, total }, stats] = await Promise.all([listCustomers(params, page, PAGE_SIZE), customerStats()]);
  const canManage = user.permissions.has("customers.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Customers"
        description="Buyer accounts across destinations. Lifetime value counts paid, non-refunded orders in the buyer's currency, with the PKR equivalent at each order's recorded rate."
        actions={<ExportLink href={hrefWith("/admin/export/customers", params, {})} />}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Buyer accounts" value={String(stats.total)} hint={`${stats.new30} joined in 30 days`} href="/admin/customers?sort=newest" />
        <MiniStat label="Have purchased" value={String(stats.buyers)} hint={`${percent(ratio(stats.buyers, stats.total), 0)} of accounts`} href="/admin/customers?orders=paid" />
        <MiniStat label="Repeat buyers" value={String(stats.repeat)} hint={`${percent(ratio(stats.repeat, stats.buyers), 0)} of purchasers`} href="/admin/customers?orders=repeat" />
        <MiniStat label="Lifetime value (PKR)" value={<SellerPrice pkr={stats.valuePkr} compact />} hint="All buyers, at order rates" />
        <MiniStat label="Wholesale" value={String(stats.wholesale)} hint="Trade accounts" href="/admin/customers?wholesale=1" />
        <MiniStat label="Flagged · disabled" value={`${stats.flagged} · ${stats.suspended}`} tone={stats.flagged ? "danger" : undefined} hint="Need a look" href="/admin/customers?flagged=1" />
      </div>
      <FilterBar action="/admin/customers" q={str(params, "q")} placeholder="Name, email or phone">
        <FilterSelect name="country" label="Country" value={str(params, "country")} options={[...BUYER_DESTINATIONS.map((d) => ({ value: d.code, label: d.name })), { value: "none", label: "Not set" }]} />
        <FilterSelect name="orders" label="Orders" value={str(params, "orders")} options={[{ value: "none", label: "No orders" }, { value: "any", label: "Any order" }, { value: "paid", label: "Paid order" }, { value: "repeat", label: "Repeat (2+ paid)" }]} />
        <FilterSelect name="wholesale" label="Wholesale" value={str(params, "wholesale")} options={[{ value: "1", label: "Trade only" }, { value: "0", label: "Retail only" }]} />
        <FilterSelect name="status" label="Login" value={str(params, "status")} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Disabled" }]} />
        <FilterSelect name="flagged" label="Flag" value={str(params, "flagged")} options={[{ value: "1", label: "Flagged" }]} />
        <FilterDate name="from" label="Signed up from" value={str(params, "from")} />
        <FilterDate name="to" label="to" value={str(params, "to")} />
        <FilterSelect name="sort" label="Sort" value={str(params, "sort")} options={CUSTOMER_SORTS.filter((s) => s.value !== "newest").map((s) => ({ value: s.value, label: s.label }))} />
      </FilterBar>
      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {total} customer{total === 1 ? "" : "s"}
            </p>
            {canManage ? (
              <BulkBar
                formId="customers-bulk"
                action={bulkCustomersAction}
                options={[
                  { value: "grant_wholesale", label: "Grant wholesale", confirm: "Grant wholesale pricing to the selected buyers?" },
                  { value: "revoke_wholesale", label: "Revoke wholesale", confirm: "Revoke wholesale access?" },
                  { value: "suspend", label: "Disable login", confirm: "Disable login for the selected buyers? They'll be signed out." },
                  { value: "reinstate", label: "Re-enable login" },
                ]}
                extra={<input name="reason" placeholder="Reason (for disabling)" aria-label="Reason" className="h-8 w-48 rounded-full border border-umber-200 bg-white/90 px-3 text-sm focus:border-gold-500 focus:outline-none" />}
              />
            ) : null}
          </>
        }
        footer={<Pagination page={page} pageCount={pageCount(total)} hrefFor={(p) => hrefWith("/admin/customers", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-8">
                    <SelectAll formId="customers-bulk" />
                  </Th>
                ) : null}
                <Th>Customer</Th>
                <Th>Country</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Lifetime value</Th>
                <Th>Last order</Th>
                <Th>Signed up</Th>
                <Th>Account</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((c) => (
                <Tr key={c.id}>
                  {canManage ? (
                    <Td>
                      <RowCheck formId="customers-bulk" value={c.id} label={`Select ${c.email}`} />
                    </Td>
                  ) : null}
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-umber-900 hover:underline">
                        {c.name}
                      </Link>
                      {c.flagged ? <Flag className="size-3.5 text-danger-600" aria-label="Flagged" /> : null}
                      <DemoBadge show={c.isDemo} />
                    </div>
                    <p className="text-xs text-umber-500">{c.email}</p>
                  </Td>
                  <Td className="text-sm whitespace-nowrap text-umber-700">{c.country ? destinationName(c.country) : <span className="text-umber-400">Not set</span>}</Td>
                  <Td className="text-right tabular-nums">
                    {c.paidOrders}
                    {c.orders !== c.paidOrders ? <span className="text-umber-400">/{c.orders}</span> : null}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {c.currencies.length ? (
                      <>
                        {c.currencies.map((v) => (
                          <div key={v.currency}>
                            <OrderAmount amount={v.total} currency={v.currency} className="font-medium" />
                          </div>
                        ))}
                        <p className="text-xs text-umber-500">
                          ≈ <SellerPrice pkr={c.valuePkr} />
                        </p>
                      </>
                    ) : (
                      <span className="text-umber-400">—</span>
                    )}
                  </Td>
                  <Td className="text-sm whitespace-nowrap text-umber-600">{c.lastOrderAt ? timeAgo(c.lastOrderAt) : "—"}</Td>
                  <Td className="text-sm whitespace-nowrap text-umber-600">{formatDate(c.createdAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {c.status !== "active" ? <StatusBadge kind="account" status={c.status} label="Login disabled" /> : null}
                      {c.isWholesale ? <Badge tone="indigo">Wholesale</Badge> : null}
                      {c.marketingOptIn ? <Badge tone="neutral">Marketing opt-in</Badge> : null}
                      {c.status === "active" && !c.isWholesale && !c.marketingOptIn ? <span className="text-xs text-umber-400">Retail</span> : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No customers match these filters.</Empty>
        )}
      </TableCard>
    </div>
  );
}
