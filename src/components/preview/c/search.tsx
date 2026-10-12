"use client";

import Form from "next/form";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Cat = { slug: string; name: string };

/**
 * Theme-style search: a craft selector + field, inline in the header from md up
 * and as a drop-down row on phones. GET /shop?category=&q= so it works without JS.
 * "/" and Ctrl/⌘K focus it (captured here so the shared header's dialog stays shut).
 */
export function PcSearch({ categories }: { categories: Cat[] }) {
  const [open, setOpen] = useState(false);
  const desktop = useRef<HTMLInputElement>(null);
  const mobile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        e.stopPropagation();
        if (window.matchMedia("(min-width: 768px)").matches) desktop.current?.focus();
        else {
          setOpen(true);
          requestAnimationFrame(() => mobile.current?.focus());
        }
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  return (
    <>
      <SearchForm categories={categories} inputRef={desktop} id="pc-search-d" className="hidden max-w-xl flex-1 md:flex" />
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          requestAnimationFrame(() => mobile.current?.focus());
        }}
        aria-expanded={open}
        aria-controls="pc-search-m-row"
        aria-label={open ? "Close search" : "Search"}
        className="pressable grid size-10 shrink-0 place-items-center rounded-full hover:bg-current/[0.08] md:hidden"
      >
        {open ? <X className="size-[18px]" aria-hidden /> : <Search className="size-[18px]" aria-hidden />}
      </button>
      <div id="pc-search-m-row" hidden={!open} className="absolute inset-x-0 top-[calc(100%+0.5rem)] md:hidden">
        <div className="glass-thick rounded-[1.5rem] p-2">
          <SearchForm categories={categories} inputRef={mobile} id="pc-search-m" className="flex" />
        </div>
      </div>
    </>
  );
}

function SearchForm({ categories, inputRef, id, className }: { categories: Cat[]; inputRef: React.RefObject<HTMLInputElement | null>; id: string; className?: string }) {
  return (
    <Form action="/shop" role="search" className={cn("h-11 min-w-0 items-center rounded-full bg-white shadow-[0_0_0_1px_rgb(34_26_19/0.12)] focus-within:shadow-[0_0_0_2px_var(--color-gold-600)]", className)}>
      <label htmlFor={`${id}-cat`} className="sr-only">
        Craft
      </label>
      <span className="relative flex h-full shrink-0 items-center border-r border-[var(--pc-line)]">
        <select
          id={`${id}-cat`}
          name="category"
          defaultValue=""
          className="h-full max-w-[6.5rem] appearance-none lg:max-w-[8.5rem] truncate rounded-l-full bg-transparent pr-7 pl-4 text-sm font-medium text-[var(--pc-ink)] focus:outline-none"
        >
          <option value="">All crafts</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-[var(--pc-muted)]" aria-hidden />
      </span>
      <label htmlFor={id} className="sr-only">
        Search pieces, crafts and artisans
      </label>
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        enterKeyHint="search"
        placeholder="Search pieces, makers"
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-[var(--pc-ink)] placeholder:text-[var(--pc-muted)] focus:outline-none md:text-sm"
      />
      <button type="submit" className="pressable mr-1 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--pc-ink)] text-white hover:bg-indigo-900" aria-label="Search">
        <Search className="size-4" aria-hidden />
      </button>
    </Form>
  );
}
