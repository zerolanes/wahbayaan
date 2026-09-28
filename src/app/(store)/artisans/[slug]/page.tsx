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
    { icon: CheckCircle2, label: "Sold on Wahbayaan", value: vendor.salesCount ? `${vendor.salesCount} ${vendor.salesCount === 1 ? "piece" : "pieces"}` : "New here", sub: null },
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
        {vendor.bannerUrl ? <Image src={vendor.bannerUrl} alt="" fill priority sizes="100vw" unoptimized={isSvg(vendor.bannerUrl)} className="object-cover" /> : <div className="night absolute inset-0" />}
        <div className="absolute inset-0 bg-gradient-to-t from-parchment via-parchment/10 to-transparent" />
        <Container className="relative pt-6">
          <Breadcrumbs items={[{ label: "Artisans", href: "/artisans" }, { label: vendor.displayName }]} className="inline-flex rounded-full bg-sand-50/85 px-3 py-1 backdrop-blur" />
        </Container>
        {isSvg(vendor.bannerUrl) ? <IllustrationTag className="absolute top-6 right-4 md:right-8" /> : null}
      </section>

      <Container className="relative -mt-24 md:-mt-28">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-5 md:flex-row md:items-end">
            <div className="relative size-36 shrink-0 overflow-hidden rounded-full border-[6px] border-parchment bg-sand-200 shadow-lift md:size-44">
              {vendor.profilePhotoUrl ? (
                <Image src={vendor.profilePhotoUrl} alt={`${vendor.displayName}`} fill priority sizes="176px" unoptimized={isSvg(vendor.profilePhotoUrl)} className="object-cover" />
              ) : null}
            </div>
            <div className="animate-fade-up pb-2">
              <div className="flex flex-wrap items-center gap-3">
                <VerifiedBadge size="md" />
                {vendor.profilePhotoKind === "illustration" ? <span className="rounded-full bg-umber-100 px-2 py-0.5 text-[11px] text-umber-600">Illustrated portrait</span> : null}
              </div>
              <h1 className="mt-2 font-display text-5xl leading-[1.02] text-umber-900 md:text-6xl">{vendor.displayName}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-umber-600">
                <span className="font-medium text-gold-700">{vendor.craft}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden />
                  {vendor.workshopCity}
                  {vendor.workshopRegion ? `, ${regionLabel(vendor.workshopRegion)}` : ""}, Pakistan
                </span>
                {vendor.locationVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-turquoise-50 px-2.5 py-0.5 text-xs font-medium text-turquoise-700">
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
              <button type="submit" className="inline-flex h-13 items-center gap-2 rounded-full border border-umber-300/70 px-6 text-base font-medium text-umber-900 transition hover:border-umber-900 hover:bg-white/60">
                <MessageCircle className="size-4" aria-hidden /> Message
              </button>
            </form>
          </div>
        </div>

        {vendor.tagline ? <p className="mt-8 max-w-3xl font-display text-2xl text-umber-700 italic md:text-3xl">“{vendor.tagline}”</p> : null}

        {vendor.vacationMode ? (
          <div className="mt-8 flex gap-3 rounded-2xl bg-pending-50 p-5 text-umber-800 ring-1 ring-pending-600/20">
            <Palmtree className="mt-0.5 size-5 shrink-0 text-pending-600" aria-hidden />
            <p>
              <strong className="font-semibold">Away from the workshop.</strong> {vendor.displayName} isn&apos;t taking new commissions right now. You can still save pieces and send a
              message — they&apos;ll reply when they&apos;re back.
            </p>
          </div>
        ) : null}

        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-umber-200/60 ring-1 ring-umber-200/60 md:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="bg-sand-50 px-5 py-4">
              <dt className="flex items-center gap-1.5 text-xs tracking-wider text-umber-500 uppercase">
                <s.icon className="size-3.5 text-gold-600" aria-hidden /> {s.label}
              </dt>
              <dd className="mt-1 font-display text-xl text-umber-900">{s.value}</dd>
              {s.sub ? <dd className="text-xs text-umber-500">{s.sub}</dd> : null}
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
                <p className="font-display text-2xl leading-[1.45] text-pretty text-umber-900 md:text-[1.8rem]">{storyParas[0]}</p>
                {storyParas.slice(1).map((p, i) => (
                  <p key={i} className="text-lg leading-relaxed text-umber-700">
                    {p}
                  </p>
                ))}
              </div>
            ) : null}
            {vendor.craftHistory ? (
              <div className="mt-12 rounded-[var(--radius-card)] bg-sand-100/80 p-7 ring-1 ring-umber-200/50 md:p-9">
                <p className="text-xs font-semibold tracking-[0.2em] text-gold-700 uppercase">The craft&apos;s history</p>
                <p className="mt-3 text-lg leading-relaxed text-umber-800">{vendor.craftHistory}</p>
                {category ? (
                  <Link href={`/category/${category.slug}`} className="mt-4 inline-block text-sm font-medium text-terracotta-600 hover:underline">
                    Explore {category.name} →
                  </Link>
                ) : null}
              </div>
            ) : null}
            {vendor.storyVideoUrl ? (
              <div className="mt-12">
                <p className="mb-3 text-sm font-semibold text-umber-900">Inside the workshop</p>
                <video src={vendor.storyVideoUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-[var(--radius-card)] bg-black">
                  <track kind="captions" />
                </video>
              </div>
            ) : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[var(--radius-card)] bg-sand-50 p-6 shadow-soft ring-1 ring-umber-200/60">
              <p className="flex items-center gap-2 font-semibold text-umber-900">
                <BadgeCheck className="size-5 fill-turquoise-500 text-white" aria-hidden /> Checks passed
              </p>
              {checks.length ? (
                <ul className="mt-4 space-y-4">
                  {checks.map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden />
                      <div>
                        <p className="text-sm font-medium text-umber-900">{VERIFICATION_LABELS[c.kind]?.title ?? c.kind}</p>
                        <p className="text-xs text-umber-500">
                          {VERIFICATION_LABELS[c.kind]?.text}
                          {c.checkedAt ? ` Checked ${formatDate(c.checkedAt, { month: "short", year: "numeric" })}.` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-umber-600">Verified by our team{vendor.verifiedAt ? ` on ${formatDate(vendor.verifiedAt)}` : ""}.</p>
              )}
              <Link href="/artisans#directory" className="mt-5 inline-block text-xs font-medium text-terracotta-600 hover:underline">
                How verification works
              </Link>
            </div>
            {vendor.acceptsCustomOrders && !vendor.vacationMode ? (
              <div className="night rounded-[var(--radius-card)] p-6">
                <p className="font-display text-2xl text-sand-50">Something made for you</p>
                <p className="mt-2 text-sm text-sand-200/80">
                  Describe what you have in mind — size, words, colours. {vendor.displayName.split(" ")[0]} replies with a quote and a making time; you approve it before
                  paying, and payment is held until it arrives.
                </p>
                <ButtonLink href={`/custom?artisan=${vendor.slug}`} variant="gold" className="mt-5">
                  Request a commission
                </ButtonLink>
              </div>
            ) : null}
          </aside>
        </Container>
      </section>

      <section id="pieces" className="border-t border-umber-200/60 py-20 md:py-24">
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
                <div className="rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
                  <p className="font-display text-6xl text-umber-900 tabular-nums">{vendor.rating.average?.toFixed(1)}</p>
                  <StarRating average={vendor.rating.average} count={vendor.rating.count} size="lg" className="mt-2" />
                  <div className="mt-5">
                    <RatingHistogram histogram={histogram} total={vendor.rating.count} />
                  </div>
                </div>
              </div>
              <div className="min-w-0 space-y-8">
                {wall.length ? (
                  <div>
                    <p className="mb-3 text-sm font-semibold text-umber-900">Buyer photos</p>
                    <ReviewPhotoWall photos={wall} />
                  </div>
                ) : null}
                <div className="grid gap-4">
                  {reviews.map((r) => (
                    <div key={r.id}>
                      {r.product && r.product.status === "active" ? (
                        <Link href={`/product/${r.product.slug}`} className="mb-1.5 ml-1 inline-block text-xs font-medium text-umber-500 hover:text-terracotta-700">
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
            <p className="mt-6 max-w-xl text-umber-600">
              {vendor.displayName} is new to Wahbayaan. Every order is still covered by buyer protection — your payment is held until your piece arrives.
            </p>
          )}
        </Container>
      </section>
    </>
  );
}
