import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ArrowDown, ArrowUp, Box, ExternalLink, Trash2 } from "lucide-react";
import {
  deleteImageAction,
  moderateListingAction,
  moveImageAction,
  setModelAction,
  toggleListingFeaturedAction,
  updateImageAction,
  updateListingAction,
  uploadListingImagesAction,
} from "@/app/actions/admin/listings";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { CustomizationEditor } from "@/components/admin/customization-editor";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DemoBadge, DetailGrid, KV, OrderAmount, Panel, PendingBadge, StatusBadge } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, certificates, orderItems, orders, productImages, products, reviews } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/settings";
import { productIssues } from "@/lib/trust/visibility";
import { minorToInput } from "@/lib/admin/money";
import { formatDate, REGION_LABELS } from "@/lib/utils/format";

export const metadata = { title: "Listing" };

const PROCEDURAL = ["rug", "calligraphy", "pottery", "truckart", "stone", "salt", "wood", "print", "ajrak", "tile"];

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="grid gap-4 border-t border-umber-200 pt-5 first:border-0 first:pt-0 md:grid-cols-2">
      <legend className="float-left mb-1 w-full text-xs font-semibold tracking-wider text-umber-500 uppercase md:col-span-2">
        {title}
        {hint ? <span className="ml-2 font-normal tracking-normal text-umber-400 normal-case">{hint}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

export default async function ListingDetail(props: PageProps<"/admin/listings/[id]">) {
  const user = await requireStaff("products.view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const p = await d.query.products.findFirst({ where: eq(products.id, id), with: { vendor: true, category: true, images: { orderBy: asc(productImages.sort) } } });
  if (!p) notFound();
  const [cats, sold, revs, certs] = await Promise.all([
    d.select({ id: categories.id, name: categories.name, hsCode: categories.hsCode }).from(categories).orderBy(asc(categories.sort)),
    d.select({ i: orderItems, number: orders.number, status: orders.status, currency: orders.currency, createdAt: orders.createdAt }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(orderItems.productId, p.id)).orderBy(desc(orders.createdAt)).limit(10),
    d.select().from(reviews).where(eq(reviews.productId, p.id)).orderBy(desc(reviews.createdAt)).limit(6),
    d.select().from(certificates).where(eq(certificates.productId, p.id)),
  ]);
  const issues = productIssues({ ...p, imageCount: p.images.length }, { demoMode: isDemoMode() });
  const canEdit = user.permissions.has("products.manage");
  const canModerate = user.permissions.has("products.moderate");
  const model = p.model3d;
  const dt = (x: Date | null) => (x ? new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

  const main = (
    <>
      {p.status === "rejected" && p.rejectionReason ? <Notice tone="danger" title="Rejected">{p.rejectionReason}</Notice> : null}
      {issues.length ? (
        <Notice tone="pending" title="Not shown on the storefront">
          {issues.map((i) => i.message).join(" · ")}
        </Notice>
      ) : (
        <Notice tone="success" title="Public on the storefront">
          Passes every listing guard.
        </Notice>
      )}

      <Panel title={`Images (${p.images.length})`} description="The first image is the cover. Mark illustrations honestly — buyers see an “illustration” label.">
        {p.images.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.images.map((img, i) => (
              <li key={img.id} className="overflow-hidden rounded-xl border border-umber-200 bg-white/60">
                <div className="relative aspect-[4/3] bg-umber-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt ?? p.title} className="h-full w-full object-cover" />
                  {i === 0 ? <Badge tone="dark" className="absolute top-2 left-2">Cover</Badge> : null}
                  {img.kind === "illustration" ? <Badge tone="gold" className="absolute top-2 right-2">Illustration</Badge> : null}
                </div>
                {canEdit ? (
                  <div className="space-y-2 p-2.5">
                    <ActionForm action={updateImageAction} className="space-y-1.5">
                      <input type="hidden" name="imageId" value={img.id} />
                      <TextInput name="alt" defaultValue={img.alt ?? ""} placeholder="Alt text" aria-label="Alt text" className="h-8 text-xs" />
                      <div className="flex gap-1.5">
                        <SelectInput name="kind" defaultValue={img.kind} aria-label="Image type" className="h-8 text-xs">
                          <option value="photo">Photo</option>
                          <option value="illustration">Illustration</option>
                        </SelectInput>
                        <SubmitButton variant="outline" className="h-8">
                          Save
                        </SubmitButton>
                      </div>
                    </ActionForm>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        <ActionButton action={moveImageAction} fields={{ imageId: img.id, dir: "up" }} variant="ghost" title="Move earlier">
                          <ArrowUp className="size-3.5" />
                        </ActionButton>
                        <ActionButton action={moveImageAction} fields={{ imageId: img.id, dir: "down" }} variant="ghost" title="Move later">
                          <ArrowDown className="size-3.5" />
                        </ActionButton>
                        {i > 0 ? (
                          <ActionButton action={moveImageAction} fields={{ imageId: img.id, dir: "first" }} variant="ghost">
                            Make cover
                          </ActionButton>
                        ) : null}
                      </div>
                      <ActionButton action={deleteImageAction} fields={{ imageId: img.id }} variant="ghost" confirm="Remove this image from the listing?" title="Delete image">
                        <Trash2 className="size-3.5 text-danger-600" />
                      </ActionButton>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-umber-500">No images — the listing can&apos;t be shown until one is added.</p>
        )}
        {canEdit ? (
          <ActionForm action={uploadListingImagesAction} resetOnSuccess className="mt-4 grid gap-3 rounded-xl bg-sand-100/60 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <input type="hidden" name="productId" value={p.id} />
            <ImageInput name="images" multiple label="Add images" />
            <SelectInput name="kind" defaultValue="photo" aria-label="Uploaded images are" className="w-auto">
              <option value="photo">Real photographs</option>
              <option value="illustration">Illustrations</option>
            </SelectInput>
            <SubmitButton variant="primary">Upload</SubmitButton>
            <TextInput name="alt" placeholder="Alt text for these images (optional)" className="sm:col-span-3" />
          </ActionForm>
        ) : null}
      </Panel>

      <Panel title="Listing details" description="Everything the artisan can edit, plus company-only fields (HS code, featured).">
        <ActionForm action={updateListingAction} inline className="space-y-6">
          <input type="hidden" name="productId" value={p.id} />
          <fieldset disabled={!canEdit} className="space-y-6">
            <Section title="Basics">
              <FieldRow label="Title" className="md:col-span-2">
                <TextInput name="title" defaultValue={p.title} required />
              </FieldRow>
              <FieldRow label="URL slug" hint={`/product/${p.slug}`}>
                <TextInput name="slug" defaultValue={p.slug} required />
              </FieldRow>
              <FieldRow label="Category">
                <SelectInput name="categoryId" defaultValue={p.categoryId}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </FieldRow>
              <FieldRow label="Summary" hint="One line — also used as the search-result description" className="md:col-span-2">
                <TextInput name="summary" defaultValue={p.summary ?? ""} maxLength={400} />
              </FieldRow>
              <FieldRow label="Description" className="md:col-span-2">
                <TextArea name="description" defaultValue={p.description ?? ""} rows={6} />
              </FieldRow>
              <FieldRow label="The story behind it" className="md:col-span-2">
                <TextArea name="story" defaultValue={p.story ?? ""} rows={4} />
              </FieldRow>
            </Section>
            <Section title="Price & stock" hint="PKR — buyers see converted prices">
              <FieldRow label="Price (Rs)">
                <TextInput name="pricePkr" defaultValue={minorToInput(p.pricePkr)} inputMode="decimal" required />
              </FieldRow>
              <FieldRow label="Compare-at price (Rs)" hint="Optional, shown struck through">
                <TextInput name="compareAtPricePkr" defaultValue={minorToInput(p.compareAtPricePkr)} inputMode="decimal" />
              </FieldRow>
              <FieldRow label="Availability">
                <SelectInput name="availability" defaultValue={p.availability}>
                  <option value="ready_to_ship">Ready to ship</option>
                  <option value="made_to_order">Made to order</option>
                </SelectInput>
              </FieldRow>
              <FieldRow label="Stock quantity">
                <TextInput name="stockQty" defaultValue={p.stockQty} inputMode="numeric" />
              </FieldRow>
              <FieldRow label="Time to make (days)" hint="Made-to-order pieces">
                <TextInput name="timeToMakeDays" defaultValue={p.timeToMakeDays ?? ""} inputMode="numeric" />
              </FieldRow>
              <FieldRow label="Dispatch within (days)" hint="Ready-to-ship pieces">
                <TextInput name="dispatchDays" defaultValue={p.dispatchDays ?? ""} inputMode="numeric" />
              </FieldRow>
              <Toggle name="isOneOfAKind" label="One of a kind (issues a certificate of authenticity)" defaultChecked={p.isOneOfAKind} className="md:col-span-2" />
            </Section>
            <Section title="Shipping & customs" hint="Weight and dimensions are required for automatic shipping quotes">
              <div className="grid grid-cols-3 gap-2">
                <FieldRow label="Width cm">
                  <TextInput name="widthCm" defaultValue={p.widthCm ?? ""} inputMode="decimal" />
                </FieldRow>
                <FieldRow label="Height cm">
                  <TextInput name="heightCm" defaultValue={p.heightCm ?? ""} inputMode="decimal" />
                </FieldRow>
                <FieldRow label="Depth cm">
                  <TextInput name="depthCm" defaultValue={p.depthCm ?? ""} inputMode="decimal" />
                </FieldRow>
              </div>
              <FieldRow label="Weight (grams, packed)">
                <TextInput name="weightG" defaultValue={p.weightG ?? ""} inputMode="numeric" />
              </FieldRow>
              <FieldRow label="HS code override" hint={`Category default: ${p.category.hsCode ?? "not set"} — confirm with your customs broker`}>
                <TextInput name="hsCodeOverride" defaultValue={p.hsCodeOverride ?? ""} placeholder={p.category.hsCode ?? "e.g. 5701.10"} />
              </FieldRow>
              <FieldRow label="Region of origin">
                <SelectInput name="region" defaultValue={p.region ?? ""}>
                  <option value="">—</option>
                  {Object.entries(REGION_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </FieldRow>
            </Section>
            <Section title="Materials & care">
              <FieldRow label="Materials" hint="Comma separated">
                <TextInput name="materials" defaultValue={p.materials.join(", ")} />
              </FieldRow>
              <FieldRow label="Techniques" hint="Comma separated">
                <TextInput name="techniques" defaultValue={p.techniques.join(", ")} />
              </FieldRow>
              <FieldRow label="Care instructions" className="md:col-span-2">
                <TextArea name="careInstructions" defaultValue={p.careInstructions ?? ""} rows={2} />
              </FieldRow>
              <FieldRow label="Video URL" className="md:col-span-2">
                <TextInput name="videoUrl" defaultValue={p.videoUrl ?? ""} type="url" />
              </FieldRow>
            </Section>
            <Section title="Personalisation">
              <Toggle name="customizable" label="Buyers can personalise this piece" defaultChecked={p.customizable} className="md:col-span-2" />
              <div className="md:col-span-2">
                <CustomizationEditor name="customizationOptions" initial={p.customizationOptions} />
              </div>
            </Section>
            <Section title="Limited drop">
              <Toggle name="isLimitedDrop" label="Release as a limited drop" defaultChecked={p.isLimitedDrop} className="md:col-span-2" />
              <FieldRow label="Drop starts">
                <TextInput name="dropStartsAt" type="datetime-local" defaultValue={dt(p.dropStartsAt)} />
              </FieldRow>
              <FieldRow label="Edition size">
                <TextInput name="editionSize" defaultValue={p.editionSize ?? ""} inputMode="numeric" />
              </FieldRow>
            </Section>
            <Section title="Wholesale (trade buyers)">
              <Toggle name="wholesaleEnabled" label="Offer trade pricing" defaultChecked={p.wholesaleEnabled} className="md:col-span-2" />
              <FieldRow label="Minimum quantity">
                <TextInput name="wholesaleMinQty" defaultValue={p.wholesaleMinQty ?? ""} inputMode="numeric" />
              </FieldRow>
              <FieldRow label="Wholesale price (Rs per piece)">
                <TextInput name="wholesalePricePkr" defaultValue={minorToInput(p.wholesalePricePkr)} inputMode="decimal" />
              </FieldRow>
            </Section>
            <Section title="Search preview" hint="Built from the title, slug and summary">
              <div className="rounded-xl border border-umber-200 bg-white p-4 md:col-span-2">
                <p className="text-xs text-success-700">wahbayaan.com › product › {p.slug}</p>
                <p className="text-lg text-indigo-700">{p.title} · Wahbayaan</p>
                <p className="text-sm text-umber-600">{(p.summary ?? p.description ?? "").slice(0, 158) || <span className="text-danger-700">No summary — search engines will pick random text.</span>}</p>
              </div>
            </Section>
          </fieldset>
          {canEdit ? (
            <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-umber-200 bg-sand-50/95 px-5 py-3 backdrop-blur">
              <p className="text-xs text-umber-500">Changes are recorded in the audit trail with before/after values.</p>
              <SubmitButton variant="primary" size="md">
                Save listing
              </SubmitButton>
            </div>
          ) : null}
        </ActionForm>
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Moderation">
        <KV
          items={[
            ["Status", <StatusBadge key="s" kind="product" status={p.status} />],
            ["Artisan", <Link key="a" href={`/admin/artisans/${p.vendorId}`} className="text-indigo-800 hover:underline">{p.vendor.displayName}</Link>],
            ["Price", <SellerPrice key="p" pkr={p.pricePkr} />],
            ["Published", p.publishedAt ? formatDate(p.publishedAt) : "—"],
            ["Views", p.viewCount],
            ["Public page", <a key="u" href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-800 hover:underline">Open <ExternalLink className="size-3" /></a>],
          ]}
        />
        {canModerate ? (
          <div className="mt-4 space-y-3 border-t border-umber-200 pt-4">
            <div className="flex flex-wrap gap-2">
              {p.status !== "active" ? (
                <ActionButton action={moderateListingAction} fields={{ productId: p.id, op: "approve" }} variant="primary">
                  Approve &amp; publish
                </ActionButton>
              ) : null}
              {p.status !== "archived" ? (
                <ActionButton action={moderateListingAction} fields={{ productId: p.id, op: "archive" }} confirm="Archive this listing?">
                  Archive
                </ActionButton>
              ) : null}
              {p.status === "archived" || p.status === "rejected" ? (
                <ActionButton action={moderateListingAction} fields={{ productId: p.id, op: "draft" }}>
                  Back to draft
                </ActionButton>
              ) : null}
              <ActionButton action={toggleListingFeaturedAction} fields={{ productId: p.id }}>
                {p.isFeatured ? "Unfeature" : "Feature"}
              </ActionButton>
            </div>
            {p.status !== "rejected" ? (
              <ActionForm action={moderateListingAction} className="space-y-2">
                <input type="hidden" name="productId" value={p.id} />
                <input type="hidden" name="op" value="reject" />
                <TextArea name="reason" rows={2} className="min-h-14" placeholder="What needs to change? (sent to the artisan)" required />
                <SubmitButton variant="danger">Reject with reason</SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><Box className="size-4 text-indigo-600" />3D model</span>} description="A GLB scan of this exact piece, or an illustrative procedural model.">
        <p className="mb-3 text-sm">
          Current:{" "}
          {!model ? (
            <span className="text-umber-500">none</span>
          ) : model.source === "scan" ? (
            <a href={model.url} className="text-indigo-800 underline" target="_blank" rel="noreferrer">
              3D scan (GLB)
            </a>
          ) : (
            <span>
              procedural “{model.kind}” · seed {model.seed} <Badge tone="gold">Illustrative</Badge>
            </span>
          )}
        </p>
        {canEdit ? (
          <div className="space-y-3">
            <ActionForm action={setModelAction} className="space-y-2 rounded-xl border border-umber-200 p-3">
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="mode" value="scan" />
              <p className="text-xs font-semibold text-umber-600">Upload a scan</p>
              <input type="file" name="glb" accept=".glb,model/gltf-binary" className="block w-full text-xs" aria-label="GLB file" />
              <SubmitButton variant="outline">Attach scan</SubmitButton>
            </ActionForm>
            <ActionForm action={setModelAction} className="space-y-2 rounded-xl border border-umber-200 p-3">
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="mode" value="procedural" />
              <p className="text-xs font-semibold text-umber-600">Procedural (illustrative)</p>
              <div className="flex gap-2">
                <SelectInput name="kind" defaultValue={model?.source === "procedural" ? model.kind : "rug"} aria-label="Model style">
                  {PROCEDURAL.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </SelectInput>
                <TextInput name="seed" defaultValue={model?.source === "procedural" ? model.seed : ""} placeholder="Seed" inputMode="numeric" aria-label="Seed" className="w-24" />
              </div>
              <SubmitButton variant="outline">Use procedural model</SubmitButton>
            </ActionForm>
            {model ? (
              <ActionButton action={setModelAction} fields={{ productId: p.id, mode: "none" }} variant="ghost" confirm="Remove the 3D model?">
                Remove 3D model
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title="Sales history" bodyClassName="p-0">
        {sold.length ? (
          <ul className="divide-y divide-umber-200/60 text-sm">
            {sold.map((s) => (
              <li key={s.i.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div>
                  <Link href={`/admin/orders/${s.number}`} className="text-indigo-800 hover:underline">
                    {s.number}
                  </Link>
                  <p className="text-xs text-umber-500">
                    {formatDate(s.createdAt)} · qty {s.i.qty}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <OrderAmount amount={s.i.unitPrice * s.i.qty} currency={s.currency} />
                  <p className="text-umber-500">
                    <SellerPrice pkr={s.i.unitPricePkr * s.i.qty} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-5 text-sm text-umber-500">Not sold yet.</p>
        )}
      </Panel>

      <Panel title="Reviews & certificates" bodyClassName="p-0">
        <ul className="divide-y divide-umber-200/60 text-sm">
          {revs.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
              <span className="truncate">
                {r.rating}★ {r.title ?? r.body.slice(0, 40)}
              </span>
              <StatusBadge kind="review" status={r.status} />
            </li>
          ))}
          {certs.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
              <Link href={`/admin/certificates?q=${c.code}`} className="text-gold-700 hover:underline">
                {c.code}
              </Link>
              <StatusBadge kind="certificate" status={c.status} />
            </li>
          ))}
          {!revs.length && !certs.length ? <li className="px-5 py-5 text-umber-500">None yet.</li> : null}
        </ul>
      </Panel>
      {!p.weightG ? <PendingBadge>Weight missing — orders will need a manual quote</PendingBadge> : null}
      <NotesPanel entity="product" entityId={p.id} currentUserId={user.id} />
      <AuditTrail entity="product" entityId={p.id} title="History" />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Listings", href: "/admin/listings" }, { label: p.title }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.title}
            <StatusBadge kind="product" status={p.status} className="font-sans text-sm" />
            {p.isFeatured ? <Badge tone="gold" className="font-sans">Featured</Badge> : null}
            <DemoBadge show={p.isDemo} />
          </span>
        }
        description={`${p.vendor.displayName} · ${p.category.name}`}
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
