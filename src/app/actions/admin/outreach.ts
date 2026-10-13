"use server";

import { redirect } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brands, brandSources, outreachContacts, outreachMessages, outreachSuppressions, outreachTemplates, users } from "@/lib/db/schema";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { changedFields } from "@/lib/admin/diff";
import { zBool, zIds, zOptDate, zOptStr, zStr, zUuid } from "@/lib/admin/zod";
import { can } from "@/lib/auth/session";
import { slugify } from "@/lib/brands/adapters/normalize";
import { RESERVED_BRAND_SLUGS } from "@/lib/brands/reserved";
import { getSetting, setSetting } from "@/lib/settings";
import { contactNameKey } from "@/lib/outreach/csv";
import { importOutreachCsv, importOutreachSeedFile, OUTREACH_SEED_FILE, seedOutreachTemplates } from "@/lib/outreach/import";
import { composeOutreachEmail, unresolvedFields } from "@/lib/outreach/merge";
import { CLOSED_STATUSES, MANUAL_EVENTS, OUTREACH_STATUSES, STATUS_LABEL, statusAfterEvent, type OutreachStatus } from "@/lib/outreach/pipeline";
import { deliverOutreachEmail, loadSendFacts, outreachSender, outreachSiteUrl } from "@/lib/outreach/server";
import { BULK_SEND_LIMIT, isHardBlock, isValidEmail, normalizeEmail, skipReason } from "@/lib/outreach/skip";
import { unsubscribeUrl } from "@/lib/outreach/token";
import { formatDate } from "@/lib/utils/format";

const zStatus = z.enum(OUTREACH_STATUSES);
const zOptEmail = zOptStr(200).refine((v) => !v || isValidEmail(v), "Enter a valid email address");
const zOptUuid = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v ?? null), z.string().uuid().nullable());

async function getContact(id: string) {
  const d = await db();
  const c = await d.query.outreachContacts.findFirst({ where: eq(outreachContacts.id, id) });
  if (!c) throw new AdminError("Contact not found");
  return c;
}

async function assertStaffOwner(ownerId: string | null) {
  if (!ownerId) return;
  const d = await db();
  const u = await d.query.users.findFirst({ where: and(eq(users.id, ownerId), eq(users.role, "staff")), columns: { id: true } });
  if (!u) throw new AdminError("The owner must be a staff member.");
}

/** Add an address to the suppression list (idempotent). */
async function suppress(email: string | null, contactId: string, source: "manual" | "unsubscribe", reason: string) {
  const e = normalizeEmail(email);
  if (!e) return;
  const d = await db();
  await d.insert(outreachSuppressions).values({ email: e, source, reason, contactId }).onConflictDoNothing();
}

// ── Import ──────────────────────────────────────────────────────────────────

export const importOutreachSeedAction = adminAction("outreach.manage", z.object({}), async ({ audit }) => {
  const d = await db();
  const res = await importOutreachSeedFile(d);
  if (!res) throw new AdminError(`${OUTREACH_SEED_FILE} isn't in this deployment — upload the CSV instead.`);
  if (res.error) throw new AdminError(res.error);
  await audit({ action: "outreach.import", entity: "outreach_contact", summary: `Imported ${OUTREACH_SEED_FILE}: ${res.summary}`, data: { kept: res.plan.kept, issues: res.issues } });
  return { message: res.summary };
});

export const importOutreachCsvAction = adminAction("outreach.manage", z.object({}), async ({ formData, audit }) => {
  const file = files(formData, "file")[0];
  if (!file) throw new AdminError("Choose a CSV file.");
  if (file.size > 2_000_000) throw new AdminError("That file is over 2 MB — split it up.");
  const d = await db();
  const res = await importOutreachCsv(d, await file.text(), "csv_upload");
  if (res.error) throw new AdminError(res.error);
  await audit({ action: "outreach.import", entity: "outreach_contact", summary: `Imported ${file.name}: ${res.summary}`, data: { kept: res.plan.kept, issues: res.issues } });
  return { message: res.issues.length ? `${res.summary}. ${res.issues.slice(0, 3).map((i) => `Line ${i.line}: ${i.message}`).join("; ")}` : res.summary };
});

// ── Contacts ────────────────────────────────────────────────────────────────

const detailFields = {
  brandName: zStr(120),
  contactName: zOptStr(120),
  websiteUrl: zOptStr(300).refine((v) => !v || /^https?:\/\//i.test(v), "Website must start with https://"),
  email: zOptEmail,
  emailType: zOptStr(80),
  phone: zOptStr(200),
  instagram: zOptStr(120),
  city: zOptStr(160),
  category: zOptStr(60),
  shipsInternationally: zOptStr(200),
  sourceUrl: zOptStr(500),
  notes: zOptStr(4000),
};

export const createOutreachContactAction = adminAction("outreach.manage", z.object({ brandName: zStr(120), email: zOptEmail, websiteUrl: detailFields.websiteUrl }), async ({ data, user, audit }) => {
  const nameKey = contactNameKey(data.brandName);
  if (!nameKey) throw new AdminError("Enter a brand name.");
  const d = await db();
  const existing = await d.query.outreachContacts.findFirst({ where: eq(outreachContacts.nameKey, nameKey), columns: { id: true } });
  if (existing) throw new AdminError(`${data.brandName} is already in the outreach list.`);
  const [c] = await d
    .insert(outreachContacts)
    .values({ brandName: data.brandName, nameKey, email: normalizeEmail(data.email), websiteUrl: data.websiteUrl, ownerId: user.id, source: "admin", staffEditedAt: new Date() })
    .returning();
  await audit({ action: "outreach.create", entity: "outreach_contact", entityId: c.id, summary: `Added ${c.brandName} to brand outreach` });
  redirect(`/admin/outreach/${c.id}`);
});

export const updateOutreachDetailsAction = adminAction(
  "outreach.manage",
  z.object({ id: zUuid, ...detailFields, brandId: zOptUuid }),
  async ({ data, audit }) => {
    const before = await getContact(data.id);
    const nameKey = contactNameKey(data.brandName);
    if (!nameKey) throw new AdminError("Enter a brand name.");
    const d = await db();
    if (data.brandId && !(await d.query.brands.findFirst({ where: eq(brands.id, data.brandId), columns: { id: true } }))) throw new AdminError("Brand not found");
    const { id: _id, ...rest } = data;
    const row = { ...rest, nameKey, email: normalizeEmail(data.email) };
    const fields = changedFields(Object.fromEntries(Object.keys(row).map((k) => [k, before[k as keyof typeof before] ?? null])), row);
    if (!fields.length) return { message: "No changes to save" };
    await d.update(outreachContacts).set({ ...row, staffEditedAt: new Date() }).where(eq(outreachContacts.id, before.id));
    await audit({ action: "outreach.update", entity: "outreach_contact", entityId: before.id, summary: `Edited outreach contact ${data.brandName} (${fields.join(", ")})`, data: { fields } });
    return { message: "Contact saved" };
  },
);

export const updateOutreachPipelineAction = adminAction(
  "outreach.manage",
  z.object({ id: zUuid, status: zStatus, ownerId: zOptUuid, nextFollowUpAt: zOptDate }),
  async ({ data, user, audit }) => {
    const before = await getContact(data.id);
    await assertStaffOwner(data.ownerId);
    const d = await db();
    const statusChanged = before.status !== data.status;
    const followUp = CLOSED_STATUSES.includes(data.status) ? null : data.nextFollowUpAt;
    await d.update(outreachContacts).set({ status: data.status, ownerId: data.ownerId, nextFollowUpAt: followUp }).where(eq(outreachContacts.id, before.id));
    if (statusChanged) {
      await d.insert(outreachMessages).values({ contactId: before.id, kind: "status", fromStatus: before.status, toStatus: data.status, actorUserId: user.id });
      if (data.status === "do_not_contact") await suppress(before.email, before.id, "manual", "Marked do not contact by staff");
    }
    const changes = [
      statusChanged ? `status ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[data.status]}` : null,
      before.ownerId !== data.ownerId ? "owner" : null,
      (before.nextFollowUpAt?.getTime() ?? null) !== (followUp?.getTime() ?? null) ? `follow-up ${followUp ? formatDate(followUp) : "cleared"}` : null,
    ].filter(Boolean);
    if (!changes.length) return { message: "No changes to save" };
    await audit({ action: statusChanged ? "outreach.status" : "outreach.pipeline", entity: "outreach_contact", entityId: before.id, summary: `${before.brandName}: ${changes.join(", ")}` });
    // Agreeing here never authorises the brand — the detail page now prompts to record permission on the brand.
    return { message: data.status === "agreed" ? "Marked agreed — now record the brand's permission (see the prompt above)" : "Pipeline saved" };
  },
);

export const addOutreachEventAction = adminAction(
  "outreach.manage",
  z.object({ id: zUuid, kind: z.enum(MANUAL_EVENTS.map((e) => e.kind) as [(typeof MANUAL_EVENTS)[number]["kind"], ...(typeof MANUAL_EVENTS)[number]["kind"][]]), note: zOptStr(4000) }),
  async ({ data, user, audit }) => {
    const c = await getContact(data.id);
    if (data.kind === "note" && !data.note) throw new AdminError("Write the note first.");
    const from = c.status as OutreachStatus;
    const to = statusAfterEvent(from, data.kind);
    const d = await db();
    await d.insert(outreachMessages).values({ contactId: c.id, kind: data.kind, body: data.note, fromStatus: from, toStatus: to, actorUserId: user.id });
    const contacted = data.kind === "instagram_dm" || data.kind === "whatsapp" || data.kind === "phone_call";
    await d
      .update(outreachContacts)
      .set({ status: to, ...(contacted ? { lastContactedAt: new Date() } : {}) })
      .where(eq(outreachContacts.id, c.id));
    const label = MANUAL_EVENTS.find((e) => e.kind === data.kind)!.label;
    await audit({ action: "outreach.event", entity: "outreach_contact", entityId: c.id, summary: `${c.brandName}: ${label}${to !== from ? ` (status → ${STATUS_LABEL[to]})` : ""}` });
    return { message: to !== from ? `${label} recorded — status now ${STATUS_LABEL[to]}` : `${label} recorded` };
  },
);

export const suppressOutreachEmailAction = adminAction("outreach.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const c = await getContact(data.id);
  if (!normalizeEmail(c.email)) throw new AdminError("This contact has no email address.");
  await suppress(c.email, c.id, "manual", "Added by staff");
  await audit({ action: "outreach.suppress", entity: "outreach_contact", entityId: c.id, summary: `${c.brandName}: email address added to the suppression list` });
  return { message: "Added to the suppression list" };
});

/** Only manual suppressions can be lifted — an opt-out from the brand itself stays. */
export const unsuppressOutreachEmailAction = adminAction("outreach.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const c = await getContact(data.id);
  const email = normalizeEmail(c.email);
  if (!email) throw new AdminError("This contact has no email address.");
  const d = await db();
  const row = await d.query.outreachSuppressions.findFirst({ where: eq(sql`lower(${outreachSuppressions.email})`, email) });
  if (!row) return { message: "Not on the suppression list" };
  if (row.source === "unsubscribe") throw new AdminError("This address opted out with the link in our email — it stays suppressed.");
  await d.delete(outreachSuppressions).where(eq(outreachSuppressions.id, row.id));
  await audit({ action: "outreach.unsuppress", entity: "outreach_contact", entityId: c.id, summary: `${c.brandName}: email address removed from the suppression list` });
  return { message: "Removed from the suppression list" };
});

export const deleteOutreachContactAction = adminAction("outreach.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const c = await getContact(data.id);
  const d = await db();
  // Keep the opt-out even when the contact goes.
  if (c.status === "do_not_contact") await suppress(c.email, c.id, "manual", "Contact deleted while marked do not contact");
  await d.delete(outreachContacts).where(eq(outreachContacts.id, c.id));
  await audit({ action: "outreach.delete", entity: "outreach_contact", entityId: c.id, summary: `Deleted outreach contact ${c.brandName}` });
  redirect("/admin/outreach");
});

// ── Agreed → brand permission (the brand record stays the single source of truth) ──

export const createBrandFromContactAction = adminAction("brands.manage", z.object({ id: zUuid }), async ({ data, user, audit }) => {
  if (!can(user, "outreach.manage")) throw new AdminError("Your role doesn't include the “outreach.manage” permission.");
  const c = await getContact(data.id);
  const d = await db();
  if (c.brandId) redirect(`/admin/brands/${c.brandId}?permissionNote=${encodeURIComponent(permissionNoteFor(c))}#permission`);
  let slug = slugify(c.brandName);
  if (!slug) throw new AdminError("This contact has no usable brand name.");
  if (RESERVED_BRAND_SLUGS.has(slug)) slug = `${slug}-brand`;
  const clash = await d.query.brands.findFirst({ where: eq(brands.slug, slug), columns: { id: true } });
  const brandId =
    clash?.id ??
    (await (async () => {
      const [b] = await d.insert(brands).values({ name: c.brandName, slug, websiteUrl: c.websiteUrl, isActive: false, partnership: "none" }).returning();
      await d.insert(brandSources).values({ brandId: b.id, type: "manual" });
      await audit({ action: "brand.create", entity: "brand", entityId: b.id, summary: `Created brand ${b.name} from brand outreach (draft, no permission)` });
      return b.id;
    })());
  await d.update(outreachContacts).set({ brandId }).where(eq(outreachContacts.id, c.id));
  await audit({ action: "outreach.link_brand", entity: "outreach_contact", entityId: c.id, summary: `${c.brandName}: linked to brand record${clash ? " (existing)" : " (new draft)"}` });
  redirect(`/admin/brands/${brandId}?permissionNote=${encodeURIComponent(permissionNoteFor(c))}#permission`);
});

/** A starting note for the brand's permission record — staff edit it before saving. */
function permissionNoteFor(c: { brandName: string; contactName: string | null; email: string | null }) {
  const who = [c.contactName, c.email].filter(Boolean).join(", ");
  return `${c.brandName} agreed through brand outreach${who ? ` (${who})` : ""}: permission to list their catalogue and images on Wahbayaan, credited to the brand. Agreed on ${formatDate(new Date())} — add how (email/call) and attach the reply as evidence.`;
}

// ── Sending ─────────────────────────────────────────────────────────────────

async function sendContext() {
  const [sender, siteUrl] = await Promise.all([outreachSender(), outreachSiteUrl()]);
  if (!sender.senderName?.trim()) throw new AdminError("Set your sender name first (Brand outreach → Templates → Sender).");
  return { sender, siteUrl };
}

export const sendOutreachEmailAction = adminAction(
  "outreach.manage",
  z.object({ id: zUuid, templateId: zOptUuid, subject: zStr(200), body: zStr(10_000), override: zBool }),
  async ({ data, user, audit }) => {
    const c = await getContact(data.id);
    const { sender, siteUrl } = await sendContext();
    const facts = await loadSendFacts([c]);
    const reason = skipReason(c, { suppressed: facts.suppressed, lastEmailedAt: facts.lastEmailed.get(c.id) });
    if (isHardBlock(reason)) throw new AdminError(`Not sent: ${reason!.message}.`);
    if (reason && !data.override) throw new AdminError(`Not sent: ${reason.message}. Tick “send anyway” to override.`);
    const unknown = unresolvedFields(`${data.subject}\n${data.body}`);
    if (unknown.length) throw new AdminError(`Unknown merge field${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{${u}}`).join(", ")} — fix or remove before sending.`);
    const res = await deliverOutreachEmail({ contact: c, subject: data.subject, body: data.body, templateId: data.templateId, actorId: user.id, sender, siteUrl });
    await audit({ action: "outreach.email", entity: "outreach_contact", entityId: c.id, summary: `${c.brandName}: outreach email “${data.subject.slice(0, 80)}” ${res.deliveryStatus}` });
    if (res.deliveryStatus === "failed") throw new AdminError(`The email provider refused it: ${res.error ?? "unknown error"}`);
    return { message: res.deliveryStatus === "logged" ? "Logged to the outbox — no email provider is configured, so nothing was sent" : "Email sent" };
  },
);

export const bulkSendOutreachAction = adminAction(
  "outreach.manage",
  z.object({ ids: zIds.pipe(z.array(z.string()).min(1, "Select at least one contact").max(BULK_SEND_LIMIT, `Select at most ${BULK_SEND_LIMIT} contacts`)), templateId: zUuid }),
  async ({ data, user, audit }) => {
    const { sender, siteUrl } = await sendContext();
    const d = await db();
    const tpl = await d.query.outreachTemplates.findFirst({ where: and(eq(outreachTemplates.id, data.templateId), eq(outreachTemplates.isArchived, false)) });
    if (!tpl) throw new AdminError("Template not found");
    const unknown = unresolvedFields(`${tpl.subject}\n${tpl.body}`);
    if (unknown.length) throw new AdminError(`The template has unknown merge fields: ${unknown.map((u) => `{${u}}`).join(", ")}`);
    const contacts = await d.select().from(outreachContacts).where(inArray(outreachContacts.id, data.ids)).orderBy(asc(outreachContacts.brandName));
    const facts = await loadSendFacts(contacts);
    const tally = { sent: 0, logged: 0, failed: 0, skipped: 0 };
    const skipped: string[] = [];
    // Sequential on purpose: one message at a time through the outbox.
    for (const c of contacts) {
      const reason = skipReason(c, { suppressed: facts.suppressed, lastEmailedAt: facts.lastEmailed.get(c.id) });
      if (reason) {
        tally.skipped++;
        skipped.push(`${c.brandName}: ${reason.message}`);
        continue;
      }
      const msg = composeOutreachEmail({ template: tpl, contact: c, sender, siteUrl, unsubscribeUrl: unsubscribeUrl(siteUrl, c.id) });
      const res = await deliverOutreachEmail({ contact: c, subject: msg.subject, body: msg.body, templateId: tpl.id, actorId: user.id, sender, siteUrl });
      tally[res.deliveryStatus as "sent" | "logged" | "failed"]++;
    }
    await audit({
      action: "outreach.bulk_email",
      entity: "outreach_contact",
      summary: `Bulk outreach “${tpl.name}”: ${tally.sent} sent, ${tally.logged} logged, ${tally.failed} failed, ${tally.skipped} skipped`,
      data: { ids: data.ids, skipped },
    });
    const parts = [tally.sent ? `${tally.sent} sent` : null, tally.logged ? `${tally.logged} logged to the outbox (no provider — nothing sent)` : null, tally.failed ? `${tally.failed} failed` : null, tally.skipped ? `${tally.skipped} skipped` : null].filter(Boolean);
    return { message: parts.join(" · ") || "Nothing to send" };
  },
);

// ── Templates & sender ──────────────────────────────────────────────────────

const templateFields = { name: zStr(80), subject: zStr(200), body: zStr(10_000) };

function checkTemplate(data: { subject: string; body: string }) {
  const unknown = unresolvedFields(`${data.subject}\n${data.body}`);
  if (unknown.length) throw new AdminError(`Unknown merge field${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{${u}}`).join(", ")}. Use {brand}, {name}, {sender_name}, {sender_phone} or {site_url}.`);
}

export const createOutreachTemplateAction = adminAction("outreach.manage", z.object(templateFields), async ({ data, user, audit }) => {
  checkTemplate(data);
  const d = await db();
  const [{ n }] = await d.select({ n: sql<number>`coalesce(max(${outreachTemplates.sort}), 0)::int` }).from(outreachTemplates);
  const [tpl] = await d.insert(outreachTemplates).values({ ...data, sort: n + 1, updatedById: user.id }).returning();
  await audit({ action: "outreach.template_create", entity: "outreach_template", entityId: tpl.id, summary: `Created outreach template “${tpl.name}”` });
  return { message: "Template created" };
});

export const updateOutreachTemplateAction = adminAction("outreach.manage", z.object({ id: zUuid, ...templateFields, isArchived: zBool }), async ({ data, user, audit }) => {
  checkTemplate(data);
  const d = await db();
  const before = await d.query.outreachTemplates.findFirst({ where: eq(outreachTemplates.id, data.id) });
  if (!before) throw new AdminError("Template not found");
  const row = { name: data.name, subject: data.subject, body: data.body, isArchived: data.isArchived };
  const fields = changedFields({ name: before.name, subject: before.subject, body: before.body, isArchived: before.isArchived }, row);
  if (!fields.length) return { message: "No changes to save" };
  await d.update(outreachTemplates).set({ ...row, updatedById: user.id }).where(eq(outreachTemplates.id, before.id));
  await audit({ action: "outreach.template_update", entity: "outreach_template", entityId: before.id, summary: `Edited outreach template “${row.name}” (${fields.join(", ")})`, data: { before: { subject: before.subject, body: before.body }, after: { subject: row.subject, body: row.body } } });
  return { message: "Template saved" };
});

export const deleteOutreachTemplateAction = adminAction("outreach.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const tpl = await d.query.outreachTemplates.findFirst({ where: eq(outreachTemplates.id, data.id) });
  if (!tpl) throw new AdminError("Template not found");
  // Sent messages keep their text; their template link is cleared.
  await d.delete(outreachTemplates).where(eq(outreachTemplates.id, tpl.id));
  await audit({ action: "outreach.template_delete", entity: "outreach_template", entityId: tpl.id, summary: `Deleted outreach template “${tpl.name}”` });
  return { message: "Template deleted" };
});

export const restoreOutreachTemplatesAction = adminAction("outreach.manage", z.object({}), async ({ audit }) => {
  const d = await db();
  await seedOutreachTemplates(d);
  await audit({ action: "outreach.template_seed", entity: "outreach_template", summary: "Restored the default outreach templates (missing ones only)" });
  return { message: "Default templates restored (existing ones left as they are)" };
});

export const saveOutreachSenderAction = adminAction(
  "outreach.manage",
  z.object({ senderName: zOptStr(80), senderPhone: zOptStr(40), replyTo: zOptEmail, businessAddress: zOptStr(160) }),
  async ({ data, audit }) => {
    const before = await getSetting("outreach");
    const value = { ...data, replyTo: normalizeEmail(data.replyTo) };
    const fields = changedFields(before, value);
    if (!fields.length) return { message: "No changes to save" };
    await setSetting("outreach", value);
    await audit({ action: "setting.outreach", entity: "setting", entityId: "outreach", summary: `Outreach sender: changed ${fields.join(", ")}`, data: { before, after: value } });
    return { message: "Sender saved" };
  },
);
