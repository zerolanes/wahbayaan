"use server";

import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { notifications, productImages, products } from "@/lib/db/schema";
import { saveUpload } from "@/lib/storage";
import { slugify } from "@/lib/ids";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { zBool, zIds, zMoney, zOptDate, zOptInt, zOptMoney, zOptNum, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

const REGIONS = ["punjab", "sindh", "khyber_pakhtunkhwa", "balochistan", "gilgit_baltistan", "azad_kashmir", "islamabad"] as const;
const PROCEDURAL = ["rug", "calligraphy", "pottery", "truckart", "stone", "salt", "wood", "print", "ajrak", "tile"] as const;

const customization = z.preprocess(
  (v) => {
    try {
      return typeof v === "string" && v ? JSON.parse(v) : [];
    } catch {
      return null;
    }
  },
  z.array(
    z.object({
      id: z.string().min(1).max(60),
      label: z.string().trim().min(1, "Every customization option needs a label").max(80),
      kind: z.enum(["text", "select"]),
      choices: z.array(z.string().max(80)).max(40).optional(),
      required: z.boolean().optional(),
      maxLength: z.number().int().min(1).max(500).optional(),
      extraPricePkr: z.number().int().min(0).optional(),
    }),
  ),
);

async function loadProduct(id: string) {
  const d = await db();
  const p = await d.query.products.findFirst({ where: eq(products.id, id), with: { vendor: true } });
  if (!p) throw new AdminError("Listing not found");
  return p;
}

const list = (s: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export const updateListingAction = adminAction(
  "products.manage",
  z.object({
    productId: zUuid,
    title: zStr(160),
    slug: zStr(90).transform((s) => slugify(s)),
    categoryId: zUuid,
    summary: zOptStr(400),
    description: zOptStr(10_000),
    story: zOptStr(10_000),
    pricePkr: zMoney.refine((n) => n > 0, "Price must be above zero"),
    compareAtPricePkr: zOptMoney,
    availability: z.enum(["ready_to_ship", "made_to_order"]),
    stockQty: zOptInt(0, 100_000),
    isOneOfAKind: zBool,
    timeToMakeDays: zOptInt(0, 365),
    dispatchDays: zOptInt(0, 60),
    widthCm: zOptNum(0, 10_000),
    heightCm: zOptNum(0, 10_000),
    depthCm: zOptNum(0, 10_000),
    weightG: zOptInt(1, 500_000),
    materials: zOptStr(500),
    techniques: zOptStr(500),
    careInstructions: zOptStr(3000),
    region: z.enum(["", ...REGIONS]).optional(),
    videoUrl: zOptStr(500),
    hsCodeOverride: zOptStr(20).refine((v) => !v || /^[0-9.]{4,14}$/.test(v), "HS codes are digits and dots, e.g. 5701.10"),
    customizable: zBool,
    customizationOptions: customization,
    isLimitedDrop: zBool,
    dropStartsAt: zOptDate,
    editionSize: zOptInt(1, 100_000),
    wholesaleEnabled: zBool,
    wholesaleMinQty: zOptInt(1, 100_000),
    wholesalePricePkr: zOptMoney,
  }),
  async ({ data, audit }) => {
    const before = await loadProduct(data.productId);
    const d = await db();
    const clash = await d.query.products.findFirst({ where: and(eq(products.slug, data.slug), ne(products.id, before.id)) });
    if (clash) throw new AdminError(`The slug “${data.slug}” is already used by “${clash.title}”.`);
    if (data.compareAtPricePkr != null && data.compareAtPricePkr <= data.pricePkr) throw new AdminError("The compare-at price must be higher than the price.");
    if (data.wholesaleEnabled && (data.wholesalePricePkr == null || data.wholesaleMinQty == null)) throw new AdminError("Wholesale needs a minimum quantity and a wholesale price.");
    if (data.isLimitedDrop && !data.dropStartsAt) throw new AdminError("A limited drop needs a start date.");
    const patch = {
      title: data.title,
      slug: data.slug,
      categoryId: data.categoryId,
      summary: data.summary,
      description: data.description,
      story: data.story,
      pricePkr: data.pricePkr,
      compareAtPricePkr: data.compareAtPricePkr,
      availability: data.availability,
      stockQty: data.stockQty ?? 0,
      isOneOfAKind: data.isOneOfAKind,
      timeToMakeDays: data.timeToMakeDays,
      dispatchDays: data.dispatchDays,
      widthCm: data.widthCm == null ? null : String(data.widthCm),
      heightCm: data.heightCm == null ? null : String(data.heightCm),
      depthCm: data.depthCm == null ? null : String(data.depthCm),
      weightG: data.weightG,
      materials: list(data.materials),
      techniques: list(data.techniques),
      careInstructions: data.careInstructions,
      region: data.region || null,
      videoUrl: data.videoUrl,
      hsCodeOverride: data.hsCodeOverride,
      customizable: data.customizable,
      customizationOptions: data.customizable ? data.customizationOptions : [],
      isLimitedDrop: data.isLimitedDrop,
      dropStartsAt: data.isLimitedDrop ? data.dropStartsAt : null,
      editionSize: data.isLimitedDrop ? data.editionSize : null,
      wholesaleEnabled: data.wholesaleEnabled,
      wholesaleMinQty: data.wholesaleEnabled ? data.wholesaleMinQty : null,
      wholesalePricePkr: data.wholesaleEnabled ? data.wholesalePricePkr : null,
    };
    await d.update(products).set(patch).where(eq(products.id, before.id));
    const changed = Object.keys(patch).filter((k) => JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((patch as Record<string, unknown>)[k] ?? null));
    await audit({
      action: "product.update",
      entity: "product",
      entityId: before.id,
      summary: `Edited “${data.title}” (${changed.join(", ") || "no changes"})`,
      data: { changed, before: Object.fromEntries(changed.map((k) => [k, (before as Record<string, unknown>)[k]])) },
    });
    return { message: changed.length ? `Saved ${changed.length} change${changed.length === 1 ? "" : "s"}` : "No changes" };
  },
);

export const moderateListingAction = adminAction(
  "products.moderate",
  z.object({ productId: zUuid, op: z.enum(["approve", "reject", "archive", "draft", "pending"]), reason: zOptStr(1000) }),
  async ({ data, audit }) => {
    const p = await loadProduct(data.productId);
    const d = await db();
    if (data.op === "reject" && !data.reason) throw new AdminError("Tell the artisan why the listing was rejected.");
    const status = { approve: "active", reject: "rejected", archive: "archived", draft: "draft", pending: "pending_review" }[data.op] as "active" | "rejected" | "archived" | "draft" | "pending_review";
    if (status === "active") {
      const imgs = await d.select().from(productImages).where(eq(productImages.productId, p.id));
      if (!imgs.length) throw new AdminError("Add at least one image before approving — listings without images are hidden anyway.");
    }
    await d
      .update(products)
      .set({ status, rejectionReason: data.op === "reject" ? data.reason : null, ...(status === "active" && !p.publishedAt ? { publishedAt: new Date() } : {}) })
      .where(eq(products.id, p.id));
    if (data.op === "approve" || data.op === "reject")
      await d.insert(notifications).values({
        userId: p.vendor.userId,
        kind: "listing",
        title: data.op === "approve" ? `“${p.title}” is live` : `“${p.title}” needs changes`,
        body: data.reason ?? undefined,
        link: "/seller/listings",
      });
    await audit({ action: `product.${data.op}`, entity: "product", entityId: p.id, summary: `${data.op === "approve" ? "Approved" : data.op === "reject" ? "Rejected" : `Set to ${status.replace("_", " ")}:`} “${p.title}”`, data: { from: p.status, reason: data.reason } });
    return { message: `Listing ${status.replace("_", " ")}` };
  },
);

export const toggleListingFeaturedAction = adminAction("products.moderate", z.object({ productId: zUuid }), async ({ data, audit }) => {
  const p = await loadProduct(data.productId);
  const d = await db();
  await d.update(products).set({ isFeatured: !p.isFeatured }).where(eq(products.id, p.id));
  await audit({ action: "product.feature", entity: "product", entityId: p.id, summary: `${p.isFeatured ? "Unfeatured" : "Featured"} “${p.title}”` });
  return { message: p.isFeatured ? "No longer featured" : "Featured" };
});

export const bulkListingsAction = adminAction(
  "products.moderate",
  z.object({ op: z.enum(["approve", "archive", "feature", "unfeature", "reject"]), ids: zIds, reason: zOptStr(500) }),
  async ({ data, audit }) => {
    if (!data.ids.length) throw new AdminError("Select at least one listing.");
    if (data.op === "reject" && !data.reason) throw new AdminError("Enter a rejection reason.");
    const d = await db();
    const rows = await d.query.products.findMany({ where: inArray(products.id, data.ids), with: { images: true, vendor: true } });
    let done = 0;
    const skipped: string[] = [];
    for (const p of rows) {
      if (data.op === "approve") {
        if (!p.images.length) {
          skipped.push(p.title);
          continue;
        }
        await d.update(products).set({ status: "active", rejectionReason: null, ...(p.publishedAt ? {} : { publishedAt: new Date() }) }).where(eq(products.id, p.id));
        await d.insert(notifications).values({ userId: p.vendor.userId, kind: "listing", title: `“${p.title}” is live`, link: "/seller/listings" });
      } else if (data.op === "archive") await d.update(products).set({ status: "archived" }).where(eq(products.id, p.id));
      else if (data.op === "reject") {
        await d.update(products).set({ status: "rejected", rejectionReason: data.reason }).where(eq(products.id, p.id));
        await d.insert(notifications).values({ userId: p.vendor.userId, kind: "listing", title: `“${p.title}” needs changes`, body: data.reason ?? undefined, link: "/seller/listings" });
      } else await d.update(products).set({ isFeatured: data.op === "feature" }).where(eq(products.id, p.id));
      done++;
    }
    await audit({ action: `product.bulk_${data.op}`, entity: "product", summary: `Bulk ${data.op} on ${done} listing(s)`, data: { ids: data.ids, skipped, reason: data.reason } });
    return { message: `${done} listing${done === 1 ? "" : "s"} updated${skipped.length ? ` · skipped (no images): ${skipped.join(", ")}` : ""}` };
  },
);

// ── Images ──────────────────────────────────────────────────────────────────

export const uploadListingImagesAction = adminAction(
  "products.manage",
  z.object({ productId: zUuid, kind: z.enum(["photo", "illustration"]), alt: zOptStr(200) }),
  async ({ user, data, formData, audit }) => {
    const p = await loadProduct(data.productId);
    const uploads = files(formData, "images");
    if (!uploads.length) throw new AdminError("Choose at least one image.");
    const d = await db();
    const [last] = await d.select().from(productImages).where(eq(productImages.productId, p.id)).orderBy(desc(productImages.sort)).limit(1);
    let sort = (last?.sort ?? -1) + 1;
    for (const f of uploads) {
      const alt = data.alt ?? p.title;
      const url = await saveUpload(f, { uploadedById: user.id, alt });
      await d.insert(productImages).values({ productId: p.id, url, alt, kind: data.kind, sort: sort++ });
    }
    await audit({ action: "product.images_upload", entity: "product", entityId: p.id, summary: `Uploaded ${uploads.length} ${data.kind}(s) to “${p.title}”` });
    return { message: `${uploads.length} image${uploads.length === 1 ? "" : "s"} added` };
  },
);

export const updateImageAction = adminAction(
  "products.manage",
  z.object({ imageId: zUuid, alt: zOptStr(200), kind: z.enum(["photo", "illustration"]) }),
  async ({ data, audit }) => {
    const d = await db();
    const img = await d.query.productImages.findFirst({ where: eq(productImages.id, data.imageId) });
    if (!img) throw new AdminError("Image not found");
    await d.update(productImages).set({ alt: data.alt, kind: data.kind }).where(eq(productImages.id, img.id));
    await audit({ action: "product.image_update", entity: "product", entityId: img.productId, summary: `Updated image alt text / type` });
    return { message: "Image updated" };
  },
);

export const moveImageAction = adminAction("products.manage", z.object({ imageId: zUuid, dir: z.enum(["up", "down", "first"]) }), async ({ data, audit }) => {
  const d = await db();
  const img = await d.query.productImages.findFirst({ where: eq(productImages.id, data.imageId) });
  if (!img) throw new AdminError("Image not found");
  const all = await d.select().from(productImages).where(eq(productImages.productId, img.productId)).orderBy(asc(productImages.sort), asc(productImages.id));
  const idx = all.findIndex((x) => x.id === img.id);
  const order = [...all];
  if (data.dir === "first") order.unshift(...order.splice(idx, 1));
  else {
    const j = data.dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= order.length) return { message: "Already at the edge" };
    [order[idx], order[j]] = [order[j], order[idx]];
  }
  for (const [i, x] of order.entries()) if (x.sort !== i) await d.update(productImages).set({ sort: i }).where(eq(productImages.id, x.id));
  await audit({ action: "product.image_reorder", entity: "product", entityId: img.productId, summary: `Reordered listing images` });
  return { message: data.dir === "first" ? "Set as cover image" : "Image moved" };
});

export const deleteImageAction = adminAction("products.manage", z.object({ imageId: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const img = await d.query.productImages.findFirst({ where: eq(productImages.id, data.imageId) });
  if (!img) throw new AdminError("Image not found");
  await d.delete(productImages).where(eq(productImages.id, img.id));
  await audit({ action: "product.image_delete", entity: "product", entityId: img.productId, summary: `Removed an image`, data: { url: img.url } });
  return { message: "Image removed" };
});

// ── 3D model ────────────────────────────────────────────────────────────────

export const setModelAction = adminAction(
  "products.manage",
  z.object({ productId: zUuid, mode: z.enum(["none", "scan", "procedural"]), kind: z.enum(PROCEDURAL).optional(), seed: zOptInt(0, 999_999_999), scanUrl: zOptStr(500) }),
  async ({ user, data, formData, audit }) => {
    const p = await loadProduct(data.productId);
    const d = await db();
    let model: typeof products.$inferInsert.model3d = null;
    if (data.mode === "scan") {
      const [glb] = files(formData, "glb");
      if (glb) {
        if (!glb.name.toLowerCase().endsWith(".glb")) throw new AdminError("Upload a .glb file (binary glTF).");
        const url = await saveUpload(new File([glb], glb.name, { type: "model/gltf-binary" }), { uploadedById: user.id, alt: `${p.title} — 3D scan` });
        model = { source: "scan", url };
      } else if (data.scanUrl) model = { source: "scan", url: data.scanUrl };
      else throw new AdminError("Choose a .glb scan to upload.");
    } else if (data.mode === "procedural") {
      if (!data.kind) throw new AdminError("Pick a model style.");
      model = { source: "procedural", kind: data.kind, seed: data.seed ?? Math.floor(Math.random() * 10_000) };
    }
    await d.update(products).set({ model3d: model }).where(eq(products.id, p.id));
    await audit({ action: "product.model3d", entity: "product", entityId: p.id, summary: `Set 3D model on “${p.title}”: ${model ? model.source : "none"}`, data: { before: p.model3d, after: model } });
    return { message: model ? (model.source === "scan" ? "3D scan attached" : "Illustrative 3D model set") : "3D model removed" };
  },
);
