import Image from "next/image";
import Link from "next/link";
import { ArtisanStoryCard } from "@/components/store/artisan-card";
import { ProductCard } from "@/components/store/product-card";
import { TrustBadges } from "@/components/store/trust";
import { ButtonLink } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { getWishlistIds } from "@/lib/commerce/cart";
import { getPublicCategories, getPublicProducts, getPublicVendors } from "@/lib/queries/catalog";
import { getSetting } from "@/lib/settings";

export default async function HomePage() {
  const [ctx, categories, vendors, featured, home] = await Promise.all([
    getBuyerContext(),
    getPublicCategories(),
    getPublicVendors(),
    getPublicProducts({ featured: true, limit: 8 }),
    getSetting("home"),
  ]);
  const saved = await getWishlistIds(ctx.ownerKey);
  return (
    <>
      <section className="night relative flex min-h-[80vh] items-center pt-16">
        <Container>
          <p className="text-xs font-semibold tracking-[0.25em] text-gold-300 uppercase">{home.heroEyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-6xl leading-[1.02] text-sand-50 md:text-8xl">{home.heroTitle}</h1>
          <p className="mt-6 max-w-xl text-lg text-sand-200/80">{home.heroSubtitle}</p>
          <div className="mt-8 flex gap-3">
            <ButtonLink href="/shop" variant="gold" size="lg">Explore the crafts</ButtonLink>
            <ButtonLink href="/how-importing-works" variant="light" size="lg">How importing works</ButtonLink>
          </div>
        </Container>
      </section>
      <section className="paper py-20">
        <Container>
          <SectionHeading eyebrow="Shop by craft" title="Eight traditions, one doorstep" />
          <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-4">
            {categories.map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className="group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)]">
                <Image src={c.coverImageUrl!} alt="" fill unoptimized className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/80 to-transparent" />
                <div className="absolute bottom-0 p-4">
                  <p className="font-display text-xl text-sand-50">{c.name}</p>
                  <p className="text-xs text-sand-200/80">{c.productCount} pieces</p>
                </div>
              </Link>
            ))}
          </div>
          <SectionHeading className="mt-20" eyebrow="Featured" title="Pieces with a maker's name" />
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {featured.items.map((p, i) => (
              <ProductCard key={p.id} product={p} saved={saved.has(p.id)} priority={i < 4} />
            ))}
          </div>
          <SectionHeading className="mt-20" eyebrow="Meet the artisans" title="Verified workshops across Pakistan" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {vendors.slice(0, 3).map((v) => (
              <ArtisanStoryCard key={v.id} vendor={v} />
            ))}
          </div>
          <TrustBadges className="mt-20" />
        </Container>
      </section>
    </>
  );
}
