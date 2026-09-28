import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardCheck, ShieldAlert } from "lucide-react";
import { BarChart, HBarList, ShareBar } from "@/components/admin/charts";
import { MiniStat, Panel, PendingBadge } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { activityFeed, dashboardData } from "@/lib/admin/dashboard";
import { getReadiness } from "@/lib/admin/readiness-data";
import { scoreReadiness } from "@/lib/admin/readiness";
import { dailySeries, CURRENCY_COLORS } from "@/lib/admin/series";
import { orderMoney } from "@/lib/admin/money";
import { destinationName, formatMoney } from "@/lib/money/currency";
import { timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard(props: PageProps<"/admin">) {
  const user = await requireStaff();
  const { denied } = await props.searchParams;
  const deniedPerm = typeof denied === "string" ? denied : null;
  const deniedNotice = deniedPerm ? (
    <Notice tone="danger" title="You don't have access to that page" icon={<ShieldAlert className="size-4" />}>
      Your role ({user.staffRoleName ?? "none"}) doesn&apos;t include <strong>{PERMISSIONS[deniedPerm as Permission] ?? deniedPerm}</strong> (<code>{deniedPerm}</code>). Ask an owner to update your role in Staff &amp; roles.
    </Notice>
  ) : null;

  if (!user.permissions.has("dashboard.view")) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Company admin" title={`Welcome, ${user.name}`} description="Your role doesn't include the operations dashboard. Use the sidebar to reach the areas you manage." />
        {deniedNotice}
      </div>
    );
  }

  const [data, readiness, feed] = await Promise.all([dashboardData(), getReadiness(), activityFeed({ limit: 12, kinds: ["order", "audit", "dispute", "application", "review"] })]);
  const score = scoreReadiness(readiness);
  const c = data.counts;
  const since = new Date(Date.now() - 29 * 86_400_000);
  const series = dailySeries(
    data.daily.map((r) => ({ at: `${r.day}T12:00:00Z`, value: r.n })),
    since,
    30,
  );
  const gmvPkr = data.gmv.reduce((a, g) => a + g.pkr, 0);
  const heldRows = data.held.filter((h) => h.state === "held");
  const frozenRows = data.held.filter((h) => h.state === "frozen");
  const a = data.attention;
  const attention = [
    { n: c.awaiting_quote, label: "orders waiting for a shipping & duty quote", href: "/admin/quotes", perm: "orders.manage" },
    { n: c.open_disputes, label: "open disputes (funds frozen)", href: "/admin/disputes", perm: "disputes.view" },
    { n: a.due_release ?? 0, label: "delivered orders past their auto-release date", href: "/admin/escrow", perm: "escrow.release" },
    { n: a.unshipped_paid ?? 0, label: "paid orders not accepted by the artisan after 3 days", href: "/admin/orders?status=paid", perm: "orders.view" },
    { n: a.overdue_shipments ?? 0, label: "parcels shipped 21+ days ago and not delivered", href: "/admin/shipments?overdue=1", perm: "orders.view" },
    { n: c.apps, label: "artisan applications to review", href: "/admin/applications", perm: "vendors.view" },
    { n: c.listings, label: "listings waiting for moderation", href: "/admin/listings?status=pending_review", perm: "products.view" },
    { n: c.reviews, label: "reviews waiting for moderation", href: "/admin/reviews?status=pending", perm: "reviews.moderate" },
    { n: a.support ?? 0, label: "new support messages", href: "/admin/inbox?status=new", perm: "support.manage" },
    { n: a.requests ?? 0, label: "new custom requests", href: "/admin/requests?status=new", perm: "requests.manage" },
    { n: a.wholesale ?? 0, label: "new wholesale applications", href: "/admin/wholesale?status=new", perm: "requests.manage" },
    { n: a.payouts ?? 0, label: "artisan payouts to send", href: "/admin/payouts", perm: "payouts.view" },
    { n: a.awaiting_payment ?? 0, label: "quotes unpaid for over a week", href: "/admin/orders?status=quote_sent", perm: "orders.view" },
    { n: a.emails_failed ?? 0, label: "emails that failed to send", href: "/admin/emails?status=failed", perm: "settings.manage" },
  ].filter((x) => x.n > 0 && user.permissions.has(x.perm));
  const businessInputs = readiness.filter((r) => r.group === "Rates & fees");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Company admin"
        title="Operations dashboard"
        description="Everything that needs a decision today. Buyer amounts are shown in the order currency; artisan-side totals in PKR."
        actions={
          <Link href="/admin/readiness" className="flex items-center gap-3 rounded-full border border-umber-200 bg-sand-50 py-1.5 pr-4 pl-1.5 text-sm shadow-soft hover:border-gold-400">
            <span className={`grid size-8 place-items-center rounded-full text-xs font-semibold text-white ${score.score >= 80 ? "bg-success-600" : score.score >= 50 ? "bg-gold-500" : "bg-danger-600"}`}>{score.score}</span>
            Launch readiness · {score.fail} blocking
          </Link>
        }
      />
      {deniedNotice}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5 sm:col-span-2">
          <p className="text-xs font-medium tracking-wider text-umber-500 uppercase">Gross sales (paid orders, all time)</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {data.gmv.length ? (
              data.gmv.map((g) => (
                <span key={g.currency} className="font-display text-2xl text-umber-900 tabular-nums">
                  {orderMoney(g.total, g.currency)}
                </span>
              ))
            ) : (
              <span className="font-display text-2xl text-umber-400">No paid orders yet</span>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-umber-500">
            ≈ <SellerPrice pkr={gmvPkr} className="font-medium text-umber-800" /> at the rate recorded on each order
            {data.placeholderFxOrders ? <PendingBadge>{data.placeholderFxOrders} used placeholder FX</PendingBadge> : null}
          </p>
          <div className="mt-4">
            <ShareBar parts={data.gmv.map((g) => ({ key: g.currency, label: `${g.currency} · ${g.n} orders`, value: g.pkr, display: formatMoney(g.pkr, "PKR", { compact: true }), color: CURRENCY_COLORS[g.currency] ?? "#76644f" }))} />
          </div>
        </Card>
        <MiniStat label="Orders today" value={c.today} hint={`${c.d7} in 7 days · ${c.d30} in 30 days`} href="/admin/orders" />
        <MiniStat label="Awaiting quote" value={c.awaiting_quote} hint={`${c.quote_sent} quotes sent, awaiting payment`} tone={c.awaiting_quote ? "pending" : undefined} href="/admin/quotes" />
        <Card className="p-5 sm:col-span-2">
          <p className="text-xs font-medium tracking-wider text-umber-500 uppercase">Buyer funds held in escrow</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {heldRows.length ? (
              heldRows.map((h) => (
                <span key={h.currency} className="font-display text-2xl text-umber-900 tabular-nums">
                  {orderMoney(h.total, h.currency)} <span className="font-sans text-sm text-umber-500">· {h.n} order{h.n === 1 ? "" : "s"}</span>
                </span>
              ))
            ) : (
              <span className="font-display text-2xl text-umber-400">Nothing held</span>
            )}
          </div>
          {frozenRows.length ? (
            <p className="mt-2 text-sm text-danger-700">
              Frozen by disputes: {frozenRows.map((f) => `${orderMoney(f.total, f.currency)} (${f.n})`).join(" · ")}
            </p>
          ) : (
            <p className="mt-2 text-sm text-umber-500">No frozen funds.</p>
          )}
        </Card>
        <MiniStat label="Open disputes" value={c.open_disputes} tone={c.open_disputes ? "danger" : undefined} href="/admin/disputes" hint="Funds frozen until resolved" />
        <MiniStat label="Pending moderation" value={c.apps + c.listings + c.reviews} hint={`${c.apps} applications · ${c.listings} listings · ${c.reviews} reviews`} href="/admin/listings?status=pending_review" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Orders, last 30 days" description={`${c.d30} orders placed · daily count`}>
          <BarChart height={230} title="Orders per day, last 30 days" data={series.map((p) => ({ ...p, display: `${p.value} order${p.value === 1 ? "" : "s"}` }))} />
        </Panel>
        <Panel title="Needs attention" description="Work queues across the company" bodyClassName="p-0">
          {attention.length ? (
            <ul className="divide-y divide-umber-200/60">
              {attention.map((x) => (
                <li key={x.href + x.label}>
                  <Link href={x.href} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-gold-50/60">
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-terracotta-100 px-1.5 text-xs font-semibold text-terracotta-700 tabular-nums">{x.n}</span>
                    <span className="flex-1 text-umber-800">{x.label}</span>
                    <ArrowRight className="size-4 text-umber-400" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-umber-500">All queues are clear.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Sales by destination" description="Paid orders · PKR equivalent">
          <HBarList
            color="#4b62a6"
            items={data.byDest.map((r) => ({ key: r.country, label: `${destinationName(r.country)} · ${r.n} order${r.n === 1 ? "" : "s"}`, value: r.pkr, display: formatMoney(r.pkr, "PKR", { compact: true }), href: `/admin/orders?destination=${r.country}` }))}
          />
        </Panel>
        <Panel title="Top artisans" description="Paid sub-orders · PKR">
          <HBarList
            color="#c4623a"
            items={data.topArtisans.map((r) => ({ key: r.id, label: r.name, value: r.pkr, display: formatMoney(r.pkr, "PKR", { compact: true }), href: `/admin/artisans/${r.id}` }))}
          />
        </Panel>
        <Panel title="Top categories" description="Items sold · PKR">
          <HBarList
            color="#1a9fb0"
            items={data.topCategories.map((r) => ({ key: r.id, label: `${r.name} · ${r.n}`, value: r.pkr, display: formatMoney(r.pkr, "PKR", { compact: true }) }))}
          />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Recent activity" action={<Link href="/admin/activity" className="text-sm text-terracotta-600 hover:underline">View all</Link>} bodyClassName="p-0">
          <ul className="divide-y divide-umber-200/60">
            {feed.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                <Badge tone={f.kind === "audit" ? "indigo" : f.kind === "dispute" ? "danger" : f.kind === "order" ? "gold" : "neutral"} className="mt-0.5 w-20 justify-center">
                  {f.kind}
                </Badge>
                <div className="min-w-0 flex-1">
                  {f.href ? (
                    <Link href={f.href} className="font-medium text-umber-900 hover:text-terracotta-600">
                      {f.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-umber-900">{f.title}</p>
                  )}
                  {f.detail ? <p className="truncate text-umber-500">{f.detail}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-umber-400">{timeAgo(f.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title={<span className="flex items-center gap-2"><ClipboardCheck className="size-4 text-gold-600" />Business inputs pending</span>}
          description="Numbers that need a real decision before launch"
          action={<Link href="/admin/readiness" className="text-sm text-terracotta-600 hover:underline">Checklist</Link>}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-umber-200/60">
            {businessInputs.map((r) => (
              <li key={r.id}>
                <Link href={r.href} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-gold-50/60">
                  {r.status === "pass" ? <Badge tone="success">Set</Badge> : r.status === "warn" ? <Badge tone="pending">Pending</Badge> : <Badge tone="danger">Blocking</Badge>}
                  <span className="flex-1 text-umber-800">{r.title}</span>
                  {r.status !== "pass" && r.count > 1 ? <span className="text-xs text-umber-500 tabular-nums">{r.count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
          {score.fail ? (
            <div className="border-t border-umber-200/60 px-5 py-3 text-sm text-umber-600">
              <AlertTriangle className="mr-1.5 inline size-4 text-danger-600" />
              {score.fail} blocking item{score.fail === 1 ? "" : "s"} across the launch checklist.
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

