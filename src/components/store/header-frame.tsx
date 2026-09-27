"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Sticky header chrome. On the 3D homepage it floats transparently over the
 * scene and turns into a frosted parchment bar once you scroll.
 */
export function HeaderFrame({ overlay, children }: { overlay: boolean; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(overlay);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      // On the 3D homepage stay dark glass until the parchment sections begin.
      const after = overlay ? document.getElementById("after-tour") : null;
      setOverDark(!!after && after.getBoundingClientRect().top > 64);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);
  const transparent = overlay && !scrolled;
  const glass = overlay && scrolled && overDark;
  return (
    <header
      className={cn(
        "top-0 z-50 transition-[background-color,color,box-shadow,backdrop-filter] duration-500",
        overlay ? "fixed inset-x-0" : "sticky",
        transparent
          ? "bg-transparent text-sand-50"
          : glass
            ? "border-b border-white/10 bg-indigo-950/45 text-sand-50 backdrop-blur-xl"
            : "border-b border-umber-200/50 bg-parchment/85 text-umber-900 shadow-[0_1px_0_rgb(34_26_19/0.03)] backdrop-blur-xl",
      )}
    >
      <div className="relative mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-10">{children}</div>
    </header>
  );
}
