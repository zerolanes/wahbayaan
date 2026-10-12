import Link from "next/link";
import { ArrowRight, Columns3, Heart, ShoppingBag, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CurrencySwitcher } from "@/components/store/currency-switcher";
import { HeaderFrame } from "@/components/store/header-frame";
import { MenuOverlay } from "@/components/store/menu-overlay";
import { CountBadge } from "@/components/store/mini-cart";
import { iconButtonClass } from "@/components/ui/glass";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { getCartCount, getWishlistIds } from "@/lib/commerce/cart";
import { featureFlags } from "@/lib/features";
import { getPublicCategories } from "@/lib/queries/catalog";
import { getActiveAnnouncement, getCompareIds } from "@/lib/queries/storefront";
import content from "@/content/preview/c/home.json";
import { PhoolStrip } from "./motifs";
import { PcSearch } from "./search";

type Flags = Awaited<ReturnType<typeof featureFlags>>;
export const flagOn = (flags: Flags, flag?: string) => !flag || flags[flag as keyof Flags] !== false;

/**
 * Theme-style header: promo strip (phool-patti edge) → sticky glass capsule with
 * menu, wordmark, craft search, ship-to/currency, compare, wishlist, account and
 * bag → a quiet text nav (desktop). Phones keep the drawer and bottom tab bar.
 */
export async function PcHeader() {
  const [ctx, user, categories, flags, announcement, compareIds] = await Promise.all([
    getBuyerContext(),
    getCurrentUser(),
    getPublicCategories(),
    featureFlags(),
    getActiveAnnouncement(),
    getCompareIds(),
  ]);
  const [cartCount, wishlist] = await Promise.all([getCartCount(ctx.ownerKey), getWishlistIds(ctx.ownerKey)]);
  const accountHref = user ? (user.role === "staff" ? "/admin" : user.vendorId ? "/seller" : "/account") : "/login";
  const hidden = [
    !flags.limitedDrops && "/drops",
    !flags.customRequests && "/custom",
    !flags.journal && "/journal",
    !flags.compare && "/compare",
    !flags.wholesale && "/wholesale",
    !flags.pakistaniBrands && "/brands",
    !flags.brandRequests && "/brands/request",
  ].filter((h): h is string => !!h);
  const icon = iconButtonClass("plain", "md");
  const promo = announcement ? { text: announcement.message, link: announcement.link ? { label: "Details", href: announcement.link } : null } : content.promo;

  return (
    <>
      <div role="region" aria-label="Promotion" className="bg-white">
        <p className="mx-auto flex max-w-[1400px] items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[0.8rem] font-medium text-[var(--pc-ink)] max-sm:flex-col sm:py-2.5">
          <span>{promo.text}</span>
          {promo.link ? (
            <Link href={promo.link.href} className="group inline-flex items-center gap-1 font-semibold text-[var(--pc-magenta-ink)] underline-offset-4 hover:underline">
              {promo.link.label}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ) : null}
        </p>
        <PhoolStrip thin />
      </div>

      <HeaderFrame overlay={false}>
        <div className="flex min-w-0 shrink-0 items-center gap-1 lg:gap-3">
          <MenuOverlay
            categories={categories.map((c) => ({ slug: c.slug, name: c.name, tagline: c.tagline, coverImageUrl: c.coverImageUrl! }))}
            signedIn={!!user}
            isSeller={!!user?.vendorId}
            isStaff={user?.role === "staff"}
            hidden={hidden}
          />
          <span className="max-md:absolute max-md:left-1/2 max-md:-translate-x-1/2">
            <Logo tone="current" compact />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1 md:justify-between md:pl-6 lg:pl-10">
          <PcSearch categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />
          <div className="flex items-center gap-0.5 sm:gap-1 md:pl-3">
            <div className="mr-1 hidden lg:block">
              <CurrencySwitcher destination={ctx.destination} currency={ctx.currency} currencyChosen={ctx.currencyChosen} tone="dark" />
            </div>
            {flags.compare ? (
              <Link href="/compare" className={icon} aria-label={`Compare (${compareIds.length})`}>
                <Columns3 className="size-[18px]" aria-hidden />
                {compareIds.length ? <CountBadge n={compareIds.length} /> : null}
              </Link>
            ) : null}
            <Link href="/wishlist" className={`${icon} hidden md:grid`} aria-label={`Wishlist (${wishlist.size})`}>
              <Heart className="size-[18px]" aria-hidden />
              {wishlist.size ? <CountBadge n={wishlist.size} /> : null}
            </Link>
            <Link href={accountHref} className={`${icon} hidden md:grid`} aria-label="Account">
              <User className="size-[18px]" aria-hidden />
            </Link>
            <Link href="/cart" className={`${icon} hidden md:grid`} aria-label={`Bag (${cartCount})`}>
              <ShoppingBag className="size-[18px]" aria-hidden />
              {cartCount ? <CountBadge n={cartCount} /> : null}
            </Link>
          </div>
        </div>
      </HeaderFrame>

      <nav aria-label="Primary" className="mx-auto hidden max-w-[1400px] items-center justify-center gap-1 px-10 pt-3 lg:flex">
        {content.nav
          .filter((l) => flagOn(flags, l.flag))
          .map((l) => (
            <Link key={l.href} href={l.href} className="pressable rounded-full px-3.5 py-2 text-sm font-medium text-[var(--pc-ink)] hover:bg-[var(--pc-ink)]/[0.06]">
              {l.label}
              {l.href === "/compare" && compareIds.length ? <span className="ml-1.5 rounded-full bg-[var(--pc-teal-tint)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--pc-teal-ink)] tabular-nums">{compareIds.length}</span> : null}
            </Link>
          ))}
      </nav>
      {/* Phones and tablets: ship-to / currency sits under the capsule (desktop has it inline). */}
      <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2 px-4 pt-3 text-xs text-[var(--pc-muted)] sm:px-6 lg:hidden">
        <span>Ship to</span>
        <CurrencySwitcher destination={ctx.destination} currency={ctx.currency} currencyChosen={ctx.currencyChosen} tone="dark" />
      </div>
    </>
  );
}
