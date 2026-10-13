"use client";

import { useState } from "react";
import { sendOutreachEmailAction } from "@/app/actions/admin/outreach";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { Notice } from "@/components/ui/misc";

export type ComposePreview = { id: string; name: string; subject: string; body: string; footer: string };

/**
 * Compose one outreach email: pick a template → the preview arrives with merge
 * fields filled → edit → send. The opt-out footer is fixed and added on send.
 */
export function OutreachCompose({
  contactId,
  to,
  previews,
  block,
  recent,
  loggedOnly,
  missing,
}: {
  contactId: string;
  to: string | null;
  previews: ComposePreview[];
  /** A hard block (do not contact, suppressed, no email): nothing can be sent. */
  block: string | null;
  /** Emailed in the last 5 days: sending needs an explicit tick. */
  recent: string | null;
  loggedOnly: boolean;
  /** Merge fields that render empty (e.g. sender phone not set). */
  missing: string[];
}) {
  const [templateId, setTemplateId] = useState(previews[0]?.id ?? "");
  const current = previews.find((p) => p.id === templateId) ?? null;
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");

  function pick(id: string) {
    setTemplateId(id);
    const p = previews.find((x) => x.id === id);
    setSubject(p?.subject ?? "");
    setBody(p?.body ?? "");
  }

  if (block) return <Notice tone="danger" title="Can't email this contact">{block}.</Notice>;

  return (
    <ActionForm action={sendOutreachEmailAction} className="space-y-3" key={contactId}>
      <input type="hidden" name="id" value={contactId} />
      <input type="hidden" name="templateId" value={templateId} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <FieldRow label="Template" htmlFor="compose-template">
          <SelectInput id="compose-template" value={templateId} onChange={(e) => pick(e.target.value)}>
            <option value="">Blank email</option>
            {previews.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
        </FieldRow>
        <FieldRow label="To">
          <TextInput value={to ?? ""} readOnly aria-readonly className="bg-umber-50" />
        </FieldRow>
      </div>
      <FieldRow label="Subject" htmlFor="compose-subject">
        <TextInput id="compose-subject" name="subject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </FieldRow>
      <FieldRow label="Message (merge fields already filled — edit freely)" htmlFor="compose-body">
        <TextArea id="compose-body" name="body" required rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="font-sans" />
      </FieldRow>
      {missing.length ? (
        <p className="text-xs text-warning-700">
          Empty in this preview: {missing.map((m) => `{${m}}`).join(", ")} — set them under Templates → Sender, or edit the text.
        </p>
      ) : null}
      {current || body ? (
        <div className="rounded-xl border border-dashed border-umber-300 bg-umber-50 px-3 py-2">
          <p className="text-xs font-medium text-umber-500">Added to every outreach email (can&apos;t be removed)</p>
          <p className="mt-1 text-xs break-words whitespace-pre-wrap text-umber-700">{(current?.footer ?? previews[0]?.footer ?? "").trim()}</p>
        </div>
      ) : null}
      {recent ? (
        <Notice tone="pending" title="Recently emailed">
          {recent}.
          <Toggle name="override" label="Send anyway" className="mt-2" />
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Sending…">{loggedOnly ? "Log to outbox (not sent)" : "Send email"}</SubmitButton>
        {loggedOnly ? <span className="text-xs text-umber-500">No email provider is configured — the message is only recorded in the Email outbox.</span> : null}
      </div>
    </ActionForm>
  );
}
