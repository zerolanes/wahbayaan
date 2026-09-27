import { DemoRibbon } from "@/components/store/demo-ribbon";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";

/** Homepage: the header floats over the 3D scene. */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-indigo-950">
      <DemoRibbon variant="pill" />
      <SiteHeader overlay />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
