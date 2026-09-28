"use server";

import { eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { redirects } from "@/lib/db/schema";
import { adminAction, AdminError } from "@/lib/admin/action";
import { normalizePath, normalizeTarget, validateRedirect } from "@/lib/admin/redirects";
import { zBool, zIds, zStr } from "@/lib/admin/zod";

const fields = { fromPath: zStr(500), toPath: zStr(1000), permanent: zBool };

export const saveRedirectAction = adminAction("settings.manage", z.object({ id: z.string().uuid().optional(), ...fields }), async ({ data, audit }) => {
  const d = await db();
  const fromPath = normalizePath(data.fromPath);
  const toPath = normalizeTarget(data.toPath);
  const others = await d.select().from(redirects).where(data.id ? ne(redirects.id, data.id) : undefined);
  const err = validateRedirect({ fromPath, toPath }, others);
  if (err) throw new AdminError(err);
  const values = { fromPath, toPath, permanent: data.permanent };
  if (data.id) {
    const before = await d.query.redirects.findFirst({ where: eq(redirects.id, data.id) });
    if (!before) throw new AdminError("Redirect not found.");
    await d.update(redirects).set(values).where(eq(redirects.id, before.id));
    await audit({ action: "redirect.update", entity: "redirect", entityId: before.id, summary: `Redirect ${fromPath} → ${toPath} (${data.permanent ? "301" : "302"})`, data: { before: { fromPath: before.fromPath, toPath: before.toPath, permanent: before.permanent }, after: values } });
    return { message: "Redirect saved" };
  }
  const [r] = await d.insert(redirects).values(values).returning();
  await audit({ action: "redirect.create", entity: "redirect", entityId: r.id, summary: `Added redirect ${fromPath} → ${toPath} (${data.permanent ? "301" : "302"})`, data: { after: values } });
  return { message: `Redirect from ${fromPath} added` };
});

export const deleteRedirectsAction = adminAction("settings.manage", z.object({ ids: zIds, op: z.string().optional() }), async ({ data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one redirect.");
  const d = await db();
  const rows = await d.select().from(redirects).where(inArray(redirects.id, data.ids));
  await d.delete(redirects).where(inArray(redirects.id, rows.map((r) => r.id)));
  for (const r of rows) await audit({ action: "redirect.delete", entity: "redirect", entityId: r.id, summary: `Deleted redirect ${r.fromPath} → ${r.toPath} (${r.hits} hits)`, data: { before: r } });
  return { message: `${rows.length} redirect${rows.length === 1 ? "" : "s"} deleted` };
});

export const resetRedirectHitsAction = adminAction("settings.manage", z.object({ id: z.string().uuid() }), async ({ data, audit }) => {
  const d = await db();
  const r = await d.query.redirects.findFirst({ where: eq(redirects.id, data.id) });
  if (!r) throw new AdminError("Redirect not found.");
  await d.update(redirects).set({ hits: 0 }).where(eq(redirects.id, r.id));
  await audit({ action: "redirect.reset_hits", entity: "redirect", entityId: r.id, summary: `Reset hit counter for ${r.fromPath} (was ${r.hits})` });
  return { message: "Hit counter reset" };
});
