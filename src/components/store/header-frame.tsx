"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Sticky header chrome: a floating glass capsule inset from the page edges, with
 * content scrolling underneath. It sits flush and quiet at the top of the page
 * and lifts (deeper shadow, slightly smaller) once you scroll. On the haveli
 * walk-through it is dark glass over the 3D scene until the sand sections begin.
 */
export function HeaderFrame({ overlay, children }: { overlay: boolean; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(overlay);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      const after = overlay ? document.getElementById("after-tour") : null;
      setOverDark(!!after && after.getBoundingClientRect().top > 64);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);
  const dark = overlay && overDark;
  return (
    <header className={cn("pointer-events-none top-0 z-50 px-2 pt-2 sm:px-4 sm:pt-3", overlay ? "fixed inset-x-0" : "sticky")}>
      <div
        data-scrolled={scrolled || undefined}
        className={cn(
          "pointer-events-auto relative mx-auto flex h-14 max-w-[1400px] items-center justify-between rounded-full pr-2 pl-2 transition-[box-shadow,background-color,color] duration-[var(--dur-base)] sm:pr-3 sm:pl-3 lg:h-[3.75rem] lg:pl-4",
          dark ? "glass-dark" : "glass text-umber-900",
          scrolled && "[--glass-shadow:var(--shadow-lift)]",
        )}
      >
        {children}
      </div>
    </header>
  );
}
