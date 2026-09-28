"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { saveUpload, uploadDir } from "@/lib/storage";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { mediaUsage } from "@/lib/admin/media-usage";
import { zIds, zOptStr, zUuid } from "@/lib/admin/zod";

/** Remove the stored file for a /media/… URL, never touching anything outside the upload directory. */
async function removeFile(url: string) {
  if (!url.startsWith("/media/")) return false;
  const root = uploadDir();
  const target = path.resolve(root, url.slice("/media/".length));
  if (!target.startsWith(root + path.sep)) return false;
  try {
    await fs.unlink(target);
    return true;
  } catch {
    return false;
  }
}

export const uploadMediaAction = adminAction("media.manage", z.object({ alt: zOptStr(300) }), async ({ user, data, formData, audit }) => {
  const list = files(formData, "files");
  if (!list.length) throw new AdminError("Choose at least one file.");
  const urls: string[] = [];
  for (const f of list) urls.push(await saveUpload(f, { uploadedById: user.id, alt: data.alt }));
  await audit({ action: "media.upload", entity: "media", summary: `Uploaded ${urls.length} file${urls.length === 1 ? "" : "s"}: ${list.map((f) => f.name).join(", ")}`, data: { after: { urls } } });
  return { message: `${urls.length} file${urls.length === 1 ? "" : "s"} uploaded` };
});

export const saveMediaAltAction = adminAction("media.manage", z.object({ id: zUuid, alt: zOptStr(300) }), async ({ data, audit }) => {
  const d = await db();
  const m = await d.query.media.findFirst({ where: eq(media.id, data.id) });
  if (!m) throw new AdminError("File not found.");
  if ((m.alt ?? null) === data.alt) return { message: "No change" };
  await d.update(media).set({ alt: data.alt }).where(eq(media.id, m.id));
  await audit({ action: "media.alt", entity: "media", entityId: m.id, summary: `Alt text for ${m.filename} ${data.alt ? "updated" : "cleared"}`, data: { before: { alt: m.alt }, after: { alt: data.alt } } });
  return { message: "Alt text saved" };
});

/** Delete files that nothing references. Files in use are skipped and reported. */
export const deleteMediaAction = adminAction("media.manage", z.object({ ids: zIds, op: z.string().optional() }), async ({ data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one file.");
  const d = await db();
  const rows = await d.select().from(media).where(inArray(media.id, data.ids));
  const usage = await mediaUsage(rows.map((r) => r.url));
  const free = rows.filter((r) => !usage.get(r.url)?.length);
  const busy = rows.length - free.length;
  if (!free.length) throw new AdminError(`${busy === 1 ? "This file is" : "These files are"} still in use — remove ${busy === 1 ? "it" : "them"} from the listing, artisan or page first.`);
  await d.delete(media).where(inArray(media.id, free.map((r) => r.id)));
  let removed = 0;
  for (const r of free) if (await removeFile(r.url)) removed++;
  for (const r of free) await audit({ action: "media.delete", entity: "media", entityId: r.id, summary: `Deleted ${r.filename} (${r.url})`, data: { before: r } });
  return { message: `${free.length} file${free.length === 1 ? "" : "s"} deleted${removed < free.length ? ` (${free.length - removed} had no file on disk)` : ""}${busy ? ` · ${busy} skipped because in use` : ""}` };
});
