import type { Metadata } from "next";
import { CmsPage, getPublishedPage } from "@/components/store/info-page";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("privacy");
  return { title: page?.title ?? "Privacy policy", description: page?.seoDescription ?? undefined };
}

export default function PrivacyPage() {
  return <CmsPage slug="privacy" eyebrow="Legal" />;
}
