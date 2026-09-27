"use server";

import { redirect } from "next/navigation";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { collectionProducts, collections } from "@/lib/db/schema";
import { saveUpload } from "@/lib/storage";
import { slugify } from "@/lib/ids";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { zBool, zOptBps, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

export const createCollectionAction = adminAction("content.manage", z.object({ title: zStr(120), kind: z.enum(["collection", "bundle"]) }), async ({ data, audit }) => {
  const d = await db();
  let slug = slugify(data.title);
  if (await d.query.collections.findFirst({ where: eq(collections.slug, slug) })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const [{ max }] = await d.select({ max: sql<number>`coalesce(max(${collections.sort}), -1)::int` }).from(collections);
  const [c] = await d.insert(collections).values({ title: data.title, slug, kind: data.kind, sort: Number(max) + 1, isPublished: false }).returning();
  await audit({ action: "collection.create", entity: "collection", entityId: c.id, summary: `Created ${data.kind} “${c.title}”` });
  redirect(`/admin/collections/${c.id}`);
});

export const updateCollectionAction = adminAction(
  "content.manage",
  z.object({ id: zUuid, title: zStr(120), slug: zStr(90), description: zOptStr(3000), kind: z.enum(["collection", "bundle"]), bundleDiscountPercent: zOptBps, isPublished: zBool }),
  async ({ user, data, formData, audit }) => {
    const d = await db();
    const c = await d.query.collections.findFirst({ where: eq(collections.id, data.id), with: { products: true } });
    if (!c) throw new AdminError("Collection not found");
    const slug = slugify(data.slug);
    if (await d.query.collections.findFirst({ where: and(eq(collections.slug, slug), ne(collections.id, c.id)) })) throw new AdminError(`The slug “${slug}” is taken.`);
    if (data.kind === "bundle" && data.bundleDiscountPercent == null) throw new AdminError("A bundle needs a discount (0% is allowed).");
    if (data.isPublished && c.products.length === 0) throw new AdminError("Add at least one listing before publishing.");
    const [cover] = files(formData, "cover");
    const coverUrl = cover ? await saveUpload(cover, { uploadedById: user.id, alt: `${data.title} cover` }) : null;
    await d
      .update(collections)
      .set({ title: data.title, slug, description: data.description, kind: data.kind, bundleDiscountBps: data.kind === "bundle" ? data.bundleDiscountPercent : null, isPublished: data.isPublished, ...(coverUrl ? { coverImageUrl: coverUrl } : {}) })
      .where(eq(collections.id, c.id));
    await audit({ action: "collection.update", entity: "collection", entityId: c.id, summary: `Edited “${data.title}”${data.isPublished !== c.isPublished ? (data.isPublished ? " · published" : " · unpublished") : ""}` });
    return { message: "Saved" };
  },
);

export const addToCollectionAction = adminAction("content.manage", z.object({ id: zUuid, productId: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const exists = await d.query.collectionProducts.findFirst({ where: and(eq(collectionProducts.collectionId, data.id), eq(collectionProducts.productId, data.productId)) });
  if (exists) throw new AdminError("That listing is already in this collection.");
  const [{ max }] = await d.select({ max: sql<number>`coalesce(max(${collectionProducts.sort}), -1)::int` }).from(collectionProducts).where(eq(collectionProducts.collectionId, data.id));
  await d.insert(collectionProducts).values({ collectionId: data.id, productId: data.productId, sort: Number(max) + 1 });
  await audit({ action: "collection.add", entity: "collection", entityId: data.id, summary: "Added a listing to the collection", data: { productId: data.productId } });
  return { message: "Listing added" };
});

export const removeFromCollectionAction = adminAction("content.manage", z.object({ id: zUuid, productId: zUuid }), async ({ data, audit }) => {
  const d = await db();
  await d.delete(collectionProducts).where(and(eq(collectionProducts.collectionId, data.id), eq(collectionProducts.productId, data.productId)));
  await audit({ action: "collection.remove", entity: "collection", entityId: data.id, summary: "Removed a listing from the collection", data: { productId: data.productId } });
  return { message: "Listing removed" };
});

export const moveInCollectionAction = adminAction("content.manage", z.object({ id: zUuid, productId: zUuid, dir: z.enum(["up", "down"]) }), async ({ data }) => {
  const d = await db();
  const rows = await d.select().from(collectionProducts).where(eq(collectionProducts.collectionId, data.id)).orderBy(asc(collectionProducts.sort));
  const i = rows.findIndex((r) => r.productId === data.productId);
  const j = data.dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return { message: "Already at the edge" };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [k, r] of rows.entries()) await d.update(collectionProducts).set({ sort: k }).where(and(eq(collectionProducts.collectionId, data.id), eq(collectionProducts.productId, r.productId)));
  return { message: "Order updated" };
});

export const moveCollectionAction = adminAction("content.manage", z.object({ id: zUuid, dir: z.enum(["up", "down"]) }), async ({ data }) => {
  const d = await db();
  const rows = await d.select().from(collections).orderBy(asc(collections.sort), asc(collections.title));
  const i = rows.findIndex((r) => r.id === data.id);
  const j = data.dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return { message: "Already at the edge" };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [k, r] of rows.entries()) if (r.sort !== k) await d.update(collections).set({ sort: k }).where(eq(collections.id, r.id));
  return { message: "Order updated" };
});

export const deleteCollectionAction = adminAction("content.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const c = await d.query.collections.findFirst({ where: eq(collections.id, data.id) });
  if (!c) throw new AdminError("Collection not found");
  await d.delete(collections).where(eq(collections.id, c.id));
  await audit({ action: "collection.delete", entity: "collection", entityId: c.id, summary: `Deleted “${c.title}”` });
  redirect("/admin/collections");
});
