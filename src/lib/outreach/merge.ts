/**
 * Outreach templates: merge fields and the compliance footer. Pure.
 *
 * Merge fields: {brand}, {name} (contact name, or "{brand} team"),
 * {sender_name}, {sender_phone}, {site_url}. Unknown fields are left as typed
 * so staff can see them in the preview; `unresolvedFields` lists them.
 */

import type { OutreachSenderSetting } from "@/lib/settings";

export type { OutreachSenderSetting };

export const MERGE_FIELDS = [
  { key: "brand", hint: "Brand name" },
  { key: "name", hint: "Contact name, or “{brand} team”" },
  { key: "sender_name", hint: "Your name (sender settings)" },
  { key: "sender_phone", hint: "Your phone (sender settings)" },
  { key: "site_url", hint: "Wahbayaan's address" },
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number]["key"];
export type MergeVars = Record<MergeField, string>;

export function mergeVars(contact: { brandName: string; contactName?: string | null }, sender: OutreachSenderSetting, siteUrl: string): MergeVars {
  const brand = contact.brandName.trim();
  return {
    brand,
    name: contact.contactName?.trim() || `${brand} team`,
    sender_name: sender.senderName?.trim() ?? "",
    sender_phone: sender.senderPhone?.trim() ?? "",
    site_url: siteUrl.replace(/\/$/, ""),
  };
}

const FIELD_RE = /\{([a-z_]+)\}/g;

/** Replace known merge fields; leave anything else exactly as typed. */
export function renderTemplate(text: string, vars: MergeVars): string {
  return text.replace(FIELD_RE, (m, key: string) => (key in vars ? vars[key as MergeField] : m));
}

/** `{fields}` in the text that aren't merge fields (typos like {brnad}). */
export function unresolvedFields(text: string): string[] {
  const known = new Set<string>(MERGE_FIELDS.map((f) => f.key));
  return [...new Set([...text.matchAll(FIELD_RE)].map((m) => m[1]).filter((k) => !known.has(k)))];
}

/** Merge fields that render empty for this contact/sender (e.g. no sender phone yet). */
export function emptyFieldsUsed(text: string, vars: MergeVars): MergeField[] {
  return [...new Set([...text.matchAll(FIELD_RE)].map((m) => m[1]).filter((k): k is MergeField => k in vars && !vars[k as MergeField]))];
}

/**
 * Every outreach email ends with the sender's business identity and a one-click
 * opt-out link. Appended at send time — staff can't remove it.
 */
export function outreachFooter(opts: { sender: OutreachSenderSetting; siteUrl: string; unsubscribeUrl: string }) {
  const identity = ["Wahbayaan", opts.sender.businessAddress?.trim(), opts.siteUrl.replace(/\/$/, "")].filter(Boolean).join(" · ");
  return `—\n${identity}\nThis is a one-off business enquiry about listing your brand. Not interested? Opt out with one click and we won't email you again: ${opts.unsubscribeUrl}`;
}

/** Render a template for one contact: subject, body, and the final text with the footer. */
export function composeOutreachEmail(input: {
  template: { subject: string; body: string };
  contact: { brandName: string; contactName?: string | null };
  sender: OutreachSenderSetting;
  siteUrl: string;
  unsubscribeUrl: string;
}) {
  const vars = mergeVars(input.contact, input.sender, input.siteUrl);
  const subject = renderTemplate(input.template.subject, vars).replace(/\s+/g, " ").trim();
  const body = renderTemplate(input.template.body, vars).trim();
  return { subject, body, footer: outreachFooter(input), vars };
}

/** The text actually sent: the (possibly edited) body + the fixed footer. */
export function withFooter(body: string, footer: string) {
  return `${body.trim()}\n\n${footer}`;
}
