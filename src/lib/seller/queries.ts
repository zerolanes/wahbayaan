import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  categories,
  conversations,
  customRequests,
  messages,
  orderEvents,
  orderItems,
  orders,
  payouts,
  productImages,
  products,
  reviews,
  users,
  vendorOrders,
  vendors,
  verificationChecks,
} from "@/lib/db/schema";
import { findSharedBanners, vendorIssues } from "@/lib/trust/visibility";
import { isDemoMode } from "@/lib/settings";

/** Everything here is scoped to one artisan and reported in PKR. */

const rows = <T>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows?: T[] }).rows ?? [])) as T[];

export async function getSellerVendor(vendorId: string) {
  const d = await db();
  const vendor = await d.query.vendors.findFirst({ where: eq(vendors.id, vendorId), with: { checks: true, primaryCategory: true } });
  if (!vendor) throw new Error("Artisan not found");
  const all = await d.select({ bannerUrl: vendors.bannerUrl }).from(vendors);
  const issues = vendorIssues(vendor, { demoMode: isDemoMode() }, findSharedBanners(all));
  return { vendor, issues, publiclyVisible: issues.length === 0 };
}

export async function getSellerStats(vendorId: string) {
  const d = await db();
  const [money] = rows<{
    gross_all: string | null;
    gross_30: string | null;
    held: string | null;
    released_unpaid: string | null;
    awaiting_commission: string | null;
    orders_all: number;
  }>(
    await d.execute(sql`
      select
        coalesce(sum(vo.subtotal_pkr) filter (where o.payment_status in ('paid','partially_refunded')), 0) as gross_all,
        coalesce(sum(vo.subtotal_pkr) filter (where o.payment_status in ('paid','partially_refunded') and o.paid_at > now() - interval '30 days'), 0) as gross_30,
        coalesce(sum(vo.subtotal_pkr) filter (where o.funds_state in ('held','frozen') and vo.status <> 'cancelled'), 0) as held,
        coalesce(sum(vo.net_pkr) filter (where o.funds_state = 'released' and vo.payout_id is not null and p.status in ('pending','scheduled','on_hold')), 0) as released_unpaid,
        coalesce(sum(vo.subtotal_pkr) filter (where o.funds_state = 'released' and vo.net_pkr is null), 0) as awaiting_commission,
        count(*) filter (where o.payment_status <> 'unpaid')::int as orders_all
      from vendor_orders vo
      join orders o on o.id = vo.order_id
      left join payouts p on p.id = vo.payout_id
      where vo.vendor_id = ${vendorId}`),
  );
  const [paid] = rows<{ paid: string | null }>(
    await d.execute(sql`select coalesce(sum(amount_pkr), 0) as paid from payouts where vendor_id = ${vendorId} and status = 'paid'`),
  );
  const actions = rows<{ status: string; n: number }>(
    await d.execute(sql`
      select vo.status, count(*)::int as n from vendor_orders vo join orders o on o.id = vo.order_id
      where vo.vendor_id = ${vendorId} and o.payment_status = 'paid' and o.status not in ('cancelled','refunded')
      group by vo.status`),
  );
  const listings = rows<{ status: string; n: number }>(
    await d.execute(sql`select status, count(*)::int as n from products where vendor_id = ${vendorId} group by status`),
  );
  const [rating] = rows<{ avg: string | null; n: number }>(
    await d.execute(sql`select avg(rating) as avg, count(*)::int as n from reviews where vendor_id = ${vendorId} and status = 'published'`),
  );
  const series = rows<{ day: string; pkr: string }>(
    await d.execute(sql`
      select to_char(g.day, 'YYYY-MM-DD') as day, coalesce(sum(vo.subtotal_pkr), 0) as pkr
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') as g(day)
      left join orders o on date_trunc('day', o.paid_at) = g.day and o.payment_status in ('paid','partially_refunded')
      left join vendor_orders vo on vo.order_id = o.id and vo.vendor_id = ${vendorId}
      group by g.day order by g.day`),
  );
  const count = (list: { status: string; n: number }[], ...s: string[]) => list.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
  return {
    grossAllPkr: Number(money?.gross_all ?? 0),
    gross30Pkr: Number(money?.gross_30 ?? 0),
    heldPkr: Number(money?.held ?? 0),
    releasedUnpaidPkr: Number(money?.released_unpaid ?? 0),
    awaitingCommissionPkr: Number(money?.awaiting_commission ?? 0),
    paidOutPkr: Number(paid?.paid ?? 0),
    ordersAll: money?.orders_all ?? 0,
    toAccept: count(actions, "pending"),
    inProgress: count(actions, "accepted", "in_production"),
    toShip: count(actions, "ready_to_ship"),
    inTransit: count(actions, "shipped"),
    listings: {
      active: count(listings, "active"),
      pending: count(listings, "pending_review"),
      draft: count(listings, "draft"),
      rejected: count(listings, "rejected"),
      archived: count(listings, "archived"),
    },
    rating: rating?.n ? { average: Number(rating.avg), count: rating.n } : { average: null, count: 0 },
    series: series.map((s) => ({ day: s.day, pkr: Number(s.pkr) })),
  };
}

export type SellerOrderFilter = "action" | "in_progress" | "shipped" | "delivered" | "all";

export async function listSellerOrders(vendorId: string, filter: SellerOrderFilter = "all") {
  const d = await db();
  const statusFor: Record<SellerOrderFilter, string[] | null> = {
    action: ["pending", "ready_to_ship"],
    in_progress: ["accepted", "in_production", "ready_to_ship"],
    shipped: ["shipped"],
    delivered: ["delivered"],
    all: null,
  };
  const s = statusFor[filter];
  const list = await d
    .select({
      vo: vendorOrders,
      number: orders.number,
      orderStatus: orders.status,
      paymentStatus: orders.paymentStatus,
      fundsState: orders.fundsState,
      destination: orders.destinationCountry,
      isGift: orders.isGift,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
    })
    .from(vendorOrders)
    .innerJoin(orders, eq(orders.id, vendorOrders.orderId))
    .where(and(eq(vendorOrders.vendorId, vendorId), ...(s ? [inArray(vendorOrders.status, s as never[])] : [])))
    .orderBy(desc(orders.createdAt));
  const items = list.length
    ? await d
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.vendorOrderId,
            list.map((l) => l.vo.id),
          ),
        )
    : [];
  return list.map((l) => ({ ...l, items: items.filter((i) => i.vendorOrderId === l.vo.id) }));
}

export async function getSellerOrder(vendorId: string, vendorOrderId: string) {
  const d = await db();
  const vo = await d.query.vendorOrders.findFirst({
    where: and(eq(vendorOrders.id, vendorOrderId), eq(vendorOrders.vendorId, vendorId)),
    with: { order: true, items: { with: { product: true } } },
  });
  if (!vo) return null;
  const events = await d
    .select()
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, vo.orderId), sql`(${orderEvents.vendorOrderId} is null or ${orderEvents.vendorOrderId} = ${vo.id})`))
    .orderBy(asc(orderEvents.createdAt));
  const payout = vo.payoutId ? await d.query.payouts.findFirst({ where: eq(payouts.id, vo.payoutId) }) : null;
  return { vo, events, payout };
}

export async function listSellerProducts(vendorId: string) {
  const d = await db();
  const list = await d
    .select({ p: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.vendorId, vendorId))
    .orderBy(desc(products.updatedAt));
  const imgs = list.length
    ? await d
        .select()
        .from(productImages)
        .where(
          inArray(
            productImages.productId,
            list.map((l) => l.p.id),
          ),
        )
        .orderBy(asc(productImages.sort))
    : [];
  const sold = rows<{ product_id: string; n: number }>(
    await d.execute(sql`select oi.product_id, sum(oi.qty)::int as n from order_items oi join orders o on o.id = oi.order_id
      where oi.vendor_id = ${vendorId} and o.payment_status = 'paid' group by oi.product_id`),
  );
  return list.map((l) => ({
    ...l.p,
    categoryName: l.categoryName,
    imageUrl: imgs.find((i) => i.productId === l.p.id)?.url ?? null,
    imageCount: imgs.filter((i) => i.productId === l.p.id).length,
    sold: sold.find((s) => s.product_id === l.p.id)?.n ?? 0,
  }));
}

export async function getSellerProduct(vendorId: string, productId: string) {
  const d = await db();
  return d.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.vendorId, vendorId)),
    with: { images: { orderBy: asc(productImages.sort) }, category: true },
  });
}

export async function listCategoriesForSeller() {
  const d = await db();
  return d.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).orderBy(asc(categories.sort));
}

export async function listSellerRequests(vendorId: string) {
  const d = await db();
  return d.query.customRequests.findMany({
    where: eq(customRequests.vendorId, vendorId),
    with: { category: true, product: true },
    orderBy: desc(customRequests.createdAt),
  });
}

export async function listSellerConversations(vendorId: string, sellerUserId: string) {
  const d = await db();
  const list = await d
    .select({ c: conversations, buyerName: users.name })
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.buyerId))
    .where(eq(conversations.vendorId, vendorId))
    .orderBy(desc(conversations.lastMessageAt));
  const unread = rows<{ conversation_id: string; n: number }>(
    await d.execute(sql`select m.conversation_id, count(*)::int as n from messages m join conversations c on c.id = m.conversation_id
      where c.vendor_id = ${vendorId} and m.read_at is null and m.sender_user_id <> ${sellerUserId} group by m.conversation_id`),
  );
  const last = list.length
    ? await d
        .selectDistinctOn([messages.conversationId], { conversation_id: messages.conversationId, body: messages.body })
        .from(messages)
        .where(
          inArray(
            messages.conversationId,
            list.map((l) => l.c.id),
          ),
        )
        .orderBy(messages.conversationId, desc(messages.createdAt))
    : [];
  return list.map((l) => ({
    ...l.c,
    buyerName: l.buyerName,
    unread: unread.find((u) => u.conversation_id === l.c.id)?.n ?? 0,
    lastMessage: last.find((m) => m.conversation_id === l.c.id)?.body ?? "",
  }));
}

export async function getSellerConversation(vendorId: string, conversationId: string) {
  const d = await db();
  const c = await d.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.vendorId, vendorId)),
    with: { buyer: true, product: true, messages: { orderBy: asc(messages.createdAt) } },
  });
  return c ?? null;
}

export async function listSellerReviews(vendorId: string) {
  const d = await db();
  return d.query.reviews.findMany({
    where: and(eq(reviews.vendorId, vendorId), inArray(reviews.status, ["published", "pending"])),
    with: { photos: true, product: true },
    orderBy: desc(reviews.createdAt),
  });
}

export async function listSellerPayouts(vendorId: string) {
  const d = await db();
  const list = await d.select().from(payouts).where(eq(payouts.vendorId, vendorId)).orderBy(desc(payouts.createdAt));
  const ledger = await d
    .select({
      vo: vendorOrders,
      number: orders.number,
      fundsState: orders.fundsState,
      orderStatus: orders.status,
      releasedAt: orders.releasedAt,
      paidAt: orders.paidAt,
    })
    .from(vendorOrders)
    .innerJoin(orders, eq(orders.id, vendorOrders.orderId))
    .where(and(eq(vendorOrders.vendorId, vendorId), sql`${orders.paymentStatus} <> 'unpaid'`))
    .orderBy(desc(orders.createdAt));
  return { payouts: list, ledger };
}

export async function getChecks(vendorId: string) {
  const d = await db();
  return d.select().from(verificationChecks).where(eq(verificationChecks.vendorId, vendorId));
}
