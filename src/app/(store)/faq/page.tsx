import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ChevronDown } from "lucide-react";
import { InfoHeader } from "@/components/store/info-page";
import { Markdown } from "@/components/store/markdown";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { db } from "@/lib/db/client";
import { faqs } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Shipping from Pakistan, import duty and tax, payment protection, commissions, returns and caring for handmade pieces.",
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default async function FaqPage() {
  const d = await db();
  const rows = await d.select().from(faqs).where(eq(faqs.isPublished, true)).orderBy(asc(faqs.sort));
  const groups = [...new Set(rows.map((r) => r.group))];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rows.map((r) => ({ "@type": "Question", name: r.question, acceptedAnswer: { "@type": "Answer", text: r.answer } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <InfoHeader eyebrow="Help centre" title="Questions, answered" lead="Everything about buying handmade work from Pakistan — what it costs to bring home, how your payment is protected and how long things take." crumb="FAQ" />
      <Container className="grid gap-12 py-12 md:py-16 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20">
        <nav aria-label="FAQ topics" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold tracking-wide text-umber-500 uppercase">Topics</p>
          <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1.5">
            {groups.map((g) => (
              <li key={g}>
                <a href={`#${slug(g)}`} className="text-sm text-umber-600 hover:text-umber-900 max-lg:rounded-full max-lg:bg-white max-lg:px-3 max-lg:py-1.5 max-lg:ring-1 max-lg:ring-umber-200">
                  {g}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="max-w-3xl space-y-14">
          {groups.map((g) => (
            <section key={g} id={slug(g)} className="scroll-mt-24">
              <h2 className="font-display text-3xl text-umber-900">{g}</h2>
              <div className="mt-5 divide-y divide-umber-200/70 border-y border-umber-200/70">
                {rows
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <details key={r.id} className="group py-1">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-left font-medium text-umber-900 [&::-webkit-details-marker]:hidden">
                        {r.question}
                        <ChevronDown className="size-4 shrink-0 text-umber-500 transition group-open:rotate-180" aria-hidden />
                      </summary>
                      <Markdown source={r.answer} className="pb-5 text-[0.98rem]" />
                    </details>
                  ))}
              </div>
            </section>
          ))}
          <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="font-medium text-umber-900">Still have a question?</p>
              <p className="mt-1 text-sm text-umber-600">
                We aim to reply within one working day. For order questions, have your <Link href="/account/orders" className="underline underline-offset-4">order number</Link> ready.
              </p>
            </div>
            <ButtonLink href="/contact" className="mt-4 sm:mt-0">
              Contact us
            </ButtonLink>
          </div>
        </div>
      </Container>
    </>
  );
}
