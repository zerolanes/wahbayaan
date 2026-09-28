import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { createJournalAction } from "@/app/actions/admin/content";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { TextInput } from "@/components/admin/controls";
import { DemoBadge, Empty, FilterBar, FilterSelect, MiniStat, TableCard, Thumb } from "@/components/admin/ui";
import { Badge, PageHeader, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, journalPosts } from "@/lib/db/schema";
import { postState, type PostState } from "@/lib/admin/content";
import { hrefWith, str } from "@/lib/admin/params";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Journal" };

const TONE: Record<PostState, "neutral" | "indigo" | "success"> = { draft: "neutral", scheduled: "indigo", published: "success" };

export default async function JournalAdmin(props: PageProps<"/admin/content/journal">) {
  await requireStaff("content.manage");
  const params = await props.searchParams;
  const d = await db();
  const rows = await d
    .select({ p: journalPosts, category: categories.name })
    .from(journalPosts)
    .leftJoin(categories, eq(categories.id, journalPosts.categoryId))
    .orderBy(desc(journalPosts.updatedAt));
  const now = new Date();
  const withState = rows.map((r) => ({ ...r, state: postState(r.p, now) }));
  const tab = str(params, "state");
  const q = str(params, "q").toLowerCase();
  const cat = str(params, "category");
  const list = withState.filter((r) => (!tab || r.state === tab) && (!q || r.p.title.toLowerCase().includes(q) || (r.p.excerpt ?? "").toLowerCase().includes(q)) && (!cat || r.p.categoryId === cat));
  const count = (s: PostState) => withState.filter((r) => r.state === s).length;
  const cats = [...new Map(rows.filter((r) => r.p.categoryId).map((r) => [r.p.categoryId!, r.category ?? ""])).entries()];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content" title="Journal" description="Heritage stories published at /journal. A published post with a future date is scheduled and appears automatically at that time (UTC)." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Published" value={String(count("published"))} />
        <MiniStat label="Scheduled" value={String(count("scheduled"))} hint={withState.filter((r) => r.state === "scheduled").sort((a, b) => +a.p.publishedAt! - +b.p.publishedAt!)[0]?.p.publishedAt ? `Next ${formatDate(withState.filter((r) => r.state === "scheduled").sort((a, b) => +a.p.publishedAt! - +b.p.publishedAt!)[0].p.publishedAt)}` : undefined} />
        <MiniStat label="Drafts" value={String(count("draft"))} />
        <MiniStat label="Missing cover or excerpt" value={String(withState.filter((r) => !r.p.coverImageUrl || !r.p.excerpt).length)} hint="Cards look bare without them" />
      </div>
      <Tabs
        items={[
          { v: "", l: "All", n: rows.length },
          { v: "published", l: "Published", n: count("published") },
          { v: "scheduled", l: "Scheduled", n: count("scheduled") },
          { v: "draft", l: "Drafts", n: count("draft") },
        ].map((t) => ({ label: t.l, href: hrefWith("/admin/content/journal", params, { state: t.v || null }), active: tab === t.v, count: t.n }))}
      />
      <TableCard
        toolbar={
          <>
            <FilterBar action="/admin/content/journal" q={str(params, "q")} placeholder="Title or excerpt">
              {tab ? <input type="hidden" name="state" value={tab} /> : null}
              <FilterSelect name="category" label="Category" value={cat} options={cats.map(([value, label]) => ({ value, label }))} />
            </FilterBar>
            <ActionForm action={createJournalAction} className="flex items-center gap-2">
              <div className="w-64">
                <TextInput name="title" placeholder="New post title" required aria-label="Title" />
              </div>
              <SubmitButton variant="primary">New post</SubmitButton>
            </ActionForm>
          </>
        }
      >
        {list.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Post</Th>
                <Th>Category</Th>
                <Th>Author</Th>
                <Th>Publish date</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {list.map(({ p, category, state }) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Thumb src={p.coverImageUrl} alt={p.title} size={48} kind={p.coverImageUrl?.startsWith("/art/") ? "illustration" : "photo"} />
                      <div className="min-w-0">
                        <Link href={`/admin/content/journal/${p.id}`} className="font-medium text-indigo-800 hover:underline">
                          {p.title}
                        </Link>{" "}
                        <DemoBadge show={p.isDemo} />
                        <p className="max-w-lg truncate text-xs text-umber-500">{p.excerpt ?? <span className="text-pending-600">No excerpt</span>}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-sm">{category ?? "—"}</Td>
                  <Td className="text-sm text-umber-600">{p.authorName ?? "—"}</Td>
                  <Td className="text-sm whitespace-nowrap text-umber-600">{p.publishedAt ? formatDateTime(p.publishedAt) : "—"}</Td>
                  <Td>
                    <Badge tone={TONE[state]}>{state}</Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>{rows.length ? "No posts match." : "No journal posts yet — start one above."}</Empty>
        )}
      </TableCard>
    </div>
  );
}
