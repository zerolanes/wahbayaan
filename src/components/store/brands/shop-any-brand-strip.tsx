import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";
import { shopWithWahbayaanHref } from "@/lib/directory";
import { featureFlags } from "@/lib/features";
import { getPublicDirectory } from "@/lib/queries/directory";
import { cn } from "@/lib/utils/cn";

const FALLBACK = ["Khaadi", "Sana Safinaz", "Maria B"];

/**
 * Compact "Shop Khaadi, Sana Safinaz, Maria B and more — paste any link" strip
 * for the homepage (placed by the design pass). Brand names are plain text
 * links into the shop-by-link form; no logos and no claim of any relationship.
 * Renders nothing when shop-by-link is switched off.
 */
export async function ShopAnyBrandStrip({ names, className }: { names?: string[]; className?: string }) {
  const flags = await featureFlags();
  if (!flags.pakistaniBrands || !flags.brandRequests) return null;
  const listed = names?.length ? names : (await getPublicDirectory()).map((e) => e.name);
  const picks = (listed.length ? listed : FALLBACK).slice(0, 3);
  return (
    <section aria-label="Shop any Pakistani brand by link" className={cn("rounded-[var(--radius-card)] bg-sand-50 ring-1 ring-umber-200/60", className)}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <p className="flex items-start gap-2.5 text-umber-800">
          <Link2 className="mt-1 size-4 shrink-0 text-terracotta-600" aria-hidden />
          <span>
            Shop{" "}
            {picks.map((n, i) => (
              <span key={n}>
                <Link href={shopWithWahbayaanHref(n)} className="font-semibold text-umber-900 underline-offset-4 hover:underline">
                  {n}
                </Link>
                {i < picks.length - 1 ? ", " : ""}
              </span>
            ))}{" "}
            and more — paste any link.
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-4 pl-6 text-sm sm:pl-0">
          <Link href="/brands/request" className="inline-flex min-h-10 items-center gap-1.5 font-medium text-terracotta-700 hover:underline">
            Paste a link <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/brands/directory" className="inline-flex min-h-10 items-center text-umber-600 hover:text-umber-900">
            All brands
          </Link>
        </div>
      </div>
    </section>
  );
}
