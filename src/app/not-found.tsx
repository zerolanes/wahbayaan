import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { StarMark } from "@/components/brand/logo";
import { db } from "@/lib/db/client";
import { redirects } from "@/lib/db/schema";

async function findRedirect() {
  const path = (await headers()).get("x-wb-path");
  if (!path) return null;
  const d = await db();
  const row = await d.query.redirects.findFirst({ where: eq(redirects.fromPath, path.replace(/\/$/, "") || "/") });
  if (!row) return null;
  await d.update(redirects).set({ hits: sql`${redirects.hits} + 1` }).where(eq(redirects.id, row.id));
  return row.toPath;
}

export default async function NotFound() {
  const to = await findRedirect();
  if (to) redirect(to);
  return (
    <main className="night grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-lg">
        <StarMark className="mx-auto size-14" />
        <p className="mt-8 text-xs font-semibold tracking-[0.3em] text-gold-300 uppercase">404</p>
        <h1 className="mt-3 font-display text-5xl text-sand-50">This piece has found another home</h1>
        <p className="mt-4 text-sand-200/75">The page you were looking for isn&apos;t here — it may have sold, moved or never existed.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="inline-flex h-11 items-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-6 font-medium text-ink">
            Browse the crafts
          </Link>
          <Link href="/" className="inline-flex h-11 items-center rounded-full border border-white/25 px-6 text-sand-50">
            Back to the haveli
          </Link>
        </div>
      </div>
    </main>
  );
}
