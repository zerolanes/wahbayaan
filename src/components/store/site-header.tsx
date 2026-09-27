import Link from "next/link";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { getCartCount, getWishlistIds } from "@/lib/commerce/cart";
import { getPublicCategories } from "@/lib/queries/catalog";
import { CurrencySwitcher } from "./currency-switcher";
import { HeaderFrame } from "./header-frame";
import { MenuOverlay } from "./menu-overlay";

export async function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [ctx, user, categories] = await Promise.all([getBuyerContext(), getCurrentUser(), getPublicCategories()]);
  const [cartCount, wishlist] = await Promise.all([getCartCount(ctx.ownerKey), getWishlistIds(ctx.ownerKey)]);

  const iconLink = "relative grid size-9 place-items-center rounded-full transition hover:bg-current/10";
  const count = (n: number) =>
    n > 0 ? (
      <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-terracotta-600 px-1 text-[10px] leading-4 font-semibold text-white">
        {n}
      </span>
    ) : null;

  return (
    <HeaderFrame overlay={overlay}>
      <div className="flex items-center gap-2 lg:gap-6">
        <MenuOverlay
          categories={categories.map((c) => ({ slug: c.slug, name: c.name, tagline: c.tagline, coverImageUrl: c.coverImageUrl! }))}
          signedIn={!!user}
          isSeller={!!user?.vendorId}
          isStaff={user?.role === "staff"}
        />
        <nav className="hidden items-center gap-5 text-sm font-medium lg:flex" aria-label="Primary">
          <Link href="/shop" className="opacity-80 transition hover:opacity-100">
            Shop
          </Link>
          <Link href="/artisans" className="opacity-80 transition hover:opacity-100">
            Artisans
          </Link>
          <Link href="/how-importing-works" className="opacity-80 transition hover:opacity-100">
            How importing works
          </Link>
        </nav>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2">
        <Logo tone="current" compact />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden sm:block">
          <CurrencySwitcher destination={ctx.destination} currency={ctx.currency} currencyChosen={ctx.currencyChosen} tone="dark" />
        </div>
        <Link href="/search" className={iconLink} aria-label="Search">
          <Search className="size-[18px]" />
        </Link>
        <Link href="/wishlist" className={iconLink} aria-label={`Wishlist (${wishlist.size})`}>
          <Heart className="size-[18px]" />
          {count(wishlist.size)}
        </Link>
        <Link href={user ? (user.role === "staff" ? "/admin" : user.vendorId ? "/seller" : "/account") : "/login"} className={`${iconLink} hidden sm:grid`} aria-label="Account">
          <User className="size-[18px]" />
        </Link>
        <Link href="/cart" className={iconLink} aria-label={`Cart (${cartCount})`}>
          <ShoppingBag className="size-[18px]" />
          {count(cartCount)}
        </Link>
      </div>
    </HeaderFrame>
  );
}
