import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Camera, Fingerprint, Home, MapPinned, PackageSearch, Video } from "lucide-react";
import { TileDivider } from "@/components/brand/logo";
import { ArtisanStoryCard } from "@/components/store/artisan-card";
import { isSvg } from "@/components/store/illustration-tag";
import { Eyebrow, PageHero } from "@/components/store/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState, SectionHeading } from "@/components/ui/misc";
import { getPublicCategories, getPublicVendors } from "@/lib/queries/catalog";
import { cn } from "@/lib/utils/cn";
import { REGION_LABELS } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Meet the artisans",
  description: "Verified Pakistani artisans — calligraphers, weavers, carvers, potters and painters — each with their own workshop, story and record on Wahbayaan.",
};

const STEPS = [
  { icon: Fingerprint, title: "Identity", text: "We match a government ID to the person named on the profile — the maker, not a middleman." },
  { icon: Home, title: "Workshop", text: "We confirm the workshop exists where the profile says, and that the work is made there." },
  { icon: PackageSearch, title: "Sample work", text: "Our team inspects finished pieces for quality, materials and honest description." },
  { icon: Video, title: "Video walk-through", text: "A live call around the workshop: tools, materials and work in progress." },
  { icon: MapPinned, title: "Pick-up address", text: "The export collection address is checked so couriers collect from the real workshop." },
];

export default async function ArtisansPage(props: PageProps<"/artisans">) {
  const sp = await props.searchParams;
  const craft = typeof sp.craft === "string" ? sp.craft : undefined;
  const region = typeof sp.region === "string" && sp.region in REGION_LABELS ? sp.region : undefined;
  const [vendors, categories] = await Promise.all([getPublicVendors(), getPublicCategories()]);

  const crafts = categories.filter((c) => vendors.some((v) => v.primaryCategoryId === c.id));
  const regions = [...new Set(vendors.map((v) => v.workshopRegion).filter((r): r is NonNullable<typeof r> => !!r))];
  const craftCat = crafts.find((c) => c.slug === craft);
  const shown = vendors.filter((v) => (!craftCat || v.primaryCategoryId === craftCat.id) && (!region || v.workshopRegion === region));
  const href = (patch: { craft?: string | null; region?: string | null }) => {
    const p = new URLSearchParams();
    const c = patch.craft === undefined ? craft : patch.craft;
    const r = patch.region === undefined ? region : patch.region;
    if (c) p.set("craft", c);
    if (r) p.set("region", r);
    const s = p.toString();
    return s ? `/artisans?${s}#directory` : "/artisans#directory";
  };
  const collage = vendors.slice(0, 4);
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm transition",
      active ? "bg-indigo-900 text-sand-50 shadow-soft" : "bg-sand-50 text-umber-700 ring-1 ring-umber-200/70 hover:ring-umber-400",
    );

  return (
    <>
      <PageHero
        eyebrow="The makers"
        title={
          <>
            Meet the artisans <span className="gold-text italic">behind every piece</span>
          </>
        }
        description="Calligraphers in Lahore, weavers near Peshawar, carvers in Taxila, potters in Multan. Every artisan here has passed our identity, workshop and sample checks — and every piece carries their name."
        aside={
          collage.length ? (
            <div className="grid grid-cols-2 gap-3">
              {collage.map((v, i) => (
                <Link
                  key={v.id}
                  href={`/artisans/${v.slug}`}
                  className={cn("group relative overflow-hidden rounded-3xl ring-1 ring-white/10", i % 3 === 0 ? "aspect-[4/5]" : "aspect-square", i === 1 && "mt-10")}
                >
                  {v.bannerUrl ? <Image src={v.bannerUrl} alt="" fill sizes="20vw" unoptimized={isSvg(v.bannerUrl)} className="object-cover transition duration-700 group-hover:scale-105" /> : null}
                  <span className="absolute inset-0 bg-gradient-to-t from-indigo-950/85 to-transparent" />
                  <span className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="relative size-8 overflow-hidden rounded-full ring-2 ring-sand-50">
                      {v.profilePhotoUrl ? <Image src={v.profilePhotoUrl} alt="" fill sizes="32px" unoptimized={isSvg(v.profilePhotoUrl)} className="object-cover" /> : null}
                    </span>
                    <span className="text-xs font-medium text-sand-50">{v.displayName}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null
        }
      >
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {[
            { k: "Verified artisans", v: vendors.length },
            { k: "Crafts", v: crafts.length },
            { k: "Regions of Pakistan", v: regions.length },
          ].map((s) => (
            <div key={s.k}>
              <dt className="text-xs tracking-wider text-sand-200/60 uppercase">{s.k}</dt>
              <dd className="font-display text-4xl text-sand-50 tabular-nums">{s.v}</dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <section id="directory" className="scroll-mt-16 pt-14 md:pt-20">
        <Container>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Filter by craft" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
              <Link href={href({ craft: null })} className={chip(!craftCat)} aria-current={!craftCat ? "true" : undefined}>
                All crafts
              </Link>
              {crafts.map((c) => (
                <Link key={c.slug} href={href({ craft: craft === c.slug ? null : c.slug })} className={chip(craft === c.slug)} aria-current={craft === c.slug ? "true" : undefined}>
                  {c.name}
                </Link>
              ))}
            </nav>
            {regions.length > 1 ? (
              <nav aria-label="Filter by region" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
                {regions.map((r) => (
                  <Link key={r} href={href({ region: region === r ? null : r })} className={chip(region === r)} aria-current={region === r ? "true" : undefined}>
                    {REGION_LABELS[r]}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
          <p className="mt-6 text-sm text-umber-500" aria-live="polite">
            Showing <strong className="text-umber-900">{shown.length}</strong> of {vendors.length} artisans
            {craftCat ? ` · ${craftCat.name}` : ""}
            {region ? ` · ${REGION_LABELS[region]}` : ""}
          </p>
          {shown.length ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((v) => (
                <ArtisanStoryCard key={v.id} vendor={v} variant="feature" />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-8"
              title="No artisans match yet"
              action={
                <ButtonLink href="/artisans#directory" variant="outline">
                  Show all artisans
                </ButtonLink>
              }
            >
              We&apos;re verifying new workshops every month. Try another craft or region.
            </EmptyState>
          )}
        </Container>
      </section>

      <section className="mt-24 md:mt-32">
        <TileDivider />
        <div className="bg-sand-100/70 py-20 md:py-28">
          <Container className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <div>
              <Eyebrow>How verification works</Eyebrow>
              <h2 className="mt-3 font-display text-4xl leading-[1.08] text-umber-900 md:text-5xl">What the Verified badge means</h2>
              <p className="mt-5 text-lg text-umber-600">
                Buying from someone you&apos;ve never met, thousands of miles away, takes trust. So before any artisan can list, our team checks the person, the place and the work.
              </p>
              <div className="mt-8 flex items-start gap-3 rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
                <BadgeCheck className="mt-0.5 size-6 shrink-0 fill-turquoise-500 text-white" aria-hidden />
                <p className="text-sm text-umber-700">
                  Each profile lists the checks it has passed and when. The badge isn&apos;t a guarantee of taste — that&apos;s what reviews and buyer photos are for — and
                  your payment is still held until your piece arrives.
                </p>
              </div>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className={cn("rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60", i === STEPS.length - 1 && "sm:col-span-2")}>
                  <div className="flex items-center justify-between">
                    <s.icon className="size-6 text-gold-600" aria-hidden />
                    <span className="font-display text-3xl text-umber-200 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-4 font-display text-xl text-umber-900">{s.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-umber-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </Container>
        </div>
        <TileDivider />
      </section>

      <section className="py-20 md:py-28">
        <Container>
          <div className="night relative overflow-hidden rounded-[2rem] px-6 py-14 text-center md:px-16">
            <Camera className="mx-auto size-8 text-gold-300" aria-hidden />
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl text-sand-50 md:text-5xl">Are you an artisan in Pakistan?</h2>
            <p className="mx-auto mt-4 max-w-xl text-sand-200/80">
              Sell to buyers in the US, UK and Canada. You&apos;re paid in rupees; we handle international payment, export paperwork and courier booking.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/become-a-seller" variant="gold" size="lg">
                Apply to sell
              </ButtonLink>
              <ButtonLink href="/custom" variant="light" size="lg">
                Commission an artisan
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
