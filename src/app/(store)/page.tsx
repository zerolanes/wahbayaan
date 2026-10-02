import Image from "next/image";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowRight, ArrowUpRight, BadgeCheck, Calculator, MapPin, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import { VerifiedBadge } from "@/components/store/trust";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { getWishlistIds } from "@/lib/commerce/cart";
import { db } from "@/lib/db/client";
import { journalPosts } from "@/lib/db/schema";
import { getPublicCategories, getPublicProducts, getPublicVendors } from "@/lib/queries/catalog";
import { journalPostLive } from "@/lib/queries/storefront";
import { getSetting, isDemoMode } from "@/lib/settings";
import { CRAFT_ATLAS as ATLAS } from "@/lib/heritage";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

const isSvg = (url: string) => url.split("?")[0].endsWith(".svg");

const PROMISES = [
  { icon: Calculator, title: "Landed cost up front", text: "Shipping, import duty and tax for your country, itemised before you pay." },
  { icon: ShieldCheck, title: "Payment held until delivery", text: "The artisan is paid only after your piece arrives as described." },
  { icon: BadgeCheck, title: "Verified artisans", text: "Identity, workshop and sample work checked by our team." },
  { icon: Truck, title: "Tracked, insured shipping", text: "Packed for export and tracked door to door to the US, UK and Canada." },
];

const STEPS = [
  { title: "Choose a piece", text: "Every listing names its maker, materials, size and how long it takes to make." },
  { title: "See every cost", text: "We show the item, international shipping and your country's import duty and tax — before checkout." },
  { title: "Pay in your currency", text: "USD, GBP or CAD. Wahbayaan holds the payment; nothing reaches the artisan yet." },
  { title: "Made, packed, exported", text: "The artisan makes or packs your piece. We handle export paperwork and the courier." },
  { title: "Confirm it arrived", text: "When it's in your hands and as described, the artisan is paid. One-of-a-kind pieces include a certificate." },
];

export default async function HomePage() {
  const [ctx, categories, vendors, featured, recent, home] = await Promise.all([
    getBuyerContext(),
    getPublicCategories(),
    getPublicVendors(),
    getPublicProducts({ featured: true, limit: 8 }),
    getPublicProducts({ sort: "newest", limit: 20 }),
    getSetting("home"),
  ]);
  const d = await db();
  const [saved, posts] = await Promise.all([
    getWishlistIds(ctx.ownerKey),
    d
      .select()
      .from(journalPosts)
      .where(and(journalPostLive(), ...(isDemoMode() ? [] : [eq(journalPosts.isDemo, false)])))
      .orderBy(desc(journalPosts.publishedAt))
      .limit(3),
  ]);

  const crafts = categories.filter((c) => c.showOnHome && (c.productCount > 0 || isDemoMode()));
  const featuredVendors = home.featuredVendorIds.length
    ? // In the order picked in Admin → Content → Homepage; hidden artisans drop out.
      home.featuredVendorIds.map((id) => vendors.find((v) => v.id === id)).filter((v) => v !== undefined)
    : [...vendors.filter((v) => v.isFeatured), ...vendors.filter((v) => !v.isFeatured)];
  const pieceCount = categories.reduce((n, c) => n + c.productCount, 0);
  const cities = new Set(vendors.map((v) => v.workshopCity).filter(Boolean));
  const heroPieces = (featured.items.length >= 3 ? featured.items : recent.items).slice(0, 3);
  // Keep the featured grid in full rows of four, topped up with the newest work.
  const featuredIds = new Set(featured.items.map((p) => p.id));
  const featuredGrid = [...featured.items, ...recent.items.filter((p) => !featuredIds.has(p.id))].slice(0, featured.items.length > 4 ? 8 : 4);
  const gallery = recent.items.filter((p) => !featuredGrid.some((f) => f.id === p.id)).slice(0, 8);

  return (
    <>
      {/* Hero */}
      <section>
        <Container className="grid items-center gap-8 pt-6 pb-10 md:gap-10 md:py-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-16">
          <div>
            <p className="text-[0.8125rem] font-semibold tracking-[0.06em] text-terracotta-700 uppercase">{home.heroEyebrow}</p>
            <h1 className="mt-4 text-[2.75rem] leading-[1.02] tracking-[-0.035em] text-umber-900 sm:text-6xl xl:text-7xl">{home.heroTitle}</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-umber-700">{home.heroSubtitle}</p>
            <div className="mt-7 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
              <ButtonLink href="/shop" size="lg" className="max-sm:h-12 max-sm:px-4 max-sm:text-[0.95rem]">
                Shop the collection <ArrowRight className="size-4 max-sm:hidden" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/artisans" size="lg" variant="outline" className="max-sm:h-12 max-sm:px-4 max-sm:text-[0.95rem]">
                Meet the artisans
              </ButtonLink>
            </div>
            <dl className="mt-9 grid max-w-md grid-cols-3 gap-6 border-t border-umber-900/10 pt-6">
              {[
                { label: "Verified artisans", value: vendors.length },
                { label: "Pieces listed", value: pieceCount },
                { label: "Craft cities", value: cities.size },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-xs text-umber-600">{s.label}</dt>
                  <dd className="mt-1 font-display text-3xl tracking-[-0.03em] text-umber-900 tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {heroPieces.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {heroPieces.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/product/${p.slug}`}
                  className={cn("group relative overflow-hidden rounded-[var(--radius-panel)] bg-sand-200 shadow-soft", i === 0 ? "row-span-2 aspect-[3/4] sm:aspect-auto" : "aspect-[4/3]")}
                >
                  <Image
                    src={p.imageUrl}
                    alt={p.imageAlt ?? p.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 28vw, 50vw"
                    unoptimized={isSvg(p.imageUrl)}
                    className="object-cover transition-transform duration-700 ease-[var(--ease-spring)] group-hover:scale-[1.03]"
                  />
                  <div className="glass-dark absolute inset-x-2 bottom-2 rounded-[1.125rem] px-3 py-2 sm:inset-x-3 sm:bottom-3 sm:px-3.5 sm:py-2.5">
                    <p className="line-clamp-1 text-sm font-semibold text-white">{p.title}</p>
                    <p className="line-clamp-1 text-xs text-sand-100">
                      {p.categoryName} · {p.vendorName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </Container>
      </section>

      {/* Promises strip */}
      <section aria-label="Our promises">
        <Container>
          <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex w-[78%] shrink-0 snap-start gap-3.5 rounded-[var(--radius-card)] bg-sand-50 p-5 shadow-[0_0_0_0.5px_rgb(34_26_19/0.08)] sm:w-auto">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-terracotta-50 text-terracotta-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-[0.95rem] font-semibold text-umber-900">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-umber-700">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Shop by craft */}
      {crafts.length ? (
        <section className="py-16 md:py-24">
          <Container>
            <Heading eyebrow="Our collections" title="Shop by craft" action={{ href: "/shop", label: "Shop everything" }}>
              Each craft is made, photographed and shipped by the people who practise it.
            </Heading>
            <ul className="-mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:mx-0 md:mt-10 md:grid md:grid-cols-5 md:gap-5 md:overflow-visible md:px-0 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:gap-4">
              {crafts.map((c) => (
                <li key={c.slug} className="w-[7.5rem] shrink-0 snap-start md:w-auto">
                  <Link href={`/category/${c.slug}`} className="pressable group block text-center">
                    <span className="relative mx-auto block aspect-square overflow-hidden rounded-[var(--radius-card)] bg-sand-200 shadow-[0_0_0_0.5px_rgb(34_26_19/0.08)] transition-shadow group-hover:shadow-lift">
                      {c.coverImageUrl ? (
                        <Image src={c.coverImageUrl} alt="" fill sizes="160px" unoptimized={isSvg(c.coverImageUrl)} className="object-cover transition-transform duration-700 ease-[var(--ease-spring)] group-hover:scale-105" />
                      ) : null}
                    </span>
                    <span className="mt-2.5 block text-sm leading-snug font-semibold text-umber-900 group-hover:text-terracotta-700">{c.name}</span>
                    <span className="block text-xs text-umber-600">
                      {c.productCount} {c.productCount === 1 ? "piece" : "pieces"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* Featured pieces */}
      {featured.items.length ? (
        <section className="pb-16 md:pb-24">
          <Container>
            <Heading eyebrow="Featured" title="Pieces with a maker's name" action={{ href: "/shop?sort=featured", label: "See all pieces" }}>
              One-of-a-kind and small-batch work, each listed by the artisan who made it.
            </Heading>
            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
              {featuredGrid.map((p, i) => (
                <ProductCard key={p.id} product={p} saved={saved.has(p.id)} priority={i < 4} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Craft atlas */}
      <section className="py-16 md:py-24">
        <Container>
          <Heading eyebrow="Where it's made" title="A map of Pakistani craft">
            Every region keeps its own tradition. These are the cities our artisans work from.
          </Heading>
          <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {ATLAS.map((a) => (
              <li key={a.city}>
                <Link href={a.href} className="pressable group flex h-full flex-col rounded-[var(--radius-card)] bg-sand-50 p-4 shadow-[0_0_0_0.5px_rgb(34_26_19/0.08)] hover:bg-white hover:shadow-soft sm:p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-xl text-umber-900 sm:text-2xl">{a.city}</p>
                    <p lang="ur" className="font-urdu text-lg leading-none text-umber-600">
                      {a.urdu}
                    </p>
                  </div>
                  <p className="mt-1 flex-1 text-sm font-medium text-terracotta-700 sm:mt-2 sm:flex-none">{a.craft}</p>
                  <p className="mt-2 hidden flex-1 text-sm leading-relaxed text-umber-700 sm:block">{a.note}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-umber-600 group-hover:text-umber-900">
                    Browse <ArrowUpRight className="size-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* How importing works */}
      <section className="py-16 md:py-24">
        <Container className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
          <div>
            <p className="text-[0.8125rem] font-semibold tracking-[0.06em] text-terracotta-700 uppercase">How importing works</p>
            <h2 className="mt-3 font-display text-4xl leading-[1.08] tracking-[-0.03em] text-umber-900 md:text-5xl">Buying from a workshop in Pakistan, made simple.</h2>
            <p className="mt-4 text-lg text-umber-600">You pay for the piece, the international shipping and your country&apos;s import charges — and you see every line before you pay.</p>
            <div className="mt-8 rounded-[var(--radius-panel)] bg-white p-6 shadow-soft">
              <p className="text-xs font-semibold tracking-wide text-umber-500 uppercase">What you see at checkout</p>
              <dl className="mt-4 divide-y divide-umber-100 text-sm">
                {["Piece price", "International shipping", "Import duty", "Sales tax / VAT / GST", "Brokerage & handling"].map((l) => (
                  <div key={l} className="flex justify-between py-2.5">
                    <dt className="text-umber-700">{l}</dt>
                    <dd className="text-umber-500">Itemised</dd>
                  </div>
                ))}
                <div className="flex justify-between pt-3 font-semibold text-umber-900">
                  <dt>Landed total</dt>
                  <dd>In USD, GBP or CAD</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-umber-500">If a rate for your country isn&apos;t confirmed yet, we say so — we never show it as zero.</p>
            </div>
            <ButtonLink href="/how-importing-works" variant="outline" className="mt-6">
              Read the full guide <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
          <ol className="relative space-y-8 border-l border-umber-200 pl-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="absolute top-0 -left-[2.95rem] grid size-7 place-items-center rounded-full bg-white text-xs font-semibold text-umber-900 shadow-[0_0_0_1px_rgb(34_26_19/0.14)] tabular-nums">
                  {i + 1}
                </span>
                <h3 className="font-display text-xl text-umber-900 md:text-2xl">{s.title}</h3>
                <p className="mt-1.5 max-w-lg leading-relaxed text-umber-700">{s.text}</p>
              </li>
            ))}
            <li className="relative">
              <span className="absolute top-0 -left-[2.95rem] grid size-7 place-items-center rounded-full bg-terracotta-600 text-white">
                <PackageCheck className="size-4" aria-hidden />
              </span>
              <p className="text-sm text-umber-600">Something wrong on arrival? Open a claim and your payment stays held while we sort it out.</p>
            </li>
          </ol>
        </Container>
      </section>

      {/* Shop by artisan */}
      {featuredVendors.length ? (
        <section className="border-t border-umber-200/60 py-16 md:py-24">
          <Container>
            <Heading eyebrow="Meet the artisans" title="Shop by artisan" action={{ href: "/artisans", label: "All artisans" }}>
              Families and workshops, each verified by our team before they can sell — identity, workshop and sample work.
            </Heading>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredVendors.slice(0, 8).map((v) => (
                <li key={v.id}>
                  <Link href={`/artisans/${v.slug}`} className="pressable group flex h-full items-center gap-4 rounded-[var(--radius-card)] bg-sand-50 p-4 shadow-[0_0_0_0.5px_rgb(34_26_19/0.08)] hover:bg-white hover:shadow-soft">
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-sand-200">
                      {v.profilePhotoUrl ? <Image src={v.profilePhotoUrl} alt="" fill sizes="64px" unoptimized={isSvg(v.profilePhotoUrl)} className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-umber-900 group-hover:text-terracotta-700">{v.displayName}</span>
                        {v.status === "verified" ? <VerifiedBadge size="xs" label={false} /> : null}
                      </span>
                      <span className="block truncate text-sm text-umber-600">{v.craft}</span>
                      {v.workshopCity ? (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-umber-500">
                          <MapPin className="size-3" aria-hidden /> {v.workshopCity}, Pakistan
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* Crafted heritage gallery */}
      {gallery.length >= 4 ? (
        <section className="pb-16 md:pb-24">
          <Container>
            <Heading eyebrow="Crafted heritage" title="New from the workshops" action={{ href: "/shop?sort=newest", label: "Shop new arrivals" }} />
            <div className="mt-10 columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
              {gallery.map((p, i) => (
                <Link key={p.id} href={`/product/${p.slug}`} className="group relative block break-inside-avoid overflow-hidden rounded-[var(--radius-card)] bg-sand-200">
                  <div className={cn("relative", i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-square" : "aspect-[4/5]")}>
                    <Image src={p.imageUrl} alt={p.imageAlt ?? p.title} fill sizes="(min-width: 1024px) 25vw, 50vw" unoptimized={isSvg(p.imageUrl)} className="object-cover transition duration-700 group-hover:scale-[1.03]" />
                  </div>
                  <div className="glass-dark absolute inset-x-2 bottom-2 translate-y-1 rounded-[1rem] px-3 py-2 opacity-0 transition-[opacity,translate] duration-[var(--dur-base)] ease-[var(--ease-spring)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    <p className="line-clamp-1 text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-xs text-sand-100">{p.vendorName}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Commission + haveli */}
      <section className="pb-16 md:pb-24">
        <Container className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="rounded-[var(--radius-panel)] bg-terracotta-700 px-6 py-12 text-sand-50 sm:px-10">
            <p className="text-[0.8125rem] font-semibold tracking-[0.06em] text-terracotta-100 uppercase">Made for you</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl leading-tight tracking-[-0.03em] md:text-4xl">Your family name in Nastaliq. A rug in your room&apos;s exact size.</h2>
            <p className="mt-4 max-w-xl text-terracotta-50/85">Describe what you have in mind. An artisan replies with a quote, sketches and a timeline before anything is made — and your deposit is held like any other order.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/custom" className="bg-sand-50 text-umber-900 hover:bg-white">
                Commission a piece
              </ButtonLink>
              <ButtonLink href="/category/bespoke" variant="light">
                Browse bespoke work
              </ButtonLink>
            </div>
          </div>
          <Link href="/haveli" className="pressable group flex flex-col justify-between rounded-[var(--radius-panel)] bg-indigo-950 px-6 py-12 text-sand-50 sm:px-10">
            <div>
              <p className="text-[0.8125rem] font-semibold tracking-[0.06em] text-indigo-200 uppercase">Take the long way round</p>
              <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.03em] md:text-4xl">Walk through the haveli</h2>
              <p className="mt-4 text-indigo-100/80">An interactive walk through a courtyard house, with one craft in every room. Best on a laptop or tablet.</p>
            </div>
            <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium">
              Step inside <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        </Container>
      </section>

      {/* Journal */}
      {posts.length ? (
        <section className="border-t border-umber-200/60 py-16 md:py-24">
          <Container>
            <Heading eyebrow="Heritage journal" title="Stories from the workshops" action={{ href: "/journal", label: "Read the journal" }} />
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {posts.map((p) => (
                <Link key={p.id} href={`/journal/${p.slug}`} className="group">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-panel)] bg-sand-200">
                    {p.coverImageUrl ? <Image src={p.coverImageUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" unoptimized={isSvg(p.coverImageUrl)} className="object-cover transition duration-700 group-hover:scale-[1.03]" /> : null}
                  </div>
                  <p className="mt-4 text-xs text-umber-600">{formatDate(p.publishedAt)}</p>
                  <h3 className="mt-1 font-display text-xl leading-snug text-umber-900 group-hover:text-terracotta-700 md:text-2xl">{p.title}</h3>
                  {p.excerpt ? <p className="mt-2 line-clamp-2 text-sm text-umber-700">{p.excerpt}</p> : null}
                </Link>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

    </>
  );
}

function Heading({ eyebrow, title, action, children }: { eyebrow?: string; title: string; action?: { href: string; label: string }; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="text-[0.8125rem] font-semibold tracking-[0.06em] text-terracotta-700 uppercase">{eyebrow}</p> : null}
        <h2 className="mt-2 font-display text-[2rem] leading-[1.08] tracking-[-0.03em] text-umber-900 md:text-5xl">{title}</h2>
        {children ? <p className="mt-3 text-lg text-umber-700">{children}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="pressable inline-flex h-10 items-center gap-1.5 rounded-full bg-umber-900/[0.06] px-4 text-sm font-medium text-umber-900 hover:bg-umber-900/[0.1]">
          {action.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
