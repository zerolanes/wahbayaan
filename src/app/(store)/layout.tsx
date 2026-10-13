import { ConsentRoot } from "@/components/consent/consent-root";
import { MaintenanceGate } from "@/components/store/maintenance";
import { AnnouncementBar } from "@/components/store/announcement-bar";
import { DemoRibbon } from "@/components/store/demo-ribbon";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";

/**
 * Buyer-facing storefront (design direction C): promo strip, shared glass header,
 * page, light footer. Buyers in Pakistan see PKR, buyers abroad USD/GBP/CAD — always
 * through `BuyerPrice` / the buyer context, never hard-coded.
 */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <MaintenanceGate>
      <div className="storefront flex min-h-dvh flex-col">
        <DemoRibbon />
        <AnnouncementBar />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <ConsentRoot />
      </div>
    </MaintenanceGate>
  );
}
