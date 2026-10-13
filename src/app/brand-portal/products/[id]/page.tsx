import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePortalProduct } from "@/app/actions/brand-portal";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, SelectInput } from "@/components/admin/controls";
import { DetailGrid, KV, Panel, StatusBadge } from "@/components/admin/ui";
import { ProductFields } from "@/components/brand-portal/product-fields";
import { VariantEditor } from "@/components/brand-portal/variant-editor";
import { SellerPrice } from "@/components/money/seller-price";
import { Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { portalCollections, portalProduct } from "@/lib/brand-portal/queries";
import { isDemoMode } from "@/lib/settings";
import { brandIssues, brandProductIssues } from "@/lib/trust/visibility";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Edit product" };

const rupees = (pkr: number | null) => (pkr == null ? "" : String(pkr / 100));

export default async function PortalProductEdit(props: PageProps<"/brand-portal/products/[id]">) {
  const user = await requireBrandMember();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p, collections] = await Promise.all([portalProduct(user.brandId, id), portalCollections(user.brandId)]);
  if (!p) notFound();
  const ctx = { demoMode: isDemoMode() };
  const missing = brandProductIssues({ title: p.title, status: "published", imageCount: p.images.length, variantCount: p.variants.length, isDemo: p.isDemo, description: p.description }, ctx);
  const brandLive = brandIssues(user.brand, ctx).length === 0;
  const prices = p.variants.map((v) => v.pricePkr ?? p.pricePkr);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Products", href: "/brand-portal/products" }, { label: p.title }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.title} <StatusBadge kind="brand_product" status={p.status} label={p.status === "published" ? "Live" : p.status === "draft" ? "Draft" : "Hidden"} className="font-sans text-sm" />
          </span>
        }
        actions={
          p.status === "published" && brandLive ? (
            <Link href={`/brands/${user.brand.slug}/${p.slug}`} className="text-sm text-umber-600 hover:underline">
              View on Wahbayaan ↗
            </Link>
          ) : null
        }
      />
      {sp.created ? <Notice tone="success">Draft saved. Check each variant, add photos, then publish.</Notice> : null}
      <ActionForm action={updatePortalProduct} inline>
        <input type="hidden" name="id" value={p.id} />
        <DetailGrid
          main={
            <>
              <Panel title="Details">
                <ProductFields p={p} collections={collections.map((c) => c.name)} />
              </Panel>
              <Panel title="Variants" description="One row per size / colour, each with its own price and stock.">
                <VariantEditor
                  key={`v-${p.updatedAt.getTime()}`}
                  initial={p.variants.map((v) => ({
                    id: v.id,
                    size: v.size ?? "",
                    colour: v.colour ?? "",
                    sku: v.sku ?? "",
                    price: rupees(v.pricePkr ?? p.pricePkr),
                    compareAt: rupees(v.compareAtPricePkr),
                    stock: v.stockQty == null ? "" : String(v.stockQty),
                    available: v.available,
                  }))}
                />
              </Panel>
              <Panel title={`Photos (${p.images.length})`} description="Tick a photo to remove it. New photos are added after the current ones.">
                {p.images.length ? (
                  <ul className="mb-4 flex flex-wrap gap-3">
                    {p.images.map((img, i) => (
                      <li key={img.id} className="w-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.alt ?? p.title} className="aspect-[4/5] w-24 rounded-lg object-cover ring-1 ring-umber-200" />
                        <label className="mt-1 flex items-center gap-1.5 text-xs text-umber-600">
                          <input type="checkbox" name="removeImage" value={img.id} className="size-3.5" /> Remove{i === 0 ? " (main)" : ""}
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ImageInput key={`i-${p.updatedAt.getTime()}`} name="images" multiple label="Add photos" />
              </Panel>
            </>
          }
          side={
            <>
              <Panel title="Status">
                <FieldRow label="Show on Wahbayaan" htmlFor="status">
                  <SelectInput id="status" name="status" defaultValue={p.status}>
                    <option value="draft">Draft — not shown</option>
                    <option value="published">Live — shown on your brand page</option>
                    <option value="hidden">Hidden</option>
                  </SelectInput>
                </FieldRow>
                {missing.length ? <p className="mt-3 text-xs text-pending-700">To go live: {missing.map((m) => m.message.toLowerCase()).join(", ")}.</p> : null}
                {!brandLive ? <p className="mt-3 text-xs text-umber-500">Your brand page isn&apos;t public yet, so live products aren&apos;t visible until it is.</p> : null}
                <div className="mt-4">
                  <SubmitButton size="md" className="w-full">
                    Save product
                  </SubmitButton>
                </div>
              </Panel>
              <Panel title="Summary">
                <KV
                  items={[
                    ["Price", prices.length ? <span key="p"><SellerPrice pkr={Math.min(...prices)} />{Math.max(...prices) !== Math.min(...prices) ? <> – <SellerPrice pkr={Math.max(...prices)} /></> : null}</span> : "—"],
                    ["Variants", p.variants.length],
                    ["In stock", p.variants.filter((v) => v.available && v.stockQty !== 0).length],
                    ["Handle (CSV)", <code key="h" className="text-xs">{p.externalId ?? "—"}</code>],
                    ["Updated", formatDateTime(p.updatedAt)],
                  ]}
                />
              </Panel>
            </>
          }
        />
      </ActionForm>
    </div>
  );
}
