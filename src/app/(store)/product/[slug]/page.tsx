import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CalendarClock, Hammer, Layers, MapPin, MessageCircle, Package, Ruler, Scale, Sparkles, Truck } from "lucide-react";
import { ScallopDivider } from "@/components/brand/logo";
import { BuyerPrice } from "@/components/money/buyer-price";
import { ArtisanStats, responseTimeLabel } from "@/components/store/artisan-feature";
import { CompareToggle } from "@/components/store/compare-toggle";
import { DestinationPicker } from "@/components/store/destination-picker";
import { isSvg } from "@/components/store/illustration-tag";
import { DeliveryEstimateLine, LandedCostBreakdown } from "@/components/store/landed-cost";
import { Eyebrow } from "@/components/store/page-hero";
import { ProductGallery } from "@/components/store/product/gallery";
import { Countdown, WaitlistForm } from "@/components/store/product/drop-waitlist";
import { PurchaseForm, type PurchaseOption } from "@/components/store/product/purchase-form";
import { ReviewForm } from "@/components/store/product/review-form";
import { ProductGrid } from "@/components/store/product-grid";
import { BuyerProtectionBox, ImportNotices, ReviewPhotoWall } from "@/components/store/protection";
import { RatingHistogram, ReviewCard } from "@/components/store/review-card";
import { StarRating, VerifiedBadge } from "@/components/store/trust";
import { WishlistButton } from "@/components/store/wishlist-button";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, SectionHeading } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { estimateForProduct, getWishlistIds } from "@/lib/commerce/cart";
import { buyerUnitPrice } from "@/lib/commerce/landed-cost";
import { getImportNotices } from "@/lib/commerce/rates";
import { isUpcomingDrop } from "@/lib/countdown";
import { formatMoney } from "@/lib/money/currency";
import { getReviewEligibility } from "@/lib/queries/account";
import { getProductDetail, getPublicProducts, getPublicVendor, getReviewPhotoWall } from "@/lib/queries/catalog";
import { getCompareIds } from "@/lib/queries/storefront";
import { formatDate, formatDims, formatWeight, regionLabel } from "@/lib/utils/format";
import { startConversation } from "@/app/actions/product";

export async function generateMetadata(props: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getProductDetail(slug);
  if (!p) return { title: "Piece not found" };
  const description = p.summary ?? p.description?.slice(0, 160) ?? undefined;
  return {
    title: `${p.title} by ${p.vendor.displayName}`,
    description,
    openGraph: { title: p.title, description, images: p.images[0] ? [{ url: p.images[0].url, alt: p.images[0].alt ?? p.title }] : undefined },
  };
}

export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const ctx = await getBuyerContext();
  const [user, vendor, estimate, notices, wishlist, compare, related, moreFromArtisan, eligibility] = await Promise.all([
    getCurrentUser(),
    getPublicVendor(product.vendor.slug),
    estimateForProduct(product.id),
    getImportNotices(ctx.destination, product.categoryId),
    getWishlistIds(ctx.ownerKey),
    getCompareIds(),
    getPublicProducts({ categorySlug: product.category.slug, excludeId: product.id, limit: 4 }),
    getPublicProducts({ vendorId: product.vendorId, excludeId: product.id, limit: 4 }),
    getReviewEligibility((await getCurrentUser())?.id ?? null, product.id),
  ]);
  const photoWall = product.reviews.flatMap((r) => r.photos.map((ph) => ({ url: ph.url, reviewId: r.id, authorName: r.authorName, country: r.buyerCountry, rating: r.rating })));
  const artisanWall = photoWall.length ? [] : await getReviewPhotoWall(product.vendorId, 6);

  const upcoming = isUpcomingDrop(product);
  const dims = formatDims(product.widthCm, product.heightCm, product.depthCm);
  const weight = formatWeight(product.weightG);
  const soldOut = product.availability === "ready_to_ship" && product.stockQty <= 0;
  const maxQty = product.availability === "made_to_order" ? 10 : Math.max(1, product.stockQty);
  const options: PurchaseOption[] = product.customizationOptions.map((o) => ({
    id: o.id,
    label: o.label,
    kind: o.kind,
    choices: o.choices,
    required: o.required,
    maxLength: o.maxLength,
    extraLabel: o.extraPricePkr && ctx.fx ? `+ ${formatMoney(buyerUnitPrice(o.extraPricePkr, ctx.fx), ctx.currency)}` : null,
  }));
  const here = `/product/${product.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.summary ?? product.description ?? undefined,
    image: product.images.map((i) => i.url),
    sku: product.id,
    category: product.category.name,
    material: product.materials.join(", ") || undefined,
    brand: { "@type": "Brand", name: product.vendor.displayName },
    countryOfOrigin: "PK",
    ...(product.rating.count && product.rating.average
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.average.toFixed(1), reviewCount: product.rating.count } }
      : {}),
    ...(ctx.fx
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: ctx.currency,
            price: (buyerUnitPrice(product.pricePkr, ctx.fx) / 100).toFixed(2),
            availability: soldOut
              ? "https://schema.org/SoldOut"
              : upcoming
                ? "https://schema.org/PreOrder"
                : product.availability === "made_to_order"
                  ? "https://schema.org/MadeToOrder"
                  : "https://schema.org/InStock",
            seller: { "@type": "Organization", name: "Wahbayaan" },
          },
        }
      : {}),
  };

  const specs = [
    dims ? { icon: Ruler, label: "Dimensions (W × H × D)", value: `${dims.cm}`, sub: dims.inches } : null,
    weight ? { icon: Scale, label: "Weight", value: weight.metric, sub: weight.imperial } : null,
    product.materials.length ? { icon: Layers, label: "Materials", value: product.materials.join(", ") } : null,
    product.techniques.length ? { icon: Hammer, label: "Techniques", value: product.techniques.join(", ") } : null,
    product.region ? { icon: MapPin, label: "Made in", value: `${product.vendor.workshopCity ? `${product.vendor.workshopCity}, ` : ""}${regionLabel(product.region)}, Pakistan` } : null,
    {
      icon: CalendarClock,
      label: product.availability === "made_to_order" ? "Time to make" : "Dispatch",
      value:
        product.availability === "made_to_order"
          ? product.timeToMakeDays
            ? `About ${product.timeToMakeDays} days`
            : "Confirmed by the artisan"
          : product.dispatchDays
            ? `Leaves the workshop within ${product.dispatchDays} days`
            : "Ready to ship",
    },
  ].filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <Container className="pt-6 md:pt-10">
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            { label: product.category.name, href: `/category/${product.category.slug}` },
            { label: product.title },
          ]}
        />
      </Container>

      <Container className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14 xl:gap-20">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ProductGallery
            images={product.images.map((i) => ({ url: i.url, alt: i.alt, kind: i.kind }))}
            title={product.title}
            videoUrl={product.videoUrl}
          />
        </div>

        <div className="min-w-0">
          <Link href={`/artisans/${product.vendor.slug}`} className="group inline-flex items-center gap-3">
            <span className="relative size-11 overflow-hidden rounded-full bg-sand-200 ring-2 ring-sand-50">
              {product.vendor.profilePhotoUrl ? (
                <Image src={product.vendor.profilePhotoUrl} alt="" fill sizes="44px" unoptimized={isSvg(product.vendor.profilePhotoUrl)} className="object-cover" />
              ) : null}
            </span>
            <span>
              <span className="block text-sm font-semibold text-umber-900 group-hover:text-terracotta-700">{product.vendor.displayName}</span>
              <span className="flex items-center gap-2 text-xs text-umber-500">
                {product.vendor.craft} · {product.vendor.workshopCity}
              </span>
            </span>
            {product.vendor.status === "verified" ? <VerifiedBadge size="xs" /> : null}
          </Link>

          <h1 className="mt-5 font-display text-4xl leading-[1.08] text-balance text-umber-900 md:text-5xl">{product.title}</h1>
          <a href="#reviews" className="mt-3 inline-flex">
            <StarRating average={product.rating.average} count={product.rating.count} size="md" emptyLabel="New piece — no reviews yet" />
          </a>
          {product.summary ? <p className="mt-4 text-lg leading-relaxed text-pretty text-umber-700">{product.summary}</p> : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {product.isOneOfAKind ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-800">
                <Sparkles className="size-3.5" aria-hidden /> One of a kind
              </span>
            ) : null}
            {product.isLimitedDrop ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-950 px-3 py-1 text-xs font-semibold text-gold-200">
                Limited edition{product.editionSize ? ` of ${product.editionSize}` : ""}
              </span>
            ) : null}
            {product.availability === "ready_to_ship" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700">
                <Package className="size-3.5" aria-hidden /> Ready to ship
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <Hammer className="size-3.5" aria-hidden /> Made to order
              </span>
            )}
            {product.customizable ? <span className="rounded-full bg-terracotta-50 px-3 py-1 text-xs font-semibold text-terracotta-700">Customizable</span> : null}
          </div>

          <div className="mt-6 border-t border-umber-200/70 pt-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <BuyerPrice pkr={product.pricePkr} className="font-display text-4xl text-umber-900" />
              {product.compareAtPricePkr && product.compareAtPricePkr > product.pricePkr ? <BuyerPrice pkr={product.compareAtPricePkr} strike className="text-lg" /> : null}
            </div>
            <p className="mt-1 text-sm text-umber-500">Item price in {ctx.currency}. Shipping, duty and tax for your country are itemised below.</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-umber-700">
              <CalendarClock className="size-4 text-gold-600" aria-hidden />
              {product.availability === "made_to_order"
                ? `Made for you — about ${product.timeToMakeDays ?? "—"} days to make, then shipped.`
                : soldOut
                  ? "Sold — this piece has found its home."
                  : `${product.isOneOfAKind || product.stockQty === 1 ? "Only one available" : `${product.stockQty} available`} · leaves the workshop within ${product.dispatchDays ?? "a few"} days.`}
            </p>
          </div>

          {product.vendor.vacationMode ? (
            <p className="mt-5 rounded-xl bg-pending-50 px-4 py-3 text-sm text-umber-800 ring-1 ring-pending-600/20">
              {product.vendor.displayName} is away from the workshop at the moment. Orders are held safely and started when they return — message them for dates.
            </p>
          ) : null}

          <div className="mt-6">
            {upcoming ? (
              <div className="night rounded-2xl p-6">
                <p className="text-xs font-semibold tracking-[0.22em] text-gold-300 uppercase">Limited drop · opens {formatDate(product.dropStartsAt)}</p>
                <p className="mt-2 font-display text-2xl text-sand-50">Not released yet</p>
                <Countdown target={product.dropStartsAt!.toISOString()} tone="dark" className="mt-4" />
                <div className="mt-5">
                  <WaitlistForm productId={product.id} defaultEmail={user?.email} tone="dark" />
                </div>
                <p className="mt-3 text-xs text-sand-200/60">
                  {product.editionSize ? `An edition of ${product.editionSize}. ` : ""}Waitlist members hear first; it&apos;s first come, first served when it opens.
                </p>
              </div>
            ) : (
              <PurchaseForm
                productId={product.id}
                options={options}
                maxQty={maxQty}
                showQty={!product.isOneOfAKind && maxQty > 1}
                disabledReason={soldOut ? "Sold out" : !ctx.fx ? "Price on request" : null}
              />
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <WishlistButton productId={product.id} saved={wishlist.has(product.id)} variant="full" className="w-full" />
            <CompareToggle productId={product.id} compared={compare.includes(product.id)} variant="full" />
          </div>

          <form action={startConversation} className="mt-3">
            <input type="hidden" name="vendorId" value={product.vendorId} />
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="back" value={here} />
            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-umber-800 transition hover:bg-umber-900/5">
              <MessageCircle className="size-4" aria-hidden />
              Message {product.vendor.displayName.split(" ")[0]}
              <span className="hidden text-umber-500 sm:inline">· usually replies {responseTimeLabel(product.vendor.responseTimeHours).toLowerCase()}</span>
            </button>
          </form>

          <section aria-labelledby="landed-heading" className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="landed-heading" className="font-sans text-base font-semibold tracking-normal text-umber-900">
                What you&apos;ll pay, delivered
              </h2>
              <DestinationPicker destination={ctx.destination} />
            </div>
            {estimate ? (
              <>
                <LandedCostBreakdown landed={estimate} className="mt-3" title="Landed cost estimate" />
                <DeliveryEstimateLine delivery={estimate.delivery} className="mt-4" />
                {!estimate.complete ? (
                  <p className="mt-3 text-sm text-umber-600">
                    Lines marked <span className="font-medium text-pending-600">Pending</span> don&apos;t have confirmed rates yet. You can still order: our team
                    confirms them and you approve the final total before anything is charged.{" "}
                    <Link href="/how-importing-works" className="text-terracotta-600 underline-offset-4 hover:underline">
                      How importing works
                    </Link>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 rounded-xl bg-pending-50 px-4 py-3 text-sm text-umber-800">Exchange rates aren&apos;t set yet, so we can&apos;t estimate costs in {ctx.currency}.</p>
            )}
            <ImportNotices notices={notices} destination={ctx.destination} className="mt-4" />
          </section>

          <BuyerProtectionBox className="mt-6" />

          {product.isOneOfAKind ? (
            <div className="mt-4 flex gap-3 rounded-2xl bg-gold-50 p-4 ring-1 ring-gold-300/60">
              <Award className="mt-0.5 size-5 shrink-0 text-gold-700" aria-hidden />
              <p className="text-sm text-gold-900">
                <strong className="font-semibold">Certificate of authenticity included.</strong> A signed record of the artisan, materials and the date it was made
                — with a code anyone can verify on Wahbayaan.
              </p>
            </div>
          ) : null}
        </div>
      </Container>

      {/* The piece: description, story, specifications */}
      <section className="mt-24 border-t border-umber-200/60 pt-16 md:mt-32 md:pt-24">
        <Container className="grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
          <div>
            <Eyebrow>About this piece</Eyebrow>
            {product.description ? <p className="mt-5 font-display text-2xl leading-[1.45] text-pretty text-umber-900 md:text-[1.75rem]">{product.description}</p> : null}
            {product.story ? (
              <blockquote className="mt-10 border-l-2 border-gold-400 pl-6">
                <p className="text-xs font-semibold tracking-[0.2em] text-gold-700 uppercase">The story, in the artisan&apos;s words</p>
                <p className="mt-3 font-display text-xl text-umber-800 italic">“{product.story}”</p>
                <footer className="mt-3 text-sm text-umber-500">— {product.vendor.displayName}</footer>
              </blockquote>
            ) : null}
            {product.careInstructions ? (
              <div className="mt-10 rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
                <p className="text-sm font-semibold text-umber-900">Care</p>
                <p className="mt-1 text-umber-700">{product.careInstructions}</p>
              </div>
            ) : null}
          </div>
          <div>
            <h2 className="font-sans text-base font-semibold tracking-normal text-umber-900">Specifications</h2>
            <dl className="mt-4 divide-y divide-umber-200/60 border-y border-umber-200/60">
              {specs.map((s) => (
                <div key={s.label} className="flex gap-4 py-4">
                  <s.icon className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                  <div className="min-w-0">
                    <dt className="text-xs tracking-wider text-umber-500 uppercase">{s.label}</dt>
                    <dd className="mt-0.5 text-umber-900">
                      {s.value}
                      {"sub" in s && s.sub ? <span className="text-umber-500"> · {s.sub}</span> : null}
                    </dd>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 py-4">
                <Truck className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                <div>
                  <dt className="text-xs tracking-wider text-umber-500 uppercase">Ships from</dt>
                  <dd className="mt-0.5 text-umber-900">The artisan&apos;s workshop in Pakistan, by international courier</dd>
                </div>
              </div>
            </dl>
          </div>
        </Container>
      </section>

      {/* The artisan */}
      {vendor ? (
        <>
          <section className="night relative mt-24 md:mt-32">
            <ScallopDivider />
            <Container className="grid gap-12 py-16 md:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-20">
              <div className="relative">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] ring-1 ring-white/10">
                  {vendor.bannerUrl ? <Image src={vendor.bannerUrl} alt="" fill sizes="(min-width:1024px) 35vw, 100vw" unoptimized={isSvg(vendor.bannerUrl)} className="object-cover" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/80 via-transparent to-transparent" />
                </div>
                <div className="absolute -bottom-6 left-6 size-28 overflow-hidden rounded-full border-4 border-indigo-950 bg-sand-200 shadow-lift">
                  {vendor.profilePhotoUrl ? <Image src={vendor.profilePhotoUrl} alt={vendor.displayName} fill sizes="112px" unoptimized={isSvg(vendor.profilePhotoUrl)} className="object-cover" /> : null}
                </div>
              </div>
              <div>
                <Eyebrow dark>Made by</Eyebrow>
                <h2 className="mt-3 font-display text-4xl text-sand-50 md:text-5xl">{vendor.displayName}</h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sand-200/80">
                  <span className="text-gold-300">{vendor.craft}</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" aria-hidden /> {vendor.workshopCity}
                    {vendor.workshopRegion ? `, ${regionLabel(vendor.workshopRegion)}` : ""}
                  </span>
                  <StarRating average={vendor.rating.average} count={vendor.rating.count} tone="light" emptyLabel="New artisan — no reviews yet" />
                </p>
                {vendor.story ? <p className="mt-6 line-clamp-5 text-lg leading-relaxed text-sand-100/85">{vendor.story}</p> : null}
                <ArtisanStats vendor={vendor} tone="dark" className="mt-8" />
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href={`/artisans/${vendor.slug}`} variant="gold">
                    Visit the workshop
                  </ButtonLink>
                  {vendor.acceptsCustomOrders ? (
                    <ButtonLink href={`/custom?artisan=${vendor.slug}&product=${product.slug}`} variant="light">
                      Commission something similar
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            </Container>
          </section>
          <ScallopDivider className="rotate-180" />
        </>
      ) : null}

      {/* Reviews */}
      <section id="reviews" className="scroll-mt-20 py-20 md:py-28">
        <Container>
          <SectionHeading eyebrow="Reviews" title={product.rating.count ? "What buyers say" : "No reviews yet"} />
          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
            <div className="lg:sticky lg:top-24 lg:self-start">
              {product.rating.count && product.rating.average ? (
                <div className="rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
                  <p className="font-display text-6xl text-umber-900 tabular-nums">{product.rating.average.toFixed(1)}</p>
                  <StarRating average={product.rating.average} count={product.rating.count} size="lg" className="mt-2" />
                  <div className="mt-5">
                    <RatingHistogram histogram={product.histogram} total={product.rating.count} />
                  </div>
                </div>
              ) : (
                <p className="text-umber-600">
                  This piece is new. {product.vendor.displayName} has{" "}
                  {product.vendorRating.count ? `a ${product.vendorRating.average?.toFixed(1)}★ rating from ${product.vendorRating.count} reviews across their work.` : "no reviews yet."}
                </p>
              )}
              <div id="write-review" className="mt-6 scroll-mt-24 rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
                <p className="font-display text-xl text-umber-900">Bought this piece?</p>
                {eligibility.eligible ? (
                  <div className="mt-4">
                    <ReviewForm productId={product.id} />
                  </div>
                ) : eligibility.reason === "signed_out" ? (
                  <p className="mt-2 text-sm text-umber-600">
                    <Link href={`/login?next=${encodeURIComponent(`${here}#write-review`)}`} className="font-medium text-terracotta-600 hover:underline">
                      Sign in
                    </Link>{" "}
                    to review it once it&apos;s been delivered. Reviews come only from verified buyers.
                  </p>
                ) : eligibility.reason === "pending" ? (
                  <p className="mt-2 text-sm text-umber-600">Thanks — your review is with our team and will appear once approved.</p>
                ) : eligibility.reason === "reviewed" ? (
                  <p className="mt-2 text-sm text-umber-600">You&apos;ve already reviewed this piece. Thank you.</p>
                ) : (
                  <p className="mt-2 text-sm text-umber-600">Reviews open once your order has been delivered — so every review comes from a real buyer.</p>
                )}
              </div>
            </div>
            <div className="min-w-0 space-y-8">
              {photoWall.length || artisanWall.length ? (
                <div>
                  <p className="mb-3 text-sm font-semibold text-umber-900">{photoWall.length ? "Buyer photos" : `Buyer photos of ${product.vendor.displayName}'s work`}</p>
                  <ReviewPhotoWall photos={photoWall.length ? photoWall : artisanWall} />
                </div>
              ) : null}
              {product.reviews.length ? (
                <div className="grid gap-4">
                  {product.reviews.map((r) => (
                    <ReviewCard key={r.id} review={r} vendorName={product.vendor.displayName} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Container>
      </section>

      {related.items.length ? (
        <section className="border-t border-umber-200/60 py-20 md:py-24">
          <Container>
            <SectionHeading
              eyebrow={`More ${product.category.name.toLowerCase()}`}
              title="You may also love"
              action={
                <ButtonLink href={`/category/${product.category.slug}`} variant="outline">
                  See all
                </ButtonLink>
              }
            />
            <ProductGrid products={related.items} columns="four" className="mt-10" />
          </Container>
        </section>
      ) : null}

      {moreFromArtisan.items.length ? (
        <section className="pb-8">
          <Container>
            <SectionHeading
              eyebrow="From the same workshop"
              title={`More from ${product.vendor.displayName}`}
              action={
                <ButtonLink href={`/artisans/${product.vendor.slug}`} variant="outline">
                  Visit the workshop
                </ButtonLink>
              }
            />
            <ProductGrid products={moreFromArtisan.items} columns="four" className="mt-10" />
          </Container>
        </section>
      ) : null}
    </>
  );
}
