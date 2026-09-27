import Image from "next/image";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowRight, BadgeCheck, Calculator, PackageOpen, ShieldCheck } from "lucide-react";
import { ScallopDivider } from "@/components/brand/logo";
import { ArtisanStoryCard } from "@/components/store/artisan-card";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductCard } from "@/components/store/product-card";
import { TrustBadges } from "@/components/store/trust";
import { HomeExperience, type HomeChapter } from "@/components/three/home/home-experience";
import type { ArtKind3d } from "@/components/three/heritage/textures";
import { ButtonLink } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { getWishlistIds } from "@/lib/commerce/cart";
import { db } from "@/lib/db/client";
import { journalPosts } from "@/lib/db/schema";
import { getPublicCategories, getPublicProducts, getPublicVendors } from "@/lib/queries/catalog";
import { getSetting, isDemoMode } from "@/lib/settings";
import { formatDate } from "@/lib/utils/format";

const KIND_BY_SLUG: Record<string, [ArtKind3d, number]> = {
  "calligraphy-art": ["calligraphy", 8],
  paintings: ["truckart", 1],
  rugs: ["rug", 4],
  "sculpture-stone": ["stone", 2],
  "wall-decor": ["pottery", 3],
  "posters-prints": ["print", 1],
  "salt-art": ["salt", 3],
  bespoke: ["wood", 1],
};
const FALLBACK_KINDS: ArtKind3d[] = ["calligraphy", "rug", "pottery", "stone", "salt", "wood", "truckart", "print", "ajrak", "tile"];

/** Pick the 3D piece for a craft: known crafts get their object; others follow their cover art. */
function pieceFor(slug: string, coverUrl: string | null, index: number): [ArtKind3d, number] {
  if (KIND_BY_SLUG[slug]) return KIND_BY_SLUG[slug];
  const m = coverUrl?.match(/^\/art\/([a-z]+)\/(\d+)/);
  if (m && FALLBACK_KINDS.includes(m[1] as ArtKind3d)) return [m[1] as ArtKind3d, Number(m[2])];
  return [FALLBACK_KINDS[index % FALLBACK_KINDS.length], index + 1];
}

const STEPS = [
  { icon: Calculator, title: "See the landed cost", text: "Item, international shipping, import duty and tax for your country — itemised before you pay." },
  { icon: ShieldCheck, title: "Pay safely, in your currency", text: "Your payment is held by Wahbayaan, not sent to the artisan, until your piece arrives." },
  { icon: PackageOpen, title: "Made, packed and exported", text: "Artisans make or pack your piece; we handle customs paperwork and the courier." },
  { icon: BadgeCheck, title: "Delivered with provenance", text: "Confirm it arrived as described. One-of-a-kind pieces come with a certificate of authenticity." },
];

export default async function HomePage() {
  const [ctx, categories, vendors, featured, home] = await Promise.all([
    getBuyerContext(),
    getPublicCategories(),
    getPublicVendors(),
    getPublicProducts({ featured: true, limit: 8 }),
    getSetting("home"),
  ]);
  const d = await db();
  const [saved, posts] = await Promise.all([
    getWishlistIds(ctx.ownerKey),
    d
      .select()
      .from(journalPosts)
      .where(and(eq(journalPosts.status, "published"), ...(isDemoMode() ? [] : [eq(journalPosts.isDemo, false)])))
      .orderBy(desc(journalPosts.publishedAt))
      .limit(3),
  ]);

  const chapters: HomeChapter[] = categories.map((c, i) => {
    const [kind, seed] = pieceFor(c.slug, c.coverImageUrl, i);
    return { slug: c.slug, name: c.name, tagline: c.tagline, count: c.productCount, kind, seed, coverImageUrl: c.coverImageUrl! };
  });
  // Grid shows crafts that have pieces for sale (all crafts in demo mode).
  const gridCategories = categories.filter((c) => c.productCount > 0 || isDemoMode()).filter((c) => c.showOnHome);
  const featuredVendors = home.featuredVendorIds.length
    ? vendors.filter((v) => home.featuredVendorIds.includes(v.id))
    : vendors.filter((v) => v.isFeatured).concat(vendors.filter((v) => !v.isFeatured));

  return (
    <>
      <HomeExperience chapters={chapters} hero={{ eyebrow: home.heroEyebrow, title: home.heroTitle, subtitle: home.heroSubtitle }} />

      <div id="after-tour" className="paper relative">
        <ScallopDivider />

        {/* Shop by craft */}
        <section className="py-24">
          <Container>
            <SectionHeading
              eyebrow="Shop by craft"
              title={
                <>
                  {gridCategories.length} traditions,
                  <br className="hidden sm:block" /> one doorstep
                </>
              }
              description="Every craft is photographed, made and shipped by the artisans who practise it."
              action={
                <ButtonLink href="/shop" variant="outline">
                  Shop everything <ArrowRight className="size-4" />
                </ButtonLink>
              }
            />
            <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
              {gridCategories.map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className={`group relative overflow-hidden rounded-[var(--radius-card)] bg-indigo-950 ${i === 0 || i === 5 ? "md:col-span-2 md:row-span-2 aspect-[4/5] md:aspect-auto" : "aspect-[4/5]"}`}
                >
                  <Image
                    src={c.coverImageUrl!}
                    alt={`${c.name}${c.coverKind === "illustration" ? " — illustration" : ""}`}
                    fill
                    sizes="(min-width: 768px) 50vw, 50vw"
                    unoptimized={c.coverImageUrl!.endsWith(".svg")}
                    className="object-cover transition duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/90 via-indigo-950/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                    <p className="font-display text-xl text-sand-50 sm:text-2xl">{c.name}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-sand-200/75 sm:text-sm">{c.tagline}</p>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gold-300">
                      {c.productCount} {c.productCount === 1 ? "piece" : "pieces"}
                      <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
                    </p>
                  </div>
                  {c.coverKind === "illustration" ? (
                    <span className="absolute top-3 right-3 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/85 backdrop-blur">Illustration</span>
                  ) : null}
                </Link>
              ))}
            </div>
          </Container>
        </section>

        {/* Featured pieces */}
        {featured.items.length ? (
          <section className="pb-24">
            <Container>
              <SectionHeading eyebrow="Featured" title="Pieces with a maker's name" description="One-of-a-kind and small-batch work, each listed by the artisan who made it." />
              <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-5">
                {featured.items.map((p, i) => (
                  <ProductCard key={p.id} product={p} saved={saved.has(p.id)} priority={i < 4} />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* How importing works teaser */}
        <section className="night relative overflow-hidden py-24">
          <Container>
            <SectionHeading
              dark
              eyebrow="How importing works"
              title="A $1,000 purchase from a workshop you've never visited — made simple."
              description="You pay for the piece, the international shipping and your country's import duty. You see every line before you pay."
              action={
                <ButtonLink href="/how-importing-works" variant="light">
                  The full guide <ArrowRight className="size-4" />
                </ButtonLink>
              }
            />
            <ol className="mt-14 grid gap-6 md:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                  <span className="font-display text-5xl text-gold-300/30 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <Icon className="mt-4 size-6 text-gold-300" aria-hidden />
                  <h3 className="mt-3 font-display text-xl text-sand-50">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-sand-200/70">{text}</p>
                </li>
              ))}
            </ol>
            <TrustBadges tone="dark" className="mt-10" compact />
          </Container>
        </section>

        {/* Meet the artisans */}
        {featuredVendors.length ? (
          <section className="py-24">
            <Container>
              <SectionHeading
                eyebrow="Meet the artisans"
                title="The hands behind the work"
                description="Every artisan is verified by our team — identity, workshop and sample work — before they can sell."
                action={
                  <ButtonLink href="/artisans" variant="outline">
                    All artisans <ArrowRight className="size-4" />
                  </ButtonLink>
                }
              />
              <div className="mt-12 grid gap-6 md:grid-cols-3">
                {featuredVendors.slice(0, 3).map((v) => (
                  <ArtisanStoryCard key={v.id} vendor={v} variant="feature" />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* Commission band */}
        <section className="pb-24">
          <Container>
            <div className="relative overflow-hidden rounded-[2rem] bg-terracotta-700 px-6 py-14 text-sand-50 sm:px-12">
              <Image src="/art/calligraphy/7-wide.svg" alt="" fill unoptimized className="object-cover opacity-25 mix-blend-luminosity" />
              <div className="relative max-w-2xl">
                <p className="text-xs font-semibold tracking-[0.25em] text-gold-200 uppercase">Made for you</p>
                <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Your family name in Nastaliq. A rug in your room&apos;s exact size.</h2>
                <p className="mt-4 text-sand-100/85">Describe what you have in mind; an artisan sends a quote and sketches before anything is made.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ButtonLink href="/custom" variant="gold">
                    Commission a piece
                  </ButtonLink>
                  <ButtonLink href="/category/bespoke" variant="light">
                    Browse bespoke work
                  </ButtonLink>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* Journal */}
        {posts.length ? (
          <section className="pb-24">
            <Container>
              <SectionHeading
                eyebrow="Heritage journal"
                title="Stories from the workshops"
                action={
                  <ButtonLink href="/journal" variant="outline">
                    Read the journal <ArrowRight className="size-4" />
                  </ButtonLink>
                }
              />
              <div className="mt-12 grid gap-8 md:grid-cols-3">
                {posts.map((p) => (
                  <Link key={p.id} href={`/journal/${p.slug}`} className="group">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] bg-sand-200">
                      {p.coverImageUrl ? (
                        <Image src={p.coverImageUrl} alt="" fill unoptimized={p.coverImageUrl.endsWith(".svg")} className="object-cover transition duration-700 group-hover:scale-105" />
                      ) : null}
                    </div>
                    <p className="mt-4 text-xs text-umber-500">{formatDate(p.publishedAt)}</p>
                    <h3 className="mt-1 font-display text-2xl text-umber-900 group-hover:text-terracotta-700">{p.title}</h3>
                    {p.excerpt ? <p className="mt-2 text-sm text-umber-600">{p.excerpt}</p> : null}
                  </Link>
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        <section className="pb-8">
          <Container>
            <div className="night rounded-[2rem] px-6 py-12 sm:px-12 md:flex md:items-center md:justify-between md:gap-10">
              <div className="max-w-xl">
                <h2 className="font-display text-3xl text-sand-50 sm:text-4xl">First look at limited drops</h2>
                <p className="mt-2 text-sand-200/75">One-of-a-kind pieces sell once. Hear about new work before it&apos;s listed.</p>
              </div>
              <div className="mt-6 w-full max-w-md md:mt-0">
                <NewsletterForm source="home" />
              </div>
            </div>
          </Container>
        </section>
      </div>
    </>
  );
}
