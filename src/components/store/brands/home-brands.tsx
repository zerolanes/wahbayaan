import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";
import { Container } from "@/components/ui/misc";
import { featureFlags } from "@/lib/features";
import { getPublicBrandProducts, getPublicBrands } from "@/lib/queries/brands";
import { BrandProductCard } from "./brand-product-card";
import { BrandLogo } from "./brand-tile";

/** Homepage entry point for Pakistani Brands. Renders nothing when the feature is off. */
export async function HomeBrandsSection() {
  const flags = await featureFlags();
  if (!flags.pakistaniBrands) return null;
  const [brands, products] = await Promise.all([getPublicBrands(), getPublicBrandProducts()]);
  const picks = products.filter((p) => p.inStock).slice(0, 4);
  return (
    <section className="border-t border-umber-200/60 py-16 md:py-24" aria-labelledby="home-brands-h">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.22em] text-gold-600 uppercase">Pakistani Brands</p>
            <h2 id="home-brands-h" className="mt-3 font-display text-4xl leading-[1.08] text-umber-900 md:text-5xl">
              Lawn, pret and menswear — delivered.
            </h2>
            <p className="mt-4 text-lg text-umber-600">Pieces from Pakistani labels, ordered for you and delivered in Pakistan or abroad.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/brands" className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta-600 hover:underline">
              All brands <ArrowRight className="size-4" aria-hidden />
            </Link>
            {flags.brandRequests ? (
              <Link href="/brands/request" className="inline-flex items-center gap-1.5 text-sm font-medium text-umber-700 hover:text-umber-900">
                <Link2 className="size-4" aria-hidden /> Shop any brand by link
              </Link>
            ) : null}
          </div>
        </div>
        {brands.length ? (
          <ul className="mt-8 flex flex-wrap gap-3">
            {brands.map((b) => (
              <li key={b.id}>
                <Link href={`/brands/${b.slug}`} className="flex items-center gap-3 rounded-full bg-sand-50 py-1.5 pr-4 pl-1.5 ring-1 ring-umber-200/60 hover:ring-umber-400">
                  <BrandLogo name={b.name} logoUrl={b.logoUrl} size={36} className="rounded-full" />
                  <span className="text-sm font-medium text-umber-900">{b.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {picks.length ? (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {picks.map((p) => (
              <BrandProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
