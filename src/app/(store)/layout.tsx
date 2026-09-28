import { MaintenanceGate } from "@/components/store/maintenance";
import { AnnouncementBar } from "@/components/store/announcement-bar";
import { DemoRibbon } from "@/components/store/demo-ribbon";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";

/** Buyer-facing storefront. Prices here are USD/GBP/CAD (PKR only via the switcher). */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <MaintenanceGate>
      <div className="paper flex min-h-dvh flex-col">
        <DemoRibbon />
        <AnnouncementBar />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </MaintenanceGate>
  );
}
