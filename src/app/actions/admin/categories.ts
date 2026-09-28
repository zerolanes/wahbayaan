"use server";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { categories, products } from "@/lib/db/schema";
import { saveUpload } from "@/lib/storage";
import { slugify } from "@/lib/ids";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { zBool, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

const hs = zOptStr(20).refine((v) => !v || /^[0-9.]{4,14}$/.test(v), "HS codes are digits and dots, e.g. 5701.10");

const fields = {
  name: zStr(80),
  slug: zOptStr(80),
  tagline: zOptStr(200),
  description: zOptStr(3000),
  hsCode: hs,
  isVisible: zBool,
  showOnHome: zBool,
  coverKind: z.enum(["photo", "illustration"]).optional(),
};

export const createCategoryAction = adminAction("categories.manage", z.object(fields), async ({ user, data, formData, audit }) => {
  const d = await db();
  const slug = slugify(data.slug || data.name);
  if (await d.query.categories.findFirst({ where: eq(categories.slug, slug) })) throw new AdminError(`A category with the slug “${slug}” already exists.`);
  const [cover] = files(formData, "cover");
  const coverUrl = cover ? await saveUpload(cover, { uploadedById: user.id, alt: `${data.name} category cover` }) : null;
  const [{ max }] = await d.select({ max: sql<number>`coalesce(max(${categories.sort}), -1)::int` }).from(categories);
  const [c] = await d
    .insert(categories)
    .values({ name: data.name, slug, tagline: data.tagline, description: data.description, hsCode: data.hsCode, isVisible: data.isVisible, showOnHome: data.showOnHome, coverImageUrl: coverUrl, coverKind: coverUrl ? (data.coverKind ?? "photo") : null, sort: Number(max) + 1 })
    .returning();
  await audit({ action: "category.create", entity: "category", entityId: c.id, summary: `Created category “${c.name}”${coverUrl ? "" : " (no cover — hidden until one is uploaded)"}` });
  return { message: coverUrl ? "Category created" : "Category created — upload a cover so it can show publicly" };
});

export const updateCategoryAction = adminAction("categories.manage", z.object({ id: zUuid, ...fields }), async ({ user, data, formData, audit }) => {
  const d = await db();
  const before = await d.query.categories.findFirst({ where: eq(categories.id, data.id) });
  if (!before) throw new AdminError("Category not found");
  const slug = slugify(data.slug || data.name);
  if (await d.query.categories.findFirst({ where: and(eq(categories.slug, slug), ne(categories.id, before.id)) })) throw new AdminError(`The slug “${slug}” is taken.`);
  const [cover] = files(formData, "cover");
  const coverUrl = cover ? await saveUpload(cover, { uploadedById: user.id, alt: `${data.name} category cover` }) : null;
  const patch = {
    name: data.name,
    slug,
    tagline: data.tagline,
    description: data.description,
    hsCode: data.hsCode,
    isVisible: data.isVisible,
    showOnHome: data.showOnHome,
    ...(coverUrl ? { coverImageUrl: coverUrl, coverKind: data.coverKind ?? "photo" } : before.coverImageUrl && data.coverKind ? { coverKind: data.coverKind } : {}),
  };
  await d.update(categories).set(patch).where(eq(categories.id, before.id));
  await audit({
    action: "category.update",
    entity: "category",
    entityId: before.id,
    summary: `Edited category “${data.name}”${coverUrl ? " · new cover" : ""}${before.hsCode !== data.hsCode ? ` · HS ${before.hsCode ?? "—"} → ${data.hsCode ?? "—"}` : ""}`,
    data: { before: { hsCode: before.hsCode, isVisible: before.isVisible, showOnHome: before.showOnHome, coverKind: before.coverKind } },
  });
  return { message: "Category saved" };
});

export const removeCategoryCoverAction = adminAction("categories.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const c = await d.query.categories.findFirst({ where: eq(categories.id, data.id) });
  if (!c) throw new AdminError("Category not found");
  await d.update(categories).set({ coverImageUrl: null, coverKind: null }).where(eq(categories.id, c.id));
  await audit({ action: "category.cover_remove", entity: "category", entityId: c.id, summary: `Removed the cover of “${c.name}” (now hidden publicly)` });
  return { message: "Cover removed — the category is hidden until a new one is uploaded" };
});

export const moveCategoryAction = adminAction("categories.manage", z.object({ id: zUuid, dir: z.enum(["up", "down"]) }), async ({ data, audit }) => {
  const d = await db();
  const all = await d.select().from(categories).orderBy(asc(categories.sort), asc(categories.name));
  const i = all.findIndex((c) => c.id === data.id);
  const j = data.dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return { message: "Already at the edge" };
  [all[i], all[j]] = [all[j], all[i]];
  for (const [k, c] of all.entries()) if (c.sort !== k) await d.update(categories).set({ sort: k }).where(eq(categories.id, c.id));
  await audit({ action: "category.reorder", entity: "category", entityId: data.id, summary: `Moved “${all[j].name}” ${data.dir}` });
  return { message: "Order updated" };
});

export const deleteCategoryAction = adminAction("categories.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const c = await d.query.categories.findFirst({ where: eq(categories.id, data.id) });
  if (!c) throw new AdminError("Category not found");
  const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.categoryId, c.id));
  if (Number(n)) throw new AdminError(`“${c.name}” still has ${n} listing(s). Move them to another category first, or hide the category instead.`);
  await d.delete(categories).where(eq(categories.id, c.id));
  await audit({ action: "category.delete", entity: "category", entityId: c.id, summary: `Deleted category “${c.name}”` });
  return { message: "Category deleted" };
});
