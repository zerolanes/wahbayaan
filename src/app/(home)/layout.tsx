import { ConsentRoot } from "@/components/consent/consent-root";
import { MaintenanceGate } from "@/components/store/maintenance";
import { HaveliFooter } from "@/components/store/haveli-footer";
import { HaveliHeader } from "@/components/store/haveli-header";

/** The haveli walk-through (/haveli): the header floats over the 3D scene. */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <MaintenanceGate>
      <div className="flex min-h-dvh flex-col bg-indigo-950">
        <HaveliHeader overlay />
        <main id="main" className="flex-1">
          {children}
        </main>
        <HaveliFooter tabBarSpace={false} />
        <ConsentRoot />
      </div>
    </MaintenanceGate>
  );
}
