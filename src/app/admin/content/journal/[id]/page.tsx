import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { deleteJournalAction, updateJournalAction } from "@/app/actions/admin/content";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/admin/controls";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { AuditTrail } from "@/components/admin/notes-panel";
import { DemoBadge, Panel } from "@/components/admin/ui";
import { Badge, Breadcrumbs, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, journalPosts } from "@/lib/db/schema";
import { postState } from "@/lib/admin/content";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Edit journal post" };

const dt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16) : "");

export default async function EditJournal(props: PageProps<"/admin/content/journal/[id]">) {
  await requireStaff("content.manage");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const [p, cats] = await Promise.all([d.query.journalPosts.findFirst({ where: eq(journalPosts.id, id) }), d.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sort))]);
  if (!p) notFound();
  const state = postState(p);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Journal", href: "/admin/content/journal" }, { label: p.title }]} />
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {p.title} <DemoBadge show={p.isDemo} />
          </span>
        }
        description={
          <span className="flex items-center gap-2">
            <Badge tone={state === "published" ? "success" : state === "scheduled" ? "indigo" : "neutral"}>{state}</Badge>
            {state === "scheduled" ? `goes live ${formatDateTime(p.publishedAt)} UTC` : `/journal/${p.slug}`} · saved {formatDateTime(p.updatedAt)}
          </span>
        }
        actions={
          state === "published" ? (
            <a href={`/journal/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-umber-200 bg-white px-3.5 text-sm font-medium text-umber-900 hover:bg-umber-50">
              View live <ExternalLink className="size-3.5" />
            </a>
          ) : null
        }
      />
      <ActionForm action={updateJournalAction} inline className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <input type="hidden" name="id" value={p.id} />
        <div className="min-w-0 space-y-4">
          <FieldRow label="Title">
            <TextInput name="title" defaultValue={p.title} required maxLength={200} />
          </FieldRow>
          <FieldRow label="Excerpt" hint="One or two sentences for cards and the article intro.">
            <TextArea name="excerpt" defaultValue={p.excerpt ?? ""} rows={2} maxLength={400} />
          </FieldRow>
          <MarkdownEditor name="body" defaultValue={p.body} rows={26} />
        </div>
        <aside className="space-y-6">
          <Panel title="Publishing">
            <div className="space-y-3">
              <FieldRow label="Status">
                <SelectInput name="status" defaultValue={p.status}>
                  <option value="draft">Draft</option>
                  <option value="published">Published / scheduled</option>
                </SelectInput>
              </FieldRow>
              <FieldRow label="Publish date (UTC)" hint="A future date schedules the post. Empty = now.">
                <TextInput type="datetime-local" name="publishedAt" defaultValue={dt(p.publishedAt)} />
              </FieldRow>
              <SubmitButton variant="primary" className="w-full justify-center">
                Save
              </SubmitButton>
            </div>
          </Panel>
          <Panel title="Details">
            <div className="space-y-3">
              <FieldRow label="URL" hint="/journal/…">
                <TextInput name="slug" defaultValue={p.slug} required />
              </FieldRow>
              <FieldRow label="Category" hint="Links the post to that craft's pieces.">
                <SelectInput name="categoryId" defaultValue={p.categoryId ?? ""}>
                  <option value="">None</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </FieldRow>
              <FieldRow label="Author">
                <TextInput name="authorName" defaultValue={p.authorName ?? ""} />
              </FieldRow>
            </div>
          </Panel>
          <Panel title="Cover image">
            <div className="space-y-3">
              {p.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImageUrl} alt={`${p.title} cover`} className="aspect-[16/9] w-full rounded-lg bg-umber-100 object-cover" />
              ) : null}
              <ImageInput name="cover" label="Upload cover" />
              <FieldRow label="…or image URL">
                <TextInput name="coverImageUrl" defaultValue={p.coverImageUrl ?? ""} placeholder="/media/…" />
              </FieldRow>
            </div>
          </Panel>
          <Panel title="Search">
            <div className="space-y-3">
              <FieldRow label="SEO title">
                <TextInput name="seoTitle" defaultValue={p.seoTitle ?? ""} placeholder={p.title} maxLength={120} />
              </FieldRow>
              <FieldRow label="SEO description">
                <TextArea name="seoDescription" defaultValue={p.seoDescription ?? ""} rows={3} maxLength={300} placeholder={p.excerpt ?? ""} />
              </FieldRow>
            </div>
          </Panel>
        </aside>
      </ActionForm>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <AuditTrail entity="journal" entityId={p.id} title="Edit history" />
        <Panel title="Danger zone">
          <ActionButton action={deleteJournalAction} fields={{ id: p.id }} variant="danger" confirm={`Delete “${p.title}”?`}>
            Delete post
          </ActionButton>
        </Panel>
      </div>
    </div>
  );
}
