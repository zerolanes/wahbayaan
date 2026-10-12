import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import {
  addAffiliateProductAction,
  fetchAffiliateFeedAction,
  setAffiliateDisplayPermissionAction,
  toggleAffiliateProductAction,
  updateAffiliateProgrammeAction,
  uploadAffiliateFeedAction,
} from "@/app/actions/admin/affiliates";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AffiliateFields } from "@/components/admin/affiliate-fields";
import { FieldRow, TextArea, TextInput } from "@/components/admin/controls";
import { SwitchSubmit } from "@/components/admin/switch";
import { AuditTrail } from "@/components/admin/notes-panel";
import { DemoBadge, DetailGrid, Empty, KV, Panel, TableCard, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { can, requireStaff } from "@/lib/auth/session";
import { affiliateDisplayGate, buildTrackingLink, hasDisplayPermission, isAffiliateProductDisplayable } from "@/lib/affiliate";
import { db } from "@/lib/db/client";
import { affiliateProducts, affiliateProgrammes, users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Affiliate programme" };

export default async function AffiliateProgrammePage(props: PageProps<"/admin/affiliates/[id]">) {
  const user = await requireStaff("brands.view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const p = await d.query.affiliateProgrammes.findFirst({ where: eq(affiliateProgrammes.id, id) });
  if (!p) notFound();
  const [products, by] = await Promise.all([
    d.select().from(affiliateProducts).where(eq(affiliateProducts.programmeId, p.id)).orderBy(asc(affiliateProducts.isHidden), asc(affiliateProducts.title)).limit(500),
    p.displayAllowedById ? d.query.users.findFirst({ where: eq(users.id, p.displayAllowedById), columns: { name: true, email: true } }) : null,
  ]);
  const gate = affiliateDisplayGate(p);
  const canManage = can(user, "brands.manage");
  const canPermit = can(user, "brands.permission");
  const shown = products.filter((x) => isAffiliateProductDisplayable(p, x)).length;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Affiliate programmes", href: "/admin/affiliates" }, { label: p.name }]} />
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {p.name} <DemoBadge show={p.isDemo} />
          </span>
        }
        description={gate.ok ? `Live: ${shown} partner cards on the storefront.` : `Not shown on the storefront — ${gate.reason}`}
      />
      <DetailGrid
        main={
          <>
            <Panel title="Programme">
              {canManage ? (
                <ActionForm action={updateAffiliateProgrammeAction} className="space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <AffiliateFields p={p} />
                  <SubmitButton>Save programme</SubmitButton>
                </ActionForm>
              ) : (
                <KV items={[["Store", p.brandName], ["Network", p.network ?? "—"], ["Status", p.status], ["Terms", p.termsUrl ?? "—"]]} />
              )}
            </Panel>

            <Panel title="Products" description="Upload the programme's CSV feed or fetch it from the feed URL. Columns: id/sku, title/name, url/link, image/image_link, price (PKR), category. Re-imports update by id; products missing from the feed are hidden.">
              {canManage ? (
                <div className="mb-5 grid gap-4 lg:grid-cols-2">
                  <ActionForm action={uploadAffiliateFeedAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">CSV upload</span>
                      <input type="file" name="feed" accept=".csv,text/csv" required className="text-sm" />
                    </label>
                    <SubmitButton variant="outline">Upload</SubmitButton>
                  </ActionForm>
                  <div className="flex items-end gap-2">
                    <ActionButton action={fetchAffiliateFeedAction} fields={{ id: p.id }} variant="outline">
                      Fetch feed URL
                    </ActionButton>
                    <span className="text-xs text-umber-500">{p.feedUrl ? p.feedUrl : "No feed URL set"}</span>
                  </div>
                </div>
              ) : null}
              <TableCard>
                {products.length ? (
                  <Table>
                    <THead>
                      <tr>
                        <Th>Product</Th>
                        <Th>Feed price</Th>
                        <Th>Link</Th>
                        <Th>Shown</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {products.map((x) => {
                        const link = buildTrackingLink(p.trackingTemplate, x.productUrl);
                        return (
                          <Tr key={x.id}>
                            <Td>
                              <div className="flex items-center gap-3">
                                <Thumb src={x.imageUrl} alt={x.title} size={40} />
                                <div className="min-w-0">
                                  <p className="font-medium">{x.title}</p>
                                  <p className="max-w-72 truncate text-xs text-umber-500">{x.productUrl}</p>
                                </div>
                              </div>
                            </Td>
                            <Td className="text-sm">
                              <SellerPrice pkr={x.pricePkr} />
                            </Td>
                            <Td className="text-xs">{link ? <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="text-indigo-800 underline">Test link</a> : <Badge tone="pending">No template</Badge>}</Td>
                            <Td>
                              {canManage ? (
                                <ActionForm action={toggleAffiliateProductAction}>
                                  <input type="hidden" name="id" value={p.id} />
                                  <input type="hidden" name="productId" value={x.id} />
                                  <SwitchSubmit on={!x.isHidden} label={`Show ${x.title}`} />
                                </ActionForm>
                              ) : x.isHidden ? (
                                "Hidden"
                              ) : (
                                "Shown"
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </Table>
                ) : (
                  <Empty>No products yet.</Empty>
                )}
              </TableCard>
              {canManage ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">Add a product by hand</summary>
                  <ActionForm action={addAffiliateProductAction} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={p.id} />
                    <FieldRow label="Title">
                      <TextInput name="title" required />
                    </FieldRow>
                    <FieldRow label="Product link (https)">
                      <TextInput name="productUrl" required />
                    </FieldRow>
                    <FieldRow label="Image link (https)">
                      <TextInput name="imageUrl" />
                    </FieldRow>
                    <FieldRow label="Category">
                      <TextInput name="category" />
                    </FieldRow>
                    <FieldRow label="Price in the feed (Rs, reference only)">
                      <TextInput name="price" inputMode="decimal" />
                    </FieldRow>
                    <div className="flex items-end">
                      <SubmitButton variant="outline">Add product</SubmitButton>
                    </div>
                  </ActionForm>
                </details>
              ) : null}
            </Panel>
          </>
        }
        side={
          <>
            <Panel title="Feed display permission" description="Feed products and images are shown only when the programme's terms allow it.">
              {hasDisplayPermission(p) ? (
                <KV
                  items={[
                    ["Terms allow display", <Badge key="y" tone="success">Recorded</Badge>],
                    ["By", by ? `${by.name} (${by.email})` : "—"],
                    ["When", formatDateTime(p.displayAllowedAt)],
                    ["Where in the terms", <span key="n" className="whitespace-pre-wrap">{p.displayAllowedNote}</span>],
                  ]}
                />
              ) : (
                <Notice tone="pending" title="Not recorded">Nothing from this feed is shown on the storefront.</Notice>
              )}
              {canPermit ? (
                <ActionForm action={setAffiliateDisplayPermissionAction} className="mt-4 space-y-2" key={p.displayAllowedAt?.toISOString() ?? "none"}>
                  <input type="hidden" name="id" value={p.id} />
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="allowed" defaultChecked={p.displayAllowed} className="mt-1 size-4" />
                    <span>Terms allow displaying feed products and images</span>
                  </label>
                  <TextArea name="note" rows={3} placeholder="Clause / section and date, e.g. “Publisher terms §4.2 (Oct 2026): product data and images may be displayed”" defaultValue={p.displayAllowedNote ?? ""} aria-label="Where the terms allow it" />
                  <SubmitButton variant="outline">Save</SubmitButton>
                </ActionForm>
              ) : null}
            </Panel>
            <AuditTrail entity="affiliate_programme" entityId={p.id} />
          </>
        }
      />
    </div>
  );
}
