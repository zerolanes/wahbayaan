/**
 * Who an outreach email may go to. Pure — the send actions load the facts
 * (suppression list, last email) and ask here; the preview shows the reason.
 */
export const RECENT_EMAIL_DAYS = 5;
export const BULK_SEND_LIMIT = 20;

export type SkipCheckContact = { status: string; email: string | null };
export type SkipReason = { code: "do_not_contact" | "suppressed" | "no_email" | "invalid_email" | "recently_emailed"; message: string };

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i;

export function normalizeEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  return v || null;
}

export function isValidEmail(raw: string | null | undefined) {
  const v = normalizeEmail(raw);
  return !!v && EMAIL_RE.test(v);
}

/**
 * Null when the contact can be emailed now, otherwise why not. Hard blocks
 * (do not contact, suppressed, no/invalid email) come before the 5-day rule.
 */
export function skipReason(
  c: SkipCheckContact,
  facts: { suppressed: ReadonlySet<string>; lastEmailedAt: Date | null | undefined; now?: Date },
): SkipReason | null {
  const now = facts.now ?? new Date();
  const email = normalizeEmail(c.email);
  if (c.status === "do_not_contact") return { code: "do_not_contact", message: "Marked do not contact" };
  if (email && facts.suppressed.has(email)) return { code: "suppressed", message: "Address is on the suppression list (opted out)" };
  if (!email) return { code: "no_email", message: "No email address" };
  if (!EMAIL_RE.test(email)) return { code: "invalid_email", message: "Email address doesn't look valid" };
  if (facts.lastEmailedAt) {
    const days = (now.getTime() - facts.lastEmailedAt.getTime()) / 86_400_000;
    if (days < RECENT_EMAIL_DAYS) {
      const ago = days < 1 ? "today" : `${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"} ago`;
      return { code: "recently_emailed", message: `Emailed ${ago} — wait ${RECENT_EMAIL_DAYS} days between emails` };
    }
  }
  return null;
}

/** Only the 5-day rule can be overridden (single send, explicit tick). */
export function isHardBlock(r: SkipReason | null) {
  return !!r && r.code !== "recently_emailed";
}
