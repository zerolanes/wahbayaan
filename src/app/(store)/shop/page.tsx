import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CatalogBrowser } from "@/components/store/catalog-browser";
import { isSvg } from "@/components/store/illustration-tag";
import { Eyebrow } from "@/components/store/page-hero";
import { TrustBadges } from "@/components/store/trust";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { getPublicCategories, getPublicVendors } from "@/lib/queries/catalog";
import { parseShopQuery, shopHref } from "@/lib/shop-params";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Shop handmade heritage craft",
  description:
    "Browse calligraphy, hand-knotted rugs, Taxila stone, blue pottery, truck art and Khewra salt from verified Pakistani artisans — with shipping and import costs shown before you pay.",
};

export default async function ShopPage(props: PageProps<"/shop">) {
  const query = parseShopQuery(await props.searchParams);
  const [categories, vendors] = await Promise.all([getPublicCategories(), getPublicVendors()]);
  const total = categories.reduce((a, c) => a + c.productCount, 0);

  return (
    <>
      <section className="pt-8 md:pt-12">
        <Container>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
          <div className="mt-8 grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="animate-fade-up">
              <Eyebrow>The collection</Eyebrow>
              <h1 className="mt-3 font-display text-5xl leading-[1.02] text-umber-900 md:text-7xl">Shop every craft</h1>
              <p className="mt-5 max-w-2xl text-lg text-pretty text-umber-600">
                Every piece is handmade by a verified artisan in Pakistan and priced in your currency — with shipping and import costs itemised before you
                pay.
              </p>
            </div>
            <dl className="flex gap-8 text-sm md:text-right">
              <div>
                <dt className="text-umber-500">Pieces</dt>
                <dd className="font-display text-3xl text-umber-900 tabular-nums">{total}</dd>
              </div>
              <div>
                <dt className="text-umber-500">Artisans</dt>
                <dd className="font-display text-3xl text-umber-900 tabular-nums">{vendors.length}</dd>
              </div>
              <div>
                <dt className="text-umber-500">Crafts</dt>
                <dd className="font-display text-3xl text-umber-900 tabular-nums">{categories.length}</dd>
              </div>
            </dl>
          </div>

          <nav aria-label="Crafts" className="-mx-4 mt-10 overflow-x-auto px-4 pb-2 scrollbar-none sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            <ul className="flex snap-x gap-4 lg:grid lg:grid-cols-8">
              {categories.map((c) => {
                const active = query.category === c.slug;
                return (
                  <li key={c.slug} className="shrink-0 snap-start">
                    <Link href={shopHref("/shop", query, { category: active ? undefined : c.slug })} scroll={false} className="group block w-32 md:w-36 lg:w-auto" aria-current={active ? "true" : undefined}>
                      <span
                        className={cn(
                          "relative block aspect-[4/5] overflow-hidden rounded-2xl ring-offset-2 ring-offset-parchment transition",
                          active ? "ring-2 ring-indigo-900" : "ring-1 ring-umber-200/70",
                        )}
                      >
                        <Image
                          src={c.coverImageUrl!}
                          alt=""
                          fill
                          sizes="150px"
                          unoptimized={isSvg(c.coverImageUrl)}
                          className="object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-105"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-indigo-950/60 via-transparent to-transparent" />
                        <span className="absolute bottom-2 left-2.5 text-[11px] font-medium text-sand-50/90 tabular-nums">{c.productCount}</span>
                      </span>
                      <span className={cn("mt-2 block text-sm leading-snug", active ? "font-semibold text-umber-900" : "text-umber-700 group-hover:text-umber-900")}>{c.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Container>
      </section>

      <Container className="mt-10 md:mt-14">
        <CatalogBrowser basePath="/shop" query={query} />
      </Container>

      <Container className="mt-24">
        <TrustBadges />
      </Container>
    </>
  );
}
