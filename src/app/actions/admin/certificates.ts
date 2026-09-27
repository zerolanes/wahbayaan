"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { certificates, orderItems } from "@/lib/db/schema";
import { reference } from "@/lib/ids";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zStr, zUuid } from "@/lib/admin/zod";

export const voidCertificateAction = adminAction("products.moderate", z.object({ id: zUuid, reason: zStr(500) }), async ({ data, audit }) => {
  const d = await db();
  const c = await d.query.certificates.findFirst({ where: eq(certificates.id, data.id) });
  if (!c) throw new AdminError("Certificate not found");
  if (c.status === "void") throw new AdminError("Already void.");
  await d.update(certificates).set({ status: "void" }).where(eq(certificates.id, c.id));
  await audit({ action: "certificate.void", entity: "certificate", entityId: c.id, summary: `Voided certificate ${c.code} (${c.title})`, data: { reason: data.reason } });
  return { message: `${c.code} is now void — the public page says so` };
});

/** Issue a fresh certificate (new code) for the same piece, voiding the old one. */
export const reissueCertificateAction = adminAction("products.moderate", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const c = await d.query.certificates.findFirst({ where: eq(certificates.id, data.id) });
  if (!c) throw new AdminError("Certificate not found");
  const [fresh] = await d
    .insert(certificates)
    .values({ code: reference("WB-COA", 8), productId: c.productId, orderItemId: c.orderItemId, vendorId: c.vendorId, artisanName: c.artisanName, craft: c.craft, title: c.title, materials: c.materials, region: c.region, madeOn: c.madeOn })
    .returning();
  await d.update(certificates).set({ status: "void" }).where(eq(certificates.id, c.id));
  if (c.orderItemId) await d.update(orderItems).set({ certificateId: fresh.id }).where(eq(orderItems.id, c.orderItemId));
  await audit({ action: "certificate.reissue", entity: "certificate", entityId: fresh.id, summary: `Reissued ${c.code} as ${fresh.code}`, data: { previous: c.code } });
  return { message: `Reissued as ${fresh.code}` };
});
