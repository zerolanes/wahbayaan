import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { createFaqAction, createPageAction, deleteFaqAction, moveFaqAction, updateFaqAction } from "@/app/actions/admin/content";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { Empty, MiniStat, Panel, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { faqs, pages } from "@/lib/db/schema";
import { POLICY_SLUGS } from "@/lib/admin/content";
import { formatDate, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Pages & FAQ" };

export default async function PagesPage() {
  await requireStaff("content.manage");
  const d = await db();
  const [rows, faqRows] = await Promise.all([d.select().from(pages).orderBy(asc(pages.title)), d.select().from(faqs).orderBy(asc(faqs.sort))]);
  const groups = [...new Set(faqRows.map((f) => f.group))];
  const drafts = rows.filter((p) => p.status !== "published").length;
  const pendingPolicies = rows.filter((p) => POLICY_SLUGS.includes(p.slug) && /pending|draft —/i.test(p.body)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Pages & FAQ"
        description="Policy and information pages served at their own URL (e.g. /terms), written in Markdown. Published FAQ answers appear on How importing works."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Pages" value={String(rows.length)} hint={`${rows.length - drafts} published`} />
        <MiniStat label="Drafts" value={String(drafts)} />
        <MiniStat label="Policies marked pending" value={String(pendingPolicies)} tone={pendingPolicies ? "pending" : undefined} hint="Contain “pending” or “draft” notes" />
        <MiniStat label="FAQ answers" value={String(faqRows.length)} hint={`${faqRows.filter((f) => f.isPublished).length} published · ${groups.length} groups`} />
      </div>

      <TableCard
        toolbar={
          <ActionForm action={createPageAction} className="flex flex-wrap items-center gap-2">
            <div className="w-64">
              <TextInput name="title" placeholder="New page title, e.g. About us" required aria-label="Title" />
            </div>
            <div className="w-48">
              <TextInput name="slug" placeholder="URL (optional), e.g. about" aria-label="URL" />
            </div>
            <SubmitButton variant="primary">New page</SubmitButton>
          </ActionForm>
        }
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Page</Th>
                <Th>URL</Th>
                <Th className="text-right">Words</Th>
                <Th>Updated</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <Tr key={p.slug}>
                  <Td>
                    <Link href={`/admin/content/pages/${p.slug}`} className="font-medium text-indigo-800 hover:underline">
                      {p.title}
                    </Link>
                    {POLICY_SLUGS.includes(p.slug) ? <Badge className="ml-2">Policy</Badge> : null}
                    {/pending|draft —/i.test(p.body) ? <Badge tone="pending" className="ml-1.5">Has pending notes</Badge> : null}
                  </Td>
                  <Td className="text-sm">
                    {p.status === "published" ? (
                      <a href={`/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-umber-700 hover:underline">
                        /{p.slug} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-umber-500">/{p.slug}</span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums text-umber-600">{p.body.trim() ? p.body.trim().split(/\s+/).length : 0}</Td>
                  <Td className="text-sm text-umber-600" title={formatDate(p.updatedAt)}>
                    {timeAgo(p.updatedAt)}
                  </Td>
                  <Td>
                    <StatusBadge kind="publish" status={p.status} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No pages yet.</Empty>
        )}
      </TableCard>

      <Panel title="FAQ" description="Grouped questions, in display order. Answers are plain text." bodyClassName="p-0">
        {faqRows.length ? (
          <ul className="divide-y divide-umber-200/60">
            {faqRows.map((f) => (
              <li key={f.id} className="px-5 py-3">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-xs text-umber-500">{f.group}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-umber-900">{f.question}</span>
                    {!f.isPublished ? <Badge>Hidden</Badge> : null}
                    <span className="flex">
                      <ActionButton action={moveFaqAction} fields={{ id: f.id, dir: "up" }} variant="ghost" title="Move up">
                        <ArrowUp className="size-3.5" />
                      </ActionButton>
                      <ActionButton action={moveFaqAction} fields={{ id: f.id, dir: "down" }} variant="ghost" title="Move down">
                        <ArrowDown className="size-3.5" />
                      </ActionButton>
                    </span>
                  </summary>
                  <ActionForm action={updateFaqAction} inline className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
                    <input type="hidden" name="id" value={f.id} />
                    <TextInput name="group" defaultValue={f.group} aria-label="Group" list="faq-groups" required />
                    <TextInput name="question" defaultValue={f.question} aria-label="Question" required />
                    <TextArea name="answer" defaultValue={f.answer} rows={3} aria-label="Answer" className="sm:col-span-2" required />
                    <div className="flex items-center justify-between gap-3 sm:col-span-2">
                      <Toggle name="isPublished" label="Published" defaultChecked={f.isPublished} />
                      <SubmitButton>Save</SubmitButton>
                    </div>
                  </ActionForm>
                  <ActionButton action={deleteFaqAction} fields={{ id: f.id }} variant="ghost" confirm="Delete this question?" className="mt-1">
                    Delete
                  </ActionButton>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-umber-500">No questions yet.</p>
        )}
        <ActionForm action={createFaqAction} resetOnSuccess className="grid gap-2 border-t border-umber-200/60 px-5 py-4 sm:grid-cols-[10rem_1fr]">
          <TextInput name="group" placeholder="Group" defaultValue={groups[0] ?? "General"} list="faq-groups" aria-label="Group" required />
          <TextInput name="question" placeholder="New question" aria-label="Question" required />
          <TextArea name="answer" placeholder="Answer" rows={2} aria-label="Answer" className="sm:col-span-2" required />
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <Toggle name="isPublished" label="Published" defaultChecked />
            <SubmitButton variant="primary">Add question</SubmitButton>
          </div>
        </ActionForm>
        <datalist id="faq-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </Panel>
    </div>
  );
}
