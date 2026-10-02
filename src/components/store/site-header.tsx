import Link from "next/link";
import { Heart, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { iconButtonClass } from "@/components/ui/glass";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { getCartCount, getWishlistIds, loadCart } from "@/lib/commerce/cart";
import { featureFlags } from "@/lib/features";
import { getPublicCategories } from "@/lib/queries/catalog";
import { CurrencySwitcher } from "./currency-switcher";
import { HeaderFrame } from "./header-frame";
import { MenuOverlay } from "./menu-overlay";
import { CountBadge, MiniCart } from "./mini-cart";
import { MiniCartBody, MiniCartFooter } from "./mini-cart-body";
import { MobileTabBar } from "./mobile-tab-bar";
import { SearchDialog } from "./search-dialog";

export async function SiteHeader({ overlay = false, tabBar = !overlay }: { overlay?: boolean; tabBar?: boolean }) {
  const [ctx, user, categories, flags] = await Promise.all([getBuyerContext(), getCurrentUser(), getPublicCategories(), featureFlags()]);
  const hidden = [
    !flags.limitedDrops && "/drops",
    !flags.customRequests && "/custom",
    !flags.journal && "/journal",
    !flags.compare && "/compare",
    !flags.wholesale && "/wholesale",
  ].filter((h): h is string => !!h);
  const [cartCount, wishlist] = await Promise.all([getCartCount(ctx.ownerKey), getWishlistIds(ctx.ownerKey)]);
  // The mini-cart body is only worth loading when there is something in the bag.
  const cart = cartCount > 0 ? await loadCart() : null;
  const accountHref = user ? (user.role === "staff" ? "/admin" : user.vendorId ? "/seller" : "/account") : "/login";
  const icon = iconButtonClass("plain", "md");
  const priced = !!ctx.fx;
  const emptyCart = { cartId: null, lines: [], landed: null, couponCode: null, couponError: null, isGift: false, giftWrap: false, giftMessage: null };

  return (
    <>
      <HeaderFrame overlay={overlay}>
        <div className="flex min-w-0 items-center gap-1 lg:gap-5">
          <MenuOverlay
            categories={categories.map((c) => ({ slug: c.slug, name: c.name, tagline: c.tagline, coverImageUrl: c.coverImageUrl! }))}
            signedIn={!!user}
            isSeller={!!user?.vendorId}
            isStaff={user?.role === "staff"}
            hidden={hidden}
          />
          <nav className="hidden items-center gap-1 text-sm font-medium lg:flex" aria-label="Primary">
            {[
              { href: "/shop", label: "Shop" },
              { href: "/artisans", label: "Artisans" },
              { href: "/how-importing-works", label: "How importing works" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="pressable rounded-full px-3 py-2 hover:bg-current/[0.07]">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          <Logo tone="current" compact />
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <div className="mr-1 hidden md:block">
            <CurrencySwitcher destination={ctx.destination} currency={ctx.currency} currencyChosen={ctx.currencyChosen} tone="dark" />
          </div>
          <SearchDialog categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} className={icon} />
          <Link href="/wishlist" className={`${icon} hidden md:grid`} aria-label={`Wishlist (${wishlist.size})`}>
            <Heart className="size-[18px]" aria-hidden />
            {wishlist.size ? <CountBadge n={wishlist.size} /> : null}
          </Link>
          <Link href={accountHref} className={`${icon} hidden md:grid`} aria-label="Account">
            <User className="size-[18px]" aria-hidden />
          </Link>
          <MiniCart
            count={cartCount}
            className={`${icon} ${tabBar ? "hidden md:grid" : ""}`}
            footer={cart ? <MiniCartFooter cart={cart} currency={ctx.currency} priced={priced} /> : null}
          >
            <MiniCartBody cart={cart ?? emptyCart} currency={ctx.currency} priced={priced} />
          </MiniCart>
        </div>
      </HeaderFrame>
      {tabBar ? <MobileTabBar cartCount={cartCount} wishlistCount={wishlist.size} accountHref={accountHref} /> : null}
    </>
  );
}
