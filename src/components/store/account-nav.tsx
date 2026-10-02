"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Heart, LayoutDashboard, LifeBuoy, MapPin, MessageCircle, Package, PenTool, Settings } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/disputes", label: "Cases", icon: LifeBuoy },
  { href: "/account/requests", label: "Commissions", icon: PenTool },
  { href: "/account/messages", label: "Messages", icon: MessageCircle },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/referrals", label: "Refer a friend", icon: Gift },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

export function AccountNav({ badges }: { badges?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 py-1 scrollbar-none sm:mx-0 sm:px-0 lg:rounded-[var(--radius-panel)] lg:bg-sand-50 lg:p-2 lg:shadow-[0_0_0_0.5px_rgb(34_26_19/0.1)]">
      <ul className="flex gap-1.5 lg:flex-col lg:gap-0.5">
        {ITEMS.map((i) => {
          const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
          const badge = badges?.[i.href];
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "pressable flex min-h-10 items-center gap-2.5 rounded-full px-4 py-2 text-sm lg:rounded-[0.875rem] lg:px-3 lg:py-2.5",
                  active
                    ? "bg-indigo-900 font-medium text-sand-50 shadow-soft"
                    : "bg-white text-umber-800 shadow-[0_0_0_0.5px_rgb(34_26_19/0.14)] hover:text-umber-900 lg:bg-transparent lg:shadow-none lg:hover:bg-umber-900/[0.05]",
                )}
              >
                <i.icon className={cn("size-4", active ? "text-gold-300" : "text-umber-600")} aria-hidden />
                {i.label}
                {badge ? <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-terracotta-600 px-1.5 text-[11px] font-semibold text-white">{badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
