import type { Metadata } from "next";
import { CmsPage, getPublishedPage } from "@/components/store/info-page";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("terms");
  return { title: page?.title ?? "Terms of service", description: page?.seoDescription ?? undefined };
}

export default function TermsPage() {
  return <CmsPage slug="terms" eyebrow="Legal" />;
}
