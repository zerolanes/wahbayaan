import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { DemoBadge, Empty, FilterBar, FilterSelect, StatusBadge, TableCard, Thumb } from "@/components/admin/ui";
import { PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, vendorApplications } from "@/lib/db/schema";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { formatDate, REGION_LABELS, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Applications" };

const TABS = [
  { value: "", label: "To review" },
  { value: "submitted", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "more_info", label: "Waiting on applicant" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default async function ApplicationsPage(props: PageProps<"/admin/applications">) {
  await requireStaff("vendors.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const tab = str(params, "status");
  const d = await db();
  const base: SQL[] = [];
  const q = str(params, "q");
  if (q) base.push(or(ilike(vendorApplications.fullName, likeTerm(q)), ilike(vendorApplications.email, likeTerm(q)), ilike(vendorApplications.craft, likeTerm(q)), ilike(vendorApplications.workshopCity, likeTerm(q)))!);
  if (str(params, "category")) base.push(eq(vendorApplications.categoryId, str(params, "category")));
  if (str(params, "region")) base.push(sql`${vendorApplications.workshopRegion} = ${str(params, "region")}`);
  const statusCond = !tab ? sql`${vendorApplications.status} in ('submitted','in_review','more_info')` : tab === "all" ? undefined : sql`${vendorApplications.status} = ${tab}`;
  const where = and(...base, ...(statusCond ? [statusCond] : []));
  const [rows, [{ n }], counts, cats] = await Promise.all([
    d
      .select({ a: vendorApplications, category: categories.name })
      .from(vendorApplications)
      .leftJoin(categories, eq(categories.id, vendorApplications.categoryId))
      .where(where)
      .orderBy(desc(vendorApplications.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(vendorApplications).where(where),
    d.select({ s: vendorApplications.status, n: sql<number>`count(*)::int` }).from(vendorApplications).where(and(...base)).groupBy(vendorApplications.status),
    d.select({ id: categories.id, name: categories.name }).from(categories),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.s, Number(x.n)])) as Record<string, number>;
  const count = (t: string) => (t === "" ? (c.submitted ?? 0) + (c.in_review ?? 0) + (c.more_info ?? 0) : t === "all" ? Object.values(c).reduce((a, b) => a + b, 0) : (c[t] ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Marketplace" title="Artisan applications" description="Workshops asking to sell on Wahbayaan. Approving creates their account and artisan profile in review; verification checks happen on the artisan page." />
      <Tabs items={TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/applications", params, { status: t.value || null }), active: tab === t.value, count: count(t.value) }))} />
      <FilterBar action="/admin/applications" q={q} placeholder="Name, email, craft or city">
        {tab ? <input type="hidden" name="status" value={tab} /> : null}
        <FilterSelect name="category" label="Category" value={str(params, "category")} options={cats.map((x) => ({ value: x.id, label: x.name }))} />
        <FilterSelect name="region" label="Region" value={str(params, "region")} options={Object.entries(REGION_LABELS).map(([value, label]) => ({ value, label }))} />
      </FilterBar>
      <TableCard footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/applications", params, { page: p })} />}>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Applicant</Th>
                <Th>Craft</Th>
                <Th>Workshop</Th>
                <Th>Experience</Th>
                <Th>Samples</Th>
                <Th>Status</Th>
                <Th>Received</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map(({ a, category }) => (
                <Tr key={a.id}>
                  <Td>
                    <Link href={`/admin/applications/${a.id}`} className="font-medium text-umber-900 hover:text-terracotta-600">
                      {a.fullName}
                    </Link>{" "}
                    <DemoBadge show={a.email.endsWith(".test")} />
                    <p className="text-xs text-umber-500">{a.email}</p>
                  </Td>
                  <Td className="text-sm">
                    {a.craft}
                    <p className="text-xs text-umber-500">{category ?? "—"}</p>
                  </Td>
                  <Td className="text-sm">{[a.workshopCity, a.workshopRegion ? REGION_LABELS[a.workshopRegion] : null].filter(Boolean).join(", ") || "—"}</Td>
                  <Td className="text-sm">
                    {a.yearsPracticing ? `${a.yearsPracticing} yrs` : "—"}
                    {a.exportedBefore ? <p className="text-xs text-success-700">Has exported</p> : null}
                  </Td>
                  <Td>
                    <div className="flex -space-x-2">
                      {a.samplePhotoUrls.slice(0, 3).map((u) => (
                        <Thumb key={u} src={u} alt="Sample" size={30} className="ring-2 ring-sand-50" kind={u.startsWith("/art/") ? "illustration" : "photo"} />
                      ))}
                      {!a.samplePhotoUrls.length ? <span className="text-xs text-umber-400">None</span> : null}
                    </div>
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
          <Empty>No applications here.</Empty>
        )}
      </TableCard>
    </div>
  );
}
