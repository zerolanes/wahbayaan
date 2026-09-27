"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ScallopDivider, StarMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils/cn";

export type MenuCategory = { slug: string; name: string; tagline: string | null; coverImageUrl: string };

/**
 * Full-screen navigation. Replaces the old flat black text-only overlay with a
 * night-indigo, star-latticed panel whose left side previews the craft you hover.
 */
export function MenuOverlay({ categories, signedIn, isSeller, isStaff }: { categories: MenuCategory[]; signedIn: boolean; isSeller: boolean; isStaff: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const preview = categories[active];
  const explore = [
    { href: "/shop", label: "Shop everything" },
    { href: "/artisans", label: "Meet the artisans" },
    { href: "/collections", label: "Collections & bundles" },
    { href: "/drops", label: "Limited drops" },
    { href: "/custom", label: "Commission a piece" },
    { href: "/journal", label: "Heritage journal" },
    { href: "/compare", label: "Compare" },
  ];
  const help = [
    { href: "/how-importing-works", label: "How importing works" },
    { href: "/buyer-protection", label: "Buyer protection" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact us" },
    { href: "/about", label: "About Wahbayaan" },
    { href: "/wholesale", label: "Trade & wholesale" },
    { href: "/become-a-seller", label: "Sell on Wahbayaan" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="group flex h-9 items-center gap-2 rounded-full px-2 text-sm font-medium text-current"
      >
        <span className="flex w-5 flex-col gap-[5px]" aria-hidden>
          <span className="h-[1.5px] w-full bg-current transition group-hover:w-3/4" />
          <span className="h-[1.5px] w-3/4 bg-current transition group-hover:w-full" />
        </span>
        <span className="hidden sm:inline">Menu</span>
      </button>

      <div
        className={cn(
          "fixed inset-0 z-[80] transition-[opacity,visibility] duration-500",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <div className="night absolute inset-0 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Imagery panel */}
          <div className="relative hidden overflow-hidden lg:block">
            {categories.map((c, i) => (
              <Image
                key={c.slug}
                src={c.coverImageUrl}
                alt=""
                fill
                sizes="40vw"
                unoptimized
                className={cn(
                  "object-cover transition-all duration-[1200ms] ease-[var(--ease-out-expo)]",
                  i === active ? "scale-100 opacity-100" : "scale-110 opacity-0",
                )}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-950 via-indigo-950/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10">
              <p className="text-xs tracking-[0.25em] text-gold-300 uppercase">{preview?.tagline}</p>
              <p className="mt-2 font-display text-5xl text-sand-50">{preview?.name}</p>
            </div>
            <ScallopDivider className="absolute inset-x-0 top-0" />
          </div>

          {/* Navigation */}
          <div className="relative flex min-h-0 flex-col overflow-y-auto px-6 pt-6 pb-10 sm:px-10 lg:px-16">
            <div className="flex items-center justify-between">
              <StarMark className="size-9" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-sand-100 transition hover:bg-white/10"
              >
                Close <span aria-hidden>✕</span>
              </button>
            </div>

            <div className="mt-10 grid gap-12 md:grid-cols-[3fr_2fr]">
              <nav aria-label="Shop by craft">
                <p className="text-xs font-semibold tracking-[0.22em] text-gold-300 uppercase">Shop by craft</p>
                <ul className="mt-5 space-y-1">
                  {categories.map((c, i) => (
                    <li key={c.slug}>
                      <Link
                        href={`/category/${c.slug}`}
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        className={cn(
                          "group flex items-baseline gap-4 py-1.5 font-display text-3xl transition-colors md:text-[2.6rem] md:leading-[1.15]",
                          i === active ? "text-sand-50" : "text-sand-100/45 hover:text-sand-50",
                        )}
                      >
                        <span className="w-8 shrink-0 font-sans text-xs tracking-widest text-gold-400/80 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                        <span className="transition-transform duration-500 group-hover:translate-x-2">{c.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="grid content-start gap-10 sm:grid-cols-2 md:grid-cols-1">
                <nav aria-label="Explore">
                  <p className="text-xs font-semibold tracking-[0.22em] text-gold-300 uppercase">Explore</p>
                  <ul className="mt-4 space-y-2.5">
                    {explore.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="text-lg text-sand-100/80 transition hover:text-gold-200">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
                <nav aria-label="Help">
                  <p className="text-xs font-semibold tracking-[0.22em] text-gold-300 uppercase">Buying from Pakistan</p>
                  <ul className="mt-4 space-y-2.5">
                    {help.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="text-sand-100/70 transition hover:text-gold-200">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-white/10 pt-6 text-sm text-sand-100/70">
              {signedIn ? (
                <>
                  <Link href="/account" className="hover:text-gold-200">
                    My account
                  </Link>
                  {isSeller ? (
                    <Link href="/seller" className="hover:text-gold-200">
                      · Artisan dashboard
                    </Link>
                  ) : null}
                  {isStaff ? (
                    <Link href="/admin" className="hover:text-gold-200">
                      · Company admin
                    </Link>
                  ) : null}
                </>
              ) : (
                <Link href="/login" className="hover:text-gold-200">
                  Sign in or create an account
                </Link>
              )}
              <span className="ml-auto font-urdu text-lg text-gold-300/80" lang="ur">
                ہنر کی قدر
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
