import crypto from "node:crypto";

/**
 * Signed opt-out tokens for outreach emails: "<contactId>.<signature>".
 *
 * HMAC-SHA256 keyed by AUTH_SECRET (same fallback pattern as the other
 * server-side signatures), with a purpose prefix so a token minted here can't
 * be replayed anywhere else. No expiry: an opt-out link must keep working.
 */
const PURPOSE = "outreach-unsubscribe";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(contactId: string, secret = process.env.AUTH_SECRET ?? "wahbayaan") {
  return crypto.createHmac("sha256", `${secret}|${PURPOSE}`).update(contactId.toLowerCase()).digest("base64url");
}

export function createUnsubscribeToken(contactId: string, secret?: string) {
  return `${contactId.toLowerCase()}.${sign(contactId, secret)}`;
}

/** The contact id when the token is genuine, otherwise null. */
export function verifyUnsubscribeToken(token: string | null | undefined, secret?: string): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const [contactId, signature, extra] = token.trim().split(".");
  if (extra !== undefined || !contactId || !signature || !UUID_RE.test(contactId)) return null;
  const expected = Buffer.from(sign(contactId, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? contactId.toLowerCase() : null;
}

export function unsubscribeUrl(siteUrl: string, contactId: string) {
  return `${siteUrl.replace(/\/$/, "")}/outreach/unsubscribe?t=${encodeURIComponent(createUnsubscribeToken(contactId))}`;
}
