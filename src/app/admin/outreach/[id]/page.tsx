import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Handshake } from "lucide-react";
import {
  addOutreachEventAction,
  createBrandFromContactAction,
  deleteOutreachContactAction,
  suppressOutreachEmailAction,
  unsuppressOutreachEmailAction,
  updateOutreachDetailsAction,
  updateOutreachPipelineAction,
} from "@/app/actions/admin/outreach";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/admin/controls";
import { OutreachCompose } from "@/components/admin/outreach/compose";
import { DetailGrid, KV, Panel, StatusBadge } from "@/components/admin/ui";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { can, requireStaff } from "@/lib/auth/session";
import { hasRecordedPermission, PARTNERSHIP_LABEL } from "@/lib/brands/permission";
import { db } from "@/lib/db/client";
import { brands, outreachContacts, outreachMessages, outreachSuppressions, outreachTemplates, users } from "@/lib/db/schema";
import { emailProviderConfigured } from "@/lib/email";
import { emptyFieldsUsed } from "@/lib/outreach/merge";
import { EVENT_LABEL, isFollowUpDue, MANUAL_EVENTS, OUTREACH_STATUSES, STATUS_LABEL, STATUS_TONE, type OutreachStatus } from "@/lib/outreach/pipeline";
import { loadSendFacts, outreachSender, outreachSiteUrl, previewsFor } from "@/lib/outreach/server";
import { isHardBlock, normalizeEmail, skipReason } from "@/lib/outreach/skip";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Outreach contact" };

const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function OutreachContactPage(props: PageProps<"/admin/outreach/[id]">) {
  const user = await requireStaff("outreach.view");
  const canManage = can(user, "outreach.manage");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await db();
  const contact = await d.query.outreachContacts.findFirst({ where: eq(outreachContacts.id, id), with: { brand: true, directoryEntry: { columns: { name: true, slug: true, isHidden: true } }, owner: { columns: { name: true } } } });
  if (!contact) notFound();
  const email = normalizeEmail(contact.email);
  const [timeline, templates, staff, brandOptions, suppression, sender, siteUrl, facts] = await Promise.all([
    d
      .select({ m: outreachMessages, actor: users.name })
      .from(outreachMessages)
      .leftJoin(users, eq(users.id, outreachMessages.actorUserId))
      .where(eq(outreachMessages.contactId, id))
      .orderBy(desc(outreachMessages.createdAt)),
    d.select().from(outreachTemplates).where(eq(outreachTemplates.isArchived, false)).orderBy(asc(outreachTemplates.sort), asc(outreachTemplates.name)),
    d.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "staff")).orderBy(asc(users.name)),
    d.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    email ? d.query.outreachSuppressions.findFirst({ where: eq(sql`lower(${outreachSuppressions.email})`, email) }) : null,
    outreachSender(),
    outreachSiteUrl(),
    loadSendFacts([contact]),
  ]);
  const reason = skipReason(contact, { suppressed: facts.suppressed, lastEmailedAt: facts.lastEmailed.get(contact.id) });
  const previews = previewsFor(contact, templates, sender, siteUrl);
  const missing = [...new Set(previews.flatMap((p) => emptyFieldsUsed(`${p.rawSubject}\n${p.rawBody}`, { brand: contact.brandName, name: "x", sender_name: sender.senderName ?? "", sender_phone: sender.senderPhone ?? "", site_url: siteUrl })))];
  const status = contact.status as OutreachStatus;
  const due = isFollowUpDue(contact);
  const brand = contact.brand;
  const loggedOnly = !emailProviderConfigured();

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Brand outreach", href: "/admin/outreach" }, { label: contact.brandName }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {contact.brandName} <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
          </span>
        }
        description={[contact.city, contact.category, contact.owner ? `Owner: ${contact.owner.name}` : "No owner"].filter(Boolean).join(" · ")}
      />

      {status === "agreed" ? <AgreedPrompt contactId={contact.id} brand={brand} canCreate={canManage && can(user, "brands.manage")} /> : null}
      {due ? (
        <Notice tone="pending" title="Follow-up due">
          Planned for {formatDate(contact.nextFollowUpAt)}. Send the follow-up, record a call or message, or move the date.
        </Notice>
      ) : null}

      <DetailGrid
        main={
          <>
            {canManage ? (
              <Panel title="Compose" description={loggedOnly ? "No email provider is configured — sending only records the email in the outbox." : "Sent through the site's email provider. Replies go to the sender's reply-to address."}>
                {!sender.senderName ? (
                  <Notice tone="gold" title="Sender name missing">
                    Set it on <Link href="/admin/outreach/templates#sender" className="underline">Templates → Sender</Link> before sending.
                  </Notice>
                ) : (
                  <OutreachCompose
                    contactId={contact.id}
                    to={email}
                    previews={previews.map(({ id, name, subject, body, footer }) => ({ id, name, subject, body, footer }))}
                    block={isHardBlock(reason) ? reason!.message : null}
                    recent={reason && !isHardBlock(reason) ? reason.message : null}
                    loggedOnly={loggedOnly}
                    missing={missing}
                  />
                )}
              </Panel>
            ) : null}

            <Panel title="Timeline" description="Emails, replies, calls, DMs and status changes — newest first." bodyClassName="p-0">
              {canManage ? (
                <ActionForm action={addOutreachEventAction} resetOnSuccess className="grid gap-3 border-b border-umber-200/60 p-5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
                  <input type="hidden" name="id" value={contact.id} />
                  <FieldRow label="Record" htmlFor="event-kind">
                    <SelectInput id="event-kind" name="kind" defaultValue="replied">
                      {MANUAL_EVENTS.map((e) => (
                        <option key={e.kind} value={e.kind}>
                          {e.label}
                        </option>
                      ))}
                    </SelectInput>
                  </FieldRow>
                  <FieldRow label="Note (optional)" htmlFor="event-note">
                    <TextInput id="event-note" name="note" maxLength={4000} placeholder="e.g. Spoke to Sara, e-commerce lead — wants a call Thursday" />
                  </FieldRow>
                  <SubmitButton variant="outline">Add</SubmitButton>
                </ActionForm>
              ) : null}
              {timeline.length ? (
                <ol className="divide-y divide-umber-200/60">
                  {timeline.map(({ m, actor }) => (
                    <li key={m.id} className="px-5 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={m.kind === "email" ? "indigo" : m.kind === "unsubscribed" ? "danger" : m.kind === "status" ? "neutral" : "gold"}>{EVENT_LABEL[m.kind] ?? m.kind}</Badge>
                        {m.kind === "email" && m.deliveryStatus ? <StatusBadge kind="email" status={m.deliveryStatus} label={m.deliveryStatus === "logged" ? "Logged only" : undefined} /> : null}
                        {m.fromStatus && m.toStatus && m.fromStatus !== m.toStatus ? (
                          <span className="text-umber-600">
                            {STATUS_LABEL[m.fromStatus as OutreachStatus] ?? m.fromStatus} → {STATUS_LABEL[m.toStatus as OutreachStatus] ?? m.toStatus}
                          </span>
                        ) : null}
                        <span className="ml-auto text-xs text-umber-500" title={formatDateTime(m.createdAt)}>
                          {timeAgo(m.createdAt)} · {actor ?? (m.kind === "unsubscribed" ? "the brand" : "system")}
                        </span>
                      </div>
                      {m.kind === "email" ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-umber-900">
                            {m.subject} <span className="text-umber-500">→ {m.toEmail}</span>
                          </summary>
                          <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-umber-50 p-3 font-sans text-xs break-words whitespace-pre-wrap text-umber-800">{m.body}</pre>
                          {m.outboxId && can(user, "settings.manage") ? (
                            <Link href={`/admin/emails?q=${encodeURIComponent(m.toEmail ?? "")}`} className="mt-1 inline-block text-xs text-indigo-800 hover:underline">
                              View in the Email outbox
                            </Link>
                          ) : null}
                        </details>
                      ) : m.body ? (
                        <p className="mt-1 break-words whitespace-pre-wrap text-umber-800">{m.body}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-umber-500">Nothing yet.</p>
              )}
            </Panel>
          </>
        }
        side={
          <>
            <Panel title="Pipeline">
              {canManage ? (
                <ActionForm action={updateOutreachPipelineAction} className="space-y-3" key={`${contact.status}-${contact.updatedAt.toISOString()}`}>
                  <input type="hidden" name="id" value={contact.id} />
                  <FieldRow label="Status" htmlFor="status">
                    <SelectInput id="status" name="status" defaultValue={contact.status}>
                      {OUTREACH_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </SelectInput>
                  </FieldRow>
                  <FieldRow label="Owner" htmlFor="ownerId">
                    <SelectInput id="ownerId" name="ownerId" defaultValue={contact.ownerId ?? ""}>
                      <option value="">Unassigned</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </SelectInput>
                  </FieldRow>
                  <FieldRow label="Next follow-up" htmlFor="nextFollowUpAt" hint="Set automatically 5 days after an email; cleared when agreed, declined or do not contact.">
                    <TextInput id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={dateInput(contact.nextFollowUpAt)} />
                  </FieldRow>
                  <SubmitButton>Save pipeline</SubmitButton>
                </ActionForm>
              ) : (
                <KV
                  items={[
                    ["Status", STATUS_LABEL[status]],
                    ["Owner", contact.owner?.name ?? "—"],
                    ["Next follow-up", formatDate(contact.nextFollowUpAt) || "—"],
                  ]}
                />
              )}
              <KV
                className="mt-4"
                items={[
                  ["Last contact", contact.lastContactedAt ? formatDateTime(contact.lastContactedAt) : "Never"],
                  ["Added", `${formatDate(contact.createdAt)} · ${contact.source.replace("_", " ")}`],
                ]}
              />
            </Panel>

            <Panel title="Email address">
              {suppression ? (
                <Notice tone="danger" title="Suppressed">
                  {suppression.source === "unsubscribe" ? "Opted out with the link in our email" : (suppression.reason ?? "Added by staff")} · {formatDate(suppression.createdAt)}
                </Notice>
              ) : (
                <p className="text-sm text-umber-600">{email ? "Not on the suppression list." : "No email address on file."}</p>
              )}
              {canManage && email ? (
                <div className="mt-3">
                  {suppression ? (
                    suppression.source !== "unsubscribe" ? (
                      <ActionButton action={unsuppressOutreachEmailAction} fields={{ id: contact.id }} confirm="Allow emails to this address again?">
                        Remove from suppression list
                      </ActionButton>
                    ) : null
                  ) : (
                    <ActionButton action={suppressOutreachEmailAction} fields={{ id: contact.id }} variant="outline">
                      Never email this address
                    </ActionButton>
                  )}
                </div>
              ) : null}
            </Panel>

            <Panel title="Contact details" description="Admin only — never shown on the storefront.">
              {canManage ? (
                <ActionForm action={updateOutreachDetailsAction} className="space-y-3" key={contact.updatedAt.toISOString()}>
                  <input type="hidden" name="id" value={contact.id} />
                  <FieldRow label="Brand name">
                    <TextInput name="brandName" required maxLength={120} defaultValue={contact.brandName} />
                  </FieldRow>
                  <FieldRow label="Contact name" hint="Used for {name}; empty → “{brand} team”.">
                    <TextInput name="contactName" maxLength={120} defaultValue={contact.contactName ?? ""} />
                  </FieldRow>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <FieldRow label="Email">
                      <TextInput name="email" type="email" maxLength={200} defaultValue={contact.email ?? ""} />
                    </FieldRow>
                    <FieldRow label="Email type">
                      <TextInput name="emailType" maxLength={80} defaultValue={contact.emailType ?? ""} placeholder="customer care, wholesale…" />
                    </FieldRow>
                    <FieldRow label="Phone">
                      <TextInput name="phone" maxLength={200} defaultValue={contact.phone ?? ""} />
                    </FieldRow>
                    <FieldRow label="Instagram">
                      <TextInput name="instagram" maxLength={120} defaultValue={contact.instagram ?? ""} />
                    </FieldRow>
                    <FieldRow label="Website">
                      <TextInput name="websiteUrl" maxLength={300} defaultValue={contact.websiteUrl ?? ""} />
                    </FieldRow>
                    <FieldRow label="City">
                      <TextInput name="city" maxLength={160} defaultValue={contact.city ?? ""} />
                    </FieldRow>
                    <FieldRow label="Category">
                      <TextInput name="category" maxLength={60} defaultValue={contact.category ?? ""} />
                    </FieldRow>
                    <FieldRow label="Ships internationally">
                      <TextInput name="shipsInternationally" maxLength={200} defaultValue={contact.shipsInternationally ?? ""} />
                    </FieldRow>
                  </div>
                  <FieldRow label="Source (where the details came from)">
                    <TextInput name="sourceUrl" maxLength={500} defaultValue={contact.sourceUrl ?? ""} />
                  </FieldRow>
                  <FieldRow label="Brand record" hint="Link to the brand in Pakistani Brands (for permission).">
                    <SelectInput name="brandId" defaultValue={contact.brandId ?? ""}>
                      <option value="">Not linked</option>
                      {brandOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </SelectInput>
                  </FieldRow>
                  <FieldRow label="Notes">
                    <TextArea name="notes" maxLength={4000} rows={4} defaultValue={contact.notes ?? ""} />
                  </FieldRow>
                  <SubmitButton>Save details</SubmitButton>
                  {contact.staffEditedAt ? <p className="text-xs text-umber-500">Edited by staff — CSV imports only fill blank fields.</p> : null}
                </ActionForm>
              ) : (
                <KV
                  items={[
                    ["Email", contact.email ?? "—"],
                    ["Phone", contact.phone ?? "—"],
                    ["Instagram", contact.instagram ?? "—"],
                    ["Website", contact.websiteUrl ?? "—"],
                    ["Notes", contact.notes ?? "—"],
                  ]}
                />
              )}
              <div className="mt-4 space-y-1 text-sm">
                {contact.websiteUrl ? (
                  <a href={contact.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-indigo-800 hover:underline">
                    {contact.websiteUrl.replace(/^https?:\/\//, "")} ↗
                  </a>
                ) : null}
                {contact.sourceUrl ? (
                  <a href={contact.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-umber-600 hover:underline">
                    Source ↗
                  </a>
                ) : null}
                {brand ? (
                  <Link href={`/admin/brands/${brand.id}`} className="block text-indigo-800 hover:underline">
                    Brand record: {brand.name}
                  </Link>
                ) : null}
                {contact.directoryEntry ? <p className="text-umber-500">In the brand directory{contact.directoryEntry.isHidden ? " (hidden)" : ""} — name, category and website only.</p> : null}
              </div>
            </Panel>

            {canManage ? (
              <ActionButton action={deleteOutreachContactAction} fields={{ id: contact.id }} variant="danger" confirm={`Delete ${contact.brandName} and its outreach history? An opt-out stays on the suppression list.`}>
                Delete contact
              </ActionButton>
            ) : null}
          </>
        }
      />
    </div>
  );
}

/**
 * Agreement in outreach is not permission. This prompt sends staff to the brand
 * record's permission form (prefilled note) — the single source of truth.
 */
function AgreedPrompt({ contactId, brand, canCreate }: { contactId: string; brand: (typeof brands.$inferSelect) | null; canCreate: boolean }) {
  if (brand && hasRecordedPermission(brand))
    return (
      <Notice tone="success" title="Agreed — permission recorded" icon={<Handshake className="size-4" />}>
        {brand.name}&apos;s permission is recorded (partnership: {PARTNERSHIP_LABEL[brand.partnership]}). <Link href={`/admin/brands/${brand.id}`} className="underline">Open the brand</Link>.
      </Notice>
    );
  return (
    <Notice tone="indigo" title="Agreed — now record the permission on the brand" icon={<Handshake className="size-4" />}>
      <p>Marking a contact agreed doesn&apos;t authorise anything. Record who gave permission, when and the evidence on the brand record; the catalogue stays private until then.</p>
      <div className="mt-2">
        {canCreate ? (
          <ActionButton action={createBrandFromContactAction} fields={{ id: contactId }} variant="primary">
            {brand ? `Record permission for ${brand.name}` : "Create the brand draft and record permission"}
          </ActionButton>
        ) : brand ? (
          <Link href={`/admin/brands/${brand.id}#permission`} className="underline">
            Open {brand.name}
          </Link>
        ) : (
          <span>Ask someone with brand permissions to create the brand record.</span>
        )}
      </div>
    </Notice>
  );
}
