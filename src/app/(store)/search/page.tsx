import type { Metadata } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { ArtisanStoryCard } from "@/components/store/artisan-card";
import { isSvg } from "@/components/store/illustration-tag";
import { ProductGrid } from "@/components/store/product-grid";
import { ButtonLink } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/misc";
import { getPublicCategories, getPublicProducts, getPublicVendors } from "@/lib/queries/catalog";
import { pluralize } from "@/lib/utils/format";

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { q } = await props.searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  return { title: term ? `Search: ${term}` : "Search", robots: { index: false } };
}

const SUGGESTIONS = ["Nastaliq calligraphy", "Bukhara rug", "Salt lamp", "Blue pottery", "Truck art", "Ajrak", "Taxila stone", "Jharokha"];

export default async function SearchPage(props: PageProps<"/search">) {
  const sp = await props.searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const needle = q.toLowerCase();
  const [categories, vendors, products] = await Promise.all([
    getPublicCategories(),
    getPublicVendors(),
    q ? getPublicProducts({ q, limit: 24 }) : Promise.resolve({ items: [], total: 0 }),
  ]);
  const words = needle.split(/\s+/).filter(Boolean);
  const matches = (...fields: (string | null | undefined)[]) => {
    const hay = fields.filter(Boolean).join(" ").toLowerCase();
    return words.length > 0 && words.every((w) => hay.includes(w));
  };
  const catHits = q ? categories.filter((c) => matches(c.name, c.tagline, c.description)) : [];
  const artisanHits = q ? vendors.filter((v) => matches(v.displayName, v.craft, v.workshopCity, v.tagline, v.story, v.categoryName)) : [];
  const total = products.total + catHits.length + artisanHits.length;

  return (
    <>
      <section className="night">
        <Container className="py-14 md:py-20">
          <p className="text-xs font-semibold tracking-[0.25em] text-gold-300 uppercase">Search</p>
          <h1 className="mt-3 font-display text-4xl text-sand-50 md:text-6xl">{q ? <>Results for “{q}”</> : "Find a piece, a craft or a maker"}</h1>
          <Form action="/search" className="mt-8 flex max-w-3xl items-center gap-2 rounded-full bg-sand-50 p-1.5 pl-5 shadow-lift focus-within:ring-4 focus-within:ring-gold-300/40" role="search">
            <Search className="size-5 shrink-0 text-umber-600" aria-hidden />
            <label htmlFor="q" className="sr-only">
              Search Wahbayaan
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              autoFocus={!q}
              placeholder="Try “gold calligraphy”, “wool rug” or “Multan”"
              className="h-12 min-w-0 flex-1 bg-transparent text-lg text-umber-900 placeholder:text-umber-500 focus:outline-none"
            />
            <button type="submit" className="h-12 rounded-full bg-indigo-900 px-6 text-sm font-medium text-sand-50 transition hover:bg-indigo-800">
              Search
            </button>
          </Form>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-sand-200/60">Popular:</span>
            {SUGGESTIONS.map((s) => (
              <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="rounded-full bg-white/5 px-3 py-1 text-sm text-sand-100/80 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-sand-50">
                {s}
              </Link>
            ))}
          </div>
          {q ? (
            <p className="mt-8 text-sm text-sand-200/70" aria-live="polite">
              {total ? `${pluralize(products.total, "piece")}, ${pluralize(artisanHits.length, "artisan")} and ${pluralize(catHits.length, "craft")}` : "No matches"}
            </p>
          ) : null}
        </Container>
      </section>

      <Container className="py-14 md:py-20">
        {q && total === 0 ? (
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl text-umber-900">Nothing matched “{q}”</h2>
            <p className="mt-3 text-umber-600">
              Try a broader word — a material (wool, brass, schist), a place (Multan, Lahore) or a craft. Or describe what you want and an artisan can make it.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href={`/custom`} variant="accent">
                Commission it instead
              </ButtonLink>
              <ButtonLink href="/shop" variant="outline">
                Browse everything
              </ButtonLink>
            </div>
          </div>
        ) : null}

        {catHits.length ? (
          <section className="mb-16">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-umber-500 uppercase">Crafts</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {catHits.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} className="group relative aspect-[16/9] overflow-hidden rounded-2xl">
                  <Image src={c.coverImageUrl!} alt="" fill sizes="25vw" unoptimized={isSvg(c.coverImageUrl)} className="object-cover transition duration-700 group-hover:scale-105" />
                  <span className="absolute inset-0 bg-gradient-to-t from-indigo-950/85 to-transparent" />
                  <span className="absolute bottom-3 left-4">
                    <span className="block font-display text-xl text-sand-50">{c.name}</span>
                    <span className="text-xs text-sand-200/80">{pluralize(c.productCount, "piece")}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {artisanHits.length ? (
          <section className="mb-16">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-umber-500 uppercase">Artisans</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {artisanHits.slice(0, 6).map((v) => (
                <ArtisanStoryCard key={v.id} vendor={v} />
              ))}
            </div>
          </section>
        ) : null}

        {products.items.length ? (
          <section>
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xs font-semibold tracking-[0.2em] text-umber-500 uppercase">Pieces</h2>
              {products.total > products.items.length ? (
                <Link href={`/shop?q=${encodeURIComponent(q)}`} className="inline-flex items-center gap-1 text-sm font-medium text-terracotta-600 hover:underline">
                  All {products.total} in the shop <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </div>
            <ProductGrid products={products.items} columns="wide" className="mt-6" priorityCount={4} />
          </section>
        ) : null}

        {!q || total === 0 ? (
          <section className={q ? "mt-20" : undefined}>
            <SectionHeading eyebrow="Or browse by craft" title="Where would you like to start?" />
            <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              {categories.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} className="group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)]">
                  <Image src={c.coverImageUrl!} alt="" fill sizes="25vw" unoptimized={isSvg(c.coverImageUrl)} className="object-cover transition duration-700 group-hover:scale-105" />
                  <span className="absolute inset-0 bg-gradient-to-t from-indigo-950/80 to-transparent" />
                  <span className="absolute bottom-4 left-4 font-display text-xl text-sand-50">{c.name}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </>
  );
}
