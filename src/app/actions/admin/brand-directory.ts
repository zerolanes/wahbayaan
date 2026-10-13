"use server";

import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brandDirectoryEntries } from "@/lib/db/schema";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zBool, zInt, zOptStr, zStr, zUuid } from "@/lib/admin/zod";
import { slugify } from "@/lib/brands/adapters/normalize";
import { cleanWebsite, DIRECTORY_CATEGORIES, looksLikeContactDetail } from "@/lib/directory";
import { seedDirectory, DIRECTORY_SEED_FILE } from "@/lib/directory-seed";

const zCategory = z.enum(DIRECTORY_CATEGORIES.map((c) => c.key) as [string, ...string[]]);

const fields = z.object({
  name: zStr(80),
  category: zCategory,
  description: zOptStr(160),
  websiteUrl: zOptStr(300),
  sort: zInt(0, 10_000).optional(),
});

/** Directory entries are text only: name, category, one line, website. Contact details are refused. */
function clean(data: z.output<typeof fields>) {
  if (looksLikeContactDetail(data.name) || looksLikeContactDetail(data.description))
    throw new AdminError("Directory entries can't include emails or phone numbers — keep it to a factual one-liner.");
  const websiteUrl = data.websiteUrl ? cleanWebsite(data.websiteUrl) : null;
  if (data.websiteUrl && !websiteUrl) throw new AdminError("Enter the brand's website as a full link, e.g. https://brand.pk");
  return { name: data.name, category: data.category, description: data.description, websiteUrl };
}

export const createDirectoryEntryAction = adminAction("brands.manage", fields, async ({ data, audit }) => {
  const row = clean(data);
  const slug = slugify(row.name);
  if (!slug) throw new AdminError("Enter a brand name.");
  const d = await db();
  const [e] = await d.insert(brandDirectoryEntries).values({ ...row, slug, sort: data.sort ?? 1000, source: "admin" }).returning();
  await audit({ action: "directory.create", entity: "brand_directory", entityId: e.id, summary: `Added ${e.name} to the brand directory` });
  return { message: `${e.name} added` };
});

export const updateDirectoryEntryAction = adminAction("brands.manage", fields.extend({ id: zUuid, isHidden: zBool }), async ({ data, audit }) => {
  const d = await db();
  const before = await d.query.brandDirectoryEntries.findFirst({ where: eq(brandDirectoryEntries.id, data.id) });
  if (!before) throw new AdminError("Entry not found");
  const row = { ...clean(data), isHidden: data.isHidden, sort: data.sort ?? before.sort };
  await d.update(brandDirectoryEntries).set(row).where(eq(brandDirectoryEntries.id, before.id));
  const changed = (Object.keys(row) as (keyof typeof row)[]).filter((k) => row[k] !== before[k]);
  await audit({ action: "directory.update", entity: "brand_directory", entityId: before.id, summary: `Edited directory entry ${row.name} (${changed.join(", ") || "no changes"})`, data: { before, after: row } });
  return { message: "Saved" };
});

export const toggleDirectoryEntryAction = adminAction("brands.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const e = await d.query.brandDirectoryEntries.findFirst({ where: eq(brandDirectoryEntries.id, data.id) });
  if (!e) throw new AdminError("Entry not found");
  await d.update(brandDirectoryEntries).set({ isHidden: !e.isHidden }).where(eq(brandDirectoryEntries.id, e.id));
  await audit({ action: e.isHidden ? "directory.show" : "directory.hide", entity: "brand_directory", entityId: e.id, summary: `${e.isHidden ? "Showed" : "Hid"} ${e.name} in the brand directory` });
  return { message: e.isHidden ? `${e.name} is visible` : `${e.name} hidden` };
});

/** Load the outreach CSV (name, category, website only) when the directory is empty. */
export const seedDirectoryAction = adminAction("brands.manage", z.object({}), async ({ audit }) => {
  const d = await db();
  const n = await seedDirectory(d, path.join(/*turbopackIgnore: true*/ process.cwd(), DIRECTORY_SEED_FILE));
  if (!n) throw new AdminError("Nothing loaded — the directory already has entries, or the outreach file isn't in this deployment.");
  await audit({ action: "directory.seed", entity: "brand_directory", summary: `Loaded ${n} brands into the directory from ${DIRECTORY_SEED_FILE} (name, category and website only)` });
  return { message: `${n} brands loaded` };
});
