"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Search, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";

const SUGGESTIONS = ["Nastaliq calligraphy", "Bukhara rug", "Salt lamp", "Blue pottery", "Truck art", "Carved sideboard", "Snooker table", "Ajrak"];

/**
 * Header search: a glass dialog with a search field and a craft selector,
 * opened from the header icon, "/" or ⌘K / Ctrl+K. With a craft chosen it
 * searches within that craft on /shop; otherwise it runs the full-site search
 * (pieces, crafts and artisans).
 */
export function SearchDialog({ categories, className }: { categories: { slug: string; name: string }[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  function go(term: string) {
    const t = term.trim();
    if (category) router.push(`/shop?${new URLSearchParams({ category, ...(t ? { q: t } : {}) })}`);
    else router.push(t ? `/search?${new URLSearchParams({ q: t })}` : "/search");
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-label="Search (press /)" aria-haspopup="dialog">
        <Search className="size-[18px]" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} side="center" label="Search Wahbayaan" hideClose>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
          className="pt-4"
          role="search"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-4 shadow-[0_0_0_0.5px_rgb(34_26_19/0.14),0_1px_3px_rgb(34_26_19/0.06)] focus-within:shadow-[0_0_0_2px_var(--color-gold-500)]">
              <Search className="size-[18px] shrink-0 text-umber-600" aria-hidden />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search pieces, crafts and artisans"
                aria-label="Search"
                enterKeyHint="search"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-umber-900 placeholder:text-umber-600 focus:outline-none"
              />
              {q ? (
                <button type="button" onClick={() => setQ("")} className="grid size-6 place-items-center rounded-full bg-umber-900/10 text-umber-700" aria-label="Clear search">
                  <X className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="pressable h-11 shrink-0 rounded-full px-3 text-sm font-medium text-umber-900 hover:bg-umber-900/[0.06]">
              Cancel
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="relative inline-flex">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Craft"
                className="h-10 appearance-none rounded-full bg-umber-900/[0.06] pr-9 pl-4 text-sm font-medium text-umber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                <option value="">All crafts</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-umber-700" aria-hidden />
            </span>
            <button type="submit" className="pressable ml-auto h-10 rounded-full bg-indigo-900 px-5 text-sm font-medium text-sand-50 hover:bg-indigo-800">
              Search
            </button>
          </div>
        </form>
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-[0.08em] text-umber-700 uppercase">Popular searches</p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => go(s)} className="pressable inline-flex h-9 items-center rounded-full bg-white px-3.5 text-sm text-umber-900 shadow-[0_0_0_0.5px_rgb(34_26_19/0.14)] hover:bg-sand-50">
                  {s}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs font-semibold tracking-[0.08em] text-umber-700 uppercase">Browse by craft</p>
          <ul className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="pressable group flex min-h-10 items-center justify-between rounded-[var(--radius-control)] px-3 text-sm text-umber-900 hover:bg-umber-900/[0.06]">
                  {c.name} <ArrowRight className="size-3.5 text-umber-500 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
