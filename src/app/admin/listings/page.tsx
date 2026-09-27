import Link from "next/link";
import { asc } from "drizzle-orm";
import { Star } from "lucide-react";
import { bulkListingsAction, moderateListingAction, toggleListingFeaturedAction } from "@/app/actions/admin/listings";
import { ActionButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { DemoBadge, Empty, ExportLink, FilterBar, FilterSelect, PendingBadge, StatusBadge, TableCard, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, vendors } from "@/lib/db/schema";
import { LISTING_TABS, listingCounts, listListings } from "@/lib/admin/listings";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Listings" };

export default async function ListingsPage(props: PageProps<"/admin/listings">) {
  const user = await requireStaff("products.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const status = str(params, "status");
  const d = await db();
  const [{ rows, total }, counts, cats, artisans] = await Promise.all([
    listListings(params, page, PAGE_SIZE),
    listingCounts(params),
    d.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sort)),
    d.select({ id: vendors.id, name: vendors.displayName }).from(vendors).orderBy(asc(vendors.displayName)),
  ]);
  const canModerate = user.permissions.has("products.moderate");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Listings"
        description="Every piece on the marketplace. Artisan prices are in PKR; buyers see them converted with the landed cost."
        actions={<ExportLink href={hrefWith("/admin/export/listings", params, {})} />}
      />
      <Tabs items={LISTING_TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/listings", params, { status: t.value || null }), active: status === t.value, count: counts[t.value] ?? 0 }))} />
      <FilterBar action="/admin/listings" q={str(params, "q")} placeholder="Title, slug or artisan">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <FilterSelect name="artisan" label="Artisan" value={str(params, "artisan")} options={artisans.map((a) => ({ value: a.id, label: a.name }))} />
        <FilterSelect name="category" label="Category" value={str(params, "category")} options={cats.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect name="issues" label="Guards" value={str(params, "issues")} options={[{ value: "1", label: "Failing public guards" }]} />
        <FilterSelect name="image" label="Images" value={str(params, "image")} options={[{ value: "illustration", label: "Uses illustrations" }, { value: "none", label: "No images" }]} />
        <FilterSelect name="missing" label="Missing" value={str(params, "missing")} options={[{ value: "shipping", label: "Weight / dimensions" }, { value: "hs", label: "HS code" }]} />
        <FilterSelect name="availability" label="Availability" value={str(params, "availability")} options={[{ value: "ready_to_ship", label: "Ready to ship" }, { value: "made_to_order", label: "Made to order" }]} />
        <FilterSelect name="featured" label="Featured" value={str(params, "featured")} options={[{ value: "1", label: "Featured only" }]} />
        <FilterSelect name="demo" label="Demo" value={str(params, "demo")} options={[{ value: "1", label: "Demo only" }, { value: "0", label: "Real only" }]} />
        <FilterSelect
          name="sort"
          label="Sort"
          value={str(params, "sort")}
          options={[
            { value: "updated", label: "Recently updated" },
            { value: "price_desc", label: "Price high → low" },
            { value: "price_asc", label: "Price low → high" },
            { value: "views", label: "Most viewed" },
            { value: "title", label: "Title A–Z" },
          ]}
        />
      </FilterBar>
      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {total} listing{total === 1 ? "" : "s"}
            </p>
            {canModerate ? (
              <BulkBar
                formId="listings-bulk"
                action={bulkListingsAction}
                options={[
                  { value: "approve", label: "Approve (publish)" },
                  { value: "reject", label: "Reject (enter reason)" },
                  { value: "archive", label: "Archive", confirm: "Archive the selected listings?" },
                  { value: "feature", label: "Feature" },
                  { value: "unfeature", label: "Unfeature" },
                ]}
                extra={<input name="reason" placeholder="Reason (reject only)" aria-label="Rejection reason" className="h-8 w-44 rounded-full border border-umber-200 bg-white/90 px-3 text-sm focus:border-gold-500 focus:outline-none" />}
              />
            ) : null}
          </>
        }
        footer={<Pagination page={page} pageCount={pageCount(total)} hrefFor={(p) => hrefWith("/admin/listings", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canModerate ? (
                  <Th className="w-8">
                    <SelectAll formId="listings-bulk" />
                  </Th>
                ) : null}
                <Th>Listing</Th>
                <Th>Category</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Stock</Th>
                <Th>Status</Th>
                <Th>Guards</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const blocking = r.issues.filter((i) => i.code !== "not_active");
                return (
                  <Tr key={r.p.id}>
                    {canModerate ? (
                      <Td>
                        <RowCheck formId="listings-bulk" value={r.p.id} />
                      </Td>
                    ) : null}
                    <Td>
                      <div className="flex items-center gap-3">
                        <Thumb src={r.cover} alt={r.p.title} kind={r.coverKind} size={44} />
                        <div className="min-w-0">
                          <Link href={`/admin/listings/${r.p.id}`} className="font-medium text-umber-900 hover:text-terracotta-600">
                            {r.p.title}
                          </Link>{" "}
                          <DemoBadge show={r.p.isDemo} />
                          {r.p.isFeatured ? <Star className="ml-1 inline size-3.5 fill-gold-400 text-gold-500" aria-label="Featured" /> : null}
                          <p className="text-xs text-umber-500">
                            <Link href={`/admin/artisans/${r.vendorId}`} className="hover:underline">
                              {r.vendorName}
                            </Link>{" "}
                            · {r.p.availability === "made_to_order" ? "made to order" : "ready to ship"} · updated {timeAgo(r.p.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm">
                      {r.category}
                      <p className="text-xs text-umber-500">{r.p.hsCodeOverride ?? r.categoryHs ?? <span className="text-pending-600">no HS code</span>}</p>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <SellerPrice pkr={r.p.pricePkr} />
                    </Td>
                    <Td className="text-right tabular-nums">{r.p.stockQty}</Td>
                    <Td>
                      <StatusBadge kind="product" status={r.p.status} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {blocking.length ? (
                          <Badge tone="danger" title={blocking.map((i) => i.message).join("\n")}>
                            {blocking.length} issue{blocking.length === 1 ? "" : "s"}
                          </Badge>
                        ) : (
                          <Badge tone="success">OK</Badge>
                        )}
                        {Number(r.illusCount) ? <Badge tone="neutral" title="Uses illustrations — needs real photography">Illustrations</Badge> : null}
                        {!r.p.weightG ? <PendingBadge>No weight</PendingBadge> : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {canModerate && r.p.status === "pending_review" ? (
                          <ActionButton action={moderateListingAction} fields={{ productId: r.p.id, op: "approve" }} variant="primary">
                            Approve
                          </ActionButton>
                        ) : null}
                        {canModerate ? (
                          <ActionButton action={toggleListingFeaturedAction} fields={{ productId: r.p.id }} variant="ghost" title={r.p.isFeatured ? "Unfeature" : "Feature"}>
                            <Star className={r.p.isFeatured ? "size-4 fill-gold-400 text-gold-500" : "size-4 text-umber-300"} />
                          </ActionButton>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No listings match.</Empty>
        )}
      </TableCard>
    </div>
  );
}
