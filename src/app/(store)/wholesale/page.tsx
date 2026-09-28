import type { Metadata } from "next";
import { Boxes, FileText, Ruler, Truck } from "lucide-react";
import { InfoHeader } from "@/components/store/info-page";
import { WholesaleForm } from "@/components/store/lead-forms";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { DESTINATIONS } from "@/lib/money/currency";

export const metadata: Metadata = {
  title: "Trade & wholesale",
  description: "Trade accounts for interior designers, retailers, hotels and architects sourcing handmade Pakistani craft.",
};

const BENEFITS = [
  { icon: Boxes, title: "Trade pricing", text: "Where an artisan offers it, trade accounts see wholesale prices and minimum quantities on each listing." },
  { icon: Ruler, title: "Made to your spec", text: "Rugs to exact dimensions, calligraphy for a lobby, carved panels for a fit-out — quoted by the workshop before anything is made." },
  { icon: Truck, title: "Consolidated freight", text: "Larger orders from several workshops can travel together, with duty and tax itemised for your country." },
  { icon: FileText, title: "Paperwork handled", text: "Commercial invoices, certificates of origin where available, and a single point of contact for the whole order." },
];

export default async function WholesalePage() {
  const [user, ctx] = await Promise.all([getCurrentUser(), getBuyerContext()]);
  return (
    <>
      <InfoHeader eyebrow="For the trade" title="Trade & wholesale" lead="For interior designers, retailers, galleries, hotels and architects who want to source directly from Pakistan's workshops — with verified makers and every cost shown." crumb="Trade & wholesale" />
      <Container className="grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-20">
        <div>
          <ul className="space-y-8">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-terracotta-600" aria-hidden />
                <div>
                  <p className="font-medium text-umber-900">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-umber-600">{text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-10 rounded-[var(--radius-card)] bg-sand-50 p-5 text-sm text-umber-600 ring-1 ring-umber-200/70">
            <p className="font-medium text-umber-900">How it works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Apply below — we review every application by hand.</li>
              <li>Once approved, trade prices appear when you sign in.</li>
              <li>Order online, or send us a brief for a custom project.</li>
            </ol>
          </div>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70 sm:p-8">
          <h2 className="font-display text-3xl text-umber-900">Apply for a trade account</h2>
          <p className="mt-1 mb-6 text-sm text-umber-600">Takes about two minutes.</p>
          <WholesaleForm defaults={{ name: user?.name ?? "", email: user?.email ?? "", country: ctx.destination }} destinations={DESTINATIONS.map((d) => ({ code: d.code, name: d.name }))} />
        </div>
      </Container>
    </>
  );
}
