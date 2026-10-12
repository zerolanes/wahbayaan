import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { approveBrandApplicationAction, reviewBrandApplicationAction, saveBrandApplicationNotesAction } from "@/app/actions/admin/brand-applications";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextArea, TextInput } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DetailGrid, KV, Panel, StatusBadge } from "@/components/admin/ui";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { can, requireStaff } from "@/lib/auth/session";
import { acceptanceGate } from "@/lib/brand-portal/terms";
import { slugify } from "@/lib/brands/adapters/normalize";
import { db } from "@/lib/db/client";
import { brands, brandSellerApplications, brandTermsAcceptances, users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Brand application" };

export default async function BrandApplicationDetail(props: PageProps<"/admin/applications/brand/[id]">) {
  const user = await requireStaff("vendors.view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const a = await d.query.brandSellerApplications.findFirst({ where: eq(brandSellerApplications.id, id) });
  if (!a) notFound();
  const [acceptances, reviewer, account] = await Promise.all([
    d.select().from(brandTermsAcceptances).where(eq(brandTermsAcceptances.applicationId, a.id)).orderBy(desc(brandTermsAcceptances.acceptedAt)),
    a.reviewerId ? d.query.users.findFirst({ where: eq(users.id, a.reviewerId), columns: { name: true } }) : null,
    a.userId ? d.query.users.findFirst({ where: eq(users.id, a.userId), columns: { email: true, role: true } }) : null,
  ]);
  const acc = acceptances[0];
  const gate = acceptanceGate(acc ? { ...acc, userId: acc.userId ?? a.userId } : null);
  const suggestedSlug = slugify(a.brandName);
  const existing = suggestedSlug ? await d.query.brands.findFirst({ where: eq(brands.slug, suggestedSlug), columns: { id: true, name: true, partnership: true } }) : null;
  const open = !["approved", "rejected"].includes(a.status);
  const canVerify = can(user, "vendors.verify");
  const canApprove = can(user, "brands.permission");

  const main = (
    <>
      {a.status === "approved" && a.brandId ? (
        <Notice tone="success" title="Approved">
          The brand is authorised from its terms acceptance.{" "}
          <Link href={`/admin/brands/${a.brandId}`} className="font-medium underline">
            Open the brand →
          </Link>
        </Notice>
      ) : null}
      <Panel title="Brand">
        <KV
          items={[
            ["Brand", a.brandName],
            ["Sells", a.productTypes ?? "—"],
            ["For", a.audiences.join(", ") || "—"],
            ["Products", a.catalogueSize ?? "—"],
            ["City", a.city ?? "—"],
            ["Website", a.websiteUrl ? <a key="w" href={a.websiteUrl} target="_blank" rel="noreferrer" className="text-indigo-800 underline">{a.websiteUrl}</a> : "—"],
            ["Instagram", a.instagram ? <a key="i" href={`https://instagram.com/${a.instagram}`} target="_blank" rel="noreferrer" className="text-indigo-800 underline">@{a.instagram}</a> : "—"],
            ["Received", formatDateTime(a.createdAt)],
          ]}
        />
        {a.about ? <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-umber-800">{a.about}</p> : null}
      </Panel>
      <Panel title="Contact">
        <KV
          items={[
            ["Name", a.contactName],
            ["Role", a.contactRole ?? "—"],
            ["Email", <a key="e" href={`mailto:${a.email}`} className="text-indigo-800 hover:underline">{a.email}</a>],
            ["Phone", a.phone ?? "—"],
            ["Account", account ? `${account.email} (${account.role})` : "—"],
          ]}
        />
      </Panel>
      <Panel title="Seller terms acceptance" description="This is the brand's permission record: on approval the brand becomes an authorised partner with it — no separate permission needed.">
        {acc ? (
          <KV
            items={[
              ["Accepted by", `${acc.name} <${acc.email}>`],
              ["When", formatDateTime(acc.acceptedAt)],
              ["Terms version", acc.termsVersion],
              ["IP / browser", <span key="ip" className="text-xs text-umber-500">{[acc.ipAddress, acc.userAgent?.slice(0, 80)].filter(Boolean).join(" · ") || "—"}</span>],
              ["Valid as permission", gate.ok ? <Badge key="g" tone="success">Yes</Badge> : <Badge key="g" tone="danger">{gate.reason}</Badge>],
            ]}
          />
        ) : (
          <Notice tone="danger" title="No acceptance recorded">This application can't be approved.</Notice>
        )}
      </Panel>
      <Panel title="Reviewer notes" description="Staff only. Decisions are appended automatically.">
        <ActionForm action={saveBrandApplicationNotesAction} className="space-y-2">
          <input type="hidden" name="applicationId" value={a.id} />
          <TextArea name="reviewerNotes" defaultValue={a.reviewerNotes ?? ""} rows={5} aria-label="Reviewer notes" />
          <SubmitButton variant="outline">Save notes</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Decision">
        <KV items={[["Status", <StatusBadge key="s" kind="application" status={a.status} />], ["Reviewer", reviewer?.name ?? "—"], ["Decided", a.decidedAt ? formatDateTime(a.decidedAt) : "—"]]} />
        {open ? (
          <div className="mt-4 space-y-4 border-t border-umber-200 pt-4">
            {canVerify && a.status === "submitted" ? (
              <ActionButton action={reviewBrandApplicationAction} fields={{ applicationId: a.id, op: "in_review" }}>
                Start review
              </ActionButton>
            ) : null}
            {canApprove ? (
              <ActionForm action={approveBrandApplicationAction} inline className="space-y-2 rounded-xl bg-success-50/60 p-3">
                <input type="hidden" name="applicationId" value={a.id} />
                <FieldRow label="Brand name" htmlFor="brandName">
                  <TextInput id="brandName" name="brandName" defaultValue={a.brandName} required />
                </FieldRow>
                <FieldRow label="Page address" htmlFor="slug" hint={existing ? `/brands/${suggestedSlug} exists (${existing.name}, ${existing.partnership}). Keeping it links that draft brand to this account — confirm they represent it.` : `/brands/${suggestedSlug}`}>
                  <TextInput id="slug" name="slug" defaultValue={suggestedSlug} required />
                </FieldRow>
                <SubmitButton variant="primary" disabled={!gate.ok} confirm="Approve? The brand becomes an authorised partner with its own portal.">
                  Approve brand
                </SubmitButton>
                <p className="text-xs text-umber-600">Verify they represent the brand (e.g. email from its domain, Instagram DM) before approving.</p>
              </ActionForm>
            ) : (
              <p className="text-xs text-umber-500">Approving needs the “brands.permission” permission.</p>
            )}
            {canVerify ? (
              <>
                <ActionForm action={reviewBrandApplicationAction} className="space-y-2">
                  <input type="hidden" name="applicationId" value={a.id} />
                  <input type="hidden" name="op" value="more_info" />
                  <TextArea name="message" rows={2} placeholder="What do you need? (emailed)" className="min-h-14" required aria-label="Request more info" />
                  <SubmitButton variant="outline">Request more info</SubmitButton>
                </ActionForm>
                <ActionForm action={reviewBrandApplicationAction} className="space-y-2">
                  <input type="hidden" name="applicationId" value={a.id} />
                  <input type="hidden" name="op" value="reject" />
                  <TextInput name="message" placeholder="Reason (emailed)" required aria-label="Reason for rejecting" />
                  <SubmitButton variant="danger" confirm="Reject this application?">
                    Reject
                  </SubmitButton>
                </ActionForm>
              </>
            ) : null}
          </div>
        ) : null}
      </Panel>
      <NotesPanel entity="brand_application" entityId={a.id} currentUserId={user.id} />
      <AuditTrail entity="brand_application" entityId={a.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Brand applications", href: "/admin/applications?type=brand" }, { label: a.brandName }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {a.brandName} <StatusBadge kind="application" status={a.status} className="font-sans text-sm" />
          </span>
        }
        description={`${a.contactName}${a.contactRole ? ` (${a.contactRole})` : ""} · ${a.city ?? "city not given"}`}
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
