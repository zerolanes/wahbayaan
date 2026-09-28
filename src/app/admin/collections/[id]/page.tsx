import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, ilike, notInArray, or, sql } from "drizzle-orm";
import { ArrowDown, ArrowUp } from "lucide-react";
import { addToCollectionAction, deleteCollectionAction, moveInCollectionAction, removeFromCollectionAction, updateCollectionAction } from "@/app/actions/admin/collections";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { AuditTrail } from "@/components/admin/notes-panel";
import { DemoBadge, DetailGrid, Panel, StatusBadge, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { collectionProducts, collections, products, vendors } from "@/lib/db/schema";
import { applyBps } from "@/lib/money/currency";
import { bpsToPercentString } from "@/lib/admin/money";
import { str } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";

export const metadata = { title: "Collection" };

export default async function CollectionDetail(props: PageProps<"/admin/collections/[id]">) {
  await requireStaff("content.manage");
  const { id } = await props.params;
  const params = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const c = await d.query.collections.findFirst({ where: eq(collections.id, id) });
  if (!c) notFound();
  const items = await d
    .select({ p: products, vendor: vendors.displayName, sort: collectionProducts.sort, cover: sql<string | null>`(select url from product_images i where i.product_id = ${products.id} order by sort limit 1)` })
    .from(collectionProducts)
    .innerJoin(products, eq(products.id, collectionProducts.productId))
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(eq(collectionProducts.collectionId, c.id))
    .orderBy(asc(collectionProducts.sort));
  const q = str(params, "pq");
  const candidates = await d
    .select({ id: products.id, title: products.title, vendor: vendors.displayName, status: products.status, pricePkr: products.pricePkr })
    .from(products)
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(and(items.length ? notInArray(products.id, items.map((i) => i.p.id)) : undefined, q ? or(ilike(products.title, likeTerm(q)), ilike(vendors.displayName, likeTerm(q))) : undefined))
    .orderBy(asc(products.title))
    .limit(q ? 50 : 200);
  const subtotal = items.reduce((a, i) => a + i.p.pricePkr, 0);
  const inactive = items.filter((i) => i.p.status !== "active");

  const main = (
    <>
      {inactive.length ? (
        <Notice tone="pending" title={`${inactive.length} piece${inactive.length === 1 ? " is" : "s are"} not active`}>
          They won&apos;t show inside the collection on the storefront: {inactive.map((i) => i.p.title).join(", ")}.
        </Notice>
      ) : null}
      <Panel title={`Pieces (${items.length})`} description={c.kind === "bundle" ? <>Bundle subtotal <SellerPrice pkr={subtotal} /> → <SellerPrice pkr={subtotal - applyBps(subtotal, c.bundleDiscountBps ?? 0)} /> after {(c.bundleDiscountBps ?? 0) / 100}% off (artisan prices, PKR)</> : "Drag order with the arrows"} bodyClassName="p-0">
        {items.length ? (
          <ul className="divide-y divide-umber-200/60">
            {items.map((i, idx) => (
              <li key={i.p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-5 text-right text-xs text-umber-400 tabular-nums">{idx + 1}</span>
                <Thumb src={i.cover} alt={i.p.title} size={40} kind={i.cover?.startsWith("/art/") ? "illustration" : "photo"} />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/listings/${i.p.id}`} className="font-medium hover:text-terracotta-600">
                    {i.p.title}
                  </Link>
                  <p className="text-xs text-umber-500">
                    {i.vendor} · <SellerPrice pkr={i.p.pricePkr} />
                  </p>
                </div>
                <StatusBadge kind="product" status={i.p.status} />
                <ActionButton action={moveInCollectionAction} fields={{ id: c.id, productId: i.p.id, dir: "up" }} variant="ghost" title="Move up">
                  <ArrowUp className="size-3.5" />
                </ActionButton>
                <ActionButton action={moveInCollectionAction} fields={{ id: c.id, productId: i.p.id, dir: "down" }} variant="ghost" title="Move down">
                  <ArrowDown className="size-3.5" />
                </ActionButton>
                <ActionButton action={removeFromCollectionAction} fields={{ id: c.id, productId: i.p.id }} variant="ghost">
                  Remove
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-umber-500">Empty — add pieces below.</p>
        )}
      </Panel>
      <Panel title="Add pieces">
        <form method="get" className="mb-3 flex gap-2">
          <TextInput name="pq" defaultValue={q} placeholder="Search listings by title or artisan" aria-label="Search listings" />
          <button className="h-9 rounded-full bg-indigo-900 px-4 text-sm text-sand-50">Search</button>
        </form>
        <ActionForm action={addToCollectionAction} className="flex gap-2">
          <input type="hidden" name="id" value={c.id} />
          <SelectInput name="productId" aria-label="Listing to add" required>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.vendor} {p.status !== "active" ? `(${p.status})` : ""}
              </option>
            ))}
          </SelectInput>
          <SubmitButton variant="primary">Add</SubmitButton>
        </ActionForm>
        <p className="mt-2 text-xs text-umber-500">{candidates.length} listing{candidates.length === 1 ? "" : "s"} available{q ? ` matching “${q}”` : ""}.</p>
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Settings">
        <ActionForm action={updateCollectionAction} inline className="space-y-3">
          <input type="hidden" name="id" value={c.id} />
          <FieldRow label="Title">
            <TextInput name="title" defaultValue={c.title} required />
          </FieldRow>
          <FieldRow label="Slug">
            <TextInput name="slug" defaultValue={c.slug} required />
          </FieldRow>
          <FieldRow label="Description">
            <TextArea name="description" defaultValue={c.description ?? ""} rows={3} />
          </FieldRow>
          <FieldRow label="Kind">
            <SelectInput name="kind" defaultValue={c.kind}>
              <option value="collection">Collection</option>
              <option value="bundle">Bundle (discounted together)</option>
            </SelectInput>
          </FieldRow>
          <FieldRow label="Bundle discount (%)" hint="Bundles only">
            <TextInput name="bundleDiscountPercent" defaultValue={bpsToPercentString(c.bundleDiscountBps)} inputMode="decimal" />
          </FieldRow>
          <FieldRow label="Cover image">
            {c.coverImageUrl ? <Thumb src={c.coverImageUrl} alt={c.title} size={80} /> : null}
            <ImageInput name="cover" label="Upload cover" />
          </FieldRow>
          <Toggle name="isPublished" label="Published on the storefront" defaultChecked={c.isPublished} />
          <SubmitButton variant="primary">Save</SubmitButton>
        </ActionForm>
      </Panel>
      <Panel title="Danger zone">
        <ActionButton action={deleteCollectionAction} fields={{ id: c.id }} variant="danger" confirm={`Delete “${c.title}”? Listings are not affected.`}>
          Delete collection
        </ActionButton>
      </Panel>
      <AuditTrail entity="collection" entityId={c.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Collections", href: "/admin/collections" }, { label: c.title }]} />
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {c.title} <DemoBadge show={c.isDemo} />
          </span>
        }
        description={c.kind === "bundle" ? `Bundle · ${(c.bundleDiscountBps ?? 0) / 100}% off together` : "Collection"}
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
