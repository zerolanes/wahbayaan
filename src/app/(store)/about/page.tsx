import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, HandCoins, Landmark, ScrollText } from "lucide-react";
import { InfoHeader } from "@/components/store/info-page";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { CRAFT_ATLAS } from "@/lib/heritage";
import { getPublicCategories, getPublicVendors } from "@/lib/queries/catalog";

export const metadata: Metadata = {
  title: "About Wahbayaan",
  description: "A marketplace for handmade Pakistani craft — verified artisans, honest landed costs, and payment held until your piece arrives.",
};

const PRINCIPLES = [
  { icon: BadgeCheck, title: "Every maker is verified", text: "Before anyone can sell, our team checks their identity, visits or video-calls the workshop and reviews finished work. Listings name the person who made the piece." },
  { icon: ScrollText, title: "Every cost is shown", text: "Buyers see the piece, international shipping and their own country's import charges before paying. If a rate isn't confirmed, we say so rather than guess." },
  { icon: Landmark, title: "Money is held, not passed on", text: "Payments are held by Wahbayaan until the buyer confirms the piece arrived as described. That protects buyers — and protects artisans from chargebacks." },
  { icon: HandCoins, title: "Artisans are paid in rupees", text: "Makers price their work in PKR and are paid to a Pakistani bank account. They never have to deal with foreign currency, card disputes or customs forms." },
];

export default async function AboutPage() {
  const [vendors, categories] = await Promise.all([getPublicVendors(), getPublicCategories()]);
  const cities = new Set(vendors.map((v) => v.workshopCity).filter(Boolean));
  return (
    <>
      <InfoHeader
        eyebrow="About us"
        title={
          <>
            Wahbayaan <span lang="ur" className="font-urdu text-4xl text-umber-600 md:text-5xl">واہ بیان</span>
          </>
        }
        lead="“Wah” is what you say when something moves you; “bayaan” is how it's expressed. We started Wahbayaan so the work of Pakistan's craftspeople could be bought, trusted and carried home by people anywhere."
        crumb="About"
      />

      <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-2 lg:gap-20">
        <div className="space-y-5 text-lg leading-relaxed text-umber-700">
          <p>Pakistan's crafts are some of the oldest living traditions in South Asia — Nastaliq calligraphy, hand-knotted rugs, Multani blue pottery, Sindhi ajrak, Chiniot carving, Gandhara stonework. Most of it is made in small family workshops that have never sold abroad.</p>
          <p>Buying from them, especially from abroad, has usually meant guessing: guessing who made the piece, guessing what it will cost once shipping and import duty are added, and hoping it arrives. Wahbayaan is built to take the guessing out.</p>
          <p>We verify the makers, show every cost up front, hold the payment until the piece arrives, and handle the export paperwork — so the artisan can concentrate on the work, and you can buy it with confidence.</p>
        </div>
        <dl className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-[var(--radius-card)] bg-umber-200/70 ring-1 ring-umber-200/70">
          {[
            { label: "Verified artisans", value: vendors.length },
            { label: "Crafts", value: categories.length },
            { label: "Workshop cities", value: cities.size },
            { label: "Countries we deliver to", value: 3 },
          ].map((s) => (
            <div key={s.label} className="bg-white p-6">
              <dt className="text-sm text-umber-500">{s.label}</dt>
              <dd className="mt-2 font-display text-5xl text-umber-900 tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Container>

      <section className="border-y border-umber-200/60 bg-sand-50/70 py-14 md:py-20">
        <Container>
          <h2 className="font-display text-4xl text-umber-900 md:text-5xl">How we work</h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon className="size-6 text-terracotta-600" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-umber-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-umber-600">{text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-14 md:py-20">
        <Container>
          <h2 className="font-display text-4xl text-umber-900 md:text-5xl">Where the work comes from</h2>
          <ul className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {CRAFT_ATLAS.map((a) => (
              <li key={a.city} className="border-t border-umber-200/70 pt-4">
                <Link href={a.href} className="group">
                  <p className="flex items-baseline justify-between font-display text-2xl text-umber-900">
                    {a.city}
                    <span lang="ur" className="font-urdu text-base text-umber-600">
                      {a.urdu}
                    </span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-terracotta-700 group-hover:underline">{a.craft}</p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-14 flex flex-wrap gap-3">
            <ButtonLink href="/artisans">
              Meet the artisans <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/become-a-seller" variant="outline">
              Sell on Wahbayaan
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
