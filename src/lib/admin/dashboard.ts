import "server-only";
import { sql } from "drizzle-orm";
import { query, scalar } from "./sql";

/** Paid orders: money was captured at some point (refunds are reported separately). */
export const PAID_ORDER = sql`paid_at is not null`;

export async function dashboardData() {
  const [
    gmv,
    counts,
    held,
    daily,
    byDest,
    topArtisans,
    topCategories,
    attention,
    placeholderFxOrders,
  ] = await Promise.all([
    query<{ currency: string; total: string; pkr: string; n: number }>(sql`
      select currency, sum(total)::bigint as total, sum(round(total * fx_pkr_per_unit))::bigint as pkr, count(*)::int as n
      from orders where ${PAID_ORDER} group by currency order by currency`),
    query<{ today: number; d7: number; d30: number; awaiting_quote: number; quote_sent: number; open_disputes: number; apps: number; listings: number; reviews: number }>(sql`
      select
        (select count(*)::int from orders where created_at >= date_trunc('day', now())) as today,
        (select count(*)::int from orders where created_at >= now() - interval '7 days') as d7,
        (select count(*)::int from orders where created_at >= now() - interval '30 days') as d30,
        (select count(*)::int from orders where status = 'awaiting_quote') as awaiting_quote,
        (select count(*)::int from orders where status = 'quote_sent') as quote_sent,
        (select count(*)::int from disputes where status not in ('resolved','closed')) as open_disputes,
        (select count(*)::int from vendor_applications where status in ('submitted','in_review','more_info')) as apps,
        (select count(*)::int from products where status = 'pending_review') as listings,
        (select count(*)::int from reviews where status = 'pending') as reviews`),
    query<{ currency: string; state: string; total: string; n: number }>(sql`
      select currency, funds_state as state, sum(total)::bigint as total, count(*)::int as n
      from orders where funds_state in ('held','frozen') group by currency, funds_state order by currency`),
    query<{ day: string; n: number }>(sql`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as n
      from orders where created_at >= date_trunc('day', now()) - interval '29 days' group by 1`),
    query<{ country: string; n: number; pkr: string }>(sql`
      select destination_country as country, count(*)::int as n, sum(round(total * fx_pkr_per_unit))::bigint as pkr
      from orders where ${PAID_ORDER} group by 1 order by pkr desc`),
    query<{ id: string; name: string; pkr: string; n: number; is_demo: boolean }>(sql`
      select v.id, v.display_name as name, sum(vo.subtotal_pkr)::bigint as pkr, count(*)::int as n, v.is_demo
      from vendor_orders vo join orders o on o.id = vo.order_id join vendors v on v.id = vo.vendor_id
      where o.paid_at is not null and vo.status <> 'cancelled'
      group by v.id order by pkr desc limit 6`),
    query<{ id: string; name: string; pkr: string; n: number }>(sql`
      select c.id, c.name, sum(oi.unit_price_pkr * oi.qty)::bigint as pkr, sum(oi.qty)::int as n
      from order_items oi join orders o on o.id = oi.order_id join products p on p.id = oi.product_id join categories c on c.id = p.category_id
      where o.paid_at is not null group by c.id order by pkr desc limit 6`),
    query<{ k: string; n: number }>(sql`
      select 'due_release' as k, count(*)::int as n from orders where status = 'delivered' and funds_state = 'held' and auto_release_at < now()
      union all select 'overdue_shipments', count(*)::int from vendor_orders where status = 'shipped' and shipped_at < now() - interval '21 days'
      union all select 'unshipped_paid', count(*)::int from orders where status in ('paid') and paid_at < now() - interval '3 days'
      union all select 'support', count(*)::int from contact_messages where status = 'new'
      union all select 'requests', count(*)::int from custom_requests where status = 'new'
      union all select 'payouts', count(*)::int from payouts where status in ('pending','scheduled')
      union all select 'emails_failed', count(*)::int from email_outbox where status = 'failed'
      union all select 'wholesale', count(*)::int from wholesale_applications where status = 'new'
      union all select 'awaiting_payment', count(*)::int from orders where status in ('quote_sent','awaiting_payment') and created_at < now() - interval '7 days'`),
    scalar(sql`select count(*)::int as n from orders where ${PAID_ORDER} and fx_source ilike '%placeholder%'`),
  ]);
  return {
    gmv: gmv.map((r) => ({ currency: r.currency, total: Number(r.total), pkr: Number(r.pkr), n: r.n })),
    counts: counts[0],
    held: held.map((r) => ({ currency: r.currency, state: r.state, total: Number(r.total), n: r.n })),
    daily,
    byDest: byDest.map((r) => ({ country: r.country, n: r.n, pkr: Number(r.pkr) })),
    topArtisans: topArtisans.map((r) => ({ ...r, pkr: Number(r.pkr) })),
    topCategories: topCategories.map((r) => ({ ...r, pkr: Number(r.pkr) })),
    attention: Object.fromEntries(attention.map((r) => [r.k, r.n])) as Record<string, number>,
    placeholderFxOrders,
  };
}

export type ActivityItem = {
  id: string;
  at: Date;
  kind: "order" | "audit" | "signup" | "review" | "application" | "dispute" | "message";
  title: string;
  detail?: string | null;
  href?: string | null;
  actor?: string | null;
};

/** Merged activity feed across order events, audit log, signups, reviews, applications, disputes and support. */
export async function activityFeed(opts: { kinds?: ActivityItem["kind"][]; limit?: number; before?: Date | null } = {}): Promise<ActivityItem[]> {
  const limit = opts.limit ?? 40;
  const beforeIso = (opts.before ?? new Date(Date.now() + 60_000)).toISOString();
  const want = (k: ActivityItem["kind"]) => !opts.kinds?.length || opts.kinds.includes(k);
  const tasks: Promise<ActivityItem[]>[] = [];
  if (want("order"))
    tasks.push(
      query<{ id: string; at: string; kind: string; message: string; number: string; actor: string | null }>(sql`
        select e.id, e.created_at as at, e.kind, e.message, o.number, u.name as actor
        from order_events e join orders o on o.id = e.order_id left join users u on u.id = e.actor_user_id
        where e.created_at < ${beforeIso} order by e.created_at desc limit ${limit}`).then((rows) =>
        rows.map((r) => ({ id: `oe-${r.id}`, at: new Date(r.at), kind: "order" as const, title: `${r.number} · ${r.kind.replace(/_/g, " ")}`, detail: r.message, href: `/admin/orders/${r.number}`, actor: r.actor })),
      ),
    );
  if (want("audit"))
    tasks.push(
      query<{ id: string; at: string; action: string; summary: string; entity: string; entity_id: string | null; actor: string | null }>(sql`
        select a.id, a.created_at as at, a.action, a.summary, a.entity, a.entity_id, u.name as actor
        from audit_log a left join users u on u.id = a.actor_user_id
        where a.created_at < ${beforeIso} order by a.created_at desc limit ${limit}`).then((rows) =>
        rows.map((r) => ({ id: `au-${r.id}`, at: new Date(r.at), kind: "audit" as const, title: r.summary, detail: r.action, href: `/admin/audit?entity=${encodeURIComponent(r.entity)}${r.entity_id ? `&entityId=${encodeURIComponent(r.entity_id)}` : ""}`, actor: r.actor })),
      ),
    );
  if (want("signup"))
    tasks.push(
      query<{ id: string; at: string; name: string; email: string; role: string }>(sql`
        select id, created_at as at, name, email, role from users where created_at < ${beforeIso} order by created_at desc limit ${limit}`).then((rows) =>
        rows.map((r) => ({ id: `us-${r.id}`, at: new Date(r.at), kind: "signup" as const, title: `New ${r.role} account: ${r.name}`, detail: r.email, href: r.role === "buyer" ? `/admin/customers/${r.id}` : null })),
      ),
    );
  if (want("review"))
    tasks.push(
      query<{ id: string; at: string; rating: number; title: string | null; product: string; status: string }>(sql`
        select r.id, r.created_at as at, r.rating, r.title, p.title as product, r.status
        from reviews r join products p on p.id = r.product_id where r.created_at < ${beforeIso} order by r.created_at desc limit ${limit}`).then((rows) =>
        rows.map((r) => ({ id: `rv-${r.id}`, at: new Date(r.at), kind: "review" as const, title: `${r.rating}★ review on ${r.product}`, detail: `${r.title ?? ""} (${r.status})`, href: `/admin/reviews?status=${r.status}` })),
      ),
    );
  if (want("application"))
    tasks.push(
      query<{ id: string; at: string; name: string; craft: string; status: string }>(sql`
        select id, created_at as at, full_name as name, craft, status from vendor_applications where created_at < ${beforeIso} order by created_at desc limit ${limit}`).then((rows) =>
        rows.map((r) => ({ id: `ap-${r.id}`, at: new Date(r.at), kind: "application" as const, title: `Artisan application: ${r.name}`, detail: `${r.craft} · ${r.status.replace(/_/g, " ")}`, href: `/admin/applications/${r.id}` })),
      ),
    );
  if (want("dispute"))
    tasks.push(
      query<{ id: string; at: string; number: string; reason: string; status: string }>(sql`
        select id, created_at as at, number, reason, status from disputes where created_at < ${beforeIso} order by created_at desc limit ${limit}`).then((rows) =>
        rows.map((r) => ({ id: `di-${r.id}`, at: new Date(r.at), kind: "dispute" as const, title: `Case ${r.number} opened`, detail: `${r.reason.replace(/_/g, " ")} · ${r.status.replace(/_/g, " ")}`, href: `/admin/disputes/${r.number}` })),
      ),
    );
  if (want("message"))
    tasks.push(
      query<{ id: string; at: string; name: string; topic: string }>(sql`
        select id, created_at as at, name, topic from contact_messages where created_at < ${beforeIso} order by created_at desc limit ${limit}`).then((rows) =>
        rows.map((r) => ({ id: `cm-${r.id}`, at: new Date(r.at), kind: "message" as const, title: `Support message from ${r.name}`, detail: r.topic, href: `/admin/inbox?open=${r.id}` })),
      ),
    );
  return (await Promise.all(tasks))
    .flat()
    .sort((a, b) => +b.at - +a.at)
    .slice(0, limit);
}
