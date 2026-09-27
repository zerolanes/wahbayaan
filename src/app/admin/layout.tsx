import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { adminNav } from "@/components/admin/nav";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { isDemoMode } from "@/lib/settings";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Wahbayaan Admin" }, robots: { index: false } };

async function counts() {
  const d = await db();
  const one = async (q: ReturnType<typeof sql>) => {
    const r = await d.execute<{ n: number }>(q);
    const rows = Array.isArray(r) ? r : ((r as { rows?: { n: number }[] }).rows ?? []);
    return Number(rows[0]?.n ?? 0);
  };
  const [awaitingQuote, openDisputes, pendingApplications, pendingListings, pendingReviews, newMessages, newRequests] = await Promise.all([
    one(sql`select count(*)::int as n from orders where status = 'awaiting_quote'`),
    one(sql`select count(*)::int as n from disputes where status not in ('resolved','closed')`),
    one(sql`select count(*)::int as n from vendor_applications where status in ('submitted','in_review')`),
    one(sql`select count(*)::int as n from products where status = 'pending_review'`),
    one(sql`select count(*)::int as n from reviews where status = 'pending'`),
    one(sql`select count(*)::int as n from contact_messages where status = 'new'`),
    one(sql`select count(*)::int as n from custom_requests where status = 'new'`),
  ]);
  return { awaitingQuote, openDisputes, pendingApplications, pendingListings, pendingReviews, newMessages, newRequests };
}

/** Company admin panel — internal amounts are PKR unless a page says otherwise. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const groups = adminNav(await counts())
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || user.permissions.has(i.permission)) }))
    .filter((g) => g.items.length);
  return (
    <div className="min-h-dvh bg-sand-100">
      <DashboardSidebar groups={groups} label="Company admin" />
      <div className="lg:pl-64">
        <DashboardTopbar
          userName={user.name}
          context={<span className="truncate">Signed in as <strong className="text-umber-800">{user.staffRoleName}</strong></span>}
          badge={isDemoMode() ? <Badge tone="pending">Demo data</Badge> : null}
        />
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
