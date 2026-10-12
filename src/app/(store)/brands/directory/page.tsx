import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/glass";
import { Breadcrumbs, Container, EmptyState } from "@/components/ui/misc";
import { DIRECTORY_CATEGORIES } from "@/lib/directory";
import { featureFlags } from "@/lib/features";
import { getPublicDirectory } from "@/lib/queries/directory";

export const metadata: Metadata = {
  title: "Pakistani brand directory",
  description: "Pakistani clothing and footwear brands, with links to their websites. Paste any product link and we'll buy it for you.",
};

/**
 * Text-only directory of Pakistani brands that are not on Wahbayaan: name,
 * category, one line and the brand's website. No logos, photos or products,
 * and no claim of any relationship with the brands listed.
 */
export default async function BrandDirectoryPage(props: PageProps<"/brands/directory">) {
  const flags = await featureFlags();
  if (!flags.pakistaniBrands) notFound();
  const sp = await props.searchParams;
  const cat = typeof sp.category === "string" ? sp.category : "";
  const all = await getPublicDirectory();
  const used = DIRECTORY_CATEGORIES.filter((c) => all.some((e) => e.category === c.key));
  const entries = cat ? all.filter((e) => e.category === cat) : all;

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: "Directory" }]} />
      <div className="mt-6 max-w-2xl">
        <h1 className="font-display text-5xl text-umber-900">Brand directory</h1>
        <p className="mt-3 text-lg text-umber-600">Pakistani brands not on Wahbayaan yet. Found something on their site? {flags.brandRequests ? "Send us the link and we'll buy it for you." : "Visit the brand's website."}</p>
        <p className="mt-2 text-sm text-umber-500">These brands are not affiliated with Wahbayaan. Listed for reference only.</p>
      </div>

      {used.length > 1 ? (
        <SegmentedControl
          className="mt-8"
          size="sm"
          label="Filter by category"
          items={[{ label: "All", href: "/brands/directory", active: !cat, count: all.length }, ...used.map((c) => ({ label: c.label, href: `/brands/directory?category=${c.key}`, active: cat === c.key, count: all.filter((e) => e.category === c.key).length }))]}
        />
      ) : null}

      {entries.length ? (
        <ul className="mt-8 divide-y divide-umber-200/70 rounded-[var(--radius-card)] bg-white ring-1 ring-umber-200/70" aria-label="Brands">
          {entries.map((e) => (
            <li key={e.slug} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6" data-directory-entry={e.slug}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-lg font-semibold text-umber-900">{e.name}</span>
                  <span className="text-xs font-medium tracking-wide text-umber-500 uppercase">{e.categoryLabel}</span>
                </p>
                <p className="mt-0.5 text-sm text-umber-600">{e.description}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {flags.brandRequests ? (
                  <ButtonLink href={e.shopHref} size="sm" variant="outline" aria-label={`Shop ${e.name} with Wahbayaan`}>
                    Shop with Wahbayaan
                  </ButtonLink>
                ) : null}
                {e.websiteUrl ? (
                  <a
                    href={e.websiteUrl}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm text-umber-700 hover:bg-umber-900/[0.05] hover:text-umber-900"
                    aria-label={`${e.name} website (opens in a new tab)`}
                  >
                    Website <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8" title="No brands listed here yet">
          {flags.brandRequests ? (
            <>
              You can still <Link href="/brands/request" className="text-terracotta-600 underline">shop any brand by link</Link>.
            </>
          ) : null}
        </EmptyState>
      )}
    </Container>
  );
}
