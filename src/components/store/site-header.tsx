import Link from "next/link";
import { Columns3, Heart, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { iconButtonClass } from "@/components/ui/glass";
import content from "@/content/home.json";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { getCartCount, getWishlistIds, loadCart } from "@/lib/commerce/cart";
import { featureFlags } from "@/lib/features";
import { getPublicCategories } from "@/lib/queries/catalog";
import { getCompareIds } from "@/lib/queries/storefront";
import { getSetting } from "@/lib/settings";
import { CurrencySwitcher } from "./currency-switcher";
import { HeaderFrame } from "./header-frame";
import { HeaderSearch } from "./header-search";
import { MenuOverlay } from "./menu-overlay";
import { CountBadge, MiniCart } from "./mini-cart";
import { MiniCartBody, MiniCartFooter } from "./mini-cart-body";
import { MobileTabBar } from "./mobile-tab-bar";

type Flags = Awaited<ReturnType<typeof featureFlags>>;
/** Content links may name a feature flag; they show only while it is on. */
export const flagOn = (flags: Flags, flag?: string) => !flag || flags[flag as keyof Flags] !== false;

/** Links to features switched off in Admin → Feature flags (the menu and footer drop them). */
export function hiddenLinks(flags: Flags): string[] {
  return [
    !flags.limitedDrops && "/drops",
    !flags.customRequests && "/custom",
    !flags.journal && "/journal",
    !flags.compare && "/compare",
    !flags.wholesale && "/wholesale",
    !flags.pakistaniBrands && "/brands",
    !flags.pakistaniBrands && "/brands/directory",
    !flags.pakistaniBrands && "/brands/join",
    !flags.brandRequests && "/brands/request",
  ].filter((h): h is string => !!h);
}

/**
 * Shared storefront header (design direction C): a sticky glass capsule with
 * the menu, wordmark, craft search, ship-to / currency, compare, wishlist,
 * account and bag, then a quiet text nav on desktop. Phones keep the menu
 * sheet, a search sheet and the bottom tab bar. The promo strip above it is
 * `AnnouncementBar`.
 */
export async function SiteHeader() {
  const [ctx, user, categories, flags, social, compareIds] = await Promise.all([
    getBuyerContext(),
    getCurrentUser(),
    getPublicCategories(),
    featureFlags(),
    getSetting("social_links"),
    getCompareIds(),
  ]);
  const [cartCount, wishlist] = await Promise.all([getCartCount(ctx.ownerKey), getWishlistIds(ctx.ownerKey)]);
  // The mini-cart body is only worth loading when there is something in the bag.
  const cart = cartCount > 0 ? await loadCart() : null;
  const accountHref = user ? (user.role === "staff" ? "/admin" : user.vendorId ? "/seller" : user.role === "seller" ? "/brand-portal" : "/account") : "/login";
  const hidden = hiddenLinks(flags);
  const icon = iconButtonClass("plain", "md");
  const priced = !!ctx.fx;
  const emptyCart = { cartId: null, lines: [], landed: null, couponCode: null, couponError: null, isGift: false, giftWrap: false, giftMessage: null, plan: null };
  const crafts = categories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <>
      <HeaderFrame overlay={false}>
        <div className="flex min-w-0 shrink-0 items-center gap-1 lg:gap-3">
          <MenuOverlay
            categories={categories.map((c) => ({ slug: c.slug, name: c.name, tagline: c.tagline, coverImageUrl: c.coverImageUrl! }))}
            signedIn={!!user}
            isSeller={!!user?.vendorId}
            isStaff={user?.role === "staff"}
            isBrandSeller={user?.role === "seller" && !user.vendorId}
            hidden={hidden}
            social={social}
          />
          <span className="max-md:absolute max-md:left-1/2 max-md:-translate-x-1/2">
            <Logo tone="current" compact />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1 md:justify-between md:pl-6 lg:pl-10">
          <HeaderSearch categories={crafts} buttonClassName={`${icon} md:hidden`} />
          <div className="flex items-center gap-0.5 sm:gap-1 md:pl-3">
            <div className="mr-1 hidden lg:block">
              <CurrencySwitcher destination={ctx.destination} currency={ctx.currency} currencyChosen={ctx.currencyChosen} tone="dark" />
            </div>
            {flags.compare ? (
              <Link href="/compare" className={`${icon} max-[359px]:hidden`} aria-label={`Compare (${compareIds.length})`}>
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
            {/* Phones reach the bag from the tab bar. */}
            <MiniCart count={cartCount} className={`${icon} hidden md:grid`} footer={cart ? <MiniCartFooter cart={cart} currency={ctx.currency} priced={priced} /> : null}>
              <MiniCartBody cart={cart ?? emptyCart} currency={ctx.currency} priced={priced} />
            </MiniCart>
          </div>
        </div>
      </HeaderFrame>

      <nav aria-label="Primary" className="mx-auto hidden max-w-[1400px] items-center justify-center gap-1 px-10 pt-3 lg:flex">
        {content.nav
          .filter((l) => flagOn(flags, l.flag))
          .map((l) => (
            <Link key={l.href} href={l.href} className="pressable rounded-full px-3.5 py-2 text-sm font-medium text-[var(--wb-ink)] hover:bg-[var(--wb-ink)]/[0.06]">
              {l.label}
              {l.href === "/compare" && compareIds.length ? <span className="ml-1 text-[var(--wb-muted)] tabular-nums">({compareIds.length})</span> : null}
            </Link>
          ))}
      </nav>
      {/* Phones and tablets: ship-to / currency sits under the capsule (desktop has it inline). */}
      <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2 px-4 pt-3 text-xs text-[var(--wb-muted)] sm:px-6 lg:hidden">
        <span>Ship to</span>
        <CurrencySwitcher destination={ctx.destination} currency={ctx.currency} currencyChosen={ctx.currencyChosen} tone="dark" />
      </div>
      <MobileTabBar cartCount={cartCount} wishlistCount={wishlist.size} accountHref={accountHref} />
    </>
  );
}
