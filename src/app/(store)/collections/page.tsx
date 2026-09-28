import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IllustrationTag, isSvg } from "@/components/store/illustration-tag";
import { PageHero } from "@/components/store/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/misc";
import { getPublicCollections } from "@/lib/queries/storefront";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Collections & bundles",
  description: "Curated sets of handmade Pakistani craft — pieces chosen to sit together, and bundles for a whole corner of a room.",
};

export default async function CollectionsPage() {
  const collections = await getPublicCollections();
  return (
    <>
      <PageHero
        eyebrow="Curated"
        title={
          <>
            Collections <span className="gold-text italic">&amp; bundles</span>
          </>
        }
        description="Pieces chosen to live together — a palette, a room, a gift. Bundles gather a whole corner of a home from several workshops, each shipping from its maker."
      />
      <Container className="space-y-20 py-16 md:space-y-28 md:py-24">
        {collections.length ? (
          collections.map((c, i) => (
            <article key={c.id} className="grid items-center gap-8 md:gap-14 lg:grid-cols-2">
              <Link href={`/collections/${c.slug}`} className={cn("group relative block aspect-[4/3] overflow-hidden rounded-[2rem] bg-sand-200 shadow-soft", i % 2 === 1 && "lg:order-2")}>
                {c.coverImageUrl ? (
                  <Image src={c.coverImageUrl} alt="" fill sizes="(min-width:1024px) 50vw, 100vw" unoptimized={isSvg(c.coverImageUrl)} className="object-cover transition duration-1000 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]" />
                ) : null}
                {isSvg(c.coverImageUrl) ? <IllustrationTag className="absolute right-4 bottom-4" /> : null}
              </Link>
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-gold-600 uppercase">
                  {c.kind === "bundle" ? `Bundle${c.bundleDiscountBps ? ` · save ${c.bundleDiscountBps / 100}%` : ""}` : "Collection"} · {c.products.length} pieces
                </p>
                <h2 className="mt-3 font-display text-4xl leading-[1.08] text-umber-900 md:text-5xl">
                  <Link href={`/collections/${c.slug}`} className="hover:text-terracotta-700">
                    {c.title}
                  </Link>
                </h2>
                {c.description ? <p className="mt-4 max-w-lg text-lg text-umber-600">{c.description}</p> : null}
                <ul className="mt-6 flex -space-x-3">
                  {c.products.slice(0, 5).map((p) => (
                    <li key={p.id} className="relative size-16 overflow-hidden rounded-2xl bg-sand-200 ring-4 ring-parchment">
                      <Image src={p.imageUrl} alt={p.title} fill sizes="64px" unoptimized={isSvg(p.imageUrl)} className="object-cover" />
                    </li>
                  ))}
                </ul>
                <ButtonLink href={`/collections/${c.slug}`} variant="outline" className="mt-8">
                  {c.kind === "bundle" ? "See the bundle" : "Explore the collection"} <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="Collections are being curated" action={<ButtonLink href="/shop">Browse every craft</ButtonLink>}>
            Our first curated sets are on their way.
          </EmptyState>
        )}
      </Container>
    </>
  );
}
