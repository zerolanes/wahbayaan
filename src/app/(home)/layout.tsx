import { MaintenanceGate } from "@/components/store/maintenance";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";

/** The haveli walk-through (/haveli): the header floats over the 3D scene. */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <MaintenanceGate>
      <div className="flex min-h-dvh flex-col bg-indigo-950">
        <SiteHeader overlay />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </MaintenanceGate>
  );
}
