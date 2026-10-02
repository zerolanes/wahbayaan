import type { Metadata } from "next";
import { CheckCircle2, Mail, MessageSquareQuote, ShieldCheck, Truck } from "lucide-react";
import { ScallopDivider } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicVendor } from "@/lib/queries/catalog";

export const metadata: Metadata = { title: "Request received", robots: { index: false } };

export default async function CustomConfirmationPage(props: PageProps<"/custom/confirmation">) {
  const sp = await props.searchParams;
  const ref = typeof sp.ref === "string" && /^REQ-[A-Z0-9]{4,10}$/.test(sp.ref) ? sp.ref : null;
  const artisan = typeof sp.artisan === "string" ? await getPublicVendor(sp.artisan) : null;
  const user = await getCurrentUser();
  const who = artisan ? artisan.displayName : "a verified artisan";

  const steps = [
    { icon: MessageSquareQuote, title: `${artisan ? artisan.displayName : "We"} review your request`, text: artisan ? `They'll read it closely and may message you with questions — they usually reply ${artisan.responseTimeHours ? `within ${artisan.responseTimeHours} hours` : "within a few days"}.` : "We match it with an artisan whose work fits, and they may message you with questions." },
    { icon: Mail, title: "You receive a quote", text: "A price for the piece and a making time, by email and in your account. Shipping and import costs for your country are quoted as separate lines." },
    { icon: CheckCircle2, title: "You accept — or don't", text: "Declining is free. If you accept, the piece is listed privately for you to order." },
    { icon: ShieldCheck, title: "Payment held until it arrives", text: "As with every order, your payment stays with Wahbayaan until you confirm the finished piece arrived as described." },
    { icon: Truck, title: "Made, shipped, delivered", text: "Follow it from the workshop to your door, with tracking once it ships." },
  ];

  return (
    <>
      <section className="night">
        <Container className="py-16 text-center md:py-24">
          <CheckCircle2 className="mx-auto size-14 text-gold-300" aria-hidden />
          <p className="mt-6 text-xs font-semibold tracking-[0.25em] text-gold-300 uppercase">Request received{ref ? ` · ${ref}` : ""}</p>
          <h1 className="mx-auto mt-3 max-w-3xl font-display text-4xl leading-[1.05] text-sand-50 md:text-6xl">Thank you — {who} will take it from here.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-sand-200/80">Nothing has been charged. Here&apos;s what happens next.</p>
        </Container>
      </section>
      <ScallopDivider />
      <Container className="max-w-3xl py-16 md:py-20">
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-5 rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-800">
                <s.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="text-xs font-semibold tracking-widest text-umber-600">{String(i + 1).padStart(2, "0")}</span>
                <span className="block font-display text-xl text-umber-900">{s.title}</span>
                <span className="mt-1 block text-umber-600">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {user ? (
            <ButtonLink href="/account/requests">See your requests</ButtonLink>
          ) : (
            <ButtonLink href="/register?next=/account/requests">Create an account to track it</ButtonLink>
          )}
          <ButtonLink href="/shop" variant="outline">
            Keep browsing
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
