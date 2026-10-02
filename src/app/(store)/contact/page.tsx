import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle } from "lucide-react";
import { InfoHeader } from "@/components/store/info-page";
import { ContactForm } from "@/components/store/lead-forms";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Questions about an order, import costs, a commission or selling on Wahbayaan — write to our team.",
};

export default async function ContactPage(props: PageProps<"/contact">) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  const topic = typeof sp.topic === "string" ? sp.topic : undefined;
  const order = typeof sp.order === "string" ? sp.order : undefined;
  return (
    <>
      <InfoHeader eyebrow="We're here to help" title="Contact us" lead="Orders, costs, commissions or selling — we're happy to help." crumb="Contact" />
      <Container className="grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-20">
        <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70 sm:p-8">
          <ContactForm defaults={{ name: user?.name ?? "", email: user?.email ?? "", topic, orderNumber: order }} />
        </div>
        <aside className="space-y-8">
          {[
            { icon: Clock, title: "We aim to reply within one working day", text: "Tell us your order number if you have one — it helps us answer in one go." },
            { icon: MessageCircle, title: "Talking to an artisan?", text: "Use “Message the artisan” on any listing or order — conversations stay on Wahbayaan so we can help if needed." },
            { icon: Mail, title: "Order problems", text: "If something arrived damaged or not as described, open a case from your order page — your payment stays held while we sort it out." },
            { icon: MapPin, title: "Artisans in Pakistan", text: "Want to sell your work? Apply on the Sell on Wahbayaan page — we reply in English or Urdu." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <Icon className="mt-0.5 size-5 shrink-0 text-terracotta-600" aria-hidden />
              <div>
                <p className="font-medium text-umber-900">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-umber-600">{text}</p>
              </div>
            </div>
          ))}
          <p className="border-t border-umber-200/70 pt-6 text-sm text-umber-600">
            Quick answers are often in the{" "}
            <Link href="/faq" className="font-medium text-umber-900 underline underline-offset-4">
              FAQ
            </Link>{" "}
            and the{" "}
            <Link href="/how-importing-works" className="font-medium text-umber-900 underline underline-offset-4">
              importing guide
            </Link>
            .
          </p>
        </aside>
      </Container>
    </>
  );
}
