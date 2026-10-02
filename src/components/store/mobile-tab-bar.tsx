"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { CountBadge } from "./mini-cart";

/**
 * Phone-only bottom tab bar (hidden from md up): the five places a buyer goes
 * most, within thumb reach. A floating glass capsule above the home indicator.
 * Hidden during checkout so the payment step stays calm and focused.
 */
export function MobileTabBar({ cartCount, wishlistCount, accountHref }: { cartCount: number; wishlistCount: number; accountHref: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/checkout")) return null;
  const tabs = [
    { href: "/", label: "Home", icon: Home, active: pathname === "/" },
    { href: "/shop", label: "Shop", icon: LayoutGrid, active: pathname.startsWith("/shop") || pathname.startsWith("/category") || pathname.startsWith("/collections") },
    { href: "/wishlist", label: "Saved", icon: Heart, active: pathname.startsWith("/wishlist"), badge: wishlistCount },
    { href: "/cart", label: "Bag", icon: ShoppingBag, active: pathname.startsWith("/cart"), badge: cartCount },
    {
      href: accountHref,
      label: "Account",
      icon: User,
      active: pathname.startsWith("/account") || pathname === "/login" || pathname === "/register",
    },
  ];
  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      data-tab-bar
    >
      <ul className="glass-thick mx-auto flex max-w-md items-stretch justify-between rounded-full p-1 [--glass-shadow:var(--shadow-lift)]">
        {tabs.map((t) => (
          <li key={t.label} className="flex-1">
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "pressable relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium",
                t.active ? "bg-umber-900/[0.07] text-terracotta-700" : "text-umber-800",
              )}
            >
              <span className="relative">
                <t.icon className={cn("size-[22px]", t.active && "stroke-[2.25]")} aria-hidden />
                {t.badge ? <CountBadge n={t.badge} className="-top-1.5 -right-2.5" /> : null}
              </span>
              {t.label}
              {t.badge ? <span className="sr-only">({t.badge})</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
