import { SHOW_QA_LABELS } from "@/lib/qa";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CheckCircle2, Clock, Languages, MapPin, MessageCircle, Palmtree, PenTool, Star } from "lucide-react";
import { ScallopDivider } from "@/components/brand/logo";
import { responseTimeLabel } from "@/components/store/artisan-feature";
import { IllustrationTag, isSvg } from "@/components/store/illustration-tag";
import { Eyebrow } from "@/components/store/page-hero";
import { ProductGrid } from "@/components/store/product-grid";
import { ReviewPhotoWall } from "@/components/store/protection";
import { RatingHistogram, ReviewCard } from "@/components/store/review-card";
import { StarRating, VerifiedBadge } from "@/components/store/trust";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, EmptyState, SectionHeading } from "@/components/ui/misc";
import { getPublicCategories, getPublicProducts, getPublicVendor, getReviewPhotoWall } from "@/lib/queries/catalog";
import { getPassedChecks, getVendorRatingHistogram, getVendorReviews, VERIFICATION_LABELS } from "@/lib/queries/storefront";
import { formatDate, regionLabel, yearsSince } from "@/lib/utils/format";
import { startConversation } from "@/app/actions/product";

export async function generateMetadata(props: PageProps<"/artisans/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const v = await getPublicVendor(slug);
  if (!v) return { title: "Artisan not found" };
  return {
    title: `${v.displayName} — ${v.craft}`,
    description: v.tagline ?? v.story?.slice(0, 160) ?? undefined,
    openGraph: { title: `${v.displayName}, ${v.workshopCity}`, description: v.tagline ?? undefined, images: v.bannerUrl ? [v.bannerUrl] : undefined },
  };
}

export default async function ArtisanPage(props: PageProps<"/artisans/[slug]">) {
  const { slug } = await props.params;
  const vendor = await getPublicVendor(slug);
  if (!vendor) notFound();
  const [checks, listings, reviews, histogram, wall, categories] = await Promise.all([
    getPassedChecks(vendor.id),
    getPublicProducts({ vendorId: vendor.id, limit: 48 }),
    getVendorReviews(vendor.id, 12),
    getVendorRatingHistogram(vendor.id),
    getReviewPhotoWall(vendor.id, 12),
    getPublicCategories(),
  ]);
  const years = yearsSince(vendor.foundedYear);
  const category = categories.find((c) => c.id === vendor.primaryCategoryId);
  const here = `/artisans/${vendor.slug}`;
  const storyParas = (vendor.story ?? "").split(/\n\s*\n/).filter(Boolean);

  const stats = [
    { icon: Clock, label: "Practising", value: years ? `${years} years` : "—", sub: vendor.foundedYear ? `since ${vendor.foundedYear}` : null },
    {
      icon: CheckCircle2,
      label: "Sold on Wahbayaan",
      value: vendor.salesCount ? `${vendor.salesCount} ${vendor.salesCount === 1 ? "piece" : "pieces"}` : "New here",
      sub: null,
    },
    {
      icon: Star,
      label: "Rating",
      value: vendor.rating.count && vendor.rating.average ? `${vendor.rating.average.toFixed(1)} / 5` : "No reviews yet",
      sub: vendor.rating.count ? `${vendor.rating.count} reviews` : null,
    },
    { icon: MessageCircle, label: "Usually replies", value: responseTimeLabel(vendor.responseTimeHours), sub: null },
    { icon: Languages, label: "Speaks", value: vendor.languages.length ? vendor.languages.join(", ") : "—", sub: null },
  ];

  return (
    <>
      <section className="relative h-[42vh] min-h-[320px] overflow-hidden bg-indigo-950 md:h-[52vh]">
        {vendor.bannerUrl ? (
          <Image src={vendor.bannerUrl} alt="" fill priority sizes="100vw" unoptimized={isSvg(vendor.bannerUrl)} className="object-cover" />
        ) : (
          <div className="night absolute inset-0" />
        )}
        <div className="from-parchment via-parchment/10 absolute inset-0 bg-gradient-to-t to-transparent" />
        <Container className="relative pt-6">
          <Breadcrumbs
            items={[{ label: "Artisans", href: "/artisans" }, { label: vendor.displayName }]}
            className="bg-sand-50/85 inline-flex rounded-full px-3 py-1 backdrop-blur"
          />
        </Container>
        {isSvg(vendor.bannerUrl) ? <IllustrationTag className="absolute top-6 right-4 md:right-8" /> : null}
      </section>

      <Container className="relative -mt-24 md:-mt-28">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-5 md:flex-row md:items-end">
            <div className="border-parchment bg-sand-200 shadow-lift relative size-36 shrink-0 overflow-hidden rounded-full border-[6px] md:size-44">
              {vendor.profilePhotoUrl ? (
                <Image
                  src={vendor.profilePhotoUrl}
                  alt={`${vendor.displayName}`}
                  fill
                  priority
                  sizes="176px"
                  unoptimized={isSvg(vendor.profilePhotoUrl)}
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="animate-fade-up pb-2">
              <div className="flex flex-wrap items-center gap-3">
                <VerifiedBadge size="md" />
                {SHOW_QA_LABELS && vendor.profilePhotoKind === "illustration" ? (
                  <span className="bg-umber-100 text-umber-600 rounded-full px-2 py-0.5 text-[11px]">Illustrated portrait</span>
                ) : null}
              </div>
              <h1 className="font-display text-umber-900 mt-2 text-5xl leading-[1.02] md:text-6xl">{vendor.displayName}</h1>
              <p className="text-umber-600 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-gold-700 font-medium">{vendor.craft}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden />
                  {vendor.workshopCity}
                  {vendor.workshopRegion ? `, ${regionLabel(vendor.workshopRegion)}` : ""}, Pakistan
                </span>
                {vendor.locationVerified ? (
                  <span className="bg-turquoise-50 text-turquoise-700 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    <BadgeCheck className="size-3.5" aria-hidden /> Verified location
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pb-2">
            {vendor.acceptsCustomOrders && !vendor.vacationMode ? (
              <ButtonLink href={`/custom?artisan=${vendor.slug}`} variant="accent" size="lg">
                <PenTool className="size-4" aria-hidden /> Commission this artisan
              </ButtonLink>
            ) : null}
            <form action={startConversation}>
              <input type="hidden" name="vendorId" value={vendor.id} />
              <input type="hidden" name="back" value={here} />
              <button
                type="submit"
                className="border-umber-300/70 text-umber-900 hover:border-umber-900 inline-flex h-13 items-center gap-2 rounded-full border px-6 text-base font-medium transition hover:bg-white/60"
              >
                <MessageCircle className="size-4" aria-hidden /> Message
              </button>
            </form>
          </div>
        </div>

        {vendor.tagline ? <p className="font-display text-umber-700 mt-8 max-w-3xl text-2xl italic md:text-3xl">“{vendor.tagline}”</p> : null}

        {vendor.vacationMode ? (
          <div className="bg-pending-50 text-umber-800 ring-pending-600/20 mt-8 flex gap-3 rounded-2xl p-5 ring-1">
            <Palmtree className="text-pending-600 mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              <strong className="font-semibold">Away from the workshop.</strong> {vendor.displayName} isn&apos;t taking new commissions right now. You can still
              save pieces and send a message — they&apos;ll reply when they&apos;re back.
            </p>
          </div>
        ) : null}

        <dl className="bg-umber-200/60 ring-umber-200/60 mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl ring-1 md:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="bg-sand-50 px-5 py-4">
              <dt className="text-umber-500 flex items-center gap-1.5 text-xs tracking-wider uppercase">
                <s.icon className="text-gold-600 size-3.5" aria-hidden /> {s.label}
              </dt>
              <dd className="font-display text-umber-900 mt-1 text-xl">{s.value}</dd>
              {s.sub ? <dd className="text-umber-500 text-xs">{s.sub}</dd> : null}
            </div>
          ))}
        </dl>
      </Container>

      <section className="py-20 md:py-24">
        <Container className="grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-20">
          <div>
            <Eyebrow>The workshop&apos;s story</Eyebrow>
            {storyParas.length ? (
              <div className="mt-5 space-y-5">
                <p className="font-display text-umber-900 text-2xl leading-[1.45] text-pretty md:text-[1.8rem]">{storyParas[0]}</p>
                {storyParas.slice(1).map((p, i) => (
                  <p key={i} className="text-umber-700 text-lg leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            ) : null}
            {vendor.craftHistory ? (
              <div className="bg-sand-100/80 ring-umber-200/50 mt-12 rounded-[var(--radius-card)] p-7 ring-1 md:p-9">
                <p className="text-gold-700 text-xs font-semibold tracking-[0.2em] uppercase">The craft&apos;s history</p>
                <p className="text-umber-800 mt-3 text-lg leading-relaxed">{vendor.craftHistory}</p>
                {category ? (
                  <Link href={`/category/${category.slug}`} className="text-terracotta-600 mt-4 inline-block text-sm font-medium hover:underline">
                    Explore {category.name} →
                  </Link>
                ) : null}
              </div>
            ) : null}
            {vendor.storyVideoUrl ? (
              <div className="mt-12">
                <p className="text-umber-900 mb-3 text-sm font-semibold">Inside the workshop</p>
                <video src={vendor.storyVideoUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-[var(--radius-card)] bg-black">
                  <track kind="captions" />
                </video>
              </div>
            ) : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="bg-sand-50 shadow-soft ring-umber-200/60 rounded-[var(--radius-card)] p-6 ring-1">
              <p className="text-umber-900 flex items-center gap-2 font-semibold">
                <BadgeCheck className="fill-turquoise-500 size-5 text-white" aria-hidden /> Checks passed
              </p>
              {checks.length ? (
                <ul className="mt-4 space-y-4">
                  {checks.map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <CheckCircle2 className="text-success-600 mt-0.5 size-4 shrink-0" aria-hidden />
                      <div>
                        <p className="text-umber-900 text-sm font-medium">{VERIFICATION_LABELS[c.kind]?.title ?? c.kind}</p>
                        <p className="text-umber-500 text-xs">
                          {VERIFICATION_LABELS[c.kind]?.text}
                          {c.checkedAt ? ` Checked ${formatDate(c.checkedAt, { month: "short", year: "numeric" })}.` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-umber-600 mt-2 text-sm">Verified by our team{vendor.verifiedAt ? ` on ${formatDate(vendor.verifiedAt)}` : ""}.</p>
              )}
              <Link href="/artisans#directory" className="text-terracotta-600 mt-5 inline-block text-xs font-medium hover:underline">
                How verification works
              </Link>
            </div>
            {vendor.acceptsCustomOrders && !vendor.vacationMode ? (
              <div className="night rounded-[var(--radius-card)] p-6">
                <p className="font-display text-sand-50 text-2xl">Something made for you</p>
                <p className="text-sand-200/80 mt-2 text-sm">
                  Describe what you have in mind — size, words, colours. {vendor.displayName.split(" ")[0]} replies with a quote and a making time; you approve
                  it before paying, and payment is held until it arrives.
                </p>
                <ButtonLink href={`/custom?artisan=${vendor.slug}`} variant="gold" className="mt-5">
                  Request a commission
                </ButtonLink>
              </div>
            ) : null}
          </aside>
        </Container>
      </section>

      <section id="pieces" className="border-umber-200/60 border-t py-20 md:py-24">
        <Container>
          <SectionHeading eyebrow="In the workshop now" title={`${listings.total} ${listings.total === 1 ? "piece" : "pieces"} by ${vendor.displayName}`} />
          <div className="mt-10">
            {listings.items.length ? (
              <ProductGrid products={listings.items} columns="wide" priorityCount={0} />
            ) : (
              <EmptyState
                title="Nothing listed right now"
                action={
                  vendor.acceptsCustomOrders ? (
                    <ButtonLink href={`/custom?artisan=${vendor.slug}`} variant="outline">
                      Commission a piece
                    </ButtonLink>
                  ) : undefined
                }
              >
                New pieces appear here as they come off the loom, the wheel or the bench.
              </EmptyState>
            )}
          </div>
        </Container>
      </section>

      <ScallopDivider />
      <section className="bg-sand-100/60 py-20 md:py-24">
        <Container>
          <SectionHeading eyebrow="From buyers" title={vendor.rating.count ? "Reviews across their work" : "No reviews yet"} />
          {vendor.rating.count ? (
            <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="bg-sand-50 ring-umber-200/60 rounded-2xl p-6 ring-1">
                  <p className="font-display text-umber-900 text-6xl tabular-nums">{vendor.rating.average?.toFixed(1)}</p>
                  <StarRating average={vendor.rating.average} count={vendor.rating.count} size="lg" className="mt-2" />
                  <div className="mt-5">
                    <RatingHistogram histogram={histogram} total={vendor.rating.count} />
                  </div>
                </div>
              </div>
              <div className="min-w-0 space-y-8">
                {wall.length ? (
                  <div>
                    <p className="text-umber-900 mb-3 text-sm font-semibold">Buyer photos</p>
                    <ReviewPhotoWall photos={wall} />
                  </div>
                ) : null}
                <div className="grid gap-4">
                  {reviews.map((r) => (
                    <div key={r.id}>
                      {r.product && r.product.status === "active" ? (
                        <Link
                          href={`/product/${r.product.slug}`}
                          className="text-umber-500 hover:text-terracotta-700 mb-1.5 ml-1 inline-block text-xs font-medium"
                        >
                          On “{r.product.title}”
                        </Link>
                      ) : null}
                      <ReviewCard review={r} vendorName={vendor.displayName} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-umber-600 mt-6 max-w-xl">
              {vendor.displayName} is new to Wahbayaan. Every order is still covered by buyer protection — your payment is held until your piece arrives.
            </p>
          )}
        </Container>
      </section>
    </>
  );
}
