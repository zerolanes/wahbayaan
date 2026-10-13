import { asc } from "drizzle-orm";
import {
  createOutreachTemplateAction,
  deleteOutreachTemplateAction,
  restoreOutreachTemplatesAction,
  saveOutreachSenderAction,
  updateOutreachTemplateAction,
} from "@/app/actions/admin/outreach";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { Panel } from "@/components/admin/ui";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { can, requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { outreachTemplates } from "@/lib/db/schema";
import { emailProviderConfigured } from "@/lib/email";
import { composeOutreachEmail, MERGE_FIELDS, unresolvedFields, withFooter } from "@/lib/outreach/merge";
import { outreachSender, outreachSiteUrl } from "@/lib/outreach/server";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Outreach templates" };

const SAMPLE = { brandName: "Example Brand", contactName: null };

export default async function OutreachTemplatesPage() {
  const user = await requireStaff("outreach.view");
  const canManage = can(user, "outreach.manage");
  const d = await db();
  const [templates, sender, siteUrl] = await Promise.all([d.select().from(outreachTemplates).orderBy(asc(outreachTemplates.sort), asc(outreachTemplates.name)), outreachSender(), outreachSiteUrl()]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Brand outreach", href: "/admin/outreach" }, { label: "Templates & sender" }]} />
      <PageHeader eyebrow="Brand outreach" title="Templates & sender" description="Merge fields are filled per contact in the preview, and every email ends with your business identity and a one-click opt-out link." />
      {!emailProviderConfigured() ? (
        <Notice tone="pending" title="Emails are only logged">
          No email provider is configured. Outreach emails are recorded in the Email outbox as “logged” and never reach anyone.
        </Notice>
      ) : null}

      <Panel id="sender" className="scroll-mt-24" title="Sender" description="Fills {sender_name} and {sender_phone}; replies go to the reply-to address; the business line appears in the footer.">
        {canManage ? (
          <ActionForm action={saveOutreachSenderAction} className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Sender name" hint="Required before anything can be sent.">
              <TextInput name="senderName" maxLength={80} defaultValue={sender.senderName ?? ""} placeholder="Your full name" />
            </FieldRow>
            <FieldRow label="Sender phone / WhatsApp">
              <TextInput name="senderPhone" maxLength={40} defaultValue={sender.senderPhone ?? ""} placeholder="+92 …" />
            </FieldRow>
            <FieldRow label="Reply-to email">
              <TextInput name="replyTo" type="email" maxLength={200} defaultValue={sender.replyTo ?? ""} placeholder="you@wahbayaan.com" />
            </FieldRow>
            <FieldRow label="Business line in the footer" hint="e.g. a registered business name and city">
              <TextInput name="businessAddress" maxLength={160} defaultValue={sender.businessAddress ?? ""} placeholder="Lahore, Pakistan" />
            </FieldRow>
            <div className="sm:col-span-2">
              <SubmitButton>Save sender</SubmitButton>
            </div>
          </ActionForm>
        ) : (
          <p className="text-sm text-umber-700">
            {sender.senderName ?? "No sender name"} · {sender.senderPhone ?? "no phone"} · {sender.replyTo ?? "no reply-to"}
          </p>
        )}
      </Panel>

      <Panel title="Merge fields">
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {MERGE_FIELDS.map((f) => (
            <li key={f.key}>
              <code className="rounded bg-umber-100 px-1.5 py-0.5 text-xs">{`{${f.key}}`}</code> <span className="text-umber-600">{f.hint}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {templates.length === 0 && canManage ? (
        <Notice tone="gold" title="No templates">
          <ActionButton action={restoreOutreachTemplatesAction} className="mt-2">
            Add the default pitch and follow-up
          </ActionButton>
        </Notice>
      ) : null}

      {templates.map((tpl) => {
        const preview = composeOutreachEmail({ template: tpl, contact: SAMPLE, sender, siteUrl, unsubscribeUrl: `${siteUrl}/outreach/unsubscribe?t=…` });
        const unknown = unresolvedFields(`${tpl.subject}\n${tpl.body}`);
        return (
          <Panel
            key={tpl.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {tpl.name} {tpl.key ? <Badge tone="neutral">default</Badge> : null} {tpl.isArchived ? <Badge tone="neutral">archived</Badge> : null}
              </span>
            }
            description={`Updated ${formatDateTime(tpl.updatedAt)}`}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              {canManage ? (
                <ActionForm action={updateOutreachTemplateAction} className="min-w-0 space-y-3" key={tpl.updatedAt.toISOString()}>
                  <input type="hidden" name="id" value={tpl.id} />
                  <FieldRow label="Name">
                    <TextInput name="name" required maxLength={80} defaultValue={tpl.name} />
                  </FieldRow>
                  <FieldRow label="Subject">
                    <TextInput name="subject" required maxLength={200} defaultValue={tpl.subject} />
                  </FieldRow>
                  <FieldRow label="Body">
                    <TextArea name="body" required rows={16} defaultValue={tpl.body} />
                  </FieldRow>
                  <div className="flex flex-wrap items-center gap-4">
                    <Toggle name="isArchived" label="Archived (hidden when composing)" defaultChecked={tpl.isArchived} />
                    <SubmitButton>Save template</SubmitButton>
                  </div>
                </ActionForm>
              ) : null}
              <div className="min-w-0">
                <p className="text-xs font-medium text-umber-500">Preview for “{SAMPLE.brandName}”</p>
                {unknown.length ? <p className="mt-1 text-xs text-danger-700">Unknown fields: {unknown.map((u) => `{${u}}`).join(", ")}</p> : null}
                <div className="mt-2 rounded-xl border border-umber-200 bg-umber-50 p-4">
                  <p className="text-sm font-semibold break-words text-umber-900">{preview.subject}</p>
                  <pre className="mt-3 font-sans text-xs leading-relaxed break-words whitespace-pre-wrap text-umber-800">{withFooter(preview.body, preview.footer)}</pre>
                </div>
              </div>
            </div>
            {canManage ? (
              <div className="mt-4 flex justify-end">
                <ActionButton action={deleteOutreachTemplateAction} fields={{ id: tpl.id }} variant="ghost" confirm={`Delete “${tpl.name}”? Emails already sent keep their text.`}>
                  Delete template
                </ActionButton>
              </div>
            ) : null}
          </Panel>
        );
      })}

      {canManage ? (
        <Panel title="New template">
          <ActionForm action={createOutreachTemplateAction} resetOnSuccess className="space-y-3">
            <FieldRow label="Name">
              <TextInput name="name" required maxLength={80} placeholder="e.g. Instagram follow-up" />
            </FieldRow>
            <FieldRow label="Subject">
              <TextInput name="subject" required maxLength={200} />
            </FieldRow>
            <FieldRow label="Body">
              <TextArea name="body" required rows={8} placeholder="Assalam-o-alaikum {name}, …" />
            </FieldRow>
            <SubmitButton>Create template</SubmitButton>
          </ActionForm>
          {templates.length ? (
            <ActionButton action={restoreOutreachTemplatesAction} variant="ghost" className="mt-3">
              Restore missing defaults
            </ActionButton>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
