import crypto from "node:crypto";

/**
 * Stateless password-reset tokens: "<userId>.<expiresAtMs>.<signature>".
 *
 * The signature is an HMAC keyed by the user's current password hash (plus
 * AUTH_SECRET when set), so a token can't be forged without server data and
 * stops working the moment the password changes — every link is single-use.
 */
export const RESET_TTL_MS = 60 * 60 * 1000;

function sign(userId: string, expiresAt: number, passwordHash: string) {
  const key = `${process.env.AUTH_SECRET ?? ""}:${passwordHash}`;
  return crypto.createHmac("sha256", key).update(`${userId}.${expiresAt}`).digest("base64url");
}

export function createResetToken(userId: string, passwordHash: string, now = Date.now()) {
  const expiresAt = now + RESET_TTL_MS;
  return `${userId}.${expiresAt}.${sign(userId, expiresAt, passwordHash)}`;
}

/** Splits a token without trusting it; verify with `verifyResetToken` once the user is loaded. */
export function parseResetToken(token: string) {
  const [userId, exp, signature] = token.split(".");
  const expiresAt = Number(exp);
  if (!userId || !signature || !Number.isFinite(expiresAt)) return null;
  return { userId, expiresAt, signature };
}

export function verifyResetToken(token: string, passwordHash: string, now = Date.now()) {
  const parsed = parseResetToken(token);
  if (!parsed || parsed.expiresAt < now) return false;
  const expected = Buffer.from(sign(parsed.userId, parsed.expiresAt, passwordHash));
  const given = Buffer.from(parsed.signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
