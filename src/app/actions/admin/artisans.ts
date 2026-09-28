"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { notifications, verificationChecks, vendors } from "@/lib/db/schema";
import { saveUpload } from "@/lib/storage";
import { sendEmail } from "@/lib/email";
import { slugify } from "@/lib/ids";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { KEY_VERIFICATION_CHECKS, VERIFICATION_LABEL } from "@/lib/admin/labels";
import { zBool, zIds, zOptBps, zOptInt, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

const REGIONS = ["punjab", "sindh", "khyber_pakhtunkhwa", "balochistan", "gilgit_baltistan", "azad_kashmir", "islamabad"] as const;

async function loadVendor(id: string) {
  const d = await db();
  const v = await d.query.vendors.findFirst({ where: eq(vendors.id, id), with: { user: true } });
  if (!v) throw new AdminError("Artisan not found");
  return v;
}

export const updateArtisanProfileAction = adminAction(
  "vendors.manage",
  z.object({
    vendorId: zUuid,
    displayName: zStr(120),
    slug: zStr(80).transform((s) => slugify(s)),
    craft: zStr(120),
    primaryCategoryId: z.string().optional(),
    tagline: zOptStr(200),
    story: zOptStr(8000),
    craftHistory: zOptStr(8000),
    workshopCity: zOptStr(120),
    workshopRegion: z.enum(["", ...REGIONS]).optional(),
    foundedYear: zOptInt(1800, new Date().getFullYear()),
    languages: zOptStr(300),
    storyVideoUrl: zOptStr(500),
    responseTimeHours: zOptInt(0, 720),
    acceptsCustomOrders: zBool,
    profilePhotoKind: z.enum(["photo", "illustration"]).optional(),
    payoutMethod: zOptStr(40),
    payoutAccountTitle: zOptStr(120),
    payoutBankName: zOptStr(120),
    payoutAccountLast4: zOptStr(4).refine((v) => !v || /^\d{4}$/.test(v), "Last 4 digits only"),
  }),
  async ({ user, data, formData, audit }) => {
    const before = await loadVendor(data.vendorId);
    const d = await db();
    const clash = await d.query.vendors.findFirst({ where: and(eq(vendors.slug, data.slug), ne(vendors.id, before.id)) });
    if (clash) throw new AdminError(`The URL slug “${data.slug}” is used by ${clash.displayName}.`);
    const [photo] = files(formData, "profilePhoto");
    const [banner] = files(formData, "banner");
    const photoUrl = photo ? await saveUpload(photo, { uploadedById: user.id, alt: `${data.displayName} — portrait` }) : null;
    const bannerUrl = banner ? await saveUpload(banner, { uploadedById: user.id, alt: `${data.displayName} — workshop banner` }) : null;
    const patch = {
      displayName: data.displayName,
      slug: data.slug,
      craft: data.craft,
      primaryCategoryId: data.primaryCategoryId || null,
      tagline: data.tagline,
      story: data.story,
      craftHistory: data.craftHistory,
      workshopCity: data.workshopCity,
      workshopRegion: data.workshopRegion || null,
      foundedYear: data.foundedYear,
      languages: (data.languages ?? "").split(",").map((l) => l.trim()).filter(Boolean),
      storyVideoUrl: data.storyVideoUrl,
      responseTimeHours: data.responseTimeHours,
      acceptsCustomOrders: data.acceptsCustomOrders,
      payoutMethod: data.payoutMethod,
      payoutAccountTitle: data.payoutAccountTitle,
      payoutBankName: data.payoutBankName,
      payoutAccountLast4: data.payoutAccountLast4,
      ...(photoUrl ? { profilePhotoUrl: photoUrl, profilePhotoKind: "photo" as const } : data.profilePhotoKind ? { profilePhotoKind: data.profilePhotoKind } : {}),
      ...(bannerUrl ? { bannerUrl } : {}),
    };
    await d.update(vendors).set(patch).where(eq(vendors.id, before.id));
    const changed = Object.keys(patch).filter((k) => JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((patch as Record<string, unknown>)[k] ?? null));
    await audit({ action: "vendor.update", entity: "vendor", entityId: before.id, summary: `Edited ${data.displayName}'s profile (${changed.join(", ") || "no changes"})`, data: { changed } });
    return { message: `Profile saved${photoUrl ? " · new photo" : ""}${bannerUrl ? " · new banner" : ""}` };
  },
);

export const removeArtisanImageAction = adminAction("vendors.manage", z.object({ vendorId: zUuid, field: z.enum(["profilePhotoUrl", "bannerUrl"]) }), async ({ data, audit }) => {
  const v = await loadVendor(data.vendorId);
  const d = await db();
  await d.update(vendors).set(data.field === "profilePhotoUrl" ? { profilePhotoUrl: null, profilePhotoKind: null } : { bannerUrl: null }).where(eq(vendors.id, v.id));
  await audit({ action: "vendor.image_remove", entity: "vendor", entityId: v.id, summary: `Removed ${v.displayName}'s ${data.field === "bannerUrl" ? "banner" : "profile photo"}` });
  return { message: "Image removed" };
});

export const verifyArtisanAction = adminAction(
  "vendors.verify",
  z.object({ vendorId: zUuid, status: z.enum(["in_review", "verified", "rejected"]), reason: zOptStr(1000) }),
  async ({ data, audit }) => {
    const v = await loadVendor(data.vendorId);
    const d = await db();
    if (data.status === "verified") {
      const checks = await d.select().from(verificationChecks).where(eq(verificationChecks.vendorId, v.id));
      const missing = KEY_VERIFICATION_CHECKS.filter((k) => !checks.some((c) => c.kind === k && c.status === "passed"));
      if (missing.length) throw new AdminError(`Verification needs these checks passed first: ${missing.map((m) => VERIFICATION_LABEL[m]).join(", ")}.`);
      if (checks.some((c) => c.status === "failed")) throw new AdminError("A verification check has failed — resolve it before verifying.");
    }
    if (data.status === "rejected" && !data.reason) throw new AdminError("Give a reason for rejecting.");
    await d
      .update(vendors)
      .set({ status: data.status, ...(data.status === "verified" ? { verifiedAt: new Date() } : {}) })
      .where(eq(vendors.id, v.id));
    await d.insert(notifications).values({
      userId: v.userId,
      kind: "account",
      title: data.status === "verified" ? "Your workshop is verified" : data.status === "rejected" ? "Your application was not approved" : "Your workshop is in review",
      body: data.reason ?? undefined,
      link: "/seller",
    });
    if (data.status !== "in_review")
      await sendEmail({
        to: v.user.email,
        subject: data.status === "verified" ? "You're verified on Wahbayaan" : "About your Wahbayaan application",
        template: `vendor_${data.status}`,
        body:
          data.status === "verified"
            ? `Congratulations ${v.displayName} — your workshop is verified. Once your profile and listings are complete, they'll appear on the storefront.`
            : `Thank you for applying. We're unable to verify your workshop at this time.\n\n${data.reason}`,
      });
    await audit({ action: `vendor.${data.status}`, entity: "vendor", entityId: v.id, summary: `Set ${v.displayName} to ${data.status.replace("_", " ")}`, data: { from: v.status, reason: data.reason } });
    return { message: data.status === "verified" ? "Artisan verified" : `Status set to ${data.status.replace("_", " ")}` };
  },
);

export const suspendArtisanAction = adminAction(
  "vendors.manage",
  z.object({ vendorId: zUuid, op: z.enum(["suspend", "reinstate"]), reason: zOptStr(1000) }),
  async ({ data, audit }) => {
    const v = await loadVendor(data.vendorId);
    const d = await db();
    if (data.op === "suspend") {
      if (!data.reason) throw new AdminError("Give a reason for suspending.");
      await d.update(vendors).set({ status: "suspended" }).where(eq(vendors.id, v.id));
      await d.insert(notifications).values({ userId: v.userId, kind: "account", title: "Your shop is suspended", body: data.reason, link: "/seller" });
    } else {
      if (v.status !== "suspended") throw new AdminError("This artisan isn't suspended.");
      await d.update(vendors).set({ status: v.verifiedAt ? "verified" : "in_review" }).where(eq(vendors.id, v.id));
    }
    await audit({ action: `vendor.${data.op}`, entity: "vendor", entityId: v.id, summary: `${data.op === "suspend" ? "Suspended" : "Reinstated"} ${v.displayName}`, data: { reason: data.reason } });
    return { message: data.op === "suspend" ? "Artisan suspended — hidden from the storefront" : "Artisan reinstated" };
  },
);

export const saveCheckAction = adminAction(
  "vendors.verify",
  z.object({ vendorId: zUuid, kind: z.enum(["identity", "workshop", "samples", "video_call", "address"]), status: z.enum(["pending", "passed", "failed"]), notes: zOptStr(2000) }),
  async ({ user, data, audit }) => {
    const v = await loadVendor(data.vendorId);
    const d = await db();
    const existing = await d.query.verificationChecks.findFirst({ where: and(eq(verificationChecks.vendorId, v.id), eq(verificationChecks.kind, data.kind)) });
    const values = { status: data.status, notes: data.notes, checkedById: user.id, checkedAt: data.status === "pending" ? null : new Date() };
    if (existing) await d.update(verificationChecks).set(values).where(eq(verificationChecks.id, existing.id));
    else await d.insert(verificationChecks).values({ vendorId: v.id, kind: data.kind, ...values });
    if (data.kind === "address" && data.status === "passed") await d.update(vendors).set({ locationVerified: true }).where(eq(vendors.id, v.id));
    await audit({ action: "vendor.check", entity: "vendor", entityId: v.id, summary: `${VERIFICATION_LABEL[data.kind]} check → ${data.status} for ${v.displayName}`, data: { notes: data.notes } });
    return { message: `${VERIFICATION_LABEL[data.kind]}: ${data.status}` };
  },
);

export const updateArtisanSettingsAction = adminAction(
  "vendors.manage",
  z.object({ vendorId: zUuid, commissionPercent: zOptBps, locationVerified: zBool, isFeatured: zBool, vacationMode: zBool }),
  async ({ data, audit }) => {
    const v = await loadVendor(data.vendorId);
    const d = await db();
    const patch = { commissionBps: data.commissionPercent, locationVerified: data.locationVerified, isFeatured: data.isFeatured, vacationMode: data.vacationMode };
    await d.update(vendors).set(patch).where(eq(vendors.id, v.id));
    await audit({
      action: "vendor.settings",
      entity: "vendor",
      entityId: v.id,
      summary: `Updated ${v.displayName}: commission ${data.commissionPercent == null ? "default" : `${data.commissionPercent / 100}%`}, featured ${data.isFeatured ? "on" : "off"}, vacation ${data.vacationMode ? "on" : "off"}`,
      data: { before: { commissionBps: v.commissionBps, locationVerified: v.locationVerified, isFeatured: v.isFeatured, vacationMode: v.vacationMode }, after: patch },
    });
    return { message: "Settings saved" };
  },
);

export const toggleArtisanFeaturedAction = adminAction("vendors.manage", z.object({ vendorId: zUuid }), async ({ data, audit }) => {
  const v = await loadVendor(data.vendorId);
  const d = await db();
  await d.update(vendors).set({ isFeatured: !v.isFeatured }).where(eq(vendors.id, v.id));
  await audit({ action: "vendor.feature", entity: "vendor", entityId: v.id, summary: `${v.isFeatured ? "Unfeatured" : "Featured"} ${v.displayName}` });
  return { message: v.isFeatured ? "No longer featured" : "Featured" };
});

export const bulkArtisansAction = adminAction(
  "vendors.manage",
  z.object({ op: z.enum(["suspend", "reinstate", "feature", "unfeature"]), ids: zIds, reason: zOptStr(500) }),
  async ({ data, audit }) => {
    if (!data.ids.length) throw new AdminError("Select at least one artisan.");
    const d = await db();
    const rows = await d.select().from(vendors).where(inArray(vendors.id, data.ids));
    if (data.op === "suspend") {
      await d.update(vendors).set({ status: "suspended" }).where(inArray(vendors.id, data.ids));
      for (const v of rows) await d.insert(notifications).values({ userId: v.userId, kind: "account", title: "Your shop is suspended", body: data.reason ?? undefined, link: "/seller" });
    } else if (data.op === "reinstate") {
      for (const v of rows.filter((r) => r.status === "suspended")) await d.update(vendors).set({ status: v.verifiedAt ? "verified" : "in_review" }).where(eq(vendors.id, v.id));
    } else {
      await d.update(vendors).set({ isFeatured: data.op === "feature" }).where(inArray(vendors.id, data.ids));
    }
    await audit({ action: `vendor.bulk_${data.op}`, entity: "vendor", summary: `Bulk ${data.op}: ${rows.map((r) => r.displayName).join(", ")}`, data: { ids: data.ids, reason: data.reason } });
    return { message: `${rows.length} artisan${rows.length === 1 ? "" : "s"} updated` };
  },
);
