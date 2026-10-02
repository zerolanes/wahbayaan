import type { Metadata } from "next";
import { JournalCard } from "@/components/store/journal-card";
import { PageHero } from "@/components/store/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/misc";
import { getJournalPosts } from "@/lib/queries/storefront";

export const metadata: Metadata = {
  title: "Heritage journal",
  description: "Stories from the workshops — how a hand-knotted rug is made, why Nastaliq hangs, the blue of Multan and the carvers of Taxila.",
};

export default async function JournalPage() {
  const posts = await getJournalPosts();
  const [lead, ...rest] = posts;
  return (
    <>
      <PageHero
        eyebrow="Heritage journal"
        title={
          <>
            Stories from <span className="gold-text italic">the workshops</span>
          </>
        }
        description="The crafts, the tools and the hands behind them."
        size="sm"
      />
      <Container className="py-16 md:py-20">
        {lead ? (
          <>
            <JournalCard post={lead} size="lg" className="mx-auto max-w-5xl" />
            {rest.length ? (
              <div className="mt-20 grid gap-x-8 gap-y-14 border-t border-umber-200/60 pt-16 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <JournalCard key={p.id} post={p} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState title="The first stories are being written" action={<ButtonLink href="/artisans">Meet the artisans</ButtonLink>}>
            In the meantime, every artisan&apos;s profile tells the story of their workshop.
          </EmptyState>
        )}
      </Container>
    </>
  );
}
