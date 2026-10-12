"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brandSellerApplications } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zOptStr, zStr, zUuid } from "@/lib/admin/zod";
import { approveBrandApplication, OnboardingError } from "@/lib/brand-portal/onboarding";

async function loadApp(id: string) {
  const d = await db();
  const a = await d.query.brandSellerApplications.findFirst({ where: eq(brandSellerApplications.id, id) });
  if (!a) throw new AdminError("Application not found");
  return a;
}

export const reviewBrandApplicationAction = adminAction(
  "vendors.verify",
  z.object({ applicationId: zUuid, op: z.enum(["in_review", "more_info", "reject"]), message: zOptStr(3000) }),
  async ({ user, data, audit }) => {
    const a = await loadApp(data.applicationId);
    if (a.status === "approved") throw new AdminError("This application was already approved.");
    if (data.op !== "in_review" && !data.message) throw new AdminError(data.op === "reject" ? "Give the applicant a reason." : "Tell the applicant what you need.");
    const status = data.op === "reject" ? "rejected" : data.op;
    const note = data.message ? `${new Date().toISOString().slice(0, 10)} ${data.op === "reject" ? "Rejected" : data.op === "more_info" ? "Asked for more info" : "Moved to review"}: ${data.message}` : null;
    const d = await db();
    await d
      .update(brandSellerApplications)
      .set({ status, reviewerId: user.id, reviewerNotes: note ? [a.reviewerNotes, note].filter(Boolean).join("\n") : a.reviewerNotes, ...(status === "rejected" ? { decidedAt: new Date() } : {}) })
      .where(eq(brandSellerApplications.id, a.id));
    if (data.op === "more_info")
      await sendEmail({ to: a.email, subject: `About ${a.brandName}'s application to Wahbayaan`, template: "brand_application_more_info", body: `Hello ${a.contactName},\n\nThanks for applying. Before we continue we need:\n\n${data.message}\n\nJust reply to this email.` });
    if (data.op === "reject")
      await sendEmail({ to: a.email, subject: `${a.brandName}'s application to Wahbayaan`, template: "brand_application_rejected", body: `Hello ${a.contactName},\n\nThank you for applying. We can't list ${a.brandName} at this time.\n\n${data.message}` });
    await audit({ action: `brand_application.${data.op}`, entity: "brand_application", entityId: a.id, summary: `${data.op === "reject" ? "Rejected" : data.op === "more_info" ? "Asked for more info from" : "Moved to review"} brand ${a.brandName}`, data: { message: data.message } });
    return { message: data.op === "reject" ? "Rejected and emailed" : data.op === "more_info" ? "Applicant emailed" : "Moved to review" };
  },
);

export const saveBrandApplicationNotesAction = adminAction("vendors.view", z.object({ applicationId: zUuid, reviewerNotes: zOptStr(8000) }), async ({ data, audit }) => {
  const a = await loadApp(data.applicationId);
  const d = await db();
  await d.update(brandSellerApplications).set({ reviewerNotes: data.reviewerNotes }).where(eq(brandSellerApplications.id, a.id));
  await audit({ action: "brand_application.notes", entity: "brand_application", entityId: a.id, summary: `Edited reviewer notes on brand ${a.brandName}` });
  return { message: "Notes saved" };
});

/**
 * Approve: the account becomes the brand's portal login, the brand is created
 * (or an unclaimed draft brand with that slug is linked) and authorised with
 * the recorded terms acceptance as its permission.
 */
export const approveBrandApplicationAction = adminAction(
  "brands.permission",
  z.object({ applicationId: zUuid, brandName: zStr(80), slug: zStr(80) }),
  async ({ user, data, audit }) => {
    let r: Awaited<ReturnType<typeof approveBrandApplication>>;
    try {
      r = await approveBrandApplication({ applicationId: data.applicationId, slug: data.slug, brandName: data.brandName, reviewerId: user.id });
    } catch (e) {
      if (e instanceof OnboardingError) throw new AdminError(e.message);
      throw e;
    }
    const appUrl = process.env.APP_URL ?? "";
    await sendEmail({
      to: r.application.email,
      subject: `${r.brand.name} is approved on Wahbayaan`,
      template: "brand_application_approved",
      body: `Hello ${r.application.contactName},\n\n${r.brand.name} is approved. Sign in at ${appUrl}/login with ${r.account.email} to open your brand portal: add your logo and banner, then upload products by form or CSV.\n\nYour brand page: ${appUrl}/brands/${r.brand.slug}`,
    });
    await audit({
      action: "brand_application.approve",
      entity: "brand_application",
      entityId: r.application.id,
      summary: `Approved brand ${r.brand.name} (${r.claimed ? "linked existing draft brand" : "new brand"} /brands/${r.brand.slug}); authorised from terms acceptance ${r.acceptance.termsVersion} by ${r.acceptance.name}`,
      data: { brandId: r.brand.id, userId: r.account.id, acceptanceId: r.acceptance.id },
    });
    await audit({
      action: "brand.permission_recorded",
      entity: "brand",
      entityId: r.brand.id,
      summary: `Permission recorded for ${r.brand.name} from the brand seller terms acceptance (${r.acceptance.name}, ${r.acceptance.acceptedAt.toISOString().slice(0, 10)}, ${r.acceptance.termsVersion}) — partnership authorised`,
      data: { after: { at: r.brand.permissionGrantedAt, by: r.brand.permissionGrantedById, note: r.brand.permissionNote, partnership: "authorised" } },
    });
    return { message: `Approved — ${r.brand.name} is authorised and the brand can sign in to its portal` };
  },
);
