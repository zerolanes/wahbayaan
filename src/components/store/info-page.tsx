import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { db } from "@/lib/db/client";
import { pages } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils/format";
import { Markdown } from "./markdown";

/** Plain editorial header for information pages. */
export function InfoHeader({ eyebrow, title, lead, crumb, children }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; crumb: string; children?: ReactNode }) {
  return (
    <header>
      <Container className="pt-8 pb-8 md:pt-12 md:pb-12">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: crumb }]} />
        {eyebrow ? <p className="mt-8 text-[0.8125rem] font-semibold tracking-[0.06em] text-terracotta-700 uppercase">{eyebrow}</p> : null}
        <h1 className="mt-3 max-w-3xl font-display text-[2.5rem] leading-[1.04] tracking-[-0.035em] text-umber-900 md:text-6xl">{title}</h1>
        {lead ? <p className="mt-5 max-w-2xl text-lg leading-relaxed text-umber-700">{lead}</p> : null}
        {children}
      </Container>
    </header>
  );
}

const POLICY_LINKS = [
  { slug: "buyer-protection", label: "Buyer protection" },
  { slug: "terms", label: "Terms of service" },
  { slug: "privacy", label: "Privacy policy" },
];

export async function getPublishedPage(slug: string) {
  const d = await db();
  return d.query.pages.findFirst({ where: and(eq(pages.slug, slug), eq(pages.status, "published")) });
}

/** A staff-edited page from the `pages` table (policies, legal), with sibling links. */
export async function CmsPage({ slug, eyebrow }: { slug: string; eyebrow?: string }) {
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  return (
    <>
      <InfoHeader eyebrow={eyebrow} title={page.title} lead={page.seoDescription} crumb={page.title} />
      <Container className="grid gap-12 pb-12 md:pb-16 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-20">
        <article className="max-w-3xl rounded-[var(--radius-panel)] bg-sand-50 p-6 shadow-[0_0_0_0.5px_rgb(34_26_19/0.08)] md:p-10">
          <Markdown source={page.body} />
          <p className="mt-12 border-t border-umber-200/70 pt-4 text-xs text-umber-600">Last updated {formatDate(page.updatedAt)}</p>
        </article>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold tracking-[0.06em] text-umber-600 uppercase">Policies</p>
          <ul className="mt-3 space-y-2 text-sm">
            {POLICY_LINKS.map((l) => (
              <li key={l.slug}>
                <Link href={`/${l.slug}`} className={l.slug === slug ? "font-medium text-umber-900" : "text-umber-600 hover:text-umber-900"}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs font-semibold tracking-[0.06em] text-umber-600 uppercase">Questions?</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/faq" className="text-umber-600 hover:text-umber-900">
                Read the FAQ
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-umber-600 hover:text-umber-900">
                Contact us
              </Link>
            </li>
          </ul>
        </aside>
      </Container>
    </>
  );
}
