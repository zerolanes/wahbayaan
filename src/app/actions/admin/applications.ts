"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, vendorApplications, vendors, verificationChecks } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email";
import { slugify } from "@/lib/ids";
import { adminAction, AdminError } from "@/lib/admin/action";
import { generatePassword } from "@/lib/admin/staff";
import { zOptStr, zStr, zUuid } from "@/lib/admin/zod";

async function loadApp(id: string) {
  const d = await db();
  const a = await d.query.vendorApplications.findFirst({ where: eq(vendorApplications.id, id) });
  if (!a) throw new AdminError("Application not found");
  return a;
}

async function uniqueSlug(base: string) {
  const d = await db();
  const root = slugify(base) || "artisan";
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    const hit = await d.query.vendors.findFirst({ where: eq(vendors.slug, slug) });
    if (!hit) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export const reviewApplicationAction = adminAction(
  "vendors.verify",
  z.object({ applicationId: zUuid, op: z.enum(["in_review", "more_info", "reject"]), message: zOptStr(3000) }),
  async ({ user, data, audit }) => {
    const a = await loadApp(data.applicationId);
    if (a.status === "approved") throw new AdminError("This application was already approved.");
    const d = await db();
    if (data.op !== "in_review" && !data.message) throw new AdminError(data.op === "reject" ? "Give the applicant a reason." : "Tell the applicant what you need.");
    const status = data.op === "reject" ? "rejected" : data.op;
    const note = data.message ? `${new Date().toISOString().slice(0, 10)} ${data.op === "reject" ? "Rejected" : data.op === "more_info" ? "Asked for more info" : "Moved to review"}: ${data.message}` : null;
    await d
      .update(vendorApplications)
      .set({
        status,
        reviewerId: user.id,
        reviewerNotes: note ? [a.reviewerNotes, note].filter(Boolean).join("\n") : a.reviewerNotes,
        ...(status === "rejected" ? { decidedAt: new Date() } : {}),
      })
      .where(eq(vendorApplications.id, a.id));
    if (data.op === "more_info")
      await sendEmail({ to: a.email, subject: "About your Wahbayaan artisan application", template: "application_more_info", body: `Hello ${a.fullName},\n\nThank you for applying to sell on Wahbayaan. Before we can continue, we need a little more from you:\n\n${data.message}\n\nJust reply to this email.` });
    if (data.op === "reject")
      await sendEmail({ to: a.email, subject: "Your Wahbayaan artisan application", template: "application_rejected", body: `Hello ${a.fullName},\n\nThank you for applying. We're not able to onboard your workshop at this time.\n\n${data.message}` });
    await audit({ action: `application.${data.op}`, entity: "application", entityId: a.id, summary: `${data.op === "reject" ? "Rejected" : data.op === "more_info" ? "Requested more info from" : "Moved to review"} ${a.fullName} (${a.craft})`, data: { message: data.message } });
    return { message: data.op === "reject" ? "Application rejected and applicant emailed" : data.op === "more_info" ? "Applicant emailed" : "Moved to review" };
  },
);

export const saveReviewerNotesAction = adminAction("vendors.view", z.object({ applicationId: zUuid, reviewerNotes: zOptStr(8000) }), async ({ data, audit }) => {
  const a = await loadApp(data.applicationId);
  const d = await db();
  await d.update(vendorApplications).set({ reviewerNotes: data.reviewerNotes }).where(eq(vendorApplications.id, a.id));
  await audit({ action: "application.notes", entity: "application", entityId: a.id, summary: `Edited reviewer notes on ${a.fullName}` });
  return { message: "Reviewer notes saved" };
});

/**
 * Approve an application: create (or reuse) the account, give it the seller
 * role, create the artisan in review with pending verification checks, and
 * email an invitation. The temporary password is shown once to staff.
 */
export const approveApplicationAction = adminAction(
  "vendors.verify",
  z.object({ applicationId: zUuid, displayName: zStr(120), welcome: zOptStr(2000) }),
  async ({ user, data, audit }) => {
    const a = await loadApp(data.applicationId);
    if (a.status === "approved") throw new AdminError("Already approved.");
    const d = await db();
    const email = a.email.trim().toLowerCase();
    let account = await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
    let password: string | null = null;
    if (account?.role === "staff") throw new AdminError("That email belongs to a staff account. Ask the applicant for another email.");
    if (!account) {
      password = generatePassword();
      [account] = await d
        .insert(users)
        .values({ email, name: a.fullName, passwordHash: await hashPassword(password), role: "seller", country: "PK", phone: a.phone })
        .returning();
    } else if (account.role !== "seller") {
      await d.update(users).set({ role: "seller" }).where(eq(users.id, account.id));
    }
    let vendor = await d.query.vendors.findFirst({ where: eq(vendors.userId, account.id) });
    if (!vendor) {
      [vendor] = await d
        .insert(vendors)
        .values({
          userId: account.id,
          slug: await uniqueSlug(data.displayName),
          displayName: data.displayName,
          craft: a.craft,
          primaryCategoryId: a.categoryId,
          story: a.story,
          workshopCity: a.workshopCity,
          workshopRegion: a.workshopRegion,
          status: "in_review",
        })
        .returning();
      await d.insert(verificationChecks).values((["identity", "workshop", "samples", "video_call", "address"] as const).map((kind) => ({ vendorId: vendor!.id, kind, status: "pending" as const })));
    }
    await d
      .update(vendorApplications)
      .set({ status: "approved", decidedAt: new Date(), reviewerId: user.id, userId: account.id, vendorId: vendor.id })
      .where(eq(vendorApplications.id, a.id));
    const appUrl = process.env.APP_URL ?? "";
    await sendEmail({
      to: email,
      subject: "Welcome to Wahbayaan — set up your workshop",
      template: "application_approved",
      body: [
        `Hello ${a.fullName},`,
        "",
        "Your application to sell on Wahbayaan has been approved. Our team will now complete a few verification checks (identity, workshop and samples) before your shop goes live.",
        data.welcome ? `\n${data.welcome}\n` : "",
        password ? `Sign in at ${appUrl}/login with:\nEmail: ${email}\nTemporary password: ${password}\nPlease change it after your first sign-in.` : `Sign in at ${appUrl}/login with your existing account (${email}).`,
      ].join("\n"),
    });
    await audit({ action: "application.approve", entity: "application", entityId: a.id, summary: `Approved ${a.fullName} → artisan “${vendor.displayName}” (in review)${password ? ", new account created" : ", existing account linked"}`, data: { vendorId: vendor.id, userId: account.id } });
    return {
      message: `Approved — ${vendor.displayName} created in review and invited by email`,
      ...(password ? { data: { "Temporary password (shown once)": password } } : {}),
    };
  },
);
