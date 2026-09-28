import "server-only";
import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  addresses,
  certificates,
  conversations,
  customRequests,
  disputes,
  messages,
  orderItems,
  orders,
  referralCodes,
  reviews,
} from "@/lib/db/schema";

/**
 * Buyer account reads. Every query is scoped by the signed-in user's id —
 * pass `user.id` from `requireUser()`, never an id from the request.
 */

export async function getBuyerOrders(userId: string, limit = 50) {
  const d = await db();
  return d.query.orders.findMany({
    where: eq(orders.userId, userId),
    with: { items: { columns: { id: true, title: true, imageUrl: true, qty: true } } },
    orderBy: desc(orders.createdAt),
    limit,
  });
}

export async function getBuyerOrder(userId: string, number: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({
    where: and(eq(orders.number, number), eq(orders.userId, userId)),
    with: {
      items: { with: { product: { columns: { slug: true, status: true, isOneOfAKind: true } } } },
      vendorOrders: { with: { vendor: { columns: { id: true, slug: true, displayName: true, workshopCity: true, profilePhotoUrl: true } } } },
      events: true,
      payments: true,
      refunds: true,
      disputes: true,
    },
  });
  if (!order) return null;
  const certIds = order.items.map((i) => i.certificateId).filter((x): x is string => !!x);
  const certs = certIds.length ? await d.select({ id: certificates.id, code: certificates.code }).from(certificates).where(inArray(certificates.id, certIds)) : [];
  const productIds = order.items.map((i) => i.productId).filter((x): x is string => !!x);
  const reviewed = productIds.length
    ? await d.select({ productId: reviews.productId }).from(reviews).where(and(eq(reviews.userId, userId), inArray(reviews.productId, productIds)))
    : [];
  return {
    ...order,
    events: order.events.filter((e) => e.visibleToBuyer).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    certificateCodes: new Map(certs.map((c) => [c.id, c.code])),
    reviewedProductIds: new Set(reviewed.map((r) => r.productId)),
  };
}

export async function getBuyerDisputes(userId: string) {
  const d = await db();
  return d.query.disputes.findMany({
    where: eq(disputes.userId, userId),
    with: { order: { columns: { number: true, currency: true, total: true } } },
    orderBy: desc(disputes.createdAt),
  });
}

export async function getBuyerDispute(userId: string, number: string) {
  const d = await db();
  return d.query.disputes.findFirst({
    where: and(eq(disputes.number, number), eq(disputes.userId, userId)),
    with: {
      order: { with: { items: { columns: { id: true, title: true, imageUrl: true } } } },
      vendorOrder: { with: { vendor: { columns: { displayName: true, slug: true } } } },
      messages: true,
    },
  });
}

export async function getBuyerRequests(userId: string) {
  const d = await db();
  return d.query.customRequests.findMany({
    where: eq(customRequests.userId, userId),
    with: {
      vendor: { columns: { displayName: true, slug: true, profilePhotoUrl: true } },
      category: { columns: { name: true, slug: true } },
      product: { columns: { title: true, slug: true } },
    },
    orderBy: desc(customRequests.createdAt),
  });
}

export async function getBuyerConversations(userId: string) {
  const d = await db();
  const rows = await d.query.conversations.findMany({
    where: eq(conversations.buyerId, userId),
    with: {
      vendor: { columns: { displayName: true, slug: true, profilePhotoUrl: true, userId: true, responseTimeHours: true } },
      product: { columns: { title: true, slug: true } },
      messages: { orderBy: desc(messages.createdAt), limit: 1 },
    },
    orderBy: desc(conversations.lastMessageAt),
  });
  const unread = rows.length
    ? await d
        .select({ conversationId: messages.conversationId, n: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(inArray(messages.conversationId, rows.map((r) => r.id)), sql`${messages.readAt} is null`, sql`${messages.senderUserId} is distinct from ${userId}`))
        .groupBy(messages.conversationId)
    : [];
  return rows.map((r) => ({ ...r, unread: unread.find((u) => u.conversationId === r.id)?.n ?? 0 }));
}

export async function getBuyerConversation(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const d = await db();
  return d.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.buyerId, userId)),
    with: {
      vendor: { columns: { displayName: true, slug: true, profilePhotoUrl: true, userId: true, responseTimeHours: true, craft: true, workshopCity: true } },
      product: { columns: { title: true, slug: true } },
      messages: { orderBy: asc(messages.createdAt) },
    },
  });
}

export async function getAddresses(userId: string) {
  const d = await db();
  return d.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), asc(addresses.createdAt));
}

/** The buyer's referral code, created on first visit (e.g. `AYESHA-7K2Q`). */
export async function getOrCreateReferralCode(userId: string, name: string) {
  const d = await db();
  const existing = await d.query.referralCodes.findFirst({ where: eq(referralCodes.userId, userId) });
  if (existing) return existing;
  const base = (name.split(/\s+/)[0] ?? "friend").replace(/[^a-z]/gi, "").toUpperCase().slice(0, 8) || "FRIEND";
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
    const [row] = await d.insert(referralCodes).values({ code: `${base}-${suffix}`, userId }).onConflictDoNothing().returning();
    if (row) return row;
    const mine = await d.query.referralCodes.findFirst({ where: eq(referralCodes.userId, userId) });
    if (mine) return mine;
  }
  throw new Error("Could not create a referral code");
}

export async function getReferralStats(code: string) {
  const d = await db();
  const [row] = await d.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.referralCode, code));
  return { orders: row?.n ?? 0 };
}

/**
 * A buyer may review a piece once they've received it: an order item for the
 * product on one of their delivered or completed orders, not yet reviewed.
 */
export async function getReviewEligibility(userId: string | null, productId: string) {
  if (!userId) return { eligible: false as const, reason: "signed_out" as const };
  const d = await db();
  const already = await d.query.reviews.findFirst({ where: and(eq(reviews.userId, userId), eq(reviews.productId, productId)) });
  if (already) return { eligible: false as const, reason: already.status === "pending" ? ("pending" as const) : ("reviewed" as const) };
  const [item] = await d
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.productId, productId), eq(orders.userId, userId), inArray(orders.status, ["delivered", "completed"])))
    .limit(1);
  if (!item) return { eligible: false as const, reason: "not_purchased" as const };
  return { eligible: true as const, orderItemId: item.id };
}
