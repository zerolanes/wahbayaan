import type { Metadata } from "next";
import { CmsPage, getPublishedPage } from "@/components/store/info-page";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("buyer-protection");
  return { title: page?.title ?? "Buyer protection", description: page?.seoDescription ?? "How Wahbayaan holds your payment until your piece arrives as described." };
}

export default function BuyerProtectionPage() {
  return <CmsPage slug="buyer-protection" eyebrow="Buying with confidence" />;
}
