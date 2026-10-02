import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { deletePageAction, updatePageAction } from "@/app/actions/admin/content";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/admin/controls";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { AuditTrail } from "@/components/admin/notes-panel";
import { KV, Panel, StatusBadge } from "@/components/admin/ui";
import { Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { pages } from "@/lib/db/schema";
import { POLICY_SLUGS } from "@/lib/admin/content";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Edit page" };

export default async function EditPage(props: PageProps<"/admin/content/pages/[slug]">) {
  await requireStaff("content.manage");
  const { slug } = await props.params;
  const d = await db();
  const p = await d.query.pages.findFirst({ where: eq(pages.slug, decodeURIComponent(slug)) });
  if (!p) notFound();
  const policy = POLICY_SLUGS.includes(p.slug);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Pages & FAQ", href: "/admin/content/pages" }, { label: p.title }]} />
      <PageHeader
        title={p.title}
        description={`/${p.slug} · last saved ${formatDateTime(p.updatedAt)}`}
        actions={
          p.status === "published" ? (
            <a href={`/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-umber-200 bg-white px-3.5 text-sm font-medium text-umber-900 hover:bg-umber-50">
              View live <ExternalLink className="size-3.5" />
            </a>
          ) : null
        }
      />
      {/pending|draft —/i.test(p.body) ? (
        <Notice tone="pending" title="This page contains pending notes">
          Replace the “pending” / “draft” notes with the confirmed policy before launch — buyers see exactly what&apos;s written here.
        </Notice>
      ) : null}
      <ActionForm action={updatePageAction} inline className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <input type="hidden" name="slug" value={p.slug} />
        <div className="min-w-0 space-y-4">
          <FieldRow label="Title">
            <TextInput name="title" defaultValue={p.title} required maxLength={160} />
          </FieldRow>
          <MarkdownEditor name="body" defaultValue={p.body} rows={24} />
        </div>
        <aside className="space-y-6">
          <Panel title="Publish">
            <div className="space-y-3">
              <FieldRow label="Status">
                <SelectInput name="status" defaultValue={p.status}>
                  <option value="draft">Draft — hidden</option>
                  <option value="published">Published</option>
                </SelectInput>
              </FieldRow>
              <FieldRow label="URL" hint={policy ? "Policy pages keep their URL." : "Lower-case letters, numbers and dashes."}>
                <TextInput name="newSlug" defaultValue={p.slug} readOnly={policy} required />
              </FieldRow>
              <FieldRow label="Search description" hint="Shown under the title and in search results (~155 characters).">
                <TextArea name="seoDescription" defaultValue={p.seoDescription ?? ""} rows={3} maxLength={300} />
              </FieldRow>
              <KV items={[["Currently", <StatusBadge key="s" kind="publish" status={p.status} />]]} />
              <SubmitButton variant="primary" className="w-full justify-center">
                Save
              </SubmitButton>
            </div>
          </Panel>
        </aside>
      </ActionForm>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AuditTrail entity="page" entityId={p.slug} title="Edit history" />
        {!policy ? (
          <Panel title="Danger zone">
            <ActionButton action={deletePageAction} fields={{ slug: p.slug }} variant="danger" confirm={`Delete /${p.slug}? Links to it will 404.`}>
              Delete page
            </ActionButton>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
