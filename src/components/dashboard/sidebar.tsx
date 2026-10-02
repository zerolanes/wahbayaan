"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NavGroup } from "./nav-types";

/** Neutral dashboard sidebar shared by the company admin and the artisan dashboard. */
export function DashboardSidebar({ groups, label, footer }: { groups: NavGroup[]; label: string; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[#e5e5e5] px-5">
        <Link href="/" className="text-[15px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
          Wahbayaan
        </Link>
        <span className="rounded-md border border-[#e5e5e5] bg-[#fafafa] px-1.5 py-px text-[11px] font-medium text-[#737373]">{label}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-none">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-[#737373] uppercase">{g.label}</p>
            <ul className="space-y-px">
              {g.items.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors",
                        active ? "bg-[#f0f0f0] font-medium text-[#0a0a0a]" : "text-[#525252] hover:bg-[#f5f5f5] hover:text-[#0a0a0a]",
                      )}
                    >
                      <span className={cn("grid size-4 shrink-0 place-items-center [&>svg]:size-4 [&>svg]:stroke-[1.75]", active ? "text-[#0a0a0a]" : "text-[#737373]")}>{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="min-w-5 rounded-full border border-[#e5e5e5] bg-white px-1.5 text-center text-[11px] leading-4 font-medium text-[#404040] tabular-nums">{item.badge}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {footer ? <div className="border-t border-[#e5e5e5] p-4">{footer}</div> : null}
    </nav>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-2.5 left-3 z-40 grid size-9 place-items-center rounded-md border border-[#e5e5e5] bg-white text-[#404040] lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-4" />
      </button>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-[#e5e5e5] bg-white lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-[#e5e5e5] bg-white">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-[#737373] hover:bg-[#f5f5f5]" aria-label="Close navigation">
              <X className="size-4" />
            </button>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
