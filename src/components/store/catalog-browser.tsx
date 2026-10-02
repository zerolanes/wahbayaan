import Form from "next/form";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { getFacets, getPublicCategories, getPublicProducts } from "@/lib/queries/catalog";
import {
  activeChips,
  AVAILABILITY_LABELS,
  capitalize,
  clearFiltersHref,
  pageCount,
  priceBands,
  shopHref,
  SORTS,
  toProductFilters,
  type ShopQuery,
} from "@/lib/shop-params";
import { cn } from "@/lib/utils/cn";
import { REGION_LABELS, pluralize } from "@/lib/utils/format";
import { AutoSubmitSelect, DrawerClose, DrawerScrollReset } from "./filter-controls";
import { ProductGrid } from "./product-grid";

type Option = { label: string; href: string; active: boolean; count?: number };

function OptionList({ options }: { options: Option[] }) {
  return (
    <ul className="space-y-0.5">
      {options.map((o) => (
        <li key={o.href + o.label}>
          <Link
            href={o.href}
            scroll={false}
            aria-current={o.active ? "true" : undefined}
            className={cn(
              "group flex min-h-10 items-center gap-3 rounded-[0.75rem] px-2.5 py-1.5 text-[0.95rem] transition-colors lg:min-h-0 lg:text-sm",
              o.active ? "bg-umber-900/[0.06] font-semibold text-umber-900" : "text-umber-700 hover:bg-umber-900/[0.04] hover:text-umber-900",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-[18px] shrink-0 place-items-center rounded-full border transition lg:size-4",
                o.active ? "border-indigo-900 bg-indigo-900" : "border-umber-300 group-hover:border-umber-500",
              )}
            >
              {o.active ? <span className="size-1.5 rounded-full bg-sand-50" /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.count != null ? <span className="text-xs text-umber-600 tabular-nums">{o.count}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FilterGroup({ title, children, collapsible, defaultOpen = true }: { title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  if (collapsible)
    return (
      <details open={defaultOpen} className="group/fg border-t border-umber-900/[0.08] py-5 first:border-t-0 first:pt-0">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between rounded-md text-xs font-semibold tracking-[0.06em] text-umber-700 uppercase [&::-webkit-details-marker]:hidden">
          {title}
          <span aria-hidden className="text-base text-umber-600 transition-transform duration-[var(--dur-quick)] group-open/fg:rotate-45">+</span>
        </summary>
        <div className="mt-3">{children}</div>
      </details>
    );
  return (
    <div className="border-t border-umber-900/[0.08] py-5 first:border-t-0 first:pt-0">
      <p className="mb-3 text-xs font-semibold tracking-[0.06em] text-umber-700 uppercase">{title}</p>
      {children}
    </div>
  );
}

/**
 * The browsing surface shared by /shop and /category/[slug]: filter sidebar
 * (a drawer on mobile), active-filter chips, sort, result count, grid and
 * pagination. Every control is a link or GET form — no JavaScript required.
 */
export async function CatalogBrowser({ basePath, query, lockCategory }: { basePath: string; query: ShopQuery; lockCategory?: { slug: string; name: string } }) {
  const ctx = await getBuyerContext();
  const effective: ShopQuery = lockCategory ? { ...query, category: lockCategory.slug } : query;
  const [categories, facets, result] = await Promise.all([
    getPublicCategories(),
    getFacets(effective.category),
    getPublicProducts(toProductFilters(effective, ctx)),
  ]);
  const href = (patch: Parameters<typeof shopHref>[2]) => shopHref(basePath, query, patch);
  const toggle = <K extends keyof ShopQuery>(key: K, value: ShopQuery[K]) => href({ [key]: query[key] === value ? undefined : (value as string) });
  const chips = activeChips(basePath, query, { currency: ctx.currency, categories });
  const pages = pageCount(result.total);
  const materials = facets.materials.slice(0, 14);

  const panel = (
    <nav aria-label="Filters">
      {!lockCategory ? (
        <FilterGroup title="Craft">
          <OptionList
            options={[
              { label: "All crafts", href: href({ category: undefined }), active: !query.category },
              ...categories.map((c) => ({ label: c.name, href: toggle("category", c.slug), active: query.category === c.slug, count: c.productCount })),
            ]}
          />
        </FilterGroup>
      ) : null}
      <FilterGroup title="Availability">
        <OptionList
          options={(["ready_to_ship", "made_to_order"] as const).map((a) => ({
            label: AVAILABILITY_LABELS[a],
            href: toggle("availability", a),
            active: query.availability === a,
            count: a === "ready_to_ship" ? facets.readyToShip : facets.madeToOrder,
          }))}
        />
        <div className="mt-2 border-t border-umber-900/[0.08] pt-2">
          <OptionList options={[{ label: "Customizable — make it yours", href: toggle("customizable", true), active: !!query.customizable }]} />
        </div>
      </FilterGroup>
      <FilterGroup title={`Price (${ctx.currency})`}>
        {ctx.fx ? (
          <OptionList options={priceBands(ctx.currency).map((b) => ({ label: b.label, href: toggle("price", b.id), active: query.price === b.id }))} />
        ) : (
          <p className="text-sm text-umber-600">Price filters appear once exchange rates are set.</p>
        )}
      </FilterGroup>
      {facets.regions.length ? (
        <FilterGroup title="Region of Pakistan" collapsible>
          <OptionList
            options={facets.regions.map((r) => ({ label: REGION_LABELS[r.value] ?? r.value, href: toggle("region", r.value), active: query.region === r.value, count: r.count }))}
          />
        </FilterGroup>
      ) : null}
      {materials.length ? (
        <FilterGroup title="Material" collapsible>
          <OptionList options={materials.map((m) => ({ label: capitalize(m.value), href: toggle("material", m.value), active: query.material === m.value, count: m.count }))} />
        </FilterGroup>
      ) : null}
    </nav>
  );

  const hidden = Object.entries({ ...query, sort: undefined, page: undefined }).filter(([, v]) => v != null && v !== "" && v !== false);

  return (
    <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-16">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-3 pb-8 scrollbar-none">{panel}</div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-3">
            <details className="details-sheet lg:hidden">
              <summary className="pressable inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-umber-900 shadow-[inset_0_0_0_1px_rgb(34_26_19/0.16)] [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters{chips.length ? <span className="grid size-5 place-items-center rounded-full bg-indigo-900 text-[11px] text-sand-50">{chips.length}</span> : null}
              </summary>
              <DrawerScrollReset />
              <DrawerClose href={shopHref(basePath, query)} className="details-sheet-scrim fixed inset-0 z-[89] block bg-[var(--scrim)]" aria-hidden tabIndex={-1} />
              <div
                className="details-sheet-panel glass-thick fixed inset-x-0 bottom-0 z-[90] flex max-h-[88dvh] flex-col rounded-t-[var(--radius-sheet)] pb-[env(safe-area-inset-bottom)]"
                role="dialog"
                aria-label="Filters"
              >
                <span className="sheet-grabber shrink-0" aria-hidden />
                <div className="flex items-center justify-between px-5 pt-3 pb-2">
                  <p className="text-xl font-semibold tracking-[-0.02em] text-umber-900">Filters</p>
                  <DrawerClose href={shopHref(basePath, query)} icon className="pressable grid size-10 place-items-center rounded-full bg-umber-900/[0.07] text-umber-800">
                    <span className="sr-only">Close filters</span>
                  </DrawerClose>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">{panel}</div>
                <div className="flex gap-3 border-t border-umber-900/[0.08] px-5 py-4">
                  {chips.length ? (
                    <Link href={clearFiltersHref(basePath, query)} className="pressable inline-flex h-12 items-center rounded-full px-4 text-sm font-medium text-umber-800 hover:bg-umber-900/[0.06]">
                      Clear all
                    </Link>
                  ) : null}
                  <DrawerClose
                    href={shopHref(basePath, query)}
                    className="pressable inline-flex h-12 flex-1 items-center justify-center rounded-full bg-indigo-900 text-sm font-medium text-sand-50 shadow-soft"
                  >
                    Show {pluralize(result.total, "piece")}
                  </DrawerClose>
                </div>
              </div>
            </details>
            <p className="text-sm text-umber-700" aria-live="polite">
              <strong className="font-semibold text-umber-900 tabular-nums">{result.total.toLocaleString("en-US")}</strong> {result.total === 1 ? "piece" : "pieces"}
              {pages > 1 ? <span className="text-umber-600"> · page {query.page} of {pages}</span> : null}
            </p>
          </div>
          <Form action={basePath} className="flex items-center gap-2">
            {hidden.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={k === "customizable" ? "1" : String(v)} />
            ))}
            <label htmlFor="sort" className="text-sm text-umber-700 max-sm:sr-only">
              Sort
            </label>
            <AutoSubmitSelect
              id="sort"
              name="sort"
              defaultValue={query.sort}
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </AutoSubmitSelect>
            <noscript>
              <button type="submit" className="h-10 rounded-full bg-indigo-900 px-4 text-sm text-sand-50">
                Sort
              </button>
            </noscript>
          </Form>
        </div>

        {chips.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                scroll={false}
                className="pressable group inline-flex h-8 items-center gap-1.5 rounded-full bg-indigo-900 pr-2 pl-3 text-xs font-medium text-sand-50 hover:bg-indigo-800"
              >
                {c.label}
                <X className="size-3.5 opacity-70 group-hover:opacity-100" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </Link>
            ))}
            <Link href={clearFiltersHref(basePath, query)} scroll={false} className="ml-1 inline-flex h-8 items-center px-1 text-xs font-medium text-terracotta-700 hover:underline">
              Clear all
            </Link>
          </div>
        ) : null}

        <div className="mt-6">
          {result.items.length ? (
            <ProductGrid products={result.items} priorityCount={3} />
          ) : (
            <EmptyState
              title={chips.length ? "No pieces match these filters" : "Nothing listed here yet"}
              action={
                chips.length ? (
                  <ButtonLink href={clearFiltersHref(basePath, query)} variant="outline">
                    Clear filters
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/custom" variant="outline">
                    Commission a piece instead
                  </ButtonLink>
                )
              }
            >
              {chips.length
                ? "Try removing a filter — or ask an artisan to make exactly what you have in mind."
                : "New pieces are added as artisans are verified. You can also commission something made for you."}
            </EmptyState>
          )}
        </div>

        <Pagination className="mt-16" page={query.page} pageCount={pages} hrefFor={(p) => shopHref(basePath, query, { page: p })} />
      </div>
    </div>
  );
}
