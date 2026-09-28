import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { LayoutGrid, List } from "lucide-react";
import { BuyerEquivalent } from "@/components/admin/fx-amount";
import { Empty, FilterBar, FilterSelect, MiniStat, OrderAmount, StatusBadge, TableCard } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, customRequests, vendors } from "@/lib/db/schema";
import { getFxTable } from "@/lib/commerce/rates";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { median } from "@/lib/admin/series";
import { ageLabel, requestSla } from "@/lib/admin/sla";
import { likeTerm } from "@/lib/admin/sql";
import { DESTINATIONS, destinationName } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Custom requests" };

type Row = { r: typeof customRequests.$inferSelect; vendor: string | null; category: string | null };

const COLUMNS: { key: string; title: string; hint: string; match: (r: Row["r"]) => boolean }[] = [
  { key: "unmatched", title: "Needs an artisan", hint: "Match within a day", match: (r) => r.status === "new" && !r.vendorId },
  { key: "matched", title: "Awaiting quote", hint: "Artisan to quote within 3 days", match: (r) => r.status === "new" && !!r.vendorId },
  { key: "quoted", title: "Quoted", hint: "Waiting for the buyer", match: (r) => r.status === "quoted" },
  { key: "accepted", title: "Accepted", hint: "Turn into an order", match: (r) => r.status === "accepted" },
  { key: "converted", title: "Converted", hint: "Order placed", match: (r) => r.status === "converted" },
  { key: "closed", title: "Closed", hint: "Declined, expired or cancelled", match: (r) => ["declined", "expired", "cancelled"].includes(r.status) },
];

export default async function RequestsPage(props: PageProps<"/admin/requests">) {
  await requireStaff("requests.manage");
  const params = await props.searchParams;
  // A status link (e.g. from the dashboard) opens the table, which filters by status.
  const view = str(params, "view") === "table" || (str(params, "status") && str(params, "view") !== "board") ? "table" : "board";
  const page = pageOf(params);
  const status = str(params, "status");
  const d = await db();
  const cond: SQL[] = [];
  const q = str(params, "q");
  if (q) cond.push(or(ilike(customRequests.number, likeTerm(q)), ilike(customRequests.name, likeTerm(q)), ilike(customRequests.email, likeTerm(q)), ilike(customRequests.details, likeTerm(q)))!);
  if (str(params, "category")) cond.push(eq(customRequests.categoryId, str(params, "category")));
  if (str(params, "artisan") === "none") cond.push(sql`${customRequests.vendorId} is null`);
  else if (str(params, "artisan")) cond.push(eq(customRequests.vendorId, str(params, "artisan")));
  if (str(params, "destination")) cond.push(eq(customRequests.destinationCountry, str(params, "destination")));
  if (view === "table" && status) cond.push(sql`${customRequests.status} = ${status}`);
  const [rows, fx, cats, artisans] = await Promise.all([
    d
      .select({ r: customRequests, vendor: vendors.displayName, category: categories.name })
      .from(customRequests)
      .leftJoin(vendors, eq(vendors.id, customRequests.vendorId))
      .leftJoin(categories, eq(categories.id, customRequests.categoryId))
      .where(and(...cond))
      .orderBy(desc(customRequests.createdAt)),
    getFxTable(),
    d.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sort)),
    d.select({ id: vendors.id, name: vendors.displayName }).from(vendors).where(eq(vendors.status, "verified")).orderBy(asc(vendors.displayName)),
  ]);
  const now = new Date();
  const withSla = rows.map((row) => ({ ...row, sla: requestSla({ ...row.r, matched: !!row.r.vendorId }, now) }));
  const open = withSla.filter((x) => ["new", "quoted", "accepted"].includes(x.r.status));
  const quoteHours = rows.filter((x) => x.r.quotedAt).map((x) => (x.r.quotedAt!.getTime() - x.r.createdAt.getTime()) / 3_600_000);
  const med = median(quoteHours);
  const decided = rows.filter((x) => ["accepted", "converted", "declined", "expired"].includes(x.r.status));
  const won = decided.filter((x) => ["accepted", "converted"].includes(x.r.status)).length;

  const card = (x: (typeof withSla)[number]) => {
    const r = x.r;
    const cur = r.budgetCurrency ?? DESTINATIONS.find((dd) => dd.code === r.destinationCountry)?.currency ?? "USD";
    return (
      <Link key={r.id} href={`/admin/requests/${r.id}`} className="block rounded-lg border border-umber-200 bg-white p-3 text-sm transition hover:border-umber-400">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-umber-900">{r.number}</span>
          <Badge tone={x.sla.tone} title={x.sla.note}>
            {x.sla.stageLabel}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-umber-700">{r.details}</p>
        <p className="mt-2 text-xs text-umber-500">
          {r.name} · {r.destinationCountry}
          {x.category ? ` · ${x.category}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs">
          <span className="text-umber-600">{x.vendor ?? <span className="text-danger-700">No artisan</span>}</span>
          {r.quotePkr != null ? (
            <span className="font-medium text-umber-900">
              <SellerPrice pkr={r.quotePkr} />
            </span>
          ) : r.budget != null ? (
            <span className="text-umber-600">
              Budget <OrderAmount amount={r.budget} currency={cur} />
            </span>
          ) : null}
        </div>
        {x.sla.tone === "danger" || x.sla.tone === "warning" ? <p className={cn("mt-1.5 text-xs", x.sla.tone === "danger" ? "text-danger-700" : "text-warning-700")}>{x.sla.note}</p> : null}
      </Link>
    );
  };

  const tableRows = withSla.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Custom requests"
        description="Commissions from buyers. Match each to a verified artisan within a day; the artisan quotes in PKR and the buyer sees it in their currency. Ageing is measured against those targets."
        actions={
          <div className="flex rounded-lg border border-umber-200 bg-white p-0.5 text-sm">
            <Link href={hrefWith("/admin/requests", params, { view: "board", status: null })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5", view === "board" ? "bg-umber-900 text-white" : "text-umber-600 hover:text-umber-900")}>
              <LayoutGrid className="size-3.5" /> Board
            </Link>
            <Link href={hrefWith("/admin/requests", params, { view: "table" })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5", view === "table" ? "bg-umber-900 text-white" : "text-umber-600 hover:text-umber-900")}>
              <List className="size-3.5" /> Table
            </Link>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MiniStat label="Open" value={String(open.length)} hint="New, quoted or accepted" />
        <MiniStat label="Needs an artisan" value={String(withSla.filter((x) => x.r.status === "new" && !x.r.vendorId).length)} tone={withSla.some((x) => x.r.status === "new" && !x.r.vendorId && x.sla.breached) ? "danger" : undefined} href="/admin/requests?artisan=none" />
        <MiniStat label="Behind target" value={String(open.filter((x) => x.sla.breached).length)} tone={open.some((x) => x.sla.breached) ? "danger" : undefined} hint="Unmatched >1 day or unquoted >3 days" />
        <MiniStat label="Median time to quote" value={med != null ? ageLabel(med) : "—"} hint={`${quoteHours.length} quoted`} />
        <MiniStat label="Win rate" value={decided.length ? `${Math.round((won / decided.length) * 100)}%` : "—"} hint={`${won} of ${decided.length} decided`} />
      </div>
      {view === "table" ? (
        <Tabs
          items={[{ v: "", l: "All" }, { v: "new", l: "New" }, { v: "quoted", l: "Quoted" }, { v: "accepted", l: "Accepted" }, { v: "converted", l: "Converted" }, { v: "declined", l: "Declined" }, { v: "expired", l: "Expired" }, { v: "cancelled", l: "Cancelled" }].map((t) => ({
            label: t.l,
            href: hrefWith("/admin/requests", params, { status: t.v || null }),
            active: status === t.v,
          }))}
        />
      ) : null}
      <FilterBar action="/admin/requests" q={q} placeholder="Number, buyer or details">
        {view === "table" ? <input type="hidden" name="view" value="table" /> : null}
        {status && view === "table" ? <input type="hidden" name="status" value={status} /> : null}
        <FilterSelect name="category" label="Category" value={str(params, "category")} options={cats.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect name="artisan" label="Artisan" value={str(params, "artisan")} options={[{ value: "none", label: "Not matched" }, ...artisans.map((a) => ({ value: a.id, label: a.name }))]} />
        <FilterSelect name="destination" label="Destination" value={str(params, "destination")} options={DESTINATIONS.map((x) => ({ value: x.code, label: x.name }))} />
      </FilterBar>

      {view === "board" ? (
        rows.length ? (
          <div className="grid gap-4 md:grid-cols-3 2xl:grid-cols-6">
            {COLUMNS.map((col) => {
              const items = withSla.filter((x) => col.match(x.r));
              return (
                <section key={col.key} className="min-w-0 rounded-xl border border-umber-200 bg-umber-50/60 p-3">
                  <header className="mb-3 flex items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-umber-900">{col.title}</h2>
                      <p className="text-xs text-umber-500">{col.hint}</p>
                    </div>
                    <span className="text-sm text-umber-500 tabular-nums">{items.length}</span>
                  </header>
                  <div className="space-y-2">{items.length ? items.slice(0, 30).map(card) : <p className="py-4 text-center text-xs text-umber-400">Nothing here</p>}</div>
                </section>
              );
            })}
          </div>
        ) : (
          <TableCard>
            <Empty>No custom requests{q ? " match your search" : " yet"}.</Empty>
          </TableCard>
        )
      ) : (
        <TableCard
          toolbar={<p className="text-sm text-umber-600">{withSla.length} request{withSla.length === 1 ? "" : "s"}</p>}
          footer={<Pagination page={page} pageCount={pageCount(withSla.length)} hrefFor={(p) => hrefWith("/admin/requests", params, { page: p })} />}
        >
          {tableRows.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Request</Th>
                  <Th>Buyer</Th>
                  <Th>Artisan</Th>
                  <Th className="text-right">Budget</Th>
                  <Th className="text-right">Quote</Th>
                  <Th>Age</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {tableRows.map((x) => {
                  const r = x.r;
                  const cur = r.budgetCurrency ?? DESTINATIONS.find((dd) => dd.code === r.destinationCountry)?.currency ?? "USD";
                  return (
                    <Tr key={r.id}>
                      <Td className="max-w-sm">
                        <Link href={`/admin/requests/${r.id}`} className="font-medium text-indigo-800 hover:underline">
                          {r.number}
                        </Link>
                        <p className="truncate text-xs text-umber-500">
                          {x.category ? `${x.category} · ` : ""}
                          {r.details}
                        </p>
                      </Td>
                      <Td className="text-sm">
                        {r.name}
                        <p className="text-xs text-umber-500">{destinationName(r.destinationCountry)}</p>
                      </Td>
                      <Td className="text-sm">{x.vendor ?? <span className="text-danger-700">Not matched</span>}</Td>
                      <Td className="text-right whitespace-nowrap">{r.budget != null ? <OrderAmount amount={r.budget} currency={cur} /> : <span className="text-umber-400">—</span>}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {r.quotePkr != null ? (
                          <>
                            <SellerPrice pkr={r.quotePkr} />
                            <p className="text-xs text-umber-500">
                              <BuyerEquivalent pkr={r.quotePkr} currency={cur} fx={fx} />
                            </p>
                          </>
                        ) : (
                          <span className="text-umber-400">—</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone={x.sla.tone} title={x.sla.note}>
                          {x.sla.stageLabel}
                        </Badge>
                        <p className="text-xs text-umber-500">{formatDate(r.createdAt)}</p>
                      </Td>
                      <Td>
                        <StatusBadge kind="request" status={r.status} />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          ) : (
            <Empty>No requests match these filters.</Empty>
          )}
        </TableCard>
      )}
    </div>
  );
}
