import Link from "next/link";
import { and, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import { Empty, FilterBar, StatusBadge, TableCard } from "@/components/admin/ui";
import { PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { db } from "@/lib/db/client";
import { brandSellerApplications } from "@/lib/db/schema";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE, type SearchParams as Params } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { formatDate, timeAgo } from "@/lib/utils/format";

const TABS = [
  { value: "", label: "To review" },
  { value: "submitted", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "more_info", label: "Waiting on applicant" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

/** Artisans / Brands switch shared by both application lists. */
export async function ApplicationTypeTabs({ type }: { type: "artisan" | "brand" }) {
  const d = await db();
  const r = await d.execute<{ artisan: number; brand: number }>(sql`select
    (select count(*)::int from vendor_applications where status in ('submitted','in_review','more_info')) as artisan,
    (select count(*)::int from brand_seller_applications where status in ('submitted','in_review','more_info')) as brand`);
  const row = ((Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? []))[0] ?? { artisan: 0, brand: 0 }) as { artisan: number; brand: number };
  return (
    <Tabs
      items={[
        { label: "Artisans", href: "/admin/applications", active: type === "artisan", count: row.artisan },
        { label: "Brands", href: "/admin/applications?type=brand", active: type === "brand", count: row.brand },
      ]}
    />
  );
}

export async function BrandApplicationsList({ params }: { params: Params }) {
  const page = pageOf(params);
  const tab = str(params, "status");
  const q = str(params, "q");
  const base: SQL[] = [];
  if (q) base.push(or(ilike(brandSellerApplications.brandName, likeTerm(q)), ilike(brandSellerApplications.email, likeTerm(q)), ilike(brandSellerApplications.contactName, likeTerm(q)), ilike(brandSellerApplications.city, likeTerm(q)))!);
  const statusCond = !tab ? sql`${brandSellerApplications.status} in ('submitted','in_review','more_info')` : tab === "all" ? undefined : sql`${brandSellerApplications.status} = ${tab}`;
  const where = and(...base, ...(statusCond ? [statusCond] : []));
  const d = await db();
  const [rows, [{ n }], counts] = await Promise.all([
    d.select().from(brandSellerApplications).where(where).orderBy(desc(brandSellerApplications.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(brandSellerApplications).where(where),
    d.select({ s: brandSellerApplications.status, n: sql<number>`count(*)::int` }).from(brandSellerApplications).where(and(...base)).groupBy(brandSellerApplications.status),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.s, Number(x.n)])) as Record<string, number>;
  const count = (t: string) => (t === "" ? (c.submitted ?? 0) + (c.in_review ?? 0) + (c.more_info ?? 0) : t === "all" ? Object.values(c).reduce((a, b) => a + b, 0) : (c[t] ?? 0));
  const typed = { ...params, type: "brand" };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title="Brand applications"
        description="Labels applying to sell their own collection. Each accepted the brand seller terms at signup; approving makes the brand authorised with that acceptance as its permission and opens its brand portal."
      />
      <ApplicationTypeTabs type="brand" />
      <Tabs items={TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/applications", typed, { status: t.value || null }), active: tab === t.value, count: count(t.value) }))} />
      <FilterBar action="/admin/applications" q={q} placeholder="Brand, name, email or city">
        <input type="hidden" name="type" value="brand" />
        {tab ? <input type="hidden" name="status" value={tab} /> : null}
      </FilterBar>
      <TableCard footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/applications", typed, { page: p })} />}>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Brand</Th>
                <Th>Contact</Th>
                <Th>Sells</Th>
                <Th>Links</Th>
                <Th>Status</Th>
                <Th>Received</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <Link href={`/admin/applications/brand/${a.id}`} className="font-medium text-umber-900 hover:text-terracotta-600">
                      {a.brandName}
                    </Link>
                    <p className="text-xs text-umber-500">{a.city ?? "—"}</p>
                  </Td>
                  <Td className="text-sm">
                    {a.contactName}
                    <p className="text-xs text-umber-500">{a.email}</p>
                  </Td>
                  <Td className="max-w-56 text-sm">
                    <span className="line-clamp-2">{a.productTypes ?? "—"}</span>
                    <p className="text-xs text-umber-500">{a.audiences.join(", ")}</p>
                  </Td>
                  <Td className="text-xs">
                    {a.websiteUrl ? <span className="block truncate">{a.websiteUrl.replace(/^https?:\/\//, "")}</span> : null}
                    {a.instagram ? <span className="block">@{a.instagram}</span> : null}
                    {!a.websiteUrl && !a.instagram ? "—" : null}
                  </Td>
                  <Td>
                    <StatusBadge kind="application" status={a.status} />
                  </Td>
                  <Td className="text-xs whitespace-nowrap text-umber-500" title={formatDate(a.createdAt)}>
                    {timeAgo(a.createdAt)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No brand applications here.</Empty>
        )}
      </TableCard>
    </div>
  );
}
