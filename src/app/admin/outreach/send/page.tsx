import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { bulkSendOutreachAction } from "@/app/actions/admin/outreach";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Panel } from "@/components/admin/ui";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { outreachContacts, outreachTemplates } from "@/lib/db/schema";
import { emailProviderConfigured } from "@/lib/email";
import { composeOutreachEmail, unresolvedFields, withFooter } from "@/lib/outreach/merge";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/outreach/pipeline";
import { loadSendFacts, outreachSender, outreachSiteUrl } from "@/lib/outreach/server";
import { BULK_SEND_LIMIT, normalizeEmail, skipReason } from "@/lib/outreach/skip";
import { unsubscribeUrl } from "@/lib/outreach/token";

export const metadata = { title: "Send outreach" };

const UUID = /^[0-9a-f-]{36}$/;

/** Bulk send: preview each selected contact's email (or why it's skipped), then confirm. */
export default async function OutreachSendPage(props: PageProps<"/admin/outreach/send">) {
  await requireStaff("outreach.manage");
  const params = await props.searchParams;
  const raw = params.ids;
  const ids = [...new Set((Array.isArray(raw) ? raw : raw ? [raw] : []).filter((v) => UUID.test(v)))];
  const templateParam = typeof params.template === "string" ? params.template : "";
  const d = await db();
  const [templates, sender, siteUrl] = await Promise.all([
    d.select().from(outreachTemplates).where(eq(outreachTemplates.isArchived, false)).orderBy(asc(outreachTemplates.sort), asc(outreachTemplates.name)),
    outreachSender(),
    outreachSiteUrl(),
  ]);
  const tpl = templates.find((t) => t.id === templateParam) ?? templates[0] ?? null;
  const tooMany = ids.length > BULK_SEND_LIMIT;
  const contacts = ids.length && !tooMany ? await d.select().from(outreachContacts).where(and(inArray(outreachContacts.id, ids))).orderBy(asc(outreachContacts.brandName)) : [];
  const facts = await loadSendFacts(contacts);
  const rows = contacts.map((c) => {
    const reason = skipReason(c, { suppressed: facts.suppressed, lastEmailedAt: facts.lastEmailed.get(c.id) });
    const msg = tpl && !reason ? composeOutreachEmail({ template: tpl, contact: c, sender, siteUrl, unsubscribeUrl: unsubscribeUrl(siteUrl, c.id) }) : null;
    return { c, reason, msg };
  });
  const sendable = rows.filter((r) => !r.reason);
  const loggedOnly = !emailProviderConfigured();
  const unknown = tpl ? unresolvedFields(`${tpl.subject}\n${tpl.body}`) : [];
  const blocked = !sender.senderName || !tpl || unknown.length > 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Brand outreach", href: "/admin/outreach" }, { label: "Send" }]} />
      <PageHeader eyebrow="Brand outreach" title="Preview & send" description={`Up to ${BULK_SEND_LIMIT} contacts at a time, sent one after another. Contacts marked do not contact, suppressed, without an email or emailed in the last 5 days are skipped.`} />
      {loggedOnly ? (
        <Notice tone="pending" title="Emails are only logged">
          No email provider is configured: confirming records each email in the Email outbox as “logged”. Nothing reaches the brands.
        </Notice>
      ) : null}
      {tooMany ? <Notice tone="danger" title={`Select at most ${BULK_SEND_LIMIT} contacts`}>Go back and narrow the selection.</Notice> : null}
      {!ids.length ? <Notice tone="gold" title="No contacts selected">Tick contacts in the outreach list first.</Notice> : null}
      {!sender.senderName ? (
        <Notice tone="gold" title="Sender name missing">
          <Link href="/admin/outreach/templates#sender" className="underline">Set it</Link> before sending.
        </Notice>
      ) : null}
      {unknown.length ? <Notice tone="danger" title="Template has unknown fields">{unknown.map((u) => `{${u}}`).join(", ")} — fix it on the templates screen.</Notice> : null}

      {contacts.length ? (
        <>
          <form method="get" action="/admin/outreach/send" className="flex flex-wrap items-center gap-2">
            {ids.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <label className="text-sm text-umber-600" htmlFor="tpl">
              Template
            </label>
            <select id="tpl" name="template" defaultValue={tpl?.id} className="h-9 max-w-64 rounded-lg border border-umber-200 bg-white pr-7 pl-3 text-sm">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="h-9 rounded-lg border border-umber-200 bg-white px-3 text-sm font-medium hover:bg-umber-50">Update preview</button>
          </form>

          <Panel title={`${sendable.length} to send · ${rows.length - sendable.length} skipped`} bodyClassName="p-0">
            <ul className="divide-y divide-umber-200/60">
              {rows.map(({ c, reason, msg }, i) => (
                <li key={c.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/outreach/${c.id}`} className="font-medium text-indigo-800 hover:underline">
                      {c.brandName}
                    </Link>
                    <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    <span className="min-w-0 truncate text-umber-500">{normalizeEmail(c.email) ?? "no email"}</span>
                    {reason ? (
                      <Badge tone="danger" className="ml-auto">
                        Skipped: {reason.message}
                      </Badge>
                    ) : (
                      <Badge tone="success" className="ml-auto">
                        Will {loggedOnly ? "log" : "send"}
                      </Badge>
                    )}
                  </div>
                  {msg ? (
                    <details className="mt-2" open={i === rows.findIndex((r) => !r.reason)}>
                      <summary className="cursor-pointer break-words text-umber-900">{msg.subject}</summary>
                      <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-umber-50 p-3 font-sans text-xs break-words whitespace-pre-wrap text-umber-800">{withFooter(msg.body, msg.footer)}</pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>

          <ActionForm action={bulkSendOutreachAction} className="flex flex-wrap items-center gap-3" confirm={`${loggedOnly ? "Log" : "Send"} ${sendable.length} email${sendable.length === 1 ? "" : "s"} now?`}>
            {sendable.map(({ c }) => (
              <input key={c.id} type="hidden" name="ids" value={c.id} />
            ))}
            <input type="hidden" name="templateId" value={tpl?.id ?? ""} />
            <SubmitButton size="md" disabled={blocked || !sendable.length} pendingLabel="Sending one by one…">
              {loggedOnly ? `Log ${sendable.length} to the outbox` : `Send ${sendable.length} email${sendable.length === 1 ? "" : "s"}`}
            </SubmitButton>
            <Link href="/admin/outreach" className="text-sm text-umber-600 hover:underline">
              Back to the list
            </Link>
          </ActionForm>
        </>
      ) : null}
    </div>
  );
}
