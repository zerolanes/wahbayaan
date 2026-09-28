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
import { getSetting, isDemoMode } from "@/lib/settings";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

const isSvg = (url: string) => url.split("?")[0].endsWith(".svg");

/** Where the crafts come from — the cities whose workshops the marketplace is built around. */
const ATLAS = [
  { city: "Lahore", urdu: "لاہور", craft: "Calligraphy & miniature painting", note: "Nastaliq on hand-burnished wasli paper, in the line of the Mughal ateliers.", href: "/category/calligraphy-art" },
  { city: "Multan", urdu: "ملتان", craft: "Blue pottery & kashi tiles", note: "Cobalt and turquoise glazes from the city of shrines.", href: "/category/wall-decor" },
  { city: "Hala", urdu: "ہالہ", craft: "Ajrak & lacquered woodwork", note: "Sindhi block-printing in madder and indigo, and jandi lathe lacquer.", href: "/category/wall-decor" },
  { city: "Peshawar", urdu: "پشاور", craft: "Hand-knotted rugs", note: "Wool knotted on upright looms, dyed with walnut, madder and pomegranate.", href: "/category/rugs" },
  { city: "Chiniot", urdu: "چنیوٹ", craft: "Carved wood & furniture", note: "The carvers behind palace doors, jharokas and heirloom furniture.", href: "/category/bespoke" },
  { city: "Khewra", urdu: "کھیوڑہ", craft: "Himalayan salt", note: "Lamps and carvings from one of the oldest salt mines in the world.", href: "/category/salt-art" },
  { city: "Taxila", urdu: "ٹیکسلا", craft: "Gandhara stone carving", note: "Grey schist and marble, carved beside a UNESCO World Heritage city.", href: "/category/sculpture-stone" },
  { city: "Karachi", urdu: "کراچی", craft: "Truck art & painting", note: "The bright phool-patti of Pakistan's roads, painted on panels and canvas.", href: "/category/paintings" },
];

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
      .where(and(eq(journalPosts.status, "published"), ...(isDemoMode() ? [] : [eq(journalPosts.isDemo, false)])))
      .orderBy(desc(journalPosts.publishedAt))
      .limit(3),
  ]);

  const crafts = categories.filter((c) => c.showOnHome && (c.productCount > 0 || isDemoMode()));
  const featuredVendors = home.featuredVendorIds.length
    ? vendors.filter((v) => home.featuredVendorIds.includes(v.id))
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
      <section className="border-b border-umber-200/60">
        <Container className="grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-terracotta-600 uppercase">{home.heroEyebrow}</p>
            <h1 className="mt-5 font-display text-5xl leading-[1.02] tracking-[-0.02em] text-umber-900 sm:text-6xl xl:text-7xl">{home.heroTitle}</h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-umber-600">{home.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/shop" size="lg">
                Shop the collection <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/artisans" size="lg" variant="outline">
                Meet the artisans
              </ButtonLink>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-umber-200/70 pt-6">
              {[
                { label: "Verified artisans", value: vendors.length },
                { label: "Pieces listed", value: pieceCount },
                { label: "Craft cities", value: cities.size },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-xs text-umber-500">{s.label}</dt>
                  <dd className="mt-1 font-display text-3xl text-umber-900 tabular-nums">{s.value}</dd>
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
                  className={cn("group relative overflow-hidden rounded-[var(--radius-card)] bg-sand-200", i === 0 ? "row-span-2 aspect-[3/4] sm:aspect-auto" : "aspect-[4/3]")}
                >
                  <Image
                    src={p.imageUrl}
                    alt={p.imageAlt ?? p.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 28vw, 50vw"
                    unoptimized={isSvg(p.imageUrl)}
                    className="object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10 sm:p-4 sm:pt-12">
                    <p className="line-clamp-1 text-sm font-medium text-white">{p.title}</p>
                    <p className="text-xs text-white/75">
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
      <section className="border-b border-umber-200/60 bg-sand-50/70">
        <Container>
          <ul className="grid divide-umber-200/70 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3 py-5 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                <Icon className="mt-0.5 size-5 shrink-0 text-terracotta-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-umber-900">{title}</p>
                  <p className="mt-0.5 text-sm text-umber-600">{text}</p>
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
            <ul className="mt-10 flex snap-x gap-5 overflow-x-auto pb-2 scrollbar-none md:grid md:grid-cols-4 md:gap-8 md:overflow-visible lg:grid-cols-8">
              {crafts.map((c) => (
                <li key={c.slug} className="w-32 shrink-0 snap-start md:w-auto">
                  <Link href={`/category/${c.slug}`} className="group block text-center">
                    <span className="relative mx-auto block aspect-square overflow-hidden rounded-full bg-sand-200 ring-1 ring-umber-200/70 transition group-hover:ring-2 group-hover:ring-terracotta-500">
                      {c.coverImageUrl ? (
                        <Image src={c.coverImageUrl} alt="" fill sizes="160px" unoptimized={isSvg(c.coverImageUrl)} className="object-cover transition duration-700 group-hover:scale-105" />
                      ) : null}
                    </span>
                    <span className="mt-3 block text-sm font-medium text-umber-900 group-hover:text-terracotta-700">{c.name}</span>
                    <span className="block text-xs text-umber-500">
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
      <section className="border-y border-umber-200/60 bg-sand-50/70 py-16 md:py-24">
        <Container>
          <Heading eyebrow="Where it's made" title="A map of Pakistani craft">
            Every region keeps its own tradition. These are the cities our artisans work from.
          </Heading>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-umber-200/70 ring-1 ring-umber-200/70 sm:grid-cols-2 lg:grid-cols-4">
            {ATLAS.map((a) => (
              <li key={a.city} className="bg-sand-50">
                <Link href={a.href} className="group flex h-full flex-col p-6 transition hover:bg-white">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-2xl text-umber-900">{a.city}</p>
                    <p lang="ur" className="font-urdu text-lg leading-none text-umber-400">
                      {a.urdu}
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-terracotta-700">{a.craft}</p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-umber-600">{a.note}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-umber-500 group-hover:text-umber-900">
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
            <p className="text-xs font-semibold tracking-[0.22em] text-terracotta-600 uppercase">How importing works</p>
            <h2 className="mt-3 font-display text-4xl leading-[1.08] text-umber-900 md:text-5xl">Buying from a workshop in Pakistan, made simple.</h2>
            <p className="mt-4 text-lg text-umber-600">You pay for the piece, the international shipping and your country&apos;s import charges — and you see every line before you pay.</p>
            <div className="mt-8 rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70">
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
                <span className="absolute top-0 -left-[2.95rem] grid size-7 place-items-center rounded-full bg-parchment text-xs font-semibold text-umber-900 ring-1 ring-umber-300 tabular-nums">
                  {i + 1}
                </span>
                <h3 className="font-display text-2xl text-umber-900">{s.title}</h3>
                <p className="mt-1.5 max-w-lg leading-relaxed text-umber-600">{s.text}</p>
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
                  <Link href={`/artisans/${v.slug}`} className="group flex h-full items-center gap-4 rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-umber-200/70 transition hover:ring-umber-400">
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
                  <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                    <p className="line-clamp-1 text-sm font-medium text-white">{p.title}</p>
                    <p className="text-xs text-white/75">{p.vendorName}</p>
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
          <div className="rounded-[var(--radius-card)] bg-terracotta-700 px-6 py-12 text-sand-50 sm:px-10">
            <p className="text-xs font-semibold tracking-[0.22em] text-terracotta-100 uppercase">Made for you</p>
            <h2 className="mt-3 max-w-xl font-display text-4xl leading-tight">Your family name in Nastaliq. A rug in your room&apos;s exact size.</h2>
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
          <Link href="/haveli" className="group flex flex-col justify-between rounded-[var(--radius-card)] bg-indigo-950 px-6 py-12 text-sand-50 sm:px-10">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-indigo-200 uppercase">Take the long way round</p>
              <h2 className="mt-3 font-display text-4xl leading-tight">Walk through the haveli</h2>
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
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] bg-sand-200">
                    {p.coverImageUrl ? <Image src={p.coverImageUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" unoptimized={isSvg(p.coverImageUrl)} className="object-cover transition duration-700 group-hover:scale-[1.03]" /> : null}
                  </div>
                  <p className="mt-4 text-xs text-umber-500">{formatDate(p.publishedAt)}</p>
                  <h3 className="mt-1 font-display text-2xl leading-snug text-umber-900 group-hover:text-terracotta-700">{p.title}</h3>
                  {p.excerpt ? <p className="mt-2 line-clamp-2 text-sm text-umber-600">{p.excerpt}</p> : null}
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
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.22em] text-terracotta-600 uppercase">{eyebrow}</p> : null}
        <h2 className="mt-3 font-display text-4xl leading-[1.08] text-umber-900 md:text-5xl">{title}</h2>
        {children ? <p className="mt-3 text-lg text-umber-600">{children}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-umber-900 underline-offset-4 hover:underline">
          {action.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
