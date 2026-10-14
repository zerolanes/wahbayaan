"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import s from "./home.module.css";

/**
 * A tab's content is either `panel` (rendered on the server with the page) or
 * `load` (a bound server action that renders it on first open — or on hover /
 * focus of its tab, so it is usually ready by the time it is clicked).
 */
export type Tab = { id: string; label: string; count?: number; panel?: ReactNode; load?: () => Promise<ReactNode> };

/**
 * Accessible tabs (WAI-ARIA tabs pattern: arrow keys, Home/End, roving
 * tabindex). The strip scrolls sideways on phones.
 */
export function Tabs({ tabs, label, className, align = "left" }: { tabs: Tab[]; label: string; className?: string; align?: "left" | "center" }) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, ReactNode | "error">>({});
  const pending = useRef(new Set<string>());
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const prefetch = useCallback(
    (t: Tab) => {
      if (t.panel !== undefined || !t.load || pending.current.has(t.id)) return;
      pending.current.add(t.id);
      t.load().then(
        (node) => setLoaded((m) => ({ ...m, [t.id]: node })),
        () => {
          pending.current.delete(t.id);
          setLoaded((m) => ({ ...m, [t.id]: "error" }));
        },
      );
    },
    [],
  );

  const select = (i: number) => {
    setActive(i);
    prefetch(tabs[i]);
  };
  const focus = (i: number) => {
    const next = (i + tabs.length) % tabs.length;
    select(next);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div className={cn(s.rail, "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0")}>
        <div role="tablist" aria-label={label} className={cn("flex w-max gap-1 rounded-full bg-[var(--wb-ink)]/[0.05] p-1", align === "center" && "sm:mx-auto")}>
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
                onClick={() => select(i)}
                onPointerEnter={() => prefetch(t)}
                onFocus={() => prefetch(t)}
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
                  on ? "bg-white text-[var(--wb-ink)] shadow-[0_1px_2px_rgb(34_26_19/0.08),0_0_0_0.5px_rgb(34_26_19/0.08)]" : "text-[var(--wb-muted)] hover:text-[var(--wb-ink)]",
                )}
              >
                {t.label}
                {t.count != null ? <span className="ml-1.5 text-xs text-[var(--wb-muted)] tabular-nums">{t.count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t, i) => {
        const content = t.panel !== undefined ? t.panel : loaded[t.id];
        return (
          <div
            key={t.id}
            id={`${base}-panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`${base}-tab-${t.id}`}
            aria-busy={content === undefined && i === active ? true : undefined}
            hidden={i !== active}
            tabIndex={0}
            className="mt-8 focus-visible:outline-offset-4"
          >
            {content === "error" ? (
              <p className="py-10 text-center text-sm text-[var(--wb-muted)]">This list didn&apos;t load. Please try again.</p>
            ) : content === undefined ? (
              // Holds the grid's height while the tab loads, so the page doesn't jump.
              <div className="grid min-h-[30rem] grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-5" aria-hidden>
                {Array.from({ length: 5 }, (_, k) => (
                  <div key={k} className={cn("aspect-[4/5] animate-pulse rounded-[var(--radius-card)] bg-[var(--wb-ink)]/[0.05] motion-reduce:animate-none", k >= 2 && "max-md:hidden", k >= 3 && "md:max-lg:hidden")} />
                ))}
              </div>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}
