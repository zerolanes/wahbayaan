import Link from "next/link";
import { assignCollection, setPortalProductStatus } from "@/app/actions/brand-portal";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SelectInput } from "@/components/admin/controls";
import { Empty, StatusBadge, TableCard, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { portalCollections, portalProducts } from "@/lib/brand-portal/queries";

export const metadata = { title: "Products" };

const TABS = [
  { value: "", label: "All" },
  { value: "published", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "hidden", label: "Hidden" },
];

export default async function PortalProducts(props: PageProps<"/brand-portal/products">) {
  const user = await requireBrandMember();
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const [all, collections] = await Promise.all([portalProducts(user.brandId), portalCollections(user.brandId)]);
  const rows = status ? all.filter((p) => p.status === status) : all;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Each product needs a photo and at least one variant before it can go live."
        actions={
          <>
            <ButtonLink href="/brand-portal/import" variant="outline" size="sm">
              CSV upload
            </ButtonLink>
            <ButtonLink href="/brand-portal/products/new" size="sm">
              Add a product
            </ButtonLink>
          </>
        }
      />
      <Tabs items={TABS.map((t) => ({ label: t.label, href: t.value ? `/brand-portal/products?status=${t.value}` : "/brand-portal/products", active: status === t.value, count: t.value ? all.filter((p) => p.status === t.value).length : all.length }))} />
      <TableCard>
        {rows.length ? (
          <>
            <Table>
              <THead>
                <tr>
                  <Th className="w-8">
                    <span className="sr-only">Select</span>
                  </Th>
                  <Th>Product</Th>
                  <Th>Variants</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <input type="checkbox" form="bulk-collection" name="productIds" value={p.id} aria-label={`Select ${p.title}`} className="size-4" />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Thumb src={p.images[0]?.url} alt={p.title} size={44} />
                        <div className="min-w-0">
                          <Link href={`/brand-portal/products/${p.id}`} className="font-medium text-umber-900 hover:underline">
                            {p.title}
                          </Link>
                          <p className="text-xs text-umber-500">{[p.collection, p.category, p.audience].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm">
                      {p.variants.length}
                      <p className="max-w-40 truncate text-xs text-umber-500">{[...new Set(p.variants.map((v) => v.size).filter(Boolean))].join(", ")}</p>
                    </Td>
                    <Td className="text-sm">
                      <SellerPrice pkr={p.minPkr} />
                      {p.maxPkr !== p.minPkr ? (
                        <>
                          {" – "}
                          <SellerPrice pkr={p.maxPkr} />
                        </>
                      ) : null}
                    </Td>
                    <Td className="text-sm">{p.soldOut ? <span className="text-danger-700">Sold out</span> : p.stockTotal == null ? "Not tracked" : p.stockTotal}</Td>
                    <Td>
                      <StatusBadge kind="brand_product" status={p.status} label={p.status === "published" ? "Live" : p.status === "draft" ? "Draft" : "Hidden"} />
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {p.status !== "published" ? (
                        <ActionButton action={setPortalProductStatus} fields={{ id: p.id, status: "published" }} variant="primary">
                          Publish
                        </ActionButton>
                      ) : (
                        <ActionButton action={setPortalProductStatus} fields={{ id: p.id, status: "hidden" }}>
                          Hide
                        </ActionButton>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <ActionForm action={assignCollection} id="bulk-collection" className="flex flex-wrap items-center gap-2 border-t border-umber-200 px-4 py-3 text-sm">
              <span className="text-umber-600">Selected:</span>
              <SelectInput name="collection" defaultValue="" aria-label="Collection for selected products" className="w-56">
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
              <SubmitButton variant="outline">Set collection</SubmitButton>
              {!collections.length ? (
                <Link href="/brand-portal/collections" className="text-xs text-umber-500 underline">
                  Create a collection
                </Link>
              ) : null}
            </ActionForm>
          </>
        ) : (
          <Empty>{all.length ? "No products here." : "No products yet — add one or upload a CSV."}</Empty>
        )}
      </TableCard>
    </div>
  );
}
