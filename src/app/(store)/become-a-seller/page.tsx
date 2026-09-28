import type { Metadata } from "next";
import { Banknote, Camera, FileCheck2, Globe2, PackageCheck, ShieldCheck } from "lucide-react";
import { InfoHeader } from "@/components/store/info-page";
import { ArtisanApplicationForm } from "@/components/store/lead-forms";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicCategories } from "@/lib/queries/catalog";
import { getSetting } from "@/lib/settings";
import { REGION_LABELS } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Sell on Wahbayaan",
  description: "Sell your handmade work to buyers in the US, UK and Canada. Price in rupees, get paid in rupees — we handle the buyer, the payment and the export paperwork.",
};

const WHY = [
  { icon: Globe2, title: "Buyers in the US, UK and Canada", text: "Your work is shown in dollars, pounds and Canadian dollars, with shipping and import costs worked out for each buyer." },
  { icon: Banknote, title: "Price and get paid in rupees", text: "You set your price in PKR. Payouts go to your Pakistani bank account — no foreign currency, no card disputes." },
  { icon: ShieldCheck, title: "Payment secured before you start", text: "The buyer pays Wahbayaan up front. You start making knowing the money is already held." },
  { icon: PackageCheck, title: "Export made simple", text: "We book the courier or freight and prepare the customs invoice. You pack, using our export packing guide." },
];

const CHECKS = [
  { icon: FileCheck2, title: "Identity", text: "Your CNIC, checked against a selfie on a short call." },
  { icon: Camera, title: "Your work", text: "Photos of finished pieces — and later, of each piece you list." },
  { icon: ShieldCheck, title: "Your workshop", text: "A short video call or visit to see where the work is made." },
];

export default async function BecomeASellerPage() {
  const [user, categories, commission] = await Promise.all([getCurrentUser(), getPublicCategories(), getSetting("commission")]);
  const fee = commission.status === "active" ? `${(commission.defaultBps / 100).toLocaleString("en", { maximumFractionDigits: 2 })}% of the item price` : "Confirmed with you before you list anything";
  return (
    <>
      <InfoHeader
        eyebrow="For artisans · کاریگروں کے لیے"
        title="Sell your work to the world, get paid in rupees"
        lead="Wahbayaan finds the buyers abroad, takes their payment, and handles export and customs. You make the work, pack it well, and get paid to your bank in Pakistan."
        crumb="Sell on Wahbayaan"
      />

      <Container className="py-12 md:py-16">
        <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon className="size-6 text-terracotta-600" aria-hidden />
              <h2 className="mt-4 font-semibold text-umber-900">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-umber-600">{text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70 lg:col-span-2">
            <h2 className="font-display text-2xl text-umber-900">Before you can sell, we check three things</h2>
            <ul className="mt-5 grid gap-5 sm:grid-cols-3">
              {CHECKS.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon className="size-5 text-umber-700" aria-hidden />
                  <p className="mt-2 font-medium text-umber-900">{title}</p>
                  <p className="mt-1 text-sm text-umber-600">{text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-umber-600">This is what lets buyers trust a maker they have never met — and it is why every verified artisan gets a badge on their shop.</p>
          </div>
          <dl className="space-y-4 rounded-[var(--radius-card)] bg-sand-50 p-6 text-sm ring-1 ring-umber-200/70">
            <div>
              <dt className="font-medium text-umber-900">Cost to join</dt>
              <dd className="text-umber-600">Free to apply.</dd>
            </div>
            <div>
              <dt className="font-medium text-umber-900">Commission</dt>
              <dd className="text-umber-600">{fee}</dd>
            </div>
            <div>
              <dt className="font-medium text-umber-900">When you&apos;re paid</dt>
              <dd className="text-umber-600">After the buyer confirms delivery, or automatically once the protection window ends.</dd>
            </div>
          </dl>
        </div>

        <div className="mt-14 rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70 sm:p-10">
          <h2 className="font-display text-4xl text-umber-900">Apply to sell</h2>
          <p className="mt-2 mb-8 text-umber-600">About ten minutes. Have a few good photos of your finished work ready.</p>
          <ArtisanApplicationForm
            categories={categories.map((c) => ({ id: c.id, label: c.name }))}
            regions={Object.entries(REGION_LABELS).map(([id, label]) => ({ id, label }))}
            defaults={{ name: user?.name ?? "", email: user?.email ?? "" }}
          />
        </div>
      </Container>
    </>
  );
}
