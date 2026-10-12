import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Calculator, Play, ShieldCheck, Truck } from "lucide-react";
import { BuyerPrice } from "@/components/money/buyer-price";
import { BrandProductCard } from "@/components/store/brands/brand-product-card";
import { BrandLogo } from "@/components/store/brands/brand-tile";
import { readingMinutes } from "@/components/store/journal-card";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductCard } from "@/components/store/product-card";
import type { PublicBrand, PublicBrandProduct } from "@/lib/queries/brands";
import type { ProductCardData, PublicCategory, PublicVendor } from "@/lib/queries/catalog";
import type { JournalCard, PublicCollection } from "@/lib/queries/storefront";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import content from "@/content/preview/c/home.json";
import { PcCarousel } from "./carousel";
import { PcHotspot } from "./hotspot";
import { Chip, FloralCorner, isSvg, PhoolStrip, PhotoNeeded, PillLink, SectionHead, TONES, type Tone } from "./motifs";
import { PcTabs } from "./tabs";
import s from "./pc.module.css";

/** Theme spacing: 100 / 80 / 60 px between major sections. */
export function Section({ id, label, className, children }: { id?: string; label?: string; className?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} aria-label={id ? undefined : label} className={cn("mt-[60px] md:mt-20 lg:mt-[100px]", className)}>
      {children}
    </section>
  );
}

export function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10", className)}>{children}</div>;
}

// ── 2 · Our collections (round tiles) ─────────────────────────────────────

const RING: Record<Tone, string> = {
  magenta: "group-hover:shadow-[0_0_0_3px_var(--pc-magenta)] group-focus-visible:shadow-[0_0_0_3px_var(--pc-magenta)]",
  teal: "group-hover:shadow-[0_0_0_3px_var(--pc-teal)] group-focus-visible:shadow-[0_0_0_3px_var(--pc-teal)]",
  saffron: "group-hover:shadow-[0_0_0_3px_var(--pc-saffron)] group-focus-visible:shadow-[0_0_0_3px_var(--pc-saffron)]",
};

export function CollectionsSection({ categories }: { categories: PublicCategory[] }) {
  const c = content.collections;
  if (!categories.length) return null;
  return (
    <Section id="pc-collections">
      <Wrap>
        <SectionHead id="pc-collections" eyebrow={c.eyebrow} title={c.title} urdu={c.urdu} line={c.line} align="center" tone="teal" />
        <ul className="mt-10 flex flex-wrap justify-center gap-y-8">
          {categories.map((cat, i) => (
            <li key={cat.slug} className="basis-1/3 px-1.5 md:basis-1/4 lg:basis-1/5 xl:basis-[10%]">
              <Link href={`/category/${cat.slug}`} className="group flex flex-col items-center text-center focus-visible:outline-none">
                <span
                  className={cn(
                    "relative block size-[5.75rem] overflow-hidden rounded-full bg-white shadow-[0_0_0_1px_var(--pc-line)] transition-shadow duration-300 sm:size-28 xl:size-[6.5rem]",
                    RING[TONES[i % 3]],
                  )}
                >
                  {cat.coverImageUrl ? (
                    <Image src={cat.coverImageUrl} alt="" fill sizes="112px" unoptimized={isSvg(cat.coverImageUrl)} className="object-cover transition-transform duration-700 group-hover:scale-110 motion-reduce:transition-none" />
                  ) : null}
                </span>
                <span className="mt-3 text-[0.875rem] leading-snug font-semibold text-[var(--pc-ink)] group-hover:underline group-hover:underline-offset-4">{cat.name}</span>
                <span className="mt-0.5 text-xs text-[var(--pc-muted)] tabular-nums">
                  {cat.productCount} {cat.productCount === 1 ? "piece" : "pieces"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Wrap>
    </Section>
  );
}

// ── 3 · Bestsellers (tabs) ────────────────────────────────────────────────

export type BestsellerTab = { id: string; label: string; products?: ProductCardData[]; brandProducts?: PublicBrandProduct[]; href: string };

/** 2 / 3 / 5 columns. Phones show 6, tablets 9, desktop 10 — full rows each time. */
const gridItem = (i: number) => cn(i >= 6 && "max-md:hidden", i >= 9 && "md:max-lg:hidden");

export function BestsellersSection({ tabs, saved, compared }: { tabs: BestsellerTab[]; saved: Set<string>; compared: string[] | null }) {
  const c = content.bestsellers;
  return (
    <Section id="pc-best">
      <Wrap>
        <SectionHead id="pc-best" eyebrow={c.eyebrow} title={c.title} urdu={c.urdu} line={c.line} action={c.action} tone="saffron" />
        <PcTabs
          className="mt-7"
          label="Bestsellers by craft"
          tabs={tabs.map((t) => ({
            id: t.id,
            label: t.label,
            panel: (
              <>
                {(t.products?.length ?? 0) + (t.brandProducts?.length ?? 0) === 0 ? (
                  <p className="rounded-[var(--radius-card)] bg-white px-5 py-10 text-center text-sm text-[var(--pc-muted)] shadow-[0_0_0_1px_var(--pc-line)]">
                    Nothing listed here yet.{" "}
                    <Link href={t.href} className="font-medium text-[var(--pc-ink)] underline underline-offset-4">
                      Browse the craft
                    </Link>
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-5">
                    {t.products?.slice(0, 10).map((p, i) => (
                      <li key={p.id} className={gridItem(i)}>
                        <ProductCard product={p} saved={saved.has(p.id)} compared={compared ? compared.includes(p.id) : undefined} />
                      </li>
                    ))}
                    {t.brandProducts?.slice(0, 10).map((p, i) => (
                      <li key={p.id} className={gridItem(i)}>
                        <BrandProductCard product={p} />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-8 flex justify-center">
                  <PillLink href={t.href}>{t.id === "all" ? "Shop all pieces" : `More ${t.label.toLowerCase()}`}</PillLink>
                </div>
              </>
            ),
          }))}
        />
      </Wrap>
    </Section>
  );
}

// ── 4 · Shop by artisans / brands (tall cards) ────────────────────────────

/** 5 per row desktop, 2 tablet, 1 phone; the 5th card hides below desktop (as in the theme). */
const tallItem = (i: number) => cn(i === 4 && "hidden lg:block", i > 4 && "hidden");

function TallCard({ href, image, avatar, title, sub, tag, tone }: { href: string; image: string | null; avatar: React.ReactNode; title: string; sub: string; tag?: string; tone: Tone }) {
  return (
    <Link href={href} className={cn(s.card, "group block focus-visible:outline-offset-4")}>
      <FloralCorner />
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-sand-200 shadow-[0_0_0_1px_var(--pc-line)] md:aspect-[4/5] lg:aspect-[3/5]">
        {image ? <Image src={image} alt="" fill sizes="(min-width:1024px) 20vw, (min-width:768px) 50vw, 100vw" unoptimized={isSvg(image)} className="object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none" /> : null}
        {tag ? <Chip tone={tone} className="absolute top-3 left-3">{tag}</Chip> : null}
        <span className="glass absolute inset-x-2 bottom-2 flex items-center gap-3 rounded-[1rem] p-2.5 pr-3">
          {avatar}
          <span className="min-w-0">
            <span className="block truncate text-[0.95rem] font-semibold text-umber-900">{title}</span>
            <span className="block truncate text-xs text-umber-800">{sub}</span>
          </span>
          <ArrowUpRight className="ml-auto size-4 shrink-0 text-umber-800 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

export function MakersSection({ vendors, vendorImage, brands, brandImage }: { vendors: PublicVendor[]; vendorImage: Map<string, string>; brands: PublicBrand[]; brandImage: Map<string, string> }) {
  const c = content.makers;
  if (!vendors.length && !brands.length) return null;
  const artisansPanel = (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {vendors.slice(0, 5).map((v, i) => (
        <li key={v.id} className={tallItem(i)}>
          <TallCard
            href={`/artisans/${v.slug}`}
            image={vendorImage.get(v.id) ?? v.bannerUrl}
            tone={TONES[i % 3]}
            tag={v.status === "verified" ? "Verified" : undefined}
            title={v.displayName}
            sub={[v.craft, v.workshopCity].filter(Boolean).join(" · ")}
            avatar={
              <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-sand-200">
                {v.profilePhotoUrl ? <Image src={v.profilePhotoUrl} alt="" fill sizes="40px" unoptimized={isSvg(v.profilePhotoUrl)} className="object-cover" /> : null}
              </span>
            }
          />
        </li>
      ))}
    </ul>
  );
  const brandsPanel = (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {brands.slice(0, 5).map((b, i) => (
        <li key={b.id} className={tallItem(i)}>
          <TallCard
            href={`/brands/${b.slug}`}
            image={brandImage.get(b.id) ?? null}
            tone={TONES[(i + 1) % 3]}
            title={b.name}
            sub={`${b.productCount} ${b.productCount === 1 ? "piece" : "pieces"}`}
            avatar={<BrandLogo name={b.name} logoUrl={b.logoUrl} size={40} className="rounded-full" />}
          />
        </li>
      ))}
    </ul>
  );
  const tabs = [
    ...(vendors.length ? [{ id: "artisans", label: c.tabs.artisans, panel: <>{artisansPanel}<More href={c.action.href} label={c.action.label} /></> }] : []),
    ...(brands.length ? [{ id: "brands", label: c.tabs.brands, panel: <>{brandsPanel}<More href={c.brandsAction.href} label={c.brandsAction.label} /></> }] : []),
  ];
  return (
    <Section id="pc-makers">
      <Wrap>
        <SectionHead id="pc-makers" eyebrow={c.eyebrow} title={c.title} urdu={c.urdu} line={c.line} tone="magenta" />
        <PcTabs className="mt-7" label="Shop by maker" tabs={tabs} />
      </Wrap>
    </Section>
  );
}

function More({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-8 flex justify-center">
      <PillLink href={href}>{label}</PillLink>
    </div>
  );
}

// ── 5 · Crafted heritage lookbook (5-column mosaic with hotspots) ─────────

function PinCard({ p }: { p: ProductCardData }) {
  return (
    <>
      <p className="text-xs text-[var(--pc-muted)]">{p.vendorName}</p>
      <p className="mt-0.5 line-clamp-2 text-sm leading-snug font-semibold">{p.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <BuyerPrice pkr={p.pricePkr} className="text-sm font-semibold" />
        <Link href={`/product/${p.slug}`} className="inline-flex h-9 items-center gap-1 rounded-full bg-[var(--pc-ink)] px-3 text-xs font-semibold text-white hover:bg-indigo-900">
          View <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </>
  );
}

function LookTile({ p, ratio, pin }: { p: ProductCardData; ratio: string; pin: [number, number] }) {
  return (
    <div className="relative">
      <div className={cn("relative overflow-hidden rounded-[var(--radius-card)] bg-sand-200", ratio)}>
        <Image src={p.imageUrl} alt={p.imageAlt ?? p.title} fill sizes="(min-width:1024px) 20vw, 50vw" unoptimized={isSvg(p.imageUrl)} className="object-cover" />
      </div>
      <PcHotspot x={pin[0]} y={pin[1]} label={p.title}>
        <PinCard p={p} />
      </PcHotspot>
    </div>
  );
}

function LookBanner({ b }: { b: (typeof content.heritage.banners)[number] }) {
  return (
    <Link href={b.href} className={cn(s.card, "group flex h-[150px] flex-col justify-between overflow-visible rounded-[var(--radius-card)] bg-white p-4 shadow-[0_0_0_1px_var(--pc-line)] hover:shadow-[0_0_0_1px_rgb(34_26_19/0.16),0_14px_30px_-18px_rgb(34_26_19/0.4)] sm:h-[186px] sm:p-5")}>
      <FloralCorner />
      <Chip tone={b.tone as Tone} className="self-start">
        {b.chip}
      </Chip>
      <span className="flex items-end justify-between gap-2">
        <span className={cn(s.display, "text-xl text-[var(--pc-ink)] sm:text-2xl")}>{b.title}</span>
        <ArrowUpRight className="size-5 shrink-0 text-[var(--pc-ink)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
      </span>
    </Link>
  );
}

export function HeritageSection({ looks }: { looks: ProductCardData[] }) {
  const c = content.heritage;
  if (looks.length < 8) return null;
  const [a, b, d, e, f, g, h, k] = looks;
  const [b1, b2] = c.banners;
  const col = "flex flex-col gap-3 sm:gap-4";
  return (
    <Section id="pc-heritage">
      <Wrap>
        <SectionHead id="pc-heritage" eyebrow={c.eyebrow} title={c.title} urdu={c.urdu} line={c.line} align="center" tone="magenta" />
      </Wrap>
      <div className="mx-auto mt-8 grid max-w-[1600px] grid-cols-2 gap-3 px-4 sm:gap-4 sm:px-5 md:grid-cols-4 lg:mt-[30px] lg:grid-cols-5">
        <div className={col}>
          <LookTile p={a} ratio="aspect-[4/5]" pin={[42, 46]} />
          <LookTile p={b} ratio="aspect-square" pin={[60, 58]} />
        </div>
        <div className={col}>
          <LookTile p={d} ratio="aspect-[4/5]" pin={[55, 40]} />
          <LookBanner b={b1} />
        </div>
        <div className={col}>
          <LookTile p={e} ratio="aspect-square" pin={[40, 55]} />
          <LookTile p={f} ratio="aspect-[4/5]" pin={[58, 44]} />
        </div>
        <div className={col}>
          <LookBanner b={b2} />
          <LookTile p={g} ratio="aspect-[4/5]" pin={[46, 52]} />
        </div>
        <div className={cn(col, "hidden lg:flex")}>
          <LookTile p={h} ratio="aspect-[4/5]" pin={[52, 42]} />
          <LookTile p={k} ratio="aspect-square" pin={[44, 60]} />
        </div>
      </div>
    </Section>
  );
}

// ── 6 · Collection of the week (carousel 66% + feature 33%) ───────────────

export function WeekSection({ collection, saved, compared }: { collection: PublicCollection | null; saved: Set<string>; compared: string[] | null }) {
  const c = content.week;
  if (!collection) return null;
  const lead = collection.products[0];
  const feature = collection.coverImageUrl ?? lead?.imageUrl ?? null;
  const line = collection.description?.split(/(?<=\.)\s/)[0] ?? null;
  return (
    <Section id="pc-week">
      <Wrap className="grid items-center gap-x-[30px] gap-y-10 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <SectionHead id="pc-week" eyebrow={c.eyebrow} title={collection.title} urdu={c.urdu} line={line ?? undefined} action={{ label: c.action, href: `/collections/${collection.slug}` }} tone="teal" />
          <PcCarousel
            className="mt-7"
            label={`${collection.title} pieces`}
            itemClassName="w-[46%] sm:w-[calc(33.333%-11px)]"
            items={collection.products.map((p) => (
              <ProductCard key={p.id} product={p} saved={saved.has(p.id)} compared={compared ? compared.includes(p.id) : undefined} />
            ))}
          />
        </div>
        {feature ? (
          <div className={cn(s.card, "relative")}>
            <FloralCorner />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] bg-sand-200 shadow-[0_0_0_1px_var(--pc-line)] md:aspect-[16/9] lg:aspect-[4/5]">
              <Image src={feature} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" unoptimized={isSvg(feature)} className="object-cover" />
              <PhotoNeeded className="bottom-3 left-3">{c.featurePhotoNeeded}</PhotoNeeded>
            </div>
            {lead ? (
              <PcHotspot x={50} y={42} label={lead.title}>
                <PinCard p={lead} />
              </PcHotspot>
            ) : null}
          </div>
        ) : null}
      </Wrap>
    </Section>
  );
}

// ── 7 · Story: image + text + rounded video card ──────────────────────────

export function StorySection() {
  const c = content.story;
  const v = c.video;
  const videoUrl = v.url as string | null;
  const pill = (
    <>
      <Image src={v.poster} alt="" fill sizes="(min-width:768px) 50vw, 100vw" unoptimized className="object-cover" />
      <span className="absolute inset-0 bg-[rgb(13_17_36/0.68)]" aria-hidden />
      <span className="relative flex items-center gap-4 px-7 sm:gap-6 sm:px-12">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/90 text-[var(--pc-ink)] transition group-hover:bg-white sm:size-20">
          <Play className="size-5 translate-x-px fill-current sm:size-7" aria-hidden />
        </span>
        <span className="min-w-0 text-white">
          <span className="block text-sm text-white/85 sm:text-[1.05rem]">{v.subtitle}</span>
          <span className={cn(s.display, "mt-1 block text-xl text-white md:text-[1.35rem] lg:text-[1.7rem]")}>{v.title}</span>
        </span>
      </span>
    </>
  );
  const pillClass = "group relative flex min-h-[150px] items-center overflow-hidden rounded-[200px] sm:min-h-[200px]";
  return (
    <Section id="pc-story">
      <Wrap className="grid items-center gap-8 md:grid-cols-[5fr_7fr] md:gap-12 lg:gap-16">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-panel)] bg-sand-200 shadow-[0_0_0_1px_var(--pc-line)] max-md:aspect-[4/3]">
          <Image src={c.image} alt="" fill sizes="(min-width:768px) 40vw, 100vw" unoptimized className="object-cover" />
          <PhotoNeeded className="top-3 left-3">{c.photoNeeded}</PhotoNeeded>
        </div>
        <div>
          <SectionHead id="pc-story" eyebrow={c.eyebrow} title={c.title} urdu={c.urdu} line={c.line} tone="saffron" />
          <ul className="mt-5 flex flex-wrap gap-2">
            {c.points.map((p, i) => (
              <li key={p}>
                <Chip tone={TONES[i % 3]} className="px-3 py-1.5 text-xs">
                  {p}
                </Chip>
              </li>
            ))}
          </ul>
          <PillLink href={c.cta.href} className="mt-6">
            {c.cta.label}
          </PillLink>
          <div className="mt-8">
            {videoUrl ? (
              <a href={videoUrl} target="_blank" rel="noopener" className={pillClass} aria-label={`Play video: ${v.title}`}>
                {pill}
              </a>
            ) : (
              <>
                <div className={pillClass} role="img" aria-label={`Video coming soon: ${v.title}`}>
                  {pill}
                </div>
                <p className="mt-2 px-4 font-mono text-[10.5px] leading-snug text-[var(--pc-muted)]">
                  {v.missing} · {v.posterNeeded}
                </p>
              </>
            )}
          </div>
        </div>
      </Wrap>
    </Section>
  );
}

// ── 8 · Journal carousel ──────────────────────────────────────────────────

export function JournalSection({ posts }: { posts: JournalCard[] }) {
  const c = content.journal;
  if (!posts.length) return null;
  return (
    <Section id="pc-journal">
      <Wrap>
        <SectionHead id="pc-journal" eyebrow={c.eyebrow} title={c.title} urdu={c.urdu} line={c.line} action={c.action} tone="teal" />
        <PcCarousel
          className="mt-8"
          label="Journal posts"
          itemClassName="w-[84%] sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)]"
          items={posts.slice(0, 6).map((p, i) => (
            <Link key={p.id} href={`/journal/${p.slug}`} className={cn(s.card, "group block")}>
              <FloralCorner />
              <span className="relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-sand-200 shadow-[0_0_0_1px_var(--pc-line)]">
                {p.coverImageUrl ? <Image src={p.coverImageUrl} alt="" fill sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 85vw" unoptimized={isSvg(p.coverImageUrl)} className="object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none" /> : null}
                {p.categoryName ? <Chip tone={TONES[i % 3]} className="absolute bottom-3 left-3">{p.categoryName}</Chip> : null}
              </span>
              <span className="mt-3 block text-xs text-[var(--pc-muted)]">
                {formatDate(p.publishedAt)} · {readingMinutes(p.body)} min read
              </span>
              <span className="mt-1 block text-[1.05rem] leading-snug font-semibold tracking-[-0.01em] text-[var(--pc-ink)] group-hover:underline group-hover:underline-offset-4">{p.title}</span>
            </Link>
          ))}
        />
      </Wrap>
    </Section>
  );
}

// ── 9 · Trust strip + newsletter ──────────────────────────────────────────

const TRUST_ICONS = { calculator: Calculator, shield: ShieldCheck, badge: BadgeCheck, truck: Truck } as const;

export function TrustSection() {
  const c = content.trust;
  return (
    <Section label="Why buy here">
      <Wrap>
        <div className="overflow-hidden rounded-[var(--radius-panel)] bg-white shadow-[0_0_0_1px_var(--pc-line)]">
          <PhoolStrip thin />
          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_340px] lg:items-center lg:gap-12">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
              {c.items.map((it, i) => {
                const Icon = TRUST_ICONS[it.icon as keyof typeof TRUST_ICONS];
                const tone = TONES[i % 3];
                return (
                  <li key={it.title} className="flex flex-col gap-2.5">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-full",
                        tone === "magenta" && "bg-[var(--pc-magenta-tint)] text-[var(--pc-magenta-ink)]",
                        tone === "teal" && "bg-[var(--pc-teal-tint)] text-[var(--pc-teal-ink)]",
                        tone === "saffron" && "bg-[var(--pc-saffron-tint)] text-[var(--pc-saffron-ink)]",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--pc-ink)]">{it.title}</span>
                      <span className="mt-0.5 block text-[0.8rem] leading-snug text-[var(--pc-muted)]">{it.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-[var(--pc-line)] pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
              <p className="text-sm font-semibold text-[var(--pc-ink)]">{c.newsletter.title}</p>
              <p className="mt-0.5 mb-3 text-[0.8rem] text-[var(--pc-muted)]">{c.newsletter.line}</p>
              <NewsletterForm source="preview-c" tone="light" />
            </div>
          </div>
        </div>
      </Wrap>
    </Section>
  );
}

