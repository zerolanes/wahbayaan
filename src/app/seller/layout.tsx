import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { sellerNav } from "@/components/seller/nav";
import { Badge } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

export const metadata: Metadata = { title: { default: "Artisan dashboard", template: "%s · Wahbayaan Artisan" }, robots: { index: false } };

/** Seller-facing dashboard. Every amount here is Pakistani rupees. */
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSeller();
  const d = await db();
  const r = await d.execute<{ orders: number; requests: number; messages: number }>(sql`
    select
      (select count(*)::int from vendor_orders where vendor_id = ${user.vendorId} and status = 'pending') as orders,
      (select count(*)::int from custom_requests where vendor_id = ${user.vendorId} and status = 'new') as requests,
      (select count(*)::int from messages m join conversations c on c.id = m.conversation_id
         where c.vendor_id = ${user.vendorId} and m.read_at is null and m.sender_user_id <> ${user.id}) as messages`);
  const row = (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? []))[0] as { orders: number; requests: number; messages: number } | undefined;
  const groups = sellerNav({ newOrders: row?.orders ?? 0, newRequests: row?.requests ?? 0, unreadMessages: row?.messages ?? 0 });
  return (
    <div className="min-h-dvh bg-sand-100">
      <DashboardSidebar groups={groups} label="Artisan dashboard" />
      <div className="lg:pl-64">
        <DashboardTopbar
          userName={user.name}
          context={<span className="truncate">Your workshop on Wahbayaan</span>}
          badge={<Badge tone="gold">All amounts in PKR (Rs)</Badge>}
        />
        <main className="mx-auto max-w-[1300px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
