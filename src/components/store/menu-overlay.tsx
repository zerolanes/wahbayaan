"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";

export type MenuCategory = { slug: string; name: string; tagline: string | null; coverImageUrl: string };

/**
 * Site menu: a glass panel that slides in from the left edge (the side its
 * button lives on) over a dimmed page. Crafts are listed with their cover art
 * so they're recognisable at a glance; explore and help links follow.
 */
export function MenuOverlay({
  categories,
  signedIn,
  isSeller,
  isStaff,
  hidden = [],
}: {
  categories: MenuCategory[];
  signedIn: boolean;
  isSeller: boolean;
  isStaff: boolean;
  /** Links to features switched off in Admin → Feature flags. */
  hidden?: string[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const explore = [
    { href: "/shop", label: "Shop everything" },
    { href: "/brands", label: "Pakistani brands" },
    { href: "/artisans", label: "Meet the artisans" },
    { href: "/collections", label: "Collections & bundles" },
    { href: "/drops", label: "Limited drops" },
    { href: "/custom", label: "Commission a piece" },
    { href: "/journal", label: "Heritage journal" },
    { href: "/compare", label: "Compare" },
    { href: "/haveli", label: "Walk through the haveli" },
  ].filter((l) => !hidden.includes(l.href));
  const help = [
    { href: "/how-importing-works", label: "How importing works" },
    { href: "/buyer-protection", label: "Buyer protection" },
    { href: "/track", label: "Track an order" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact us" },
    { href: "/about", label: "About Wahbayaan" },
    { href: "/wholesale", label: "Trade & wholesale" },
    { href: "/become-a-seller", label: "Sell on Wahbayaan" },
  ].filter((l) => !hidden.includes(l.href));

  const group = "text-xs font-semibold tracking-[0.08em] text-umber-700 uppercase";
  const row = "pressable flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 text-[0.95rem] text-umber-900 hover:bg-umber-900/[0.06]";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="pressable group flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-current hover:bg-current/[0.07] sm:px-3"
      >
        <span className="flex w-[18px] flex-col gap-[5px]" aria-hidden>
          <span className="h-[1.5px] w-full rounded-full bg-current" />
          <span className="h-[1.5px] w-2/3 rounded-full bg-current transition-[width] duration-[var(--dur-quick)] group-hover:w-full" />
        </span>
        <span className="hidden sm:inline">Menu</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} side="left" title="Menu" panelClassName="w-full" className="sm:w-[26rem]!">
        <div className="pt-2">
          <nav aria-label="Shop by craft">
            <p className={group}>Shop by craft</p>
            <ul className="mt-2 grid gap-0.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className="pressable group flex items-center gap-3 rounded-[var(--radius-control)] p-1.5 pr-3 hover:bg-umber-900/[0.06]">
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-[0.75rem] bg-sand-200">
                      {c.coverImageUrl ? <Image src={c.coverImageUrl} alt="" fill sizes="44px" unoptimized className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.95rem] font-semibold text-umber-900">{c.name}</span>
                      {c.tagline ? <span className="block truncate text-xs text-umber-700">{c.tagline}</span> : null}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-umber-500 transition-transform duration-[var(--dur-quick)] group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-6 grid gap-6">
            <nav aria-label="Explore">
              <p className={group}>Explore</p>
              <ul className="mt-2 grid gap-0.5">
                {explore.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={row}>
                      {l.label}
                      <ArrowRight className="size-4 text-umber-500" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Help">
              <p className={group}>Buying from Pakistan</p>
              <ul className="mt-2 grid gap-0.5">
                {help.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={cn(row, "text-umber-800")}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-umber-900/[0.08] pt-5 text-sm">
            {signedIn ? (
              <>
                <Link href="/account" className="pressable rounded-full bg-indigo-900 px-4 py-2.5 font-medium text-sand-50 hover:bg-indigo-800">
                  My account
                </Link>
                {isSeller ? (
                  <Link href="/seller" className="pressable rounded-full px-3 py-2.5 font-medium text-umber-900 hover:bg-umber-900/[0.06]">
                    Artisan dashboard
                  </Link>
                ) : null}
                {isStaff ? (
                  <Link href="/admin" className="pressable rounded-full px-3 py-2.5 font-medium text-umber-900 hover:bg-umber-900/[0.06]">
                    Company admin
                  </Link>
                ) : null}
              </>
            ) : (
              <Link href="/login" className="pressable rounded-full bg-indigo-900 px-4 py-2.5 font-medium text-sand-50 hover:bg-indigo-800">
                Sign in or create an account
              </Link>
            )}
            <span className="font-urdu ml-auto text-lg text-gold-700" lang="ur">
              ہنر کی قدر
            </span>
          </div>
        </div>
      </Sheet>
    </>
  );
}
