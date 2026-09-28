import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { outboxAction } from "@/app/actions/admin/emails";
import { ActionButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { Empty, FilterBar, FilterDate, FilterSelect, KV, MiniStat, Panel, StatusBadge, TableCard } from "@/components/admin/ui";
import { Notice, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { emailOutbox } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { emailBlocks, redactEmailBody, STUCK_AFTER_MINUTES } from "@/lib/admin/email-preview";
import { humanize } from "@/lib/admin/labels";
import { dateRange, hrefWith, pageCount, pageOf, str, PAGE_SIZE, type SearchParams } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Email outbox" };

const TABS = [
  { value: "", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "queued", label: "Queued" },
  { value: "logged", label: "Logged (not sent)" },
  { value: "sent", label: "Sent" },
  { value: "cancelled", label: "Cancelled" },
];

function conditions(params: SearchParams): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  const q = str(params, "q");
  if (q) c.push(or(ilike(emailOutbox.to, likeTerm(q)), ilike(emailOutbox.subject, likeTerm(q))));
  if (str(params, "status")) c.push(eq(emailOutbox.status, str(params, "status")));
  if (str(params, "template")) c.push(str(params, "template") === "none" ? sql`${emailOutbox.template} is null` : eq(emailOutbox.template, str(params, "template")));
  if (str(params, "from") || str(params, "to")) {
    const r = dateRange(params, 3650);
    c.push(gte(emailOutbox.createdAt, r.from), lt(emailOutbox.createdAt, r.toExclusive));
  }
  return c.length ? and(...c) : undefined;
}

export default async function EmailsPage(props: PageProps<"/admin/emails">) {
  await requireStaff("settings.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const status = str(params, "status");
  const where = conditions(params);
  const d = await db();
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000);
  const [rows, [{ n }], counts, templates, [stuck], site] = await Promise.all([
    d.select().from(emailOutbox).where(where).orderBy(desc(emailOutbox.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(emailOutbox).where(where),
    d.select({ status: emailOutbox.status, n: sql<number>`count(*)::int` }).from(emailOutbox).where(conditions({ ...params, status: undefined })).groupBy(emailOutbox.status),
    d.selectDistinct({ t: emailOutbox.template }).from(emailOutbox).orderBy(asc(emailOutbox.template)),
    d.select({ n: sql<number>`count(*)::int` }).from(emailOutbox).where(and(eq(emailOutbox.status, "queued"), lt(emailOutbox.createdAt, stuckBefore))),
    getSetting("site"),
  ]);
  const count = (s: string) => (s ? (counts.find((c) => c.status === s)?.n ?? 0) : counts.reduce((a, c) => a + c.n, 0));
  const selectedId = str(params, "id");
  const selected = selectedId && /^[0-9a-f-]{36}$/i.test(selectedId) ? ((await d.select().from(emailOutbox).where(eq(emailOutbox.id, selectedId)))[0] ?? null) : null;
  const configured = !!process.env.RESEND_API_KEY;
  const preview = selected ? redactEmailBody(selected.body) : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Email outbox" description="Every transactional email the platform tried to send, with its delivery status. Open one to preview what the recipient received." />

      {!configured ? (
        <Notice tone="pending" title="Email sending is not configured">
          RESEND_API_KEY is not set, so emails are recorded here as “logged” and nobody receives them. Set the key (and EMAIL_FROM) in the environment to start sending; logged emails can then be resent.
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Sent" value={String(count("sent"))} href={hrefWith("/admin/emails", {}, { status: "sent" })} />
        <MiniStat label="Failed" value={String(count("failed"))} tone={count("failed") ? "danger" : undefined} href={hrefWith("/admin/emails", {}, { status: "failed" })} />
        <MiniStat label="Stuck in queue" value={String(stuck?.n ?? 0)} tone={stuck?.n ? "danger" : undefined} hint={`Queued over ${STUCK_AFTER_MINUTES} min`} href={hrefWith("/admin/emails", {}, { status: "queued" })} />
        <MiniStat label="Logged, not sent" value={String(count("logged"))} tone={count("logged") && !configured ? "pending" : undefined} hint={configured ? "Recorded before sending was configured" : "Sending not configured"} href={hrefWith("/admin/emails", {}, { status: "logged" })} />
      </div>

      <Tabs items={TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/emails", params, { status: t.value || null, id: null }), active: status === t.value, count: count(t.value) }))} />

      <FilterBar action="/admin/emails" q={str(params, "q")} placeholder="Recipient or subject">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <FilterSelect name="template" label="Template" value={str(params, "template")} options={templates.map((t) => ({ value: t.t ?? "none", label: t.t ? humanize(t.t) : "No template" }))} />
        <FilterDate name="from" label="From" value={str(params, "from")} />
        <FilterDate name="to" label="To" value={str(params, "to")} />
      </FilterBar>

      <div className={cn("grid items-start gap-6", selected && "xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]")}>
        <TableCard
          toolbar={
            <>
              <p className="text-sm text-umber-600">
                {n} email{n === 1 ? "" : "s"}
              </p>
              <BulkBar
                formId="emails-bulk"
                action={outboxAction}
                options={[
                  { value: "resend", label: "Resend", confirm: "Resend the selected emails?" },
                  { value: "cancel", label: "Cancel (queued / failed)", confirm: "Cancel the selected emails?" },
                ]}
              />
            </>
          }
          footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/emails", params, { page: p })} />}
        >
          {rows.length ? (
            <Table>
              <THead>
                <tr>
                  <Th className="w-8">
                    <SelectAll formId="emails-bulk" />
                  </Th>
                  <Th>Recipient · subject</Th>
                  <Th>Template</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn("transition hover:bg-umber-50", selected?.id === r.id && "bg-umber-100/70")}>
                    <Td>
                      <RowCheck formId="emails-bulk" value={r.id} label={`Select email to ${r.to}`} />
                    </Td>
                    <Td className="max-w-md">
                      <Link href={hrefWith("/admin/emails", params, { id: r.id, page })} className="block">
                        <p className="truncate font-medium text-umber-900 hover:underline">{r.subject}</p>
                        <p className="truncate text-xs text-umber-500">{r.to}</p>
                      </Link>
                    </Td>
                    <Td className="text-xs text-umber-600">{r.template ? humanize(r.template) : "—"}</Td>
                    <Td>
                      <StatusBadge kind="email" status={r.status} />
                      {r.status === "queued" && r.createdAt < stuckBefore ? <p className="mt-0.5 text-xs text-danger-700">Stuck</p> : null}
                      {r.error ? (
                        <p className="mt-0.5 max-w-40 truncate text-xs text-danger-700" title={r.error}>
                          {r.error}
                        </p>
                      ) : null}
                    </Td>
                    <Td className="text-xs whitespace-nowrap text-umber-500" title={formatDateTime(r.createdAt)}>
                      {timeAgo(r.createdAt)}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <Empty>{count("") ? "No emails match these filters." : "No emails yet. Order confirmations, quotes, invitations and status updates will appear here."}</Empty>
          )}
        </TableCard>

        {selected && preview ? (
          <Panel
            title={selected.subject}
            description={`To ${selected.to}`}
            className="xl:sticky xl:top-20"
            action={
              <Link href={hrefWith("/admin/emails", params, { id: null, page })} className="text-xs text-umber-500 hover:text-umber-900">
                Close
              </Link>
            }
          >
            <KV
              items={[
                ["Status", <StatusBadge key="s" kind="email" status={selected.status} />],
                ["Template", selected.template ? <code key="t">{selected.template}</code> : "—"],
                ["Created", formatDateTime(selected.createdAt)],
                ["Sent", selected.sentAt ? formatDateTime(selected.sentAt) : "—"],
                ["From", process.env.EMAIL_FROM ?? `${site.name} <hello@wahbayaan.com>`],
              ]}
            />
            {selected.error ? <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-xs break-all text-danger-700">{selected.error}</p> : null}
            <div className="mt-4 overflow-hidden rounded-lg border border-umber-200">
              <div className="border-b border-umber-200 bg-umber-50 px-4 py-2 text-xs text-umber-500">Plain-text email as delivered</div>
              <div className="space-y-3 bg-white px-5 py-4 text-sm leading-relaxed text-umber-800">
                {emailBlocks(preview.text).map((b, i) => (
                  <p key={i}>
                    {b.lines.map((l, j) => (
                      <span key={j}>
                        {j ? <br /> : null}
                        {l}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            </div>
            {preview.redactions ? <p className="mt-2 text-xs text-umber-500">{preview.redactions} credential{preview.redactions === 1 ? "" : "s"} hidden in this preview. The recipient received the full text.</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {configured && selected.status !== "sent" && selected.status !== "cancelled" ? (
                <ActionButton action={outboxAction} fields={{ op: "resend", "ids[]": selected.id }} variant="primary" confirm={`Send “${selected.subject}” to ${selected.to}?`}>
                  {selected.status === "failed" ? "Retry delivery" : "Send now"}
                </ActionButton>
              ) : null}
              {selected.status === "queued" || selected.status === "failed" ? (
                <ActionButton action={outboxAction} fields={{ op: "cancel", "ids[]": selected.id }} confirm="Cancel this email?">
                  Cancel
                </ActionButton>
              ) : null}
              <Link href={`/admin/audit?entity=email&entityId=${selected.id}`} className="inline-flex h-8 items-center px-2 text-xs text-umber-500 hover:text-umber-900">
                Audit history
              </Link>
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
