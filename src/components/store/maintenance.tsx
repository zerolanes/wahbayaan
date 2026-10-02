import { StarMark } from "@/components/brand/logo";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";

/**
 * Wraps the public site: while maintenance mode is on (Admin → Settings),
 * visitors see a holding page; signed-in staff still see the site, and the
 * sign-in page stays open so staff can get in.
 */
export async function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [maintenance, user] = await Promise.all([getSetting("maintenance"), getCurrentUser()]);
  if (!maintenance.enabled || user?.role === "staff") return <>{children}</>;
  const path = (await headers()).get("x-wb-path") ?? "";
  if (["/login", "/forgot-password", "/reset-password"].some((p) => path === p || path.startsWith(`${p}/`))) return <>{children}</>;
  return (
    <main className="paper grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <StarMark className="mx-auto size-12" />
        <h1 className="mt-6 font-display text-4xl text-umber-900">Back shortly</h1>
        <p className="mt-3 text-umber-600">{maintenance.message}</p>
        <p lang="ur" className="mt-6 font-urdu text-lg text-umber-600">
          واہ بیان
        </p>
      </div>
    </main>
  );
}
