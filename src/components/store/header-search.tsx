"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { SearchDialog } from "./search-dialog";
import { searchHref } from "./search-href";

type Cat = { slug: string; name: string };

const INPUT_ID = "header-search-q";

/**
 * Header craft search. From md up it is an inline craft selector + field in the
 * capsule; on phones the search icon opens the shared search dialog (suggestions,
 * crafts). "/" and Ctrl/⌘K focus the inline field when it is on screen and open
 * the dialog otherwise. Without JS the form still submits to /shop.
 */
export function HeaderSearch({ categories, buttonClassName }: { categories: Cat[]; buttonClassName: string }) {
  const router = useRouter();
  return (
    <>
      <form
        action="/shop"
        method="get"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          router.push(searchHref(String(f.get("q") ?? ""), String(f.get("category") ?? "")));
        }}
        className="hidden h-11 max-w-xl min-w-0 flex-1 items-center rounded-full bg-white shadow-[0_0_0_1px_rgb(34_26_19/0.12)] focus-within:shadow-[0_0_0_2px_var(--color-gold-600)] md:flex"
      >
        <label htmlFor={`${INPUT_ID}-cat`} className="sr-only">
          Craft
        </label>
        <span className="relative flex h-full shrink-0 items-center border-r border-[var(--wb-line)]">
          <select
            id={`${INPUT_ID}-cat`}
            name="category"
            defaultValue=""
            className="h-full max-w-[6.5rem] truncate rounded-l-full bg-transparent pr-7 pl-4 text-sm font-medium text-[var(--wb-ink)] appearance-none focus:outline-none lg:max-w-[8.5rem]"
          >
            <option value="">All crafts</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-[var(--wb-muted)]" aria-hidden />
        </span>
        <label htmlFor={INPUT_ID} className="sr-only">
          Search pieces, crafts and artisans
        </label>
        <input
          id={INPUT_ID}
          name="q"
          type="search"
          enterKeyHint="search"
          placeholder="Search pieces, makers"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[var(--wb-ink)] placeholder:text-[var(--wb-muted)] focus:outline-none"
        />
        <button type="submit" className="pressable mr-1 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--wb-ink)] text-white hover:bg-indigo-900" aria-label="Search">
          <Search className="size-4" aria-hidden />
        </button>
      </form>
      <SearchDialog categories={categories} className={buttonClassName} inlineInputId={INPUT_ID} />
    </>
  );
}
