import Link from "next/link";
import { and, asc, desc, eq, ilike, isNotNull, isNull, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { createOutreachContactAction, importOutreachCsvAction, importOutreachSeedAction } from "@/app/actions/admin/outreach";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { OutreachBulkSelect, OutreachSelectAll } from "@/components/admin/outreach/bulk-select";
import { Empty, FilterBar, FilterSelect, Panel, TableCard } from "@/components/admin/ui";
import { Badge, Notice, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { can, requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { outreachContacts, outreachTemplates, users } from "@/lib/db/schema";
import { emailProviderConfigured } from "@/lib/email";
import { hrefWith, pageCount, pageOf, str, type SearchParams } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { OUTREACH_SEED_FILE } from "@/lib/outreach/import";
import { CLOSED_STATUSES, isFollowUpDue, isOutreachStatus, OUTREACH_STATUSES, STATUS_LABEL, STATUS_TONE } from "@/lib/outreach/pipeline";
import { BULK_SEND_LIMIT } from "@/lib/outreach/skip";
import { getSetting } from "@/lib/settings";
import { cn } from "@/lib/utils/cn";
import { formatDate, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Brand outreach" };

const PAGE = 50;
const BULK_FORM = "outreach-bulk";

function conditions(params: SearchParams, userId: string, opts: { status?: boolean } = {}): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  const q = str(params, "q");
  if (q)
    c.push(
      or(
        ilike(outreachContacts.brandName, likeTerm(q)),
        ilike(outreachContacts.email, likeTerm(q)),
        ilike(outreachContacts.city, likeTerm(q)),
        ilike(outreachContacts.instagram, likeTerm(q)),
        ilike(outreachContacts.websiteUrl, likeTerm(q)),
      ),
    );
  const status = str(params, "status");
  if (opts.status !== false && isOutreachStatus(status)) c.push(eq(outreachContacts.status, status));
  const owner = str(params, "owner");
  if (owner === "me") c.push(eq(outreachContacts.ownerId, userId));
  else if (owner === "none") c.push(isNull(outreachContacts.ownerId));
  else if (/^[0-9a-f-]{36}$/.test(owner)) c.push(eq(outreachContacts.ownerId, owner));
  if (str(params, "due") === "1") c.push(lte(outreachContacts.nextFollowUpAt, new Date()), notInArray(outreachContacts.status, [...CLOSED_STATUSES]));
  const email = str(params, "email");
  if (email === "yes") c.push(isNotNull(outreachContacts.email), sql`${outreachContacts.email} <> ''`);
  if (email === "no") c.push(or(isNull(outreachContacts.email), eq(outreachContacts.email, "")));
  return c.length ? and(...c) : undefined;
}

export default async function OutreachPage(props: PageProps<"/admin/outreach">) {
  const user = await requireStaff("outreach.view");
  const canManage = can(user, "outreach.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const status = str(params, "status");
  const d = await db();
  const where = conditions(params, user.id);
  const [rows, [{ n }], counts, [{ due }], staff, templates, sender] = await Promise.all([
    d
      .select({
        id: outreachContacts.id,
        brandName: outreachContacts.brandName,
        email: outreachContacts.email,
        city: outreachContacts.city,
        category: outreachContacts.category,
        status: outreachContacts.status,
        lastContactedAt: outreachContacts.lastContactedAt,
        nextFollowUpAt: outreachContacts.nextFollowUpAt,
        brandId: outreachContacts.brandId,
        ownerName: users.name,
      })
      .from(outreachContacts)
      .leftJoin(users, eq(users.id, outreachContacts.ownerId))
      .where(where)
      .orderBy(sql`${outreachContacts.nextFollowUpAt} asc nulls last`, desc(outreachContacts.updatedAt), asc(outreachContacts.brandName))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    d.select({ n: sql<number>`count(*)::int` }).from(outreachContacts).where(where),
    d.select({ status: outreachContacts.status, n: sql<number>`count(*)::int` }).from(outreachContacts).where(conditions(params, user.id, { status: false })).groupBy(outreachContacts.status),
    d
      .select({ due: sql<number>`count(*)::int` })
      .from(outreachContacts)
      .where(and(lte(outreachContacts.nextFollowUpAt, new Date()), notInArray(outreachContacts.status, [...CLOSED_STATUSES]))),
    d.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "staff")).orderBy(asc(users.name)),
    d.select({ id: outreachTemplates.id, name: outreachTemplates.name }).from(outreachTemplates).where(eq(outreachTemplates.isArchived, false)).orderBy(asc(outreachTemplates.sort), asc(outreachTemplates.name)),
    getSetting("outreach"),
  ]);
  const total = counts.reduce((a, c) => a + c.n, 0);
  const countOf = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const loggedOnly = !emailProviderConfigured();
  const now = new Date();

  const importPanel = canManage ? (
    <Panel title="Import & add" description="Imports match on the brand name. Contacts you've edited keep your edits; the file only fills their blank fields. Contact details stay in this admin screen — never on the storefront.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-umber-900">Research list</p>
          <p className="text-xs text-umber-500">
            <code className="break-all">{OUTREACH_SEED_FILE}</code> — safe to run again.
          </p>
          <ActionButton action={importOutreachSeedAction}>Load the research list</ActionButton>
        </div>
        <ActionForm action={importOutreachCsvAction} resetOnSuccess className="space-y-2">
          <p className="text-sm font-semibold text-umber-900">Upload a CSV</p>
          <p className="text-xs break-words text-umber-500">Columns: brand, category, website, email, email_type, phone, instagram, city, ships_internationally, source_url, notes</p>
          <input type="file" name="file" accept=".csv,text/csv" required aria-label="CSV file" className="block w-full max-w-full text-sm text-umber-700 file:mr-3 file:rounded-full file:border file:border-umber-200 file:bg-white file:px-3 file:py-1.5 file:text-sm" />
          <SubmitButton variant="outline">Import CSV</SubmitButton>
        </ActionForm>
        <ActionForm action={createOutreachContactAction} className="space-y-2">
          <p className="text-sm font-semibold text-umber-900">Add one brand</p>
          <FieldRow label="Brand name">
            <TextInput name="brandName" required maxLength={120} />
          </FieldRow>
          <FieldRow label="Email (optional)">
            <TextInput name="email" type="email" maxLength={200} />
          </FieldRow>
          <SubmitButton variant="outline">Add contact</SubmitButton>
        </ActionForm>
      </div>
    </Panel>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title="Brand outreach"
        description="Ask Pakistani brands for permission to list them. Agreeing here never puts a brand live — permission is still recorded on the brand record."
        actions={
          <>
            <Link href="/admin/outreach/templates" className="text-sm font-medium text-indigo-800 hover:underline">
              Templates &amp; sender
            </Link>
            {can(user, "settings.manage") ? (
              <Link href="/admin/emails?template=outreach" className="text-sm text-umber-600 hover:underline">
                Email outbox
              </Link>
            ) : null}
          </>
        }
      />

      {loggedOnly ? (
        <Notice tone="pending" title="Emails are only logged">
          No email provider is configured, so outreach emails are recorded in the Email outbox as “logged” and never reach the brand.
        </Notice>
      ) : null}
      {canManage && !sender.senderName ? (
        <Notice tone="gold" title="Set your sender details">
          {"{sender_name}"} is empty, so sending is blocked. <Link href="/admin/outreach/templates#sender" className="underline">Add your name and phone</Link>.
        </Notice>
      ) : null}

      <Tabs
        items={[
          { label: "All", href: hrefWith("/admin/outreach", params, { status: null, due: null }), active: !status && str(params, "due") !== "1", count: total },
          { label: "Due", href: hrefWith("/admin/outreach", params, { status: null, due: "1" }), active: str(params, "due") === "1", count: due },
          ...OUTREACH_STATUSES.map((s) => ({ label: STATUS_LABEL[s], href: hrefWith("/admin/outreach", params, { status: s, due: null }), active: status === s, count: countOf(s) })),
        ]}
      />

      <FilterBar action="/admin/outreach" q={str(params, "q")} placeholder="Brand, email, city, Instagram">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <FilterSelect
          name="owner"
          label="Owner"
          value={str(params, "owner")}
          options={[{ value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <FilterSelect name="due" label="Follow-up" value={str(params, "due")} options={[{ value: "1", label: "Due now" }]} />
        <FilterSelect
          name="email"
          label="Email"
          value={str(params, "email")}
          options={[
            { value: "yes", label: "Has email" },
            { value: "no", label: "No email" },
          ]}
        />
      </FilterBar>

      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {n} contact{n === 1 ? "" : "s"}
              {due ? ` · ${due} follow-up${due === 1 ? "" : "s"} due` : ""}
            </p>
            {canManage ? <OutreachBulkSelect formId={BULK_FORM} templates={templates} limit={BULK_SEND_LIMIT} /> : null}
          </>
        }
        footer={pageCount(n, PAGE) > 1 ? <Pagination page={page} pageCount={pageCount(n, PAGE)} hrefFor={(p) => hrefWith("/admin/outreach", params, { page: p })} /> : undefined}
      >
        {rows.length ? (
          <Table scrollLabel="Outreach contacts">
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-10">
                    <OutreachSelectAll formId={BULK_FORM} limit={BULK_SEND_LIMIT} />
                  </Th>
                ) : null}
                <Th>Brand</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Owner</Th>
                <Th>Last contact</Th>
                <Th>Follow-up</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const dueNow = isFollowUpDue(r, now);
                return (
                  <Tr key={r.id}>
                    {canManage ? (
                      <Td>
                        <input type="checkbox" name="ids" value={r.id} form={BULK_FORM} data-row disabled={!r.email || r.status === "do_not_contact"} aria-label={`Select ${r.brandName}`} className="size-4 accent-indigo-800" />
                      </Td>
                    ) : null}
                    <Td>
                      <Link href={`/admin/outreach/${r.id}`} className="font-medium text-indigo-800 hover:underline">
                        {r.brandName}
                      </Link>
                      {r.brandId ? (
                        <Badge tone="neutral" className="ml-1.5">
                          brand record
                        </Badge>
                      ) : null}
                      <p className="text-xs text-umber-500">{[r.city, r.category].filter(Boolean).join(" · ") || "—"}</p>
                    </Td>
                    <Td className="max-w-56 truncate text-sm">{r.email ?? <span className="text-umber-400">No email</span>}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </Td>
                    <Td className="text-sm">{r.ownerName ?? <span className="text-umber-400">—</span>}</Td>
                    <Td className="text-sm whitespace-nowrap">{r.lastContactedAt ? timeAgo(r.lastContactedAt) : <span className="text-umber-400">Never</span>}</Td>
                    <Td className={cn("text-sm whitespace-nowrap", dueNow && "font-semibold text-danger-700")}>{r.nextFollowUpAt ? `${dueNow ? "Due " : ""}${formatDate(r.nextFollowUpAt)}` : <span className="text-umber-400">—</span>}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>{total ? "No contacts match these filters." : canManage ? "No contacts yet — load the research list or upload a CSV below." : "No contacts yet."}</Empty>
        )}
      </TableCard>

      {importPanel}
    </div>
  );
}
