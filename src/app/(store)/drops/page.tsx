import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BellRing, Sparkles } from "lucide-react";
import { BuyerPrice } from "@/components/money/buyer-price";
import { IllustrationTag, isSvg } from "@/components/store/illustration-tag";
import { Eyebrow, PageHero } from "@/components/store/page-hero";
import { Countdown, WaitlistForm } from "@/components/store/product/drop-waitlist";
import { ProductGrid } from "@/components/store/product-grid";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState, SectionHeading } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getDrops, getEditionSizes } from "@/lib/queries/storefront";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Limited drops",
  description: "Small editions from Pakistani workshops, released on a set date. Join the waitlist to hear the moment a drop opens.",
};

export default async function DropsPage() {
  const [{ upcoming, live }, user] = await Promise.all([getDrops(), getCurrentUser()]);
  const editions = await getEditionSizes(upcoming.map((p) => p.id));

  return (
    <>
      <PageHero
        eyebrow="Limited drops"
        title={
          <>
            Small editions, <span className="gold-text italic">released on a date</span>
          </>
        }
        description="Some pieces are made in tiny runs — a dozen salt sculptures, a handful of numbered prints. Join a waitlist and we'll email you the moment it opens; it's first come, first served."
      />

      <Container className="py-16 md:py-20">
        <SectionHeading eyebrow="Coming soon" title={upcoming.length ? "Opening soon" : "No drops scheduled right now"} />
        {upcoming.length ? (
          <div className="mt-10 space-y-8">
            {upcoming.map((p) => (
              <article key={p.id} className="grid overflow-hidden rounded-[2rem] bg-sand-50 shadow-soft ring-1 ring-umber-200/60 lg:grid-cols-2">
                <Link href={`/product/${p.slug}`} className="group relative block aspect-[4/3] overflow-hidden bg-sand-200 lg:aspect-auto lg:min-h-[480px]">
                  <Image src={p.imageUrl} alt={p.imageAlt ?? p.title} fill sizes="(min-width:1024px) 50vw, 100vw" unoptimized={isSvg(p.imageUrl)} className="object-cover transition duration-1000 group-hover:scale-[1.03]" />
                  {p.imageKind === "illustration" ? <IllustrationTag className="absolute right-4 bottom-4" /> : null}
                </Link>
                <div className="night flex flex-col justify-center p-8 md:p-12">
                  <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-gold-300 uppercase">
                    <Sparkles className="size-4" aria-hidden /> Opens {formatDate(p.dropStartsAt, { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <h2 className="mt-3 font-display text-4xl leading-[1.08] text-sand-50">
                    <Link href={`/product/${p.slug}`} className="hover:text-gold-100">
                      {p.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-sand-200/75">
                    by{" "}
                    <Link href={`/artisans/${p.vendorSlug}`} className="text-sand-50 underline-offset-4 hover:underline">
                      {p.vendorName}
                    </Link>
                    {editions.get(p.id) ? ` · an edition of ${editions.get(p.id)}` : ""}
                  </p>
                  {p.summary ? <p className="mt-4 text-sand-100/85">{p.summary}</p> : null}
                  <p className="mt-5 text-sand-200/70">
                    <BuyerPrice pkr={p.pricePkr} className="font-display text-3xl text-sand-50" /> <span className="text-sm">item price</span>
                  </p>
                  <Countdown target={p.dropStartsAt!.toISOString()} tone="dark" className="mt-6" />
                  <div className="mt-6 max-w-md">
                    <WaitlistForm productId={p.id} defaultEmail={user?.email} tone="dark" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={<BellRing className="size-10" aria-hidden />} title="The next drop is being made" action={<ButtonLink href="/shop">Browse every craft</ButtonLink>}>
            Follow the journal or join our newsletter in the footer to hear about the next release.
          </EmptyState>
        )}
      </Container>

      {live.length ? (
        <section className="border-t border-umber-200/60 py-16 md:py-20">
          <Container>
            <SectionHeading eyebrow="Available now" title="Open drops" description="These editions are open — while they last." />
            <ProductGrid products={live} className="mt-10" columns="wide" />
          </Container>
        </section>
      ) : null}

      <Container className="pb-8">
        <div className="grid gap-6 rounded-[var(--radius-card)] bg-sand-100/70 p-8 ring-1 ring-umber-200/50 md:grid-cols-3 md:p-10">
          <div className="md:col-span-1">
            <Eyebrow>How drops work</Eyebrow>
            <p className="mt-2 font-display text-2xl text-umber-900">Fair, simple and protected</p>
          </div>
          <ul className="space-y-3 text-umber-700 md:col-span-2">
            <li>• Each drop opens at the time shown. Until then you can join the waitlist — joining is free and doesn&apos;t reserve a piece.</li>
            <li>• When it opens, waitlist members are emailed first; pieces are sold first come, first served.</li>
            <li>• Buying works like any other piece: landed cost shown before you pay, payment held until it arrives.</li>
          </ul>
        </div>
      </Container>
    </>
  );
}
