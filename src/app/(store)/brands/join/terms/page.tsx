import type { Metadata } from "next";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { BRAND_SELLER_TERMS, BRAND_SELLER_TERMS_VERSION } from "@/lib/brand-portal/terms";

export const metadata: Metadata = { title: "Brand seller terms", description: "The terms a Pakistani brand accepts to sell on Wahbayaan." };

export default function BrandSellerTermsPage() {
  return (
    <Container className="max-w-3xl py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: "Sell your brand", href: "/brands/join" }, { label: "Terms" }]} />
      <h1 className="mt-6 font-display text-5xl text-umber-900">Brand seller terms</h1>
      <p className="mt-2 text-sm text-umber-500">Version {BRAND_SELLER_TERMS_VERSION}. Accepted when you apply; we record who accepted, when, and this version.</p>
      <ol className="mt-8 space-y-6">
        {BRAND_SELLER_TERMS.map((t, i) => (
          <li key={t.title}>
            <h2 className="font-sans text-base font-semibold tracking-normal text-umber-900">
              {i + 1}. {t.title}
            </h2>
            <p className="mt-1 text-umber-700">{t.text}</p>
          </li>
        ))}
      </ol>
    </Container>
  );
}
