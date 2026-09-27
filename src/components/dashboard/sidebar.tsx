"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils/cn";
import type { NavGroup } from "./nav-types";

export function DashboardSidebar({ groups, label, footer }: { groups: NavGroup[]; label: string; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <Logo tone="light" compact href="/" />
      </div>
      <p className="px-5 pt-4 text-[10px] font-semibold tracking-[0.25em] text-gold-300/80 uppercase">{label}</p>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-none">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-2 pb-1.5 text-[11px] font-medium tracking-wider text-sand-200/40 uppercase">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] transition",
                        active ? "bg-gold-400/15 text-gold-100 ring-1 ring-gold-400/30" : "text-sand-200/70 hover:bg-white/5 hover:text-sand-50",
                      )}
                    >
                      <span className={cn("grid size-4 shrink-0 place-items-center [&>svg]:size-4", active ? "text-gold-300" : "opacity-70")}>{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? <span className="rounded-full bg-terracotta-500 px-1.5 text-[10px] leading-4 font-semibold text-white">{item.badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {footer ? <div className="border-t border-white/10 p-4">{footer}</div> : null}
    </nav>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed top-3 left-3 z-40 grid size-10 place-items-center rounded-full bg-indigo-950 text-sand-50 shadow-lift lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <aside className="night fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="night absolute inset-y-0 left-0 w-72">{nav}</aside>
        </div>
      ) : null}
    </>
  );
}
