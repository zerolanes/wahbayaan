import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandListing } from "@/components/store/brands/brand-listing";
import { Breadcrumbs, Container, PageHeader } from "@/components/ui/misc";
import { featureFlags } from "@/lib/features";
import { getPublicBrandProducts } from "@/lib/queries/brands";

export const metadata: Metadata = { title: "Shop Pakistani brands" };

export default async function BrandShopPage(props: PageProps<"/brands/shop">) {
  if (!(await featureFlags()).pakistaniBrands) notFound();
  const params = await props.searchParams;
  const products = await getPublicBrandProducts();
  const audience = typeof params.for === "string" ? params.for : "";
  const title = audience === "women" ? "Women" : audience === "men" ? "Men" : audience === "kids" ? "Kids" : "All brand pieces";
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: title }]} />
      <PageHeader className="mt-6 mb-8" eyebrow="Pakistani Brands" title={title} description="Every brand collection on Wahbayaan in one place." />
      <BrandListing products={products} params={params} action="/brands/shop" />
    </Container>
  );
}
