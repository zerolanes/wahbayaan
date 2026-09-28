import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { CheckCircle2, CircleX, ExternalLink } from "lucide-react";
import {
  removeArtisanImageAction,
  saveCheckAction,
  suspendArtisanAction,
  updateArtisanProfileAction,
  updateArtisanSettingsAction,
  verifyArtisanAction,
} from "@/app/actions/admin/artisans";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DemoBadge, DetailGrid, KV, Panel, StatusBadge, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, conversations, orders, payouts, products, reviews, vendorOrders, vendors, verificationChecks } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/settings";
import { findSharedBanners, vendorIssues } from "@/lib/trust/visibility";
import { KEY_VERIFICATION_CHECKS, VERIFICATION_LABEL } from "@/lib/admin/labels";
import { bpsToPercentString } from "@/lib/admin/money";
import { formatDate, formatDateTime, REGION_LABELS, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Artisan" };

export default async function ArtisanDetail(props: PageProps<"/admin/artisans/[id]">) {
  const user = await requireStaff("vendors.view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const v = await d.query.vendors.findFirst({ where: eq(vendors.id, id), with: { user: true, primaryCategory: true } });
  if (!v) notFound();
  const [cats, checks, prods, vos, pays, revs, convs, allBanners] = await Promise.all([
    d.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sort)),
    d.select().from(verificationChecks).where(eq(verificationChecks.vendorId, v.id)),
    d.query.products.findMany({ where: eq(products.vendorId, v.id), with: { images: true }, orderBy: desc(products.createdAt) }),
    d.select({ vo: vendorOrders, number: orders.number, currency: orders.currency, total: orders.total, createdAt: orders.createdAt }).from(vendorOrders).innerJoin(orders, eq(orders.id, vendorOrders.orderId)).where(eq(vendorOrders.vendorId, v.id)).orderBy(desc(orders.createdAt)).limit(15),
    d.select().from(payouts).where(eq(payouts.vendorId, v.id)).orderBy(desc(payouts.createdAt)).limit(10),
    d.query.reviews.findMany({ where: eq(reviews.vendorId, v.id), with: { product: true }, orderBy: desc(reviews.createdAt), limit: 8 }),
    d.query.conversations.findMany({ where: eq(conversations.vendorId, v.id), with: { buyer: true, messages: true }, orderBy: desc(conversations.lastMessageAt), limit: 8 }),
    d.select({ bannerUrl: vendors.bannerUrl }).from(vendors),
  ]);
  const issues = vendorIssues(v, { demoMode: isDemoMode() }, findSharedBanners(allBanners));
  const can = (p: string) => user.permissions.has(p);
  const keyPassed = KEY_VERIFICATION_CHECKS.every((k) => checks.some((c) => c.kind === k && c.status === "passed"));
  const salesPkr = vos.filter((x) => x.vo.status !== "cancelled").reduce((a, x) => a + x.vo.subtotalPkr, 0);

  const main = (
    <>
      {issues.length ? (
        <Notice tone="pending" title="Hidden from the storefront">
          <ul className="list-disc pl-4">
            {issues.map((i) => (
              <li key={i.code}>{i.message}</li>
            ))}
          </ul>
        </Notice>
      ) : (
        <Notice tone="success" title="Public on the storefront" icon={<CheckCircle2 className="size-4" />}>
          This profile passes every visibility guard.
        </Notice>
      )}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-umber-200 bg-white">
        <div className="relative h-40 border-b border-umber-200 bg-umber-100">
          {v.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.bannerUrl} alt={`${v.displayName} banner`} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-umber-400">No banner</div>
          )}
        </div>
        <div className="flex items-end gap-4 px-5 pb-4">
          <Thumb src={v.profilePhotoUrl} alt={v.displayName} kind={v.profilePhotoKind} size={80} className="-mt-10 rounded-full ring-4 ring-white" />
          <div className="pb-1 text-umber-900">
            <p className="text-lg font-semibold">{v.displayName}</p>
            <p className="text-sm text-umber-500">
              {v.tagline ?? v.craft} · {[v.workshopCity, v.workshopRegion ? REGION_LABELS[v.workshopRegion] : null].filter(Boolean).join(", ") || "location missing"}
            </p>
          </div>
        </div>
      </div>

      <Panel title="Profile" description="Everything buyers see on the artisan page.">
        {can("vendors.manage") ? (
          <ActionForm action={updateArtisanProfileAction} inline className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="vendorId" value={v.id} />
            <FieldRow label="Display name">
              <TextInput name="displayName" defaultValue={v.displayName} required />
            </FieldRow>
            <FieldRow label="URL slug" hint={`/artisans/${v.slug}`}>
              <TextInput name="slug" defaultValue={v.slug} required />
            </FieldRow>
            <FieldRow label="Craft">
              <TextInput name="craft" defaultValue={v.craft} required />
            </FieldRow>
            <FieldRow label="Primary category">
              <SelectInput name="primaryCategoryId" defaultValue={v.primaryCategoryId ?? ""}>
                <option value="">—</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="Tagline" className="md:col-span-2">
              <TextInput name="tagline" defaultValue={v.tagline ?? ""} maxLength={200} />
            </FieldRow>
            <FieldRow label="Story" hint={`${v.story?.length ?? 0} characters — at least 80 to be public`} className="md:col-span-2">
              <TextArea name="story" defaultValue={v.story ?? ""} rows={6} />
            </FieldRow>
            <FieldRow label="Craft history" className="md:col-span-2">
              <TextArea name="craftHistory" defaultValue={v.craftHistory ?? ""} rows={3} />
            </FieldRow>
            <FieldRow label="Workshop city">
              <TextInput name="workshopCity" defaultValue={v.workshopCity ?? ""} />
            </FieldRow>
            <FieldRow label="Region">
              <SelectInput name="workshopRegion" defaultValue={v.workshopRegion ?? ""}>
                <option value="">—</option>
                {Object.entries(REGION_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="Founded (year)">
              <TextInput name="foundedYear" defaultValue={v.foundedYear ?? ""} inputMode="numeric" />
            </FieldRow>
            <FieldRow label="Languages" hint="Comma separated">
              <TextInput name="languages" defaultValue={v.languages.join(", ")} />
            </FieldRow>
            <FieldRow label="Story video URL">
              <TextInput name="storyVideoUrl" defaultValue={v.storyVideoUrl ?? ""} type="url" />
            </FieldRow>
            <FieldRow label="Typical response time (hours)">
              <TextInput name="responseTimeHours" defaultValue={v.responseTimeHours ?? ""} inputMode="numeric" />
            </FieldRow>
            <FieldRow label="Profile photo">
              <ImageInput name="profilePhoto" label="Upload photo" />
              <SelectInput name="profilePhotoKind" defaultValue={v.profilePhotoKind ?? "photo"} aria-label="Current photo is a">
                <option value="photo">Current image is a real photograph</option>
                <option value="illustration">Current image is an illustration</option>
              </SelectInput>
            </FieldRow>
            <FieldRow label="Banner">
              <ImageInput name="banner" label="Upload banner" />
            </FieldRow>
            <Toggle name="acceptsCustomOrders" label="Accepts custom orders" defaultChecked={v.acceptsCustomOrders} className="md:col-span-2" />
            <div className="grid gap-4 rounded-xl bg-sand-100/70 p-4 md:col-span-2 md:grid-cols-4">
              <p className="text-xs font-semibold tracking-wide text-umber-500 uppercase md:col-span-4">Payout account (PKR)</p>
              <FieldRow label="Method">
                <SelectInput name="payoutMethod" defaultValue={v.payoutMethod ?? ""}>
                  <option value="">—</option>
                  <option value="bank">Bank transfer</option>
                  <option value="easypaisa">Easypaisa</option>
                  <option value="jazzcash">JazzCash</option>
                </SelectInput>
              </FieldRow>
              <FieldRow label="Account title">
                <TextInput name="payoutAccountTitle" defaultValue={v.payoutAccountTitle ?? ""} />
              </FieldRow>
              <FieldRow label="Bank">
                <TextInput name="payoutBankName" defaultValue={v.payoutBankName ?? ""} />
              </FieldRow>
              <FieldRow label="Account last 4">
                <TextInput name="payoutAccountLast4" defaultValue={v.payoutAccountLast4 ?? ""} maxLength={4} inputMode="numeric" />
              </FieldRow>
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <SubmitButton variant="primary" size="md">
                Save profile
              </SubmitButton>
            </div>
          </ActionForm>
        ) : (
          <KV items={[["Story", v.story ?? "—"], ["Craft", v.craft], ["Languages", v.languages.join(", ") || "—"]]} />
        )}
        {can("vendors.manage") && (v.profilePhotoUrl || v.bannerUrl) ? (
          <div className="mt-4 flex gap-2 border-t border-umber-200 pt-4">
            {v.profilePhotoUrl ? (
              <ActionButton action={removeArtisanImageAction} fields={{ vendorId: v.id, field: "profilePhotoUrl" }} confirm="Remove the profile photo?">
                Remove photo
              </ActionButton>
            ) : null}
            {v.bannerUrl ? (
              <ActionButton action={removeArtisanImageAction} fields={{ vendorId: v.id, field: "bannerUrl" }} confirm="Remove the banner?">
                Remove banner
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title={`Listings (${prods.length})`} action={<Link href={`/admin/listings?artisan=${v.id}`} className="text-sm text-terracotta-600 hover:underline">Manage</Link>} bodyClassName="p-0">
        {prods.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Listing</Th>
                <Th>Status</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Stock</Th>
              </tr>
            </THead>
            <TBody>
              {prods.slice(0, 12).map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Thumb src={p.images.sort((a, b) => a.sort - b.sort)[0]?.url} alt={p.title} kind={p.images[0]?.kind} size={32} />
                      <Link href={`/admin/listings/${p.id}`} className="hover:text-terracotta-600">
                        {p.title}
                      </Link>
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge kind="product" status={p.status} />
                  </Td>
                  <Td className="text-right">
                    <SellerPrice pkr={p.pricePkr} />
                  </Td>
                  <Td className="text-right tabular-nums">{p.stockQty}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="px-5 py-6 text-sm text-umber-500">No listings yet.</p>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent orders" description={<>Sales <SellerPrice pkr={salesPkr} /></>} bodyClassName="p-0">
          {vos.length ? (
            <ul className="divide-y divide-umber-200/60 text-sm">
              {vos.map((x) => (
                <li key={x.vo.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div>
                    <Link href={`/admin/orders/${x.number}`} className="font-medium text-indigo-800 hover:underline">
                      {x.number}
                    </Link>
                    <p className="text-xs text-umber-500">{formatDate(x.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <SellerPrice pkr={x.vo.subtotalPkr} />
                    <div>
                      <StatusBadge kind="vendorOrder" status={x.vo.status} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-umber-500">No orders yet.</p>
          )}
        </Panel>
        <Panel title="Payouts" action={<Link href={`/admin/payouts?artisan=${v.id}`} className="text-sm text-terracotta-600 hover:underline">All</Link>} bodyClassName="p-0">
          {pays.length ? (
            <ul className="divide-y divide-umber-200/60 text-sm">
              {pays.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span>
                    <SellerPrice pkr={p.amountPkr} /> <span className="text-xs text-umber-500">· {p.notes}</span>
                  </span>
                  <StatusBadge kind="payout" status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-umber-500">No payouts yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Reviews" action={<Link href={`/admin/reviews?artisan=${v.id}`} className="text-sm text-terracotta-600 hover:underline">Moderate</Link>} bodyClassName="p-0">
          {revs.length ? (
            <ul className="divide-y divide-umber-200/60 text-sm">
              {revs.map((r) => (
                <li key={r.id} className="px-5 py-2.5">
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {"★".repeat(r.rating)}
                      <span className="text-umber-300">{"★".repeat(5 - r.rating)}</span> {r.title}
                    </span>
                    <StatusBadge kind="review" status={r.status} />
                  </p>
                  <p className="truncate text-xs text-umber-500">
                    {r.product.title} · {r.buyerCountry ?? ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-umber-500">No reviews yet — the storefront shows “New artisan”.</p>
          )}
        </Panel>
        <Panel title="Buyer conversations" action={<Link href={`/admin/conversations?artisan=${v.id}`} className="text-sm text-terracotta-600 hover:underline">Oversight</Link>} bodyClassName="p-0">
          {convs.length ? (
            <ul className="divide-y divide-umber-200/60 text-sm">
              {convs.map((c) => (
                <li key={c.id} className="px-5 py-2.5">
                  <Link href={`/admin/conversations?open=${c.id}`} className="font-medium hover:text-terracotta-600">
                    {c.subject}
                  </Link>
                  <p className="text-xs text-umber-500">
                    {c.buyer.name} · {c.messages.length} messages · {timeAgo(c.lastMessageAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-umber-500">No conversations.</p>
          )}
        </Panel>
      </div>
    </>
  );

  const side = (
    <>
      <Panel title="Status">
        <KV
          items={[
            ["Status", <StatusBadge key="s" kind="vendor" status={v.status} />],
            ["Verified", v.verifiedAt ? formatDate(v.verifiedAt) : "—"],
            ["Account", <a key="e" href={`mailto:${v.user.email}`} className="text-indigo-800 hover:underline">{v.user.email}</a>],
            ["Last sign-in", v.user.lastLoginAt ? formatDateTime(v.user.lastLoginAt) : "Never"],
            ["Joined", formatDate(v.createdAt)],
            ["Public page", <a key="p" href={`/artisans/${v.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-800 hover:underline">/artisans/{v.slug} <ExternalLink className="size-3" /></a>],
          ]}
        />
        {can("vendors.verify") ? (
          <div className="mt-4 space-y-2 border-t border-umber-200 pt-4">
            {v.status !== "verified" ? (
              <ActionForm action={verifyArtisanAction} className="flex items-center gap-2">
                <input type="hidden" name="vendorId" value={v.id} />
                <input type="hidden" name="status" value="verified" />
                <SubmitButton variant="primary" disabled={!keyPassed} confirm={`Verify ${v.displayName}?`}>
                  Verify artisan
                </SubmitButton>
                {!keyPassed ? <span className="text-xs text-umber-500">Pass identity, workshop and samples first</span> : null}
              </ActionForm>
            ) : null}
            {v.status === "applied" ? <ActionButton action={verifyArtisanAction} fields={{ vendorId: v.id, status: "in_review" }}>Move to review</ActionButton> : null}
            {v.status !== "rejected" && v.status !== "verified" ? (
              <ActionForm action={verifyArtisanAction} className="flex gap-2">
                <input type="hidden" name="vendorId" value={v.id} />
                <input type="hidden" name="status" value="rejected" />
                <TextInput name="reason" placeholder="Reason for rejecting" aria-label="Reason" required />
                <SubmitButton variant="danger" confirm="Reject this artisan?">
                  Reject
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        ) : null}
        {can("vendors.manage") ? (
          <div className="mt-3 border-t border-umber-200 pt-3">
            {v.status === "suspended" ? (
              <ActionButton action={suspendArtisanAction} fields={{ vendorId: v.id, op: "reinstate" }} variant="primary">
                Reinstate
              </ActionButton>
            ) : (
              <ActionForm action={suspendArtisanAction} className="flex gap-2">
                <input type="hidden" name="vendorId" value={v.id} />
                <input type="hidden" name="op" value="suspend" />
                <TextInput name="reason" placeholder="Reason for suspending" aria-label="Reason" required />
                <SubmitButton variant="danger" confirm="Suspend this artisan? Their shop disappears from the storefront.">
                  Suspend
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        ) : null}
      </Panel>

      <Panel title="Verification checks" description="Identity, workshop and samples must pass before verifying.">
        <div className="space-y-4">
          {(["identity", "workshop", "samples", "video_call", "address"] as const).map((kind) => {
            const c = checks.find((x) => x.kind === kind);
            return (
              <ActionForm key={kind} action={saveCheckAction} className="space-y-1.5 rounded-xl border border-umber-200 bg-white/50 p-3">
                <input type="hidden" name="vendorId" value={v.id} />
                <input type="hidden" name="kind" value={kind} />
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-umber-900">
                    {c?.status === "passed" ? <CheckCircle2 className="size-4 text-success-600" /> : c?.status === "failed" ? <CircleX className="size-4 text-danger-600" /> : <span className="size-4 rounded-full border-2 border-umber-300" />}
                    {VERIFICATION_LABEL[kind]}
                    {(KEY_VERIFICATION_CHECKS as readonly string[]).includes(kind) ? <Badge tone="neutral" className="py-0 text-[10px]">required</Badge> : null}
                  </p>
                  <StatusBadge kind="check" status={c?.status ?? "pending"} />
                </div>
                {c?.checkedAt ? <p className="text-xs text-umber-500">Checked {formatDate(c.checkedAt)}</p> : null}
                {can("vendors.verify") ? (
                  <>
                    <TextInput name="notes" defaultValue={c?.notes ?? ""} placeholder="Notes (document seen, call date…)" aria-label="Notes" />
                    <div className="flex gap-2">
                      <SelectInput name="status" defaultValue={c?.status ?? "pending"} aria-label="Result" className="flex-1">
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </SelectInput>
                      <SubmitButton variant="outline">Save</SubmitButton>
                    </div>
                  </>
                ) : c?.notes ? (
                  <p className="text-xs text-umber-600">{c.notes}</p>
                ) : null}
              </ActionForm>
            );
          })}
        </div>
      </Panel>

      {can("vendors.manage") ? (
        <Panel title="Commercial settings">
          <ActionForm action={updateArtisanSettingsAction} className="space-y-3">
            <input type="hidden" name="vendorId" value={v.id} />
            <FieldRow label="Commission override (%)" hint="Empty = company default (Fees & commission)">
              <TextInput name="commissionPercent" defaultValue={bpsToPercentString(v.commissionBps)} inputMode="decimal" placeholder="Default" />
            </FieldRow>
            <Toggle name="locationVerified" label="Workshop location verified" defaultChecked={v.locationVerified} />
            <Toggle name="isFeatured" label="Featured artisan" defaultChecked={v.isFeatured} />
            <Toggle name="vacationMode" label="Vacation mode (pauses new orders)" defaultChecked={v.vacationMode} />
            <SubmitButton>Save settings</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      <Panel title="Numbers">
        <KV
          items={[
            ["Listings", `${prods.filter((p) => p.status === "active").length} active / ${prods.length}`],
            ["Sales (recent)", <SellerPrice key="s" pkr={salesPkr} />],
            ["Primary category", v.primaryCategory?.name ?? "—"],
            ["Response time", v.responseTimeHours ? `${v.responseTimeHours} h` : "—"],
            ["Demo row", v.isDemo ? <DemoBadge key="d" /> : "No"],
          ]}
        />
        <p className="mt-3 text-xs text-umber-500">Impersonating artisans is intentionally not possible; use notes and the audit trail instead.</p>
      </Panel>
      <NotesPanel entity="vendor" entityId={v.id} currentUserId={user.id} />
      <AuditTrail entity="vendor" entityId={v.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Artisans", href: "/admin/artisans" }, { label: v.displayName }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {v.displayName}
            <StatusBadge kind="vendor" status={v.status} className="font-sans text-sm" />
            {v.isFeatured ? <Badge tone="gold" className="font-sans">Featured</Badge> : null}
            <DemoBadge show={v.isDemo} />
          </span>
        }
        description={`${v.craft} · joined ${formatDate(v.createdAt)}`}
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}

