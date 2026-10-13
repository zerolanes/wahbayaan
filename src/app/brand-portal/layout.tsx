import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { brandPortalNav } from "@/components/brand-portal/nav";
import { Toaster } from "@/components/admin/toaster";
import { Badge } from "@/components/ui/misc";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { portalCounts } from "@/lib/brand-portal/queries";

export const metadata: Metadata = { title: { default: "Brand portal", template: "%s · Wahbayaan Brand portal" }, robots: { index: false } };

/** Self-listed brands manage their own page, catalogue and orders here. Every amount is Pakistani rupees. */
export default async function BrandPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireBrandMember();
  const counts = await portalCounts(user.brandId);
  return (
    <div className="admin-theme min-h-dvh bg-[#fafafa]">
      <DashboardSidebar groups={brandPortalNav({ toPrepare: counts.toPrepare, drafts: counts.drafts })} label="Brand portal" />
      <div className="lg:pl-60">
        <DashboardTopbar userName={user.name} context={<span className="truncate">{user.brand.name} on Wahbayaan</span>} badge={<Badge tone="neutral">All amounts in PKR (Rs)</Badge>} />
        <main className="mx-auto max-w-[1300px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
