import Link from "next/link";
import { Star } from "lucide-react";
import { bulkArtisansAction, toggleArtisanFeaturedAction } from "@/app/actions/admin/artisans";
import { ActionButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { DemoBadge, Empty, ExportLink, FilterBar, FilterSelect, StatusBadge, TableCard, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { artisansWithStats } from "@/lib/admin/artisans";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { REGION_LABELS } from "@/lib/utils/format";

export const metadata = { title: "Artisans" };

const STATUSES = [
  { value: "", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "in_review", label: "In review" },
  { value: "applied", label: "Applied" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
];

export default async function ArtisansPage(props: PageProps<"/admin/artisans">) {
  const user = await requireStaff("vendors.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const { all, filtered } = await artisansWithStats(params);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const crafts = [...new Set(all.map((v) => v.craft))].sort();
  const canManage = user.permissions.has("vendors.manage");
  const countFor = (status: string) => artisansCount(all, params, status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Artisans"
        description="Every workshop on Wahbayaan. “Public” shows whether the storefront guards let a profile appear — verified, own photo, a real story, a location and a banner no one else uses."
        actions={<ExportLink href={hrefWith("/admin/export/artisans", params, {})} />}
      />
      <Tabs items={STATUSES.map((s) => ({ label: s.label, href: hrefWith("/admin/artisans", params, { status: s.value || null }), active: str(params, "status") === s.value, count: countFor(s.value) }))} />
      <FilterBar action="/admin/artisans" q={str(params, "q")} placeholder="Name, craft or city">
        {str(params, "status") ? <input type="hidden" name="status" value={str(params, "status")} /> : null}
        <FilterSelect name="craft" label="Craft" value={str(params, "craft")} options={crafts.map((c) => ({ value: c, label: c }))} />
        <FilterSelect name="region" label="Region" value={str(params, "region")} options={Object.entries(REGION_LABELS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="issues" label="Public" value={str(params, "issues")} options={[{ value: "1", label: "Hidden (has issues)" }]} />
        <FilterSelect name="featured" label="Featured" value={str(params, "featured")} options={[{ value: "1", label: "Featured only" }]} />
        <FilterSelect name="demo" label="Demo" value={str(params, "demo")} options={[{ value: "1", label: "Demo only" }, { value: "0", label: "Real only" }]} />
        <FilterSelect name="sort" label="Sort" value={str(params, "sort")} options={[{ value: "sales", label: "Sales" }, { value: "listings", label: "Listings" }, { value: "newest", label: "Newest" }]} />
      </FilterBar>
      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {filtered.length} artisan{filtered.length === 1 ? "" : "s"} · {filtered.filter((v) => !v.issues.length).length} public
            </p>
            {canManage ? (
              <BulkBar
                formId="artisans-bulk"
                action={bulkArtisansAction}
                options={[
                  { value: "suspend", label: "Suspend", confirm: "Suspend the selected artisans? They'll be hidden from the storefront." },
                  { value: "reinstate", label: "Reinstate" },
                  { value: "feature", label: "Feature" },
                  { value: "unfeature", label: "Unfeature" },
                ]}
                extra={<input name="reason" placeholder="Reason (for suspension)" aria-label="Reason" className="h-8 w-48 rounded-full border border-umber-200 bg-white/90 px-3 text-sm focus:border-gold-500 focus:outline-none" />}
              />
            ) : null}
          </>
        }
        footer={<Pagination page={page} pageCount={pageCount(filtered.length)} hrefFor={(p) => hrefWith("/admin/artisans", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-8">
                    <SelectAll formId="artisans-bulk" />
                  </Th>
                ) : null}
                <Th>Artisan</Th>
                <Th>Craft · location</Th>
                <Th>Status</Th>
                <Th className="text-right">Listings</Th>
                <Th className="text-right">Sales</Th>
                <Th>Rating</Th>
                <Th>Public?</Th>
                <Th>Featured</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((v) => (
                <Tr key={v.id}>
                  {canManage ? (
                    <Td>
                      <RowCheck formId="artisans-bulk" value={v.id} />
                    </Td>
                  ) : null}
                  <Td>
                    <div className="flex items-center gap-3">
                      <Thumb src={v.profilePhotoUrl} alt={v.displayName} kind={v.profilePhotoKind} size={36} className="rounded-full" />
                      <div>
                        <Link href={`/admin/artisans/${v.id}`} className="font-medium text-umber-900 hover:text-terracotta-600">
                          {v.displayName}
                        </Link>{" "}
                        <DemoBadge show={v.isDemo} />
                        <p className="text-xs text-umber-500">/{v.slug}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-sm">
                    {v.craft}
                    <p className="text-xs text-umber-500">{[v.workshopCity, v.workshopRegion ? REGION_LABELS[v.workshopRegion] : null].filter(Boolean).join(", ") || "—"}</p>
                  </Td>
                  <Td>
                    <StatusBadge kind="vendor" status={v.status} />
                  </Td>
                  <Td className="text-right tabular-nums">
                    {v.activeListings}
                    <span className="text-umber-400">/{v.listings}</span>
                  </Td>
                  <Td className="text-right">
                    <SellerPrice pkr={v.salesPkr} />
                  </Td>
                  <Td className="text-sm whitespace-nowrap">{v.rating ? `${v.rating.toFixed(1)}★ (${v.reviews})` : <span className="text-umber-400">No reviews</span>}</Td>
                  <Td>
                    {v.issues.length ? (
                      <Badge tone="warning" title={v.issues.map((i) => i.message).join("\n")}>
                        Hidden · {v.issues.length} issue{v.issues.length === 1 ? "" : "s"}
                      </Badge>
                    ) : (
                      <Badge tone="success">Public</Badge>
                    )}
                  </Td>
                  <Td>
                    {canManage ? (
                      <ActionButton action={toggleArtisanFeaturedAction} fields={{ vendorId: v.id }} variant="ghost" title={v.isFeatured ? "Unfeature" : "Feature"}>
                        <Star className={v.isFeatured ? "size-4 fill-gold-400 text-gold-500" : "size-4 text-umber-300"} />
                      </ActionButton>
                    ) : v.isFeatured ? (
                      <Star className="size-4 fill-gold-400 text-gold-500" />
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No artisans match.</Empty>
        )}
      </TableCard>
    </div>
  );
}

function artisansCount(all: { status: string }[], _params: unknown, status: string) {
  return status ? all.filter((v) => v.status === status).length : all.length;
}
