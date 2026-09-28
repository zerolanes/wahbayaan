"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Search, X } from "lucide-react";

const SUGGESTIONS = ["Nastaliq calligraphy", "Bukhara rug", "Salt lamp", "Blue pottery", "Truck art", "Carved sideboard", "Snooker table", "Ajrak"];

/**
 * Header search: a search box with a craft selector (like the original site's
 * "Select category"), opened from the header icon, "/" or ⌘K / Ctrl+K.
 * With a craft chosen it searches within that craft on /shop; otherwise it runs
 * the full-site search (pieces, crafts and artisans).
 */
export function SearchDialog({ categories, className }: { categories: { slug: string; name: string }[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
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
      <button type="button" onClick={() => setOpen(true)} className={className} aria-label="Search (press /)">
        <Search className="size-[18px]" />
      </button>
      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Search Wahbayaan">
              <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
              <div className="relative mx-auto mt-0 w-full max-w-2xl bg-parchment p-4 shadow-lift sm:mt-20 sm:rounded-[var(--radius-card)] sm:p-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    go(q);
                  }}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <div className="flex flex-1 items-center gap-2 rounded-full border border-umber-300/70 bg-white px-4 focus-within:border-umber-900">
                    <Search className="size-4 shrink-0 text-umber-500" aria-hidden />
                    <input
                      ref={input}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search pieces, crafts and artisans"
                      aria-label="Search"
                      className="h-12 min-w-0 flex-1 bg-transparent text-umber-900 placeholder:text-umber-400 focus:outline-none"
                    />
                  </div>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Craft" className="h-12 rounded-full border border-umber-300/70 bg-white px-4 text-sm text-umber-900 focus:border-umber-900 focus:outline-none">
                    <option value="">All crafts</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="h-12 rounded-full bg-indigo-900 px-6 text-sm font-medium text-sand-50 transition hover:bg-indigo-800">
                    Search
                  </button>
                </form>
                <div className="mt-5">
                  <p className="text-xs font-semibold tracking-wide text-umber-500 uppercase">Popular searches</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <li key={s}>
                        <button type="button" onClick={() => go(s)} className="rounded-full bg-white px-3 py-1.5 text-sm text-umber-800 ring-1 ring-umber-200 transition hover:ring-umber-500">
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-xs font-semibold tracking-wide text-umber-500 uppercase">Browse by craft</p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Link href={`/category/${c.slug}`} className="group inline-flex items-center gap-1 text-sm text-umber-700 hover:text-umber-900">
                          {c.name} <ArrowRight className="size-3 opacity-0 transition group-hover:opacity-100" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="absolute top-2 right-2 grid size-8 place-items-center rounded-full text-umber-500 hover:bg-umber-900/5 sm:-top-11 sm:right-0 sm:text-sand-50 sm:hover:bg-white/10" aria-label="Close search">
                  <X className="size-4" />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
