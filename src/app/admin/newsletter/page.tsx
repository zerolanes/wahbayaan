import Link from "next/link";
import { and, desc, sql } from "drizzle-orm";
import { addSubscriberAction, bulkNewsletterAction, setSubscriberStatusAction } from "@/app/actions/admin/newsletter";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { HBarList } from "@/components/admin/charts";
import { TextInput } from "@/components/admin/controls";
import { Empty, ExportLink, FilterBar, FilterDate, FilterSelect, MiniStat, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { newsletterSubscribers } from "@/lib/db/schema";
import { newsletterConditions } from "@/lib/admin/newsletter";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { percent, ratio } from "@/lib/admin/series";
import { query } from "@/lib/admin/sql";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Newsletter" };

export default async function NewsletterPage(props: PageProps<"/admin/newsletter">) {
  await requireStaff("marketing.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const where = and(...newsletterConditions(params));
  const [rows, [{ n }], sources, [stats]] = await Promise.all([
    d
      .select({ s: newsletterSubscribers, userId: sql<string | null>`(select u.id from users u where lower(u.email) = lower("newsletter_subscribers"."email") limit 1)` })
      .from(newsletterSubscribers)
      .where(where)
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(newsletterSubscribers).where(where),
    query<{ source: string | null; subscribed: number; total: number }>(sql`
      select source, count(*) filter (where status = 'subscribed')::int as subscribed, count(*)::int as total
      from newsletter_subscribers group by source order by subscribed desc`),
    query<{ subscribed: number; unsubscribed: number; new30: number; buyers: number; optin: number }>(sql`
      select
        count(*) filter (where status = 'subscribed')::int as subscribed,
        count(*) filter (where status <> 'subscribed')::int as unsubscribed,
        count(*) filter (where status = 'subscribed' and created_at >= now() - interval '30 days')::int as new30,
        count(*) filter (where status = 'subscribed' and exists (select 1 from users u where lower(u.email) = lower(s.email) and exists (select 1 from orders o where o.user_id = u.id and o.paid_at is not null)))::int as buyers,
        (select count(*)::int from users where role = 'buyer' and marketing_opt_in) as optin
      from newsletter_subscribers s`),
  ]);
  const total = Number(n);
  const allTime = stats.subscribed + stats.unsubscribed;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Growth"
        title="Newsletter"
        description="People who asked for the Wahbayaan newsletter, where they signed up, and who has left. Only export subscribed addresses for sending."
        actions={<ExportLink href={hrefWith("/admin/export/newsletter", params, { status: str(params, "status") || "subscribed" })}>Export subscribed</ExportLink>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MiniStat label="Subscribed" value={stats.subscribed.toLocaleString("en-US")} href="/admin/newsletter?status=subscribed" />
        <MiniStat label="New · 30 days" value={String(stats.new30)} />
        <MiniStat label="Unsubscribed" value={String(stats.unsubscribed)} hint={`${percent(ratio(stats.unsubscribed, allTime), 0)} of all sign-ups`} href="/admin/newsletter?status=unsubscribed" />
        <MiniStat label="Subscribers who bought" value={String(stats.buyers)} hint={`${percent(ratio(stats.buyers, stats.subscribed), 0)} of subscribers`} />
        <MiniStat label="Buyer accounts opted in" value={String(stats.optin)} hint="Marketing consent on the account" href="/admin/customers?marketing=1" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <FilterBar action="/admin/newsletter" q={str(params, "q")} placeholder="Email">
            <FilterSelect name="status" label="Status" value={str(params, "status")} options={[{ value: "subscribed", label: "Subscribed" }, { value: "unsubscribed", label: "Unsubscribed" }]} />
            <FilterSelect name="source" label="Source" value={str(params, "source")} options={sources.map((s) => ({ value: s.source ?? "none", label: s.source ?? "Unknown" }))} />
            <FilterSelect name="buyer" label="Account" value={str(params, "buyer")} options={[{ value: "1", label: "Has an account" }, { value: "0", label: "No account" }]} />
            <FilterDate name="from" label="From" value={str(params, "from")} />
            <FilterDate name="to" label="To" value={str(params, "to")} />
          </FilterBar>
          <TableCard
            toolbar={
              <>
                <p className="text-sm text-umber-600">
                  {total} subscriber{total === 1 ? "" : "s"}
                </p>
                <BulkBar
                  formId="newsletter-bulk"
                  action={bulkNewsletterAction}
                  options={[
                    { value: "unsubscribe", label: "Unsubscribe", confirm: "Unsubscribe the selected addresses?" },
                    { value: "resubscribe", label: "Resubscribe", confirm: "Only resubscribe people who asked to be re-added. Continue?" },
                    { value: "delete", label: "Delete (erasure request)", confirm: "Permanently delete the selected addresses?" },
                  ]}
                />
              </>
            }
            footer={<Pagination page={page} pageCount={pageCount(total)} hrefFor={(p) => hrefWith("/admin/newsletter", params, { page: p })} />}
          >
            {rows.length ? (
              <Table>
                <THead>
                  <tr>
                    <Th className="w-8">
                      <SelectAll formId="newsletter-bulk" />
                    </Th>
                    <Th>Email</Th>
                    <Th>Source</Th>
                    <Th>Signed up</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </THead>
                <TBody>
                  {rows.map(({ s, userId }) => (
                    <Tr key={s.id}>
                      <Td>
                        <RowCheck formId="newsletter-bulk" value={s.id} label={`Select ${s.email}`} />
                      </Td>
                      <Td className="text-sm">
                        {userId ? (
                          <Link href={`/admin/customers/${userId}`} className="text-umber-900 hover:underline">
                            {s.email}
                          </Link>
                        ) : (
                          s.email
                        )}
                      </Td>
                      <Td className="text-sm text-umber-600">{s.source ?? "Unknown"}</Td>
                      <Td className="text-sm text-umber-600">{formatDate(s.createdAt)}</Td>
                      <Td>
                        <Badge tone={s.status === "subscribed" ? "success" : "neutral"}>{s.status}</Badge>
                      </Td>
                      <Td className="text-right">
                        {s.status === "subscribed" ? (
                          <ActionButton action={setSubscriberStatusAction} fields={{ id: s.id, status: "unsubscribed" }} variant="ghost" confirm={`Unsubscribe ${s.email}?`}>
                            Unsubscribe
                          </ActionButton>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <Empty>No subscribers match.</Empty>
            )}
          </TableCard>
        </div>
        <div className="space-y-6">
          <Panel title="Where people sign up" description="Subscribed now, by source">
            <HBarList items={sources.map((s) => ({ key: s.source ?? "none", label: s.source ?? "Unknown", value: s.subscribed, display: `${s.subscribed}${s.total !== s.subscribed ? ` of ${s.total}` : ""}`, href: `/admin/newsletter?source=${encodeURIComponent(s.source ?? "none")}` }))} empty="No sign-ups yet" />
          </Panel>
          <Panel title="Add a subscriber" description="Only people who've agreed to receive the newsletter.">
            <ActionForm action={addSubscriberAction} resetOnSuccess className="space-y-2">
              <TextInput name="email" type="email" placeholder="name@example.com" aria-label="Email" required />
              <TextInput name="source" placeholder="Source, e.g. trade-show" aria-label="Source" />
              <SubmitButton>Add</SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </div>
  );
}
