import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { approveApplicationAction, reviewApplicationAction, saveReviewerNotesAction } from "@/app/actions/admin/applications";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextArea, TextInput } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DetailGrid, KV, Panel, StatusBadge } from "@/components/admin/ui";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users, vendorApplications } from "@/lib/db/schema";
import { formatDateTime, REGION_LABELS } from "@/lib/utils/format";

export const metadata = { title: "Application" };

export default async function ApplicationDetail(props: PageProps<"/admin/applications/[id]">) {
  const user = await requireStaff("vendors.view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const a = await d.query.vendorApplications.findFirst({ where: eq(vendorApplications.id, id), with: { category: true } });
  if (!a) notFound();
  const reviewer = a.reviewerId ? await d.query.users.findFirst({ where: eq(users.id, a.reviewerId) }) : null;
  const canVerify = user.permissions.has("vendors.verify");
  const open = !["approved", "rejected"].includes(a.status);

  const main = (
    <>
      {a.status === "approved" && a.vendorId ? (
        <Notice tone="success" title="Approved">
          The artisan profile was created.{" "}
          <Link href={`/admin/artisans/${a.vendorId}`} className="font-medium underline">
            Continue verification on the artisan page →
          </Link>
        </Notice>
      ) : null}
      <Panel title="Applicant">
        <KV
          items={[
            ["Name", a.fullName],
            ["Email", <a key="e" href={`mailto:${a.email}`} className="text-indigo-800 hover:underline">{a.email}</a>],
            ["Phone", a.phone ?? "—"],
            ["Craft", a.craft],
            ["Category", a.category?.name ?? "—"],
            ["Workshop", [a.workshopCity, a.workshopRegion ? REGION_LABELS[a.workshopRegion] : null].filter(Boolean).join(", ") || "—"],
            ["Years practising", a.yearsPracticing ?? "—"],
            ["Exported before", a.exportedBefore ? <Badge key="x" tone="success">Yes</Badge> : "No"],
            ["Portfolio", a.portfolioUrl ? <a key="p" href={a.portfolioUrl} target="_blank" rel="noreferrer" className="text-indigo-800 underline">{a.portfolioUrl}</a> : "—"],
            ["Instagram", a.instagram ?? "—"],
            ["Video", a.videoUrl ? <a key="v" href={a.videoUrl} target="_blank" rel="noreferrer" className="text-indigo-800 underline">Watch</a> : "—"],
            ["Received", formatDateTime(a.createdAt)],
          ]}
        />
      </Panel>
      <Panel title="Their story">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-umber-800">{a.story ?? <span className="text-umber-400">No story given.</span>}</p>
      </Panel>
      <Panel title={`Sample work (${a.samplePhotoUrls.length})`}>
        {a.samplePhotoUrls.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {a.samplePhotoUrls.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl ring-1 ring-umber-200 hover:ring-gold-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Sample by ${a.fullName}`} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                {u.startsWith("/art/") ? <span className="absolute bottom-1 left-1 rounded bg-indigo-950/70 px-1.5 text-[10px] text-sand-50">illustration</span> : null}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-umber-500">No sample photos — ask for some before approving.</p>
        )}
      </Panel>
      <Panel title="Reviewer notes" description="Visible to staff only. Decisions are appended automatically.">
        <ActionForm action={saveReviewerNotesAction} className="space-y-2">
          <input type="hidden" name="applicationId" value={a.id} />
          <TextArea name="reviewerNotes" defaultValue={a.reviewerNotes ?? ""} rows={5} />
          <SubmitButton variant="outline">Save notes</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Decision">
        <KV items={[["Status", <StatusBadge key="s" kind="application" status={a.status} />], ["Reviewer", reviewer?.name ?? "—"], ["Decided", a.decidedAt ? formatDateTime(a.decidedAt) : "—"]]} />
        {canVerify && open ? (
          <div className="mt-4 space-y-4 border-t border-umber-200 pt-4">
            {a.status === "submitted" ? (
              <ActionButton action={reviewApplicationAction} fields={{ applicationId: a.id, op: "in_review" }}>
                Start review
              </ActionButton>
            ) : null}
            <ActionForm action={approveApplicationAction} inline className="space-y-2 rounded-xl bg-success-50/60 p-3">
              <input type="hidden" name="applicationId" value={a.id} />
              <FieldRow label="Shop name">
                <TextInput name="displayName" defaultValue={a.fullName.replace(/^Demo Applicant — /, "")} required />
              </FieldRow>
              <FieldRow label="Welcome note (optional, emailed)">
                <TextArea name="welcome" rows={2} className="min-h-14" />
              </FieldRow>
              <SubmitButton variant="primary" confirm="Approve and create the artisan account?">
                Approve &amp; invite
              </SubmitButton>
              <p className="text-xs text-umber-600">Creates the account (random password, emailed) and an artisan profile in review with pending checks.</p>
            </ActionForm>
            <ActionForm action={reviewApplicationAction} className="space-y-2">
              <input type="hidden" name="applicationId" value={a.id} />
              <input type="hidden" name="op" value="more_info" />
              <TextArea name="message" rows={2} placeholder="What do you need from them? (emailed)" className="min-h-14" required />
              <SubmitButton variant="outline">Request more info</SubmitButton>
            </ActionForm>
            <ActionForm action={reviewApplicationAction} className="space-y-2">
              <input type="hidden" name="applicationId" value={a.id} />
              <input type="hidden" name="op" value="reject" />
              <TextInput name="message" placeholder="Reason (emailed)" required />
              <SubmitButton variant="danger" confirm="Reject this application?">
                Reject
              </SubmitButton>
            </ActionForm>
          </div>
        ) : null}
      </Panel>
      <NotesPanel entity="application" entityId={a.id} currentUserId={user.id} />
      <AuditTrail entity="application" entityId={a.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Applications", href: "/admin/applications" }, { label: a.fullName }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {a.fullName} <StatusBadge kind="application" status={a.status} className="font-sans text-sm" />
          </span>
        }
        description={`${a.craft} · ${a.workshopCity ?? "city not given"}`}
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
