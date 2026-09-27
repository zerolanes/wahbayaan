import Image from "next/image";
import Link from "next/link";
import { Boxes, Copy, Eye } from "lucide-react";
import { duplicateListing, setListingStatus } from "@/app/actions/seller";
import { SellerPrice } from "@/components/money/seller-price";
import { ListingBadge } from "@/components/seller/status";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { requireSeller } from "@/lib/auth/session";
import { listSellerProducts } from "@/lib/seller/queries";

export const metadata = { title: "Listings" };

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "pending_review", label: "In review" },
  { key: "draft", label: "Drafts" },
  { key: "rejected", label: "Needs changes" },
  { key: "archived", label: "Archived" },
];

export default async function SellerListings(props: PageProps<"/seller/listings">) {
  const user = await requireSeller();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.status)?.key ?? "all";
  const all = await listSellerProducts(user.vendorId);
  const shown = tab === "all" ? all.filter((p) => p.status !== "archived") : all.filter((p) => p.status === tab);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workshop"
        title="Listings"
        description="Your pieces, prices in rupees. New and edited listings are checked by our team before they go live."
        actions={<ButtonLink href="/seller/listings/new">Add a listing</ButtonLink>}
      />
      <Tabs
        items={TABS.map((t) => ({
          label: t.label,
          href: `/seller/listings?status=${t.key}`,
          active: t.key === tab,
          count: t.key === "all" ? all.filter((p) => p.status !== "archived").length : all.filter((p) => p.status === t.key).length,
        }))}
      />
      {shown.length ? (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <Th>Piece</Th>
                <Th>Status</Th>
                <Th className="text-right">Price</Th>
                <Th>Stock</Th>
                <Th>Ready for shipping quotes</Th>
                <Th className="text-right">Views · sold</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {shown.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/seller/listings/${p.id}`} className="flex items-center gap-3">
                      <span className="bg-sand-200 relative size-12 shrink-0 overflow-hidden rounded-lg">
                        {p.imageUrl ? (
                          <Image src={p.imageUrl} alt="" fill sizes="48px" unoptimized={p.imageUrl.endsWith(".svg")} className="object-cover" />
                        ) : null}
                      </span>
                      <span>
                        <span className="text-umber-900 hover:text-terracotta-700 line-clamp-1 font-medium">{p.title}</span>
                        <span className="text-umber-500 text-xs">{p.categoryName}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <ListingBadge status={p.status} />
                    {p.status === "rejected" && p.rejectionReason ? <p className="text-danger-700 mt-1 max-w-48 text-xs">{p.rejectionReason}</p> : null}
                  </Td>
                  <Td className="text-right">
                    <SellerPrice pkr={p.pricePkr} className="font-medium" />
                  </Td>
                  <Td>
                    {p.availability === "made_to_order" ? (
                      <span className="text-umber-600 text-xs">Made to order · {p.timeToMakeDays ?? "?"} days</span>
                    ) : p.stockQty === 0 ? (
                      <Badge tone="danger">Sold out</Badge>
                    ) : (
                      p.stockQty
                    )}
                  </Td>
                  <Td>{p.weightG && p.widthCm ? <Badge tone="success">Yes</Badge> : <Badge tone="warning">Add weight & size</Badge>}</Td>
                  <Td className="text-umber-600 text-right tabular-nums">
                    {p.viewCount} · {p.sold}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {p.status === "active" ? (
                        <Link
                          href={`/product/${p.slug}`}
                          className="hover:bg-umber-900/5 grid size-8 place-items-center rounded-full"
                          title="View on the store"
                        >
                          <Eye className="size-4" />
                        </Link>
                      ) : null}
                      <form action={duplicateListing}>
                        <input type="hidden" name="productId" value={p.id} />
                        <button className="hover:bg-umber-900/5 grid size-8 place-items-center rounded-full" title="Duplicate">
                          <Copy className="size-4" />
                        </button>
                      </form>
                      {p.status !== "archived" ? (
                        <form action={setListingStatus}>
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="to" value="archived" />
                          <button className="text-umber-500 hover:bg-umber-900/5 rounded-full px-2 py-1 text-xs">Archive</button>
                        </form>
                      ) : (
                        <form action={setListingStatus}>
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="to" value="draft" />
                          <button className="text-umber-500 hover:bg-umber-900/5 rounded-full px-2 py-1 text-xs">Restore</button>
                        </form>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={<Boxes className="size-8" />}
          title="Nothing here yet"
          action={<ButtonLink href="/seller/listings/new">Add your first piece</ButtonLink>}
        >
          Good photos, the packed weight and honest dimensions are what international buyers look for.
        </EmptyState>
      )}
    </div>
  );
}
