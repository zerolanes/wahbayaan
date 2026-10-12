import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink, Ruler } from "lucide-react";
import { BrandListing } from "@/components/store/brands/brand-listing";
import { BrandLogo } from "@/components/store/brands/brand-tile";
import { NotifyForm } from "@/components/store/brands/notify-form";
import { isSvg } from "@/components/store/illustration-tag";
import { SocialLinksList } from "@/components/store/social-links";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { featureFlags } from "@/lib/features";
import { getPublicBrand, getPublicBrandProducts, getPublicBrandProfile } from "@/lib/queries/brands";

export async function generateMetadata(props: PageProps<"/brands/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const brand = await getPublicBrand(slug);
  return brand ? { title: brand.name, description: brand.description ?? brand.partnerLine } : { title: "Brand not found" };
}

export default async function BrandPage(props: PageProps<"/brands/[slug]">) {
  if (!(await featureFlags()).pakistaniBrands) notFound();
  const { slug } = await props.params;
  const params = await props.searchParams;
  const brand = await getPublicBrand(slug);
  if (!brand) notFound();
  const [products, profile] = await Promise.all([getPublicBrandProducts(brand.id), getPublicBrandProfile(brand.id)]);

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: brand.name }]} />
      {profile?.bannerUrl ? (
        <div className="relative mt-6 aspect-[3/1] overflow-hidden rounded-[var(--radius-card)] bg-sand-100 md:aspect-[4/1]">
          <Image src={profile.bannerUrl} alt={`${brand.name} banner`} fill priority sizes="(min-width: 1400px) 1400px, 100vw" unoptimized={isSvg(profile.bannerUrl)} className="object-cover" />
        </div>
      ) : null}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-umber-200/60 pb-8">
        <div className="flex items-center gap-5">
          <BrandLogo name={brand.name} logoUrl={brand.logoUrl} size={88} />
          <div>
            <h1 className="font-display text-4xl text-umber-900 md:text-5xl">{brand.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-umber-600">
              <BadgeCheck className="size-4 text-success-600" aria-hidden /> {brand.partnerLine}
            </p>
            {brand.description ? <p className="mt-3 max-w-2xl text-umber-600">{brand.description}</p> : null}
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href={`/brands/${brand.slug}/size-guide`} className="inline-flex items-center gap-1.5 text-terracotta-600 hover:underline">
              <Ruler className="size-4" aria-hidden /> Size guide
            </Link>
            {brand.websiteUrl ? (
              <a href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-umber-700 hover:text-umber-900">
                {brand.name} website <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
          <SocialLinksList links={profile?.socials} owner={brand.name} className="-mr-2.5" linkClassName="text-umber-700 hover:bg-umber-900/[0.06] hover:text-umber-900" />
          <NotifyForm brandId={brand.id} kind="sale" />
        </div>
      </header>
      <div className="mt-8">
        <BrandListing products={products} params={params} action={`/brands/${brand.slug}`} />
      </div>
    </Container>
  );
}
