"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { emailOutbox, sessions, users } from "@/lib/db/schema";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createResetToken, parseResetToken, verifyResetToken } from "@/lib/auth/reset-token";
import { sendEmail } from "@/lib/email";
import { requestOrigin } from "@/lib/order-access";
import { VISITOR_COOKIE } from "@/lib/buyer-context";
import { mergeVisitorIntoUser } from "@/lib/commerce/cart";
import { isBuyerDestination } from "@/lib/money/currency";

export type AuthState = { error?: string; fields?: Record<string, string> } | null;

function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}

async function afterSignIn(userId: string) {
  const jar = await cookies();
  const visitor = jar.get(VISITOR_COOKIE)?.value;
  if (visitor) await mergeVisitorIntoUser(`visitor:${visitor}`, userId);
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const d = await db();
  const user = await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match.", fields: { email } };
  }
  if (user.status !== "active") return { error: "This account is suspended. Please contact support.", fields: { email } };
  const h = await headers();
  await createSession(user.id, h.get("user-agent"));
  await afterSignIn(user.id);
  const fallback = user.role === "staff" ? "/admin" : user.role === "seller" ? "/seller" : "/account";
  redirect(safeNext(formData.get("next"), fallback));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.email("Please enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  country: z.string().optional(),
  marketing: z.string().optional(),
});

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  const fields = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = await db();
  const email = parsed.data.email.toLowerCase();
  const exists = await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
  if (exists) return { error: "An account with this email already exists. Try signing in.", fields };
  const [user] = await d
    .insert(users)
    .values({
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      country: isBuyerDestination(parsed.data.country) ? parsed.data.country : null,
      marketingOptIn: parsed.data.marketing === "on",
    })
    .returning();
  const h = await headers();
  await createSession(user.id, h.get("user-agent"));
  await afterSignIn(user.id);
  redirect(safeNext(formData.get("next"), "/account"));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ── Forgotten password ──────────────────────────────────────────────────────

export type ResetState = { ok?: boolean; error?: string; message?: string } | null;

const RESET_THROTTLE_MS = 3 * 60 * 1000;

/** Always answers the same way, so it never reveals which emails have accounts. */
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Please enter the email you signed up with." };
  const email = parsed.data;
  const done = { ok: true, message: `If there's an account for ${email}, we've sent a link to reset its password. It works for one hour.` };
  const d = await db();
  const user = await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
  // No password yet (e.g. a guest record): nothing safe to sign the link with.
  if (!user || user.status !== "active" || !user.passwordHash) return done;
  const recent = await d.query.emailOutbox.findFirst({
    where: and(eq(emailOutbox.to, user.email), eq(emailOutbox.template, "password_reset"), gt(emailOutbox.createdAt, new Date(Date.now() - RESET_THROTTLE_MS))),
  });
  if (recent) return done;
  const link = `${await requestOrigin()}/reset-password?token=${encodeURIComponent(createResetToken(user.id, user.passwordHash))}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Wahbayaan password",
    template: "password_reset",
    body: `Hello ${user.name.split(/\s+/)[0]},\n\nSomeone (hopefully you) asked to reset the password for your Wahbayaan account. Choose a new password here — the link works once, for one hour:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password hasn't changed.`,
  });
  return done;
}

const resetSchema = z
  .object({ token: z.string().min(10), password: z.string().min(8, "Use at least 8 characters").max(200), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match", path: ["confirm"] });

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const token = parseResetToken(parsed.data.token);
  const d = await db();
  const user = token ? await d.query.users.findFirst({ where: eq(users.id, token.userId) }).catch(() => undefined) : undefined;
  if (!user || user.status !== "active" || !user.passwordHash || !verifyResetToken(parsed.data.token, user.passwordHash)) {
    return { error: "This reset link has expired or was already used. Ask for a new one." };
  }
  await d.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, user.id));
  // Sign out everywhere: whoever had the old password loses access.
  await d.delete(sessions).where(eq(sessions.userId, user.id));
  const h = await headers();
  await createSession(user.id, h.get("user-agent"));
  redirect(user.role === "staff" ? "/admin" : user.role === "seller" ? "/seller" : "/account");
}
