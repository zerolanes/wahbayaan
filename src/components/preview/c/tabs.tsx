"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import s from "./pc.module.css";

export type PcTab = { id: string; label: string; count?: number; panel: ReactNode };

/**
 * Accessible tabs over server-rendered panels (WAI-ARIA tabs pattern: arrow
 * keys, Home/End, roving tabindex). The strip scrolls sideways on phones.
 */
export function PcTabs({ tabs, label, className, align = "left" }: { tabs: PcTab[]; label: string; className?: string; align?: "left" | "center" }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focus = (i: number) => {
    const next = (i + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div className={cn(s.rail, "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0")}>
        <div role="tablist" aria-label={label} className={cn("flex w-max gap-1 rounded-full bg-[var(--pc-ink)]/[0.05] p-1", align === "center" && "sm:mx-auto")}>
          {tabs.map((t, i) => {
            const on = i === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                id={`${base}-tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`${base}-panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") focus(i + 1);
                  else if (e.key === "ArrowLeft") focus(i - 1);
                  else if (e.key === "Home") focus(0);
                  else if (e.key === "End") focus(tabs.length - 1);
                  else return;
                  e.preventDefault();
                }}
                className={cn(
                  "pressable h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap",
                  on ? "bg-white text-[var(--pc-ink)] shadow-[0_1px_2px_rgb(34_26_19/0.08),0_0_0_0.5px_rgb(34_26_19/0.08)]" : "text-[var(--pc-muted)] hover:text-[var(--pc-ink)]",
                )}
              >
                {t.label}
                {t.count != null ? <span className="ml-1.5 text-xs text-[var(--pc-muted)] tabular-nums">{t.count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} id={`${base}-panel-${t.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${t.id}`} hidden={i !== active} tabIndex={0} className="mt-8 focus-visible:outline-offset-4">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
