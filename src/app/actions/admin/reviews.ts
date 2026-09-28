"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { reviewPhotos, reviews } from "@/lib/db/schema";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zIds, zUuid } from "@/lib/admin/zod";

const STATUS = z.enum(["published", "hidden", "pending"]);

export const moderateReviewAction = adminAction("reviews.moderate", z.object({ reviewId: zUuid, status: STATUS }), async ({ data, audit }) => {
  const d = await db();
  const r = await d.query.reviews.findFirst({ where: eq(reviews.id, data.reviewId), with: { product: true } });
  if (!r) throw new AdminError("Review not found");
  await d.update(reviews).set({ status: data.status }).where(eq(reviews.id, r.id));
  await audit({ action: `review.${data.status}`, entity: "product", entityId: r.productId, summary: `${data.status === "published" ? "Published" : data.status === "hidden" ? "Hid" : "Returned to queue"} a ${r.rating}★ review on “${r.product.title}”`, data: { reviewId: r.id, from: r.status } });
  return { message: `Review ${data.status === "pending" ? "back in the queue" : data.status}` };
});

export const removeSellerReplyAction = adminAction("reviews.moderate", z.object({ reviewId: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const r = await d.query.reviews.findFirst({ where: eq(reviews.id, data.reviewId) });
  if (!r?.sellerReply) throw new AdminError("There's no artisan reply on this review.");
  await d.update(reviews).set({ sellerReply: null, sellerRepliedAt: null }).where(eq(reviews.id, r.id));
  await audit({ action: "review.reply_remove", entity: "product", entityId: r.productId, summary: "Removed an artisan's public reply to a review", data: { reviewId: r.id, reply: r.sellerReply } });
  return { message: "Artisan reply removed from public view" };
});

export const removeReviewPhotoAction = adminAction("reviews.moderate", z.object({ photoId: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const ph = await d.query.reviewPhotos.findFirst({ where: eq(reviewPhotos.id, data.photoId), with: { review: true } });
  if (!ph) throw new AdminError("Photo not found");
  await d.delete(reviewPhotos).where(eq(reviewPhotos.id, ph.id));
  await audit({ action: "review.photo_remove", entity: "product", entityId: ph.review.productId, summary: "Removed a review photo", data: { url: ph.url } });
  return { message: "Photo removed" };
});

export const bulkReviewsAction = adminAction("reviews.moderate", z.object({ op: STATUS, ids: zIds }), async ({ data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one review.");
  const d = await db();
  await d.update(reviews).set({ status: data.op }).where(inArray(reviews.id, data.ids));
  await audit({ action: `review.bulk_${data.op}`, entity: "review", summary: `Set ${data.ids.length} review(s) to ${data.op}`, data: { ids: data.ids } });
  return { message: `${data.ids.length} review${data.ids.length === 1 ? "" : "s"} ${data.op}` };
});
