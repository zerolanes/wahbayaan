import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { adminNav } from "@/components/admin/nav";
import { CommandPalette } from "@/components/admin/command-palette";
import { Toaster } from "@/components/admin/toaster";
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
  const [awaitingQuote, openDisputes, pendingApplications, pendingListings, pendingReviews, newMessages, newRequests, brandQueue] = await Promise.all([
    one(sql`select count(*)::int as n from orders where status = 'awaiting_quote'`),
    one(sql`select count(*)::int as n from disputes where status not in ('resolved','closed')`),
    one(sql`select count(*)::int as n from vendor_applications where status in ('submitted','in_review')`),
    one(sql`select count(*)::int as n from products where status = 'pending_review'`),
    one(sql`select count(*)::int as n from reviews where status = 'pending'`),
    one(sql`select count(*)::int as n from contact_messages where status = 'new'`),
    one(sql`select count(*)::int as n from custom_requests where status = 'new'`),
    one(sql`select count(*)::int as n from orders where kind = 'brand' and (status = 'awaiting_quote' or (payment_status = 'paid' and status in ('paid','in_fulfilment')))`),
  ]);
  return { awaitingQuote, openDisputes, pendingApplications, pendingListings, pendingReviews, newMessages, newRequests, brandQueue };
}

/** Company admin panel — internal amounts are PKR unless a page says otherwise. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const groups = adminNav(await counts())
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || user.permissions.has(i.permission)) }))
    .filter((g) => g.items.length);
  const links = groups.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.label })));
  return (
    <div className="admin-theme min-h-dvh bg-[#fafafa] print:bg-white">
      <div className="print:hidden">
        <DashboardSidebar groups={groups} label="Admin" />
      </div>
      <div className="lg:pl-60 print:pl-0">
        <div className="print:hidden">
          <DashboardTopbar
            userName={user.name}
            context={
              <>
                <CommandPalette links={links} />
                <span className="hidden truncate 2xl:inline">
                  Signed in as <strong className="font-medium text-umber-800">{user.staffRoleName}</strong>
                </span>
              </>
            }
            badge={isDemoMode() ? <Badge tone="pending">Demo data</Badge> : null}
          />
        </div>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:p-0">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
