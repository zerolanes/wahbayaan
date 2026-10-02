import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import {
  recordPermissionAction,
  revokePermissionAction,
  saveSizeGuideAction,
  setPartnershipAction,
  syncNowAction,
  toggleSyncAction,
  updateBrandAction,
  updateSourceAction,
  uploadFeedAction,
} from "@/app/actions/admin/brands";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { SwitchSubmit } from "@/components/admin/switch";
import { DemoBadge, DetailGrid, KV, Panel, StatusBadge } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { can, requireStaff } from "@/lib/auth/session";
import { canEnableSync, catalogueDisplayGate, hasRecordedPermission, PARTNERSHIP_LABEL } from "@/lib/brands/permission";
import { sizeGuideToText } from "@/lib/brands/size-guide";
import { db } from "@/lib/db/client";
import { brandAlerts, brands, brandSyncRuns, users } from "@/lib/db/schema";
import { query } from "@/lib/admin/sql";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Brand" };

export default async function AdminBrandPage(props: PageProps<"/admin/brands/[id]">) {
  const user = await requireStaff("brands.view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await db();
  const brand = await d.query.brands.findFirst({ where: eq(brands.id, id), with: { source: true } });
  if (!brand) notFound();
  const [runs, grantedBy, counts, alerts] = await Promise.all([
    d.select().from(brandSyncRuns).where(eq(brandSyncRuns.brandId, id)).orderBy(desc(brandSyncRuns.startedAt)).limit(20),
    brand.permissionGrantedById ? d.query.users.findFirst({ where: eq(users.id, brand.permissionGrantedById), columns: { name: true, email: true } }) : null,
    query<{ status: string; n: number }>(sql`select status::text, count(*)::int as n from brand_products where brand_id = ${id} group by 1`),
    d.select({ n: sql<number>`count(*)::int` }).from(brandAlerts).where(eq(brandAlerts.brandId, id)),
  ]);
  const permitted = hasRecordedPermission(brand);
  const gate = catalogueDisplayGate(brand);
  const source = brand.source;
  const syncGate = canEnableSync({ ...brand, sourceType: source?.type ?? "manual" });
  const canPermission = can(user, "brands.permission");
  const canManage = can(user, "brands.manage");
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title={
          <span className="flex items-center gap-3">
            {brand.name} <DemoBadge show={brand.isDemo} />
          </span>
        }
        description={brand.isActive && gate.ok ? "Live on the storefront." : `Private draft — ${gate.ok ? "switched off" : gate.reason}`}
        actions={
          <>
            <Link href={`/admin/brand-products?brand=${brand.id}`} className="text-sm font-medium text-indigo-800 hover:underline">
              Products ({n("published")} live, {n("draft")} draft, {n("hidden")} hidden)
            </Link>
            {brand.isActive && gate.ok ? (
              <Link href={`/brands/${brand.slug}`} className="text-sm text-umber-600 hover:underline">
                View storefront ↗
              </Link>
            ) : null}
          </>
        }
      />

      <DetailGrid
        main={
          <>
            <Panel title="Permission & partnership" description="Who gave permission, when, and a note — every change is audited. Sync and the public catalogue both need it.">
              {permitted ? (
                <KV
                  items={[
                    ["Permission", <Badge key="p" tone="success">Recorded</Badge>],
                    ["Given on", formatDate(brand.permissionGrantedAt)],
                    ["Recorded by", grantedBy ? `${grantedBy.name} (${grantedBy.email})` : "—"],
                    ["Note", <span key="n" className="whitespace-pre-wrap">{brand.permissionNote}</span>],
                    ["Evidence", brand.permissionEvidenceUrl ? <a key="e" href={brand.permissionEvidenceUrl} className="text-indigo-800 underline" target="_blank" rel="noreferrer">{brand.permissionEvidenceUrl}</a> : "—"],
                    ["Partnership", PARTNERSHIP_LABEL[brand.partnership]],
                  ]}
                />
              ) : (
                <Notice tone="pending" title="No permission recorded">
                  Catalogue sync can&apos;t be switched on and the brand can&apos;t be authorised or shown publicly until permission is recorded.
                </Notice>
              )}
              {canPermission ? (
                <div className="mt-5 grid gap-6 lg:grid-cols-2">
                  <ActionForm action={recordPermissionAction} className="space-y-3">
                    <input type="hidden" name="id" value={brand.id} />
                    <p className="text-sm font-semibold text-umber-900">{permitted ? "Update the permission record" : "Record permission"}</p>
                    <FieldRow label="Who granted it and how (note)" htmlFor="note">
                      <TextArea id="note" name="note" required placeholder="e.g. Email from the brand's e-commerce head, Ms X, allowing us to list and sync their catalogue." defaultValue={brand.permissionNote ?? ""} />
                    </FieldRow>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldRow label="Date given" htmlFor="grantedOn">
                        <TextInput id="grantedOn" name="grantedOn" type="date" />
                      </FieldRow>
                      <FieldRow label="Evidence link (optional)" htmlFor="evidenceUrl">
                        <TextInput id="evidenceUrl" name="evidenceUrl" placeholder="/media/… or document link" defaultValue={brand.permissionEvidenceUrl ?? ""} />
                      </FieldRow>
                    </div>
                    <SubmitButton>Record permission</SubmitButton>
                  </ActionForm>
                  <div className="space-y-6">
                    <ActionForm action={setPartnershipAction} className="space-y-3">
                      <input type="hidden" name="id" value={brand.id} />
                      <p className="text-sm font-semibold text-umber-900">Partnership</p>
                      <SelectInput name="partnership" defaultValue={brand.partnership} aria-label="Partnership">
                        <option value="none">No partnership</option>
                        <option value="requested">Partnership requested</option>
                        <option value="authorised" disabled={!permitted}>
                          Authorised partner{permitted ? "" : " (record permission first)"}
                        </option>
                      </SelectInput>
                      <TextArea name="partnershipNote" aria-label="Partnership note" placeholder="Notes: who we spoke to, terms agreed…" defaultValue={brand.partnershipNote ?? ""} />
                      <SubmitButton variant="outline">Save partnership</SubmitButton>
                    </ActionForm>
                    {permitted ? (
                      <ActionForm action={revokePermissionAction} className="space-y-2" confirm="Revoke permission? Sync switches off and the catalogue is hidden immediately.">
                        <input type="hidden" name="id" value={brand.id} />
                        <TextInput name="reason" required placeholder="Reason for revoking" aria-label="Reason for revoking" />
                        <SubmitButton variant="danger">Revoke permission</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Panel>

            <Panel title="Catalogue source" description="Products feed, CSV upload or manual entry. Every automatic import re-checks the recorded permission.">
              {canManage ? (
                <ActionForm action={updateSourceAction} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={brand.id} />
                  <FieldRow label="Source type" htmlFor="type">
                    <SelectInput id="type" name="type" defaultValue={source?.type ?? "manual"}>
                      <option value="manual">Manual entry</option>
                      <option value="shopify_json">Products feed (Shopify-style products.json)</option>
                      <option value="csv_feed">CSV / feed upload</option>
                    </SelectInput>
                  </FieldRow>
                  <FieldRow label="products.json URL" htmlFor="url" hint="https://…/products.json — robots.txt is checked before every fetch.">
                    <TextInput id="url" name="url" defaultValue={source?.config.url ?? ""} />
                  </FieldRow>
                  <FieldRow label="Delay between requests (ms, min 1000)" htmlFor="rateLimitMs">
                    <TextInput id="rateLimitMs" name="rateLimitMs" type="number" min={1000} defaultValue={source?.config.rateLimitMs ?? 2000} />
                  </FieldRow>
                  <FieldRow label="Max pages per sync" htmlFor="maxPages">
                    <TextInput id="maxPages" name="maxPages" type="number" min={1} max={50} defaultValue={source?.config.maxPages ?? 10} />
                  </FieldRow>
                  <Toggle name="markMissingUnavailable" label="Mark products missing from a complete feed as unavailable" defaultChecked={source?.config.markMissingUnavailable !== false} className="sm:col-span-2" />
                  <div className="sm:col-span-2">
                    <SubmitButton variant="outline">Save source</SubmitButton>
                  </div>
                </ActionForm>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-umber-200/60 pt-4">
                <ActionForm action={toggleSyncAction} className="flex items-center gap-3">
                  <input type="hidden" name="id" value={brand.id} />
                  <SwitchSubmit on={!!source?.syncEnabled} label="Automatic sync" />
                  <span className="text-sm text-umber-800">Automatic sync (admin button + nightly cron)</span>
                </ActionForm>
                {!source?.syncEnabled && !syncGate.ok ? <span className="text-xs text-pending-600">{syncGate.reason}</span> : null}
                {source?.type === "shopify_json" ? (
                  <ActionButton action={syncNowAction} fields={{ id: brand.id }} variant="primary">
                    Sync now
                  </ActionButton>
                ) : null}
              </div>
              {source?.type === "csv_feed" && canManage ? (
                <ActionForm action={uploadFeedAction} encType="multipart/form-data" className="mt-4 flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={brand.id} />
                  <input type="file" name="feed" accept=".csv,text/csv" className="text-sm" aria-label="Feed CSV" />
                  <SubmitButton>Import feed</SubmitButton>
                  <span className="text-xs text-umber-500">Columns: handle, title, price_pkr, size, colour, sku, stock, image_urls…</span>
                </ActionForm>
              ) : null}
            </Panel>

            <Panel title="Sync history" description="Every run — including refused ones — with its counts and errors.">
              {runs.length ? (
                <Table>
                  <THead>
                    <tr>
                      <Th>Started</Th>
                      <Th>Trigger</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Added</Th>
                      <Th className="text-right">Updated</Th>
                      <Th className="text-right">Unchanged</Th>
                      <Th className="text-right">Failed</Th>
                      <Th>Errors</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {runs.map((r) => (
                      <Tr key={r.id}>
                        <Td className="text-sm whitespace-nowrap">{formatDateTime(r.startedAt)}</Td>
                        <Td className="text-sm">{r.trigger}</Td>
                        <Td>
                          <StatusBadge kind="sync" status={r.status} />
                        </Td>
                        <Td className="text-right text-sm tabular-nums">{r.added}</Td>
                        <Td className="text-right text-sm tabular-nums">{r.updated}</Td>
                        <Td className="text-right text-sm tabular-nums">{r.unchanged}</Td>
                        <Td className="text-right text-sm tabular-nums">{r.failed}</Td>
                        <Td className="max-w-80 text-xs text-umber-600">
                          {r.errors.length ? (
                            <details>
                              <summary className="cursor-pointer">{r.errors[0].slice(0, 80)}</summary>
                              <ul className="mt-1 list-disc pl-4">
                                {r.errors.map((e, i) => (
                                  <li key={i}>{e}</li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            "—"
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <p className="text-sm text-umber-500">No sync runs yet.</p>
              )}
            </Panel>
          </>
        }
        side={
          <>
            <Panel title="Brand details">
              <ActionForm action={updateBrandAction} encType="multipart/form-data" className="space-y-3">
                <input type="hidden" name="id" value={brand.id} />
                <FieldRow label="Name" htmlFor="b-name">
                  <TextInput id="b-name" name="name" defaultValue={brand.name} required />
                </FieldRow>
                <FieldRow label="Slug" htmlFor="b-slug">
                  <TextInput id="b-slug" name="slug" defaultValue={brand.slug} required />
                </FieldRow>
                <FieldRow label="Website" htmlFor="b-web">
                  <TextInput id="b-web" name="websiteUrl" defaultValue={brand.websiteUrl ?? ""} placeholder="https://" />
                </FieldRow>
                <FieldRow label="Logo URL" htmlFor="b-logo" hint="Shown only once the brand is an authorised partner. Upload the logo the brand supplied.">
                  <TextInput id="b-logo" name="logoUrl" defaultValue={brand.logoUrl ?? ""} />
                </FieldRow>
                <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="text-sm" aria-label="Upload logo" />
                <FieldRow label="Description" htmlFor="b-desc">
                  <TextArea id="b-desc" name="description" defaultValue={brand.description ?? ""} />
                </FieldRow>
                <fieldset className="flex flex-wrap gap-3">
                  <legend className="mb-1 text-xs font-medium text-umber-600">Shop for</legend>
                  {(["women", "men", "kids", "unisex"] as const).map((a) => (
                    <Toggle key={a} name="audiences[]" value={a} label={a} defaultChecked={brand.audiences.includes(a)} />
                  ))}
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Default parcel weight (g)" htmlFor="b-w">
                    <TextInput id="b-w" name="defaultWeightG" type="number" defaultValue={brand.defaultWeightG ?? ""} />
                  </FieldRow>
                  <FieldRow label="Sort" htmlFor="b-sort">
                    <TextInput id="b-sort" name="sort" type="number" defaultValue={brand.sort} />
                  </FieldRow>
                </div>
                <Toggle name="isActive" label="Switched on for the storefront (still needs an authorised partnership)" defaultChecked={brand.isActive} />
                <SubmitButton>Save details</SubmitButton>
              </ActionForm>
            </Panel>
            <Panel title="Size guide" description="As published by the brand. Shown on product pages and /brands/{slug}/size-guide.">
              <ActionForm action={saveSizeGuideAction} className="space-y-3">
                <input type="hidden" name="id" value={brand.id} />
                <SelectInput name="unit" defaultValue={brand.sizeGuide?.unit ?? "in"} aria-label="Unit">
                  <option value="in">Inches</option>
                  <option value="cm">Centimetres</option>
                </SelectInput>
                <TextArea name="grid" rows={7} className="font-mono text-xs" aria-label="Size chart" defaultValue={sizeGuideToText(brand.sizeGuide)} placeholder={"Size, Chest, Waist, Length\nS, 36, 32, 41\nM, 38, 34, 42"} />
                <TextInput name="note" placeholder="Note (optional)" aria-label="Note" defaultValue={brand.sizeGuide?.note ?? ""} />
                <SubmitButton variant="outline">Save size guide</SubmitButton>
              </ActionForm>
            </Panel>
            <Panel title="Buyer alerts">
              <p className="text-sm text-umber-700">{alerts[0]?.n ?? 0} sale / restock subscriptions.</p>
            </Panel>
          </>
        }
      />
    </div>
  );
}
