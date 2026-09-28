import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/store/markdown";
import { PageHero } from "@/components/store/page-hero";
import { Container } from "@/components/ui/misc";
import { getPublishedPage } from "@/lib/queries/storefront";
import { formatDate } from "@/lib/utils/format";

/**
 * CMS pages edited in Admin → Content → Pages (policies, about, etc.).
 * Only published pages render; dedicated routes (e.g. /shop) always win.
 */
export async function generateMetadata(props: PageProps<"/[page]">): Promise<Metadata> {
  const { page } = await props.params;
  const p = await getPublishedPage(page);
  if (!p) return { title: "Page not found" };
  return { title: p.title, description: p.seoDescription ?? undefined };
}

export default async function CmsPage(props: PageProps<"/[page]">) {
  const { page } = await props.params;
  if (!/^[a-z0-9-]{1,80}$/.test(page)) notFound();
  const p = await getPublishedPage(page);
  if (!p) notFound();
  return (
    <>
      <PageHero title={p.title} description={p.seoDescription ?? undefined} size="sm" />
      <Container className="py-14 md:py-20">
        <div className="max-w-3xl">
          <Markdown source={p.body} />
          <p className="mt-12 border-t border-umber-200/60 pt-4 text-sm text-umber-500">Last updated {formatDate(p.updatedAt, { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </Container>
    </>
  );
}
