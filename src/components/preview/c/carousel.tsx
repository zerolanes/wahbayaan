"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import s from "./pc.module.css";

/**
 * Scroll-snap carousel over server-rendered items. Native swipe/scroll, plus
 * previous / next buttons that are disabled at either end. Respects reduced
 * motion (instant jumps instead of smooth scrolling).
 */
export function PcCarousel({ items, label, itemClassName, className, bleed = true }: { items: ReactNode[]; label: string; itemClassName: string; className?: string; bleed?: boolean }) {
  const rail = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = rail.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const first = el.querySelector("li");
    const w = first ? first.getBoundingClientRect().width + 16 : el.clientWidth;
    const per = Math.max(1, Math.floor(el.clientWidth / w));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * w * per, behavior: reduce ? "auto" : "smooth" });
  };

  const btn =
    "pressable grid size-11 place-items-center rounded-full bg-white text-[var(--pc-ink)] shadow-[0_0_0_1px_var(--pc-line),0_2px_6px_-2px_rgb(34_26_19/0.15)] hover:shadow-[0_0_0_1px_rgb(34_26_19/0.2)] disabled:opacity-40 disabled:shadow-none";

  return (
    <div className={className} role="region" aria-roledescription="carousel" aria-label={label}>
      <ul ref={rail} onScroll={measure} className={cn(s.rail, "flex snap-x snap-mandatory gap-4 overflow-x-auto pt-2 pb-1", bleed && "-mx-4 scroll-px-4 px-4 sm:mx-0 sm:scroll-px-0 sm:px-0")}>
        {items.map((item, i) => (
          <li key={i} className={cn("shrink-0 snap-start", itemClassName)} aria-label={`${i + 1} of ${items.length}`} aria-roledescription="slide">
            {item}
          </li>
        ))}
      </ul>
      {!(edge.start && edge.end) ? (
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btn} onClick={() => step(-1)} disabled={edge.start} aria-label="Previous">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" className={btn} onClick={() => step(1)} disabled={edge.end} aria-label="Next">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
