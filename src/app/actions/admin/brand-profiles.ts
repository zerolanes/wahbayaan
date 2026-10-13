"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brandProfiles, brands } from "@/lib/db/schema";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { zBool, zOptStr, zUuid } from "@/lib/admin/zod";
import { saveUpload } from "@/lib/storage";
import { parseSocialLinks, SOCIAL_KEYS } from "@/lib/social";

/** Banner and social links shown on a brand's public page (partner or self-listed). */
export const saveBrandProfileAction = adminAction(
  "brands.manage",
  z.object({ id: zUuid, removeBanner: zBool, ...Object.fromEntries(SOCIAL_KEYS.map((k) => [`social_${k}`, zOptStr(300)])) }),
  async ({ data, user, formData, audit }) => {
    const d = await db();
    const brand = await d.query.brands.findFirst({ where: eq(brands.id, data.id) });
    if (!brand) throw new AdminError("Brand not found");
    const input = data as unknown as Record<string, string | null>;
    const socials = parseSocialLinks(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, input[`social_${k}`]])));
    if (!socials.ok) throw new AdminError(socials.error);
    const before = await d.query.brandProfiles.findFirst({ where: eq(brandProfiles.brandId, brand.id) });
    const upload = files(formData, "banner")[0];
    const bannerUrl = upload ? await saveUpload(upload, { uploadedById: user.id, alt: `${brand.name} banner` }) : data.removeBanner ? null : (before?.bannerUrl ?? null);
    await d
      .insert(brandProfiles)
      .values({ brandId: brand.id, bannerUrl, socials: socials.links })
      .onConflictDoUpdate({ target: brandProfiles.brandId, set: { bannerUrl, socials: socials.links } });
    await audit({ action: "brand.profile", entity: "brand", entityId: brand.id, summary: `Updated ${brand.name}'s banner and social links`, data: { before, after: { bannerUrl, socials: socials.links } } });
    return { message: "Brand page links saved" };
  },
);
