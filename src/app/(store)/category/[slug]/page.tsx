import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, PackageCheck, Sparkles, Truck } from "lucide-react";
import { ScallopDivider } from "@/components/brand/logo";
import { ArtisanStoryCard } from "@/components/store/artisan-card";
import { ArtisanFeatureCard } from "@/components/store/artisan-feature";
import { CatalogBrowser } from "@/components/store/catalog-browser";
import { IllustrationTag, isSvg } from "@/components/store/illustration-tag";
import { JournalCard } from "@/components/store/journal-card";
import { Eyebrow } from "@/components/store/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, SectionHeading } from "@/components/ui/misc";
import { getFacets, getPublicCategory } from "@/lib/queries/catalog";
import { getArtisansForCategory, getJournalPosts } from "@/lib/queries/storefront";
import { parseShopQuery } from "@/lib/shop-params";
import { REGION_LABELS } from "@/lib/utils/format";

export async function generateMetadata(props: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = await getPublicCategory(slug);
  if (!c) return { title: "Craft not found" };
  return {
    title: c.name,
    description: c.description ?? c.tagline ?? undefined,
    openGraph: { title: `${c.name} — handmade in Pakistan`, description: c.tagline ?? undefined, images: c.coverImageUrl ? [c.coverImageUrl] : undefined },
  };
}

export default async function CategoryPage(props: PageProps<"/category/[slug]">) {
  const { slug } = await props.params;
  const category = await getPublicCategory(slug);
  if (!category) notFound();
  const query = parseShopQuery(await props.searchParams);
  const [artisans, posts, facets] = await Promise.all([getArtisansForCategory(category.id), getJournalPosts(), getFacets(category.slug)]);
  const related = posts.filter((p) => p.categoryId === category.id);
  const regions = facets.regions.map((r) => REGION_LABELS[r.value] ?? r.value);

  return (
    <>
      <section className="relative isolate flex min-h-[78svh] items-end overflow-hidden bg-indigo-950 md:min-h-[82vh]">
        <Image
          src={category.coverImageUrl!}
          alt=""
          fill
          priority
          sizes="100vw"
          unoptimized={isSvg(category.coverImageUrl)}
          className="-z-10 animate-[fade-up_1.4s_var(--ease-out-expo)_both] object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-indigo-950 via-indigo-950/55 to-indigo-950/10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-950/70 via-transparent to-transparent" />
        <Container className="pt-28 pb-14 md:pb-20">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: category.name }]}
            className="mb-10 text-sand-200/70 [&_a:hover]:text-sand-50 [&_span[aria-current]]:text-sand-50"
          />
          <div className="max-w-3xl animate-fade-up">
            <p className="text-xs font-semibold tracking-[0.28em] text-gold-300 uppercase">
              Craft · {category.productCount} {category.productCount === 1 ? "piece" : "pieces"} · {artisans.length} {artisans.length === 1 ? "artisan" : "artisans"}
            </p>
            <h1 className="mt-4 font-display text-6xl leading-[0.98] text-balance text-sand-50 md:text-8xl">{category.name}</h1>
            {category.tagline ? <p className="mt-5 text-xl text-pretty text-sand-100/85 md:text-2xl">{category.tagline}</p> : null}
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="#pieces" variant="gold" size="lg">
                Browse the pieces
              </ButtonLink>
              {artisans.length ? (
                <ButtonLink href="#artisans" variant="light" size="lg">
                  Meet the artisans
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </Container>
        {category.coverKind === "illustration" ? <IllustrationTag className="absolute right-4 bottom-4 md:right-8 md:bottom-6" label="Illustration — real photography coming soon" /> : null}
      </section>
      <ScallopDivider className="-mt-px" />

      {category.description ? (
        <section className="py-16 md:py-24">
          <Container className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
            <div>
              <Eyebrow>About the craft</Eyebrow>
              <p className="mt-5 font-display text-3xl leading-[1.25] text-pretty text-umber-900 md:text-[2.6rem] md:leading-[1.2]">{category.description}</p>
            </div>
            <ul className="grid content-start gap-4 self-end">
              <li className="flex gap-4 rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
                <PackageCheck className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                <div>
                  <p className="font-semibold text-umber-900">
                    {facets.readyToShip} ready to ship · {facets.madeToOrder} made to order
                  </p>
                  <p className="mt-0.5 text-sm text-umber-600">Every listing shows its dispatch or making time.</p>
                </div>
              </li>
              {regions.length ? (
                <li className="flex gap-4 rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                  <div>
                    <p className="font-semibold text-umber-900">Made in {regions.join(", ")}</p>
                    <p className="mt-0.5 text-sm text-umber-600">Workshops visited and verified by our team.</p>
                  </div>
                </li>
              ) : null}
              <li className="flex gap-4 rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
                <Truck className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                <div>
                  <p className="font-semibold text-umber-900">Landed cost before you pay</p>
                  <p className="mt-0.5 text-sm text-umber-600">
                    Shipping, duty and tax itemised for your country.{" "}
                    <Link href="/how-importing-works" className="text-terracotta-600 underline-offset-4 hover:underline">
                      How importing works
                    </Link>
                  </p>
                </div>
              </li>
              {related[0] ? (
                <li>
                  <Link href={`/journal/${related[0].slug}`} className="group flex items-center gap-4 rounded-2xl bg-indigo-950 p-5 text-sand-50 transition hover:bg-indigo-900">
                    <Sparkles className="size-5 shrink-0 text-gold-300" aria-hidden />
                    <span className="flex-1">
                      <span className="block text-xs tracking-[0.18em] text-gold-300 uppercase">From the journal</span>
                      <span className="font-display text-lg">{related[0].title}</span>
                    </span>
                    <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ) : null}
            </ul>
          </Container>
        </section>
      ) : null}

      <section id="pieces" className="scroll-mt-20">
        <Container>
          <SectionHeading eyebrow="The pieces" title={`${category.name}, handmade`} className="mb-10" />
          <CatalogBrowser basePath={`/category/${category.slug}`} query={query} lockCategory={{ slug: category.slug, name: category.name }} />
        </Container>
      </section>

      {artisans.length ? (
        <section id="artisans" className="night relative mt-24 scroll-mt-16 py-20 md:py-28">
          <Container>
            <SectionHeading
              dark
              eyebrow="Meet the artisans of this craft"
              title="The hands behind the work"
              description="Every artisan is verified by our team — identity, workshop and sample work — before a single piece is listed."
              action={
                <ButtonLink href="/artisans" variant="light">
                  All artisans
                </ButtonLink>
              }
            />
            {artisans.length <= 2 ? (
              <div className="mt-12 grid gap-6">
                {artisans.map((v) => (
                  <ArtisanFeatureCard key={v.id} vendor={v} tone="dark" />
                ))}
              </div>
            ) : (
              <div className="-mx-4 mt-12 flex snap-x gap-5 overflow-x-auto px-4 pb-4 scrollbar-none sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
                {artisans.map((v) => (
                  <ArtisanStoryCard key={v.id} vendor={v} variant="feature" className="w-[82vw] max-w-sm shrink-0 snap-start md:w-auto md:max-w-none" />
                ))}
              </div>
            )}
          </Container>
        </section>
      ) : null}

      {related.length ? (
        <section className="py-20 md:py-28">
          <Container>
            <SectionHeading
              eyebrow="Heritage journal"
              title="Read about the craft"
              action={
                <ButtonLink href="/journal" variant="outline">
                  All stories
                </ButtonLink>
              }
            />
            <div className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <JournalCard key={p.id} post={p} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
