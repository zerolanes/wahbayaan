import Link from "next/link";
import { asc, desc, inArray } from "drizzle-orm";
import { createManualProductAction, priceOverrideAction, setBrandProductStatusAction } from "@/app/actions/admin/brands";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/admin/controls";
import { DemoBadge, Empty, FilterBar, FilterSelect, Panel, StatusBadge, TableCard, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { can, requireStaff } from "@/lib/auth/session";
import { minorToInput } from "@/lib/admin/money";
import { str } from "@/lib/admin/params";
import { itemPricePkr } from "@/lib/brands/catalog";
import { computeServiceFee } from "@/lib/brands/margin";
import { catalogueDisplayGate } from "@/lib/brands/permission";
import { db } from "@/lib/db/client";
import { brandProductImages, brandProducts, brandProductVariants, brands } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Brand products" };

export default async function BrandProductsPage(props: PageProps<"/admin/brand-products">) {
  const user = await requireStaff("brands.view");
  const params = await props.searchParams;
  const d = await db();
  const [allBrands, products, margin] = await Promise.all([d.select().from(brands).orderBy(asc(brands.name)), d.select().from(brandProducts).orderBy(desc(brandProducts.createdAt)), getSetting("brand_margin")]);
  const brandF = str(params, "brand");
  const status = str(params, "status");
  const q = str(params, "q").toLowerCase();
  const rows = products.filter((p) => (!brandF || p.brandId === brandF) && (!status || p.status === status) && (!q || p.title.toLowerCase().includes(q)));
  const ids = rows.map((r) => r.id);
  const [images, variants] = ids.length
    ? await Promise.all([
        d.select().from(brandProductImages).where(inArray(brandProductImages.productId, ids)).orderBy(asc(brandProductImages.sort)),
        d.select().from(brandProductVariants).where(inArray(brandProductVariants.productId, ids)),
      ])
    : [[], []];
  const canManage = can(user, "brands.manage");
  const fee = (pkr: number, rule: typeof margin.domestic) => {
    const f = computeServiceFee(rule, pkr);
    return f.status === "known" ? <SellerPrice pkr={f.feePkr} /> : <Badge tone="pending">Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title="Brand products"
        description="Synced products arrive as drafts. Publish them here, adjust the item price if needed and preview the Wahbayaan service fee (always a separate line for buyers). A product appears publicly only when its brand is live."
      />
      <TableCard
        toolbar={
          <>
            <FilterBar action="/admin/brand-products" q={str(params, "q")} placeholder="Product title">
              <FilterSelect name="brand" label="Brand" value={brandF} options={allBrands.map((b) => ({ value: b.id, label: b.name }))} />
              <FilterSelect name="status" label="Status" value={status} options={["draft", "published", "hidden"].map((s) => ({ value: s, label: s }))} />
            </FilterBar>
            {canManage ? (
              <BulkBar
                formId="brand-products-bulk"
                action={setBrandProductStatusAction}
                options={[
                  { value: "published", label: "Publish" },
                  { value: "hidden", label: "Hide" },
                  { value: "draft", label: "Back to draft" },
                ]}
              />
            ) : null}
          </>
        }
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-8">
                    <SelectAll formId="brand-products-bulk" />
                  </Th>
                ) : null}
                <Th>Product</Th>
                <Th>Brand</Th>
                <Th>Variants</Th>
                <Th className="text-right">Brand price</Th>
                <Th>Our item price</Th>
                <Th className="text-right">Fee (Pakistan)</Th>
                <Th className="text-right">Fee (abroad)</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => {
                const b = allBrands.find((x) => x.id === p.brandId)!;
                const vs = variants.filter((v) => v.productId === p.id);
                const img = images.find((i) => i.productId === p.id);
                const price = itemPricePkr(p);
                return (
                  <Tr key={p.id}>
                    {canManage ? (
                      <Td>
                        <RowCheck formId="brand-products-bulk" value={p.id} label={`Select ${p.title}`} />
                      </Td>
                    ) : null}
                    <Td>
                      <div className="flex items-center gap-3">
                        <Thumb src={img?.url} alt="" kind={img?.kind} />
                        <div className="min-w-0">
                          <p className="font-medium text-umber-900">
                            {p.title} <DemoBadge show={p.isDemo} />
                          </p>
                          <p className="text-xs text-umber-500">
                            {[p.audience, p.category, p.collection].filter(Boolean).join(" · ")}
                            {p.compareAtPricePkr ? " · on sale at the brand" : ""}
                            {p.externalId ? " · synced" : " · manual"}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm">
                      <Link href={`/admin/brands/${b.id}`} className="text-indigo-800 hover:underline">
                        {b.name}
                      </Link>
                      {catalogueDisplayGate(b).ok && b.isActive ? null : <p className="text-xs text-umber-500">brand private</p>}
                    </Td>
                    <Td className="max-w-48 text-xs text-umber-600">
                      {vs.length} · {vs.filter((v) => v.available && v.stockQty !== 0).length} available
                      <p className="truncate">{[...new Set(vs.map((v) => v.size).filter(Boolean))].join(", ")}</p>
                    </Td>
                    <Td className="text-right text-sm">
                      <SellerPrice pkr={p.pricePkr} />
                      {p.compareAtPricePkr ? (
                        <p className="text-xs text-umber-400 line-through">
                          <SellerPrice pkr={p.compareAtPricePkr} />
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      {canManage ? (
                        <ActionForm action={priceOverrideAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={p.id} />
                          <TextInput name="priceOverride" defaultValue={minorToInput(p.priceOverridePkr)} placeholder="—" className="w-24" aria-label={`Price override for ${p.title} (PKR)`} />
                          <SubmitButton variant="ghost">Set</SubmitButton>
                        </ActionForm>
                      ) : (
                        <SellerPrice pkr={price} />
                      )}
                    </Td>
                    <Td className="text-right text-sm">{fee(price, margin.domestic)}</Td>
                    <Td className="text-right text-sm">{fee(price, margin.international)}</Td>
                    <Td>
                      <StatusBadge kind="brandProduct" status={p.status} />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No brand products match.</Empty>
        )}
      </TableCard>

      {canManage ? (
        <Panel title="Add a product by hand" description="For brands whose source is manual entry: the brand's own product details and photos as they supplied them. Starts as a draft.">
          <ActionForm action={createManualProductAction} inline className="grid gap-3 md:grid-cols-3">
            <FieldRow label="Brand" htmlFor="m-brand">
              <SelectInput id="m-brand" name="brandId" defaultValue={brandF}>
                {allBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="Title" htmlFor="m-title" className="md:col-span-2">
              <TextInput id="m-title" name="title" required />
            </FieldRow>
            <FieldRow label="For" htmlFor="m-aud">
              <SelectInput id="m-aud" name="audience" defaultValue="women">
                <option value="women">Women</option>
                <option value="men">Men</option>
                <option value="kids">Kids</option>
                <option value="unisex">Unisex</option>
              </SelectInput>
            </FieldRow>
            <FieldRow label="Category" htmlFor="m-cat">
              <TextInput id="m-cat" name="category" placeholder="Unstitched, Kurta…" />
            </FieldRow>
            <FieldRow label="Collection" htmlFor="m-col">
              <TextInput id="m-col" name="collection" />
            </FieldRow>
            <FieldRow label="Brand price (PKR)" htmlFor="m-price">
              <TextInput id="m-price" name="price" required placeholder="3490" />
            </FieldRow>
            <FieldRow label="Original price if on sale (PKR)" htmlFor="m-was">
              <TextInput id="m-was" name="compareAt" />
            </FieldRow>
            <FieldRow label="Weight (g)" htmlFor="m-w">
              <TextInput id="m-w" name="weightG" type="number" />
            </FieldRow>
            <FieldRow label="Sizes (comma separated)" htmlFor="m-sizes">
              <TextInput id="m-sizes" name="sizes" placeholder="XS, S, M, L" />
            </FieldRow>
            <FieldRow label="Colours (comma separated)" htmlFor="m-colours">
              <TextInput id="m-colours" name="colours" />
            </FieldRow>
            <FieldRow label="Fabric" htmlFor="m-fabric">
              <TextInput id="m-fabric" name="fabric" />
            </FieldRow>
            <FieldRow label="Description" htmlFor="m-desc" className="md:col-span-2">
              <TextArea id="m-desc" name="description" />
            </FieldRow>
            <div className="space-y-2">
              <FieldRow label="Product link on the brand's site" htmlFor="m-src">
                <TextInput id="m-src" name="sourceUrl" placeholder="https://" />
              </FieldRow>
              <input type="file" name="images" multiple accept="image/png,image/jpeg,image/webp" className="text-sm" aria-label="Photos" />
              <TextInput name="imageUrls" placeholder="or image URLs (comma separated)" aria-label="Image URLs" />
            </div>
            <div className="md:col-span-3">
              <SubmitButton>Add as draft</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      ) : null}
    </div>
  );
}
