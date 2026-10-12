import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerLinkCard } from "@/components/store/brands/partner-link-card";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { featureFlags } from "@/lib/features";
import { getPartnerLinkCards } from "@/lib/queries/affiliates";

export const metadata: Metadata = { title: "Partner links", description: "Pieces from partner stores. You buy directly from the store.", robots: { index: false } };

export default async function PartnerLinksPage() {
  if (!(await featureFlags()).pakistaniBrands) notFound();
  const cards = await getPartnerLinkCards(96);
  if (!cards.length) notFound();
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: "Partner links" }]} />
      <h1 className="mt-6 font-display text-5xl text-umber-900">Partner links</h1>
      <p className="mt-3 max-w-xl text-umber-600">These open the partner&apos;s own store. You buy from them directly; Wahbayaan may earn a commission.</p>
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {cards.map((c) => (
          <PartnerLinkCard key={c.id} card={c} />
        ))}
      </div>
    </Container>
  );
}
