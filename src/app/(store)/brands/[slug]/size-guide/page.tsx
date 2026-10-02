import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SizeGuideTable } from "@/components/store/brands/size-guide";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, PageHeader } from "@/components/ui/misc";
import { getPublicBrand } from "@/lib/queries/brands";

export async function generateMetadata(props: PageProps<"/brands/[slug]/size-guide">): Promise<Metadata> {
  const { slug } = await props.params;
  const brand = await getPublicBrand(slug);
  return { title: brand ? `${brand.name} size guide` : "Size guide" };
}

export default async function BrandSizeGuidePage(props: PageProps<"/brands/[slug]/size-guide">) {
  const { slug } = await props.params;
  const brand = await getPublicBrand(slug);
  if (!brand) notFound();
  return (
    <Container className="max-w-3xl py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: brand.name, href: `/brands/${brand.slug}` }, { label: "Size guide" }]} />
      <PageHeader className="mt-6" title={`${brand.name} size guide`} description="Not sure between two sizes? Add a note to your order and we'll check with the brand before buying." />
      <div className="mt-8 rounded-[var(--radius-card)] bg-sand-50 p-5 ring-1 ring-umber-200/60">
        <SizeGuideTable guide={brand.sizeGuide} brandName={brand.name} />
      </div>
      <ButtonLink href={`/brands/${brand.slug}`} variant="outline" className="mt-8">
        Back to {brand.name}
      </ButtonLink>
    </Container>
  );
}
