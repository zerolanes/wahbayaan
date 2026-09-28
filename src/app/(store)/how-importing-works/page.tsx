import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Ban,
  Calculator,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Hammer,
  Home,
  Landmark,
  PackageCheck,
  Plane,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { ScallopDivider, TileDivider } from "@/components/brand/logo";
import { FaqList } from "@/components/store/faq-list";
import { Eyebrow, PageHero } from "@/components/store/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/misc";
import { getFaqGroups } from "@/lib/queries/storefront";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "How importing works",
  description:
    "Buying a handmade piece from a workshop in Pakistan: the journey, who pays for what, timelines, customs and duties in the US, UK and Canada, and how your payment is held until delivery.",
};

type Money = "with-you" | "held" | "released";
const MONEY: Record<Money, { label: string; tone: string }> = {
  "with-you": { label: "Your money: still with you", tone: "bg-umber-100 text-umber-700" },
  held: { label: "Your money: held by Wahbayaan", tone: "bg-indigo-100 text-indigo-800" },
  released: { label: "Your money: released to the artisan", tone: "bg-success-50 text-success-700" },
};

const JOURNEY: { icon: typeof Search; title: string; text: string; money: Money }[] = [
  { icon: Search, title: "Browse", text: "Every listing names its maker and shows materials, size in cm and inches, weight, and how long it takes to make or dispatch.", money: "with-you" },
  {
    icon: Calculator,
    title: "See the landed cost",
    text: "Item, international shipping, import duty, import tax and our handling fee — itemised for your country, in your currency. Anything without a confirmed rate is marked Pending, never shown as zero.",
    money: "with-you",
  },
  {
    icon: CreditCard,
    title: "Pay — and we hold it",
    text: "You pay Wahbayaan in your own currency. If any line was pending, we confirm it first and you approve the final total before your card is charged.",
    money: "held",
  },
  { icon: Hammer, title: "Made and packed", text: "The artisan makes or finishes your piece and packs it for an international journey. Made-to-order pieces take the time stated on the listing.", money: "held" },
  {
    icon: FileText,
    title: "Export documents and courier",
    text: "We prepare the export paperwork and commercial invoice, book an international courier to collect from the workshop, and share the tracking with you.",
    money: "held",
  },
  {
    icon: Landmark,
    title: "Customs in your country",
    text: "Your parcel clears customs where you live. The duty and import tax in your landed cost are what we expect to be due — if a courier ever asks you for a charge you believe you've already paid, contact us before paying.",
    money: "held",
  },
  { icon: Home, title: "Delivery", text: "The courier delivers to your door. Open it, look closely, and compare it with the listing.", money: "held" },
  {
    icon: CheckCircle2,
    title: "Confirm — or open a case",
    text: "Confirm from your order page that it arrived as described. If it's damaged or not as described, open a case with photos and the held funds are frozen while we sort it out.",
    money: "held",
  },
  { icon: Wallet, title: "The artisan is paid", text: "Only now are the funds released to the artisan, in rupees — after you confirm, or when the buyer-protection window ends.", money: "released" },
];

const WHO_PAYS: { cost: string; when: string; pending: string }[] = [
  { cost: "Item price", when: "On every listing, in your currency", pending: "Always known — set by the artisan in rupees and converted at the displayed rate." },
  { cost: "International shipping", when: "Estimated on the product page; itemised in your cart and at checkout", pending: "Pending until a courier rate for your country and the parcel's weight is confirmed." },
  { cost: "Import duty", when: "Estimated per listing; confirmed per order", pending: "Pending until the duty rate for the item's customs (HS) code in your country is confirmed." },
  { cost: "Import VAT / GST / sales tax", when: "Alongside duty, as its own line", pending: "Confirmed together with duty. Shown as not applicable where none is due." },
  { cost: "Wahbayaan handling", when: "As its own line — never hidden in the item price", pending: "Pending until the fee is set." },
  { cost: "Gift wrap (optional)", when: "In your cart, only if you choose it", pending: "Pending until priced." },
];

const COUNTRIES = [
  {
    flag: "🇺🇸",
    name: "United States",
    body: "Imports are cleared by U.S. Customs and Border Protection. Duty, if any, depends on how the piece is classified (its HS code), its value and its country of origin. There's no national VAT; any state sales tax on imports depends on your state.",
  },
  {
    flag: "🇬🇧",
    name: "United Kingdom",
    body: "Imports are cleared by HM Revenue & Customs. Import VAT generally applies, and customs duty may apply depending on the item's classification and value. Low-value rules exist and change, so we confirm the treatment for each order.",
  },
  {
    flag: "🇨🇦",
    name: "Canada",
    body: "Imports are cleared by the Canada Border Services Agency. GST — or HST in participating provinces — generally applies, and customs duty may apply depending on the item's classification and origin.",
  },
];

export default async function HowImportingWorksPage() {
  const faqGroups = await getFaqGroups();
  const teaser = faqGroups.filter((g) => ["Buying from Pakistan", "Delivery"].includes(g.group)).flatMap((g) => g.items).slice(0, 5);

  return (
    <>
      <PageHero
        size="lg"
        eyebrow="Buying from Pakistan"
        title={
          <>
            How importing <span className="gold-text italic">works</span>
          </>
        }
        description="From a workshop in Lahore, Multan or Peshawar to your door. You see every cost before you pay, we handle export and customs paperwork, and your payment is held until your piece arrives."
        aside={
          <div className="rounded-[var(--radius-card)] bg-sand-50 p-5 text-umber-900 shadow-lift ring-1 ring-white/10 md:p-6">
            <div className="flex items-center justify-between border-b border-umber-200/70 pb-3">
              <p className="text-sm font-semibold">Your landed cost</p>
              <p className="text-xs text-umber-500">Shown before checkout</p>
            </div>
            <ul className="divide-y divide-umber-200/60 text-sm">
              {[
                ["Item", "On the listing"],
                ["International shipping", "Per parcel, per artisan"],
                ["Import duty", "By HS code & country"],
                ["Import VAT / GST", "With duty"],
                ["Wahbayaan handling", "Its own line"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-umber-700">{k}</span>
                  <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs text-umber-600">{v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-indigo-950 px-4 py-3 text-sand-50">
              <span className="text-sm">Total you approve</span>
              <span className="flex items-center gap-1.5 text-xs text-gold-200">
                <ShieldCheck className="size-4" aria-hidden /> Held until delivery
              </span>
            </div>
            <p className="mt-3 text-xs text-umber-500">A line without a confirmed rate says “Pending” — we confirm it with you before you&apos;re charged.</p>
          </div>
        }
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="#journey" variant="gold" size="lg">
            The journey
          </ButtonLink>
          <ButtonLink href="#who-pays" variant="light" size="lg">
            Who pays for what
          </ButtonLink>
        </div>
      </PageHero>

      {/* Journey */}
      <section id="journey" className="scroll-mt-16 py-20 md:py-28">
        <Container className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Eyebrow>The journey</Eyebrow>
            <h2 className="mt-3 font-display text-4xl leading-[1.08] text-umber-900 md:text-5xl">Nine steps from workshop to doorstep</h2>
            <p className="mt-5 text-lg text-umber-600">Follow the money as well as the parcel: it stays with you until you pay, stays with us while your piece travels, and reaches the artisan only when you&apos;re happy.</p>
            <ul className="mt-8 space-y-2 text-sm">
              {(Object.keys(MONEY) as Money[]).map((m) => (
                <li key={m}>
                  <span className={cn("inline-flex rounded-full px-3 py-1 font-medium", MONEY[m].tone)}>{MONEY[m].label.replace("Your money: ", "")}</span>
                </li>
              ))}
            </ul>
          </div>
          <ol className="relative">
            {JOURNEY.map((s, i) => (
              <li key={s.title} className="relative flex gap-5 pb-10 last:pb-0 md:gap-7">
                {i < JOURNEY.length - 1 ? <span aria-hidden className="absolute top-14 left-6 h-[calc(100%-3.5rem)] w-px bg-gradient-to-b from-gold-400 to-umber-200 md:left-7" /> : null}
                <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-sand-50 shadow-soft ring-1 ring-umber-200/70 md:size-14">
                  <s.icon className="size-5 text-gold-700 md:size-6" aria-hidden />
                </span>
                <div className="pt-1">
                  <p className="text-xs font-semibold tracking-[0.2em] text-umber-400 tabular-nums">STEP {String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 font-display text-2xl text-umber-900">{s.title}</h3>
                  <p className="mt-2 max-w-2xl leading-relaxed text-umber-700">{s.text}</p>
                  <span className={cn("mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium", MONEY[s.money].tone)}>{MONEY[s.money].label}</span>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Who pays for what */}
      <section id="who-pays" className="night relative scroll-mt-16">
        <ScallopDivider />
        <Container className="py-20 md:py-28">
          <SectionHeading
            dark
            eyebrow="Who pays for what"
            title="You pay the landed cost — and you see all of it first"
            description="Buying across a border means more than the item price. Every one of these lines is paid by you, the buyer, and every one is shown before checkout."
          />
          <div className="mt-12 overflow-hidden rounded-[var(--radius-card)] ring-1 ring-white/10">
            <div className="hidden grid-cols-[1.1fr_0.7fr_1.3fr_1.6fr] gap-6 bg-white/5 px-6 py-3 text-xs font-semibold tracking-wider text-gold-300 uppercase md:grid">
              <span>Cost</span>
              <span>Who pays</span>
              <span>Where you see it</span>
              <span>If the rate isn&apos;t confirmed yet</span>
            </div>
            <ul className="divide-y divide-white/10">
              {WHO_PAYS.map((r) => (
                <li key={r.cost} className="grid gap-2 px-6 py-5 md:grid-cols-[1.1fr_0.7fr_1.3fr_1.6fr] md:gap-6">
                  <p className="font-display text-xl text-sand-50">{r.cost}</p>
                  <p className="text-sm">
                    <span className="rounded-full bg-gold-400/15 px-2.5 py-1 font-medium text-gold-200 ring-1 ring-gold-300/25">You, the buyer</span>
                  </p>
                  <p className="text-sm text-sand-200/80">
                    <span className="font-medium text-sand-100 md:hidden">Where: </span>
                    {r.when}
                  </p>
                  <p className="text-sm text-sand-200/70">
                    <span className="font-medium text-sand-100 md:hidden">If not confirmed: </span>
                    {r.pending}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 max-w-3xl text-sand-200/70">
            The artisan&apos;s share is paid from the item price after delivery — you never pay the artisan directly, and there are no fees beyond the lines above.
          </p>
        </Container>
        <ScallopDivider className="rotate-180" />
      </section>

      {/* Timelines */}
      <section className="py-20 md:py-28">
        <Container>
          <SectionHeading
            eyebrow="Typical timelines"
            title="How long will it take?"
            description="Two numbers add up: the time to make or dispatch your piece, and the courier's journey. Both are shown on each listing — we don't guess."
          />
          <div className="mt-12 grid overflow-hidden rounded-[var(--radius-card)] ring-1 ring-umber-200/70 md:grid-cols-[3fr_3fr_2fr]">
            {[
              {
                icon: Hammer,
                title: "Making or dispatch",
                tone: "bg-gold-100",
                text: "Ready-to-ship pieces leave the workshop within the dispatch time on the listing. Made-to-order pieces show the artisan's time to make.",
                tag: "Stated on every listing",
              },
              {
                icon: Plane,
                title: "Courier transit",
                tone: "bg-indigo-100",
                text: "Transit time comes from the courier rate for your country. Where our courier contracts aren't confirmed yet, the listing says transit is pending rather than inventing a number.",
                tag: "Shown per listing when confirmed",
              },
              {
                icon: Landmark,
                title: "Customs clearance",
                tone: "bg-terracotta-100",
                text: "Usually part of the courier's journey, but it varies by country, season and parcel.",
                tag: "Varies",
              },
            ].map((s) => (
              <div key={s.title} className="flex flex-col border-umber-200/70 bg-sand-50 not-last:border-b md:not-last:border-r md:not-last:border-b-0">
                <div className={cn("h-2", s.tone)} />
                <div className="flex flex-1 flex-col p-6 md:p-8">
                  <s.icon className="size-6 text-gold-700" aria-hidden />
                  <h3 className="mt-4 font-display text-2xl text-umber-900">{s.title}</h3>
                  <p className="mt-2 flex-1 text-umber-700">{s.text}</p>
                  <p className="mt-5 text-xs font-semibold tracking-wider text-umber-500 uppercase">{s.tag}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-umber-600">
            Several artisans in one order? Each ships separately from their own workshop, so parcels can arrive on different days — each with its own tracking.
          </p>
        </Container>
      </section>

      <TileDivider />

      {/* Customs by country */}
      <section className="bg-sand-100/60 py-20 md:py-28">
        <Container>
          <SectionHeading
            eyebrow="Customs & duties"
            title="What happens at the border"
            description="Rates depend on the item's customs classification (its HS code), its value and your country — so we show and confirm them per order, not as a blanket figure."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {COUNTRIES.map((c) => (
              <article key={c.name} className="rounded-[var(--radius-card)] bg-sand-50 p-7 shadow-soft ring-1 ring-umber-200/60">
                <p className="text-3xl" aria-hidden>
                  {c.flag}
                </p>
                <h3 className="mt-3 font-display text-2xl text-umber-900">{c.name}</h3>
                <p className="mt-3 leading-relaxed text-umber-700">{c.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="flex gap-4 rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
              <ClipboardList className="mt-0.5 size-6 shrink-0 text-gold-700" aria-hidden />
              <div>
                <h3 className="font-semibold text-umber-900">What “awaiting quote” means</h3>
                <p className="mt-1.5 text-umber-700">
                  When we can&apos;t price shipping or duty automatically yet — a new destination, an unusual weight, a craft whose duty rate isn&apos;t confirmed — we
                  don&apos;t guess. You place the order, your pieces are reserved, and our team emails you the exact total. You approve and pay, or cancel at no cost.
                  Nothing is charged until you approve.
                </p>
                <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
                  {["Order placed", "Confirming costs", "Quote ready", "You approve & pay", "Funds held"].map((s, i, a) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1", i === 1 ? "bg-pending-50 text-pending-600 ring-1 ring-pending-600/20" : "bg-umber-100 text-umber-700")}>{s}</span>
                      {i < a.length - 1 ? <span aria-hidden className="text-umber-300">→</span> : null}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
              <Ban className="mt-0.5 size-6 shrink-0 text-terracotta-600" aria-hidden />
              <div>
                <h3 className="font-semibold text-umber-900">Import restrictions</h3>
                <p className="mt-1.5 text-umber-700">
                  Some materials — certain woods, animal products and anything that could be an antiquity — can be restricted or need extra documents. We only list
                  signed, contemporary work, never antiquities. Each product page shows the import notes for your country, or tells you plainly when our team
                  hasn&apos;t reviewed that craft for your country yet — we confirm before it ships.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <TileDivider />

      {/* Protection + FAQ */}
      <section className="py-20 md:py-28">
        <Container className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div className="night self-start rounded-[2rem] p-8 md:p-10">
            <ShieldCheck className="size-10 text-gold-300" aria-hidden />
            <h2 className="mt-5 font-display text-3xl text-sand-50 md:text-4xl">Covered from payment to doorstep</h2>
            <ul className="mt-6 space-y-3 text-sand-100/85">
              {[
                "Your payment is held by Wahbayaan, not sent to the artisan.",
                "Damaged, not as described or never arrived? Open a case and the funds are frozen while we resolve it.",
                "Artisans are identity-, workshop- and sample-verified before they list.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <BadgeCheck className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/buyer-protection" variant="gold">
                Buyer protection
              </ButtonLink>
              <ButtonLink href="/shop" variant="light">
                <PackageCheck className="size-4" aria-hidden /> Start browsing
              </ButtonLink>
            </div>
          </div>
          <div>
            <Eyebrow>Common questions</Eyebrow>
            <h2 className="mt-3 font-display text-4xl text-umber-900">Before you buy</h2>
            <FaqList items={teaser} className="mt-8" />
            <p className="mt-6 text-umber-600">
              More in the{" "}
              <Link href="/faq" className="font-medium text-terracotta-600 hover:underline">
                full FAQ
              </Link>{" "}
              — or{" "}
              <Link href="/contact?topic=duties" className="font-medium text-terracotta-600 hover:underline">
                ask us about duties for your order
              </Link>
              .
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
