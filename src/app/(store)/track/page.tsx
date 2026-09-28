import type { Metadata } from "next";
import Link from "next/link";
import { InfoHeader } from "@/components/store/info-page";
import { TrackForm } from "@/components/store/track-form";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Track an order",
  description: "Check where your Wahbayaan order is — from the workshop to your door.",
  robots: { index: false },
};

export default async function TrackPage() {
  const user = await getCurrentUser();
  return (
    <>
      <InfoHeader eyebrow="Orders" title="Track an order" lead="See where your piece is — being made, packed for export, in transit or delivered." crumb="Track an order" />
      <Container className="grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-20">
        <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70 sm:p-8">
          <TrackForm defaultEmail={user?.email ?? ""} />
        </div>
        <div className="space-y-4 text-sm leading-relaxed text-umber-600">
          <p>
            <strong className="font-medium text-umber-900">Have an account?</strong>{" "}
            {user ? (
              <Link href="/account/orders" className="underline underline-offset-4">
                See all your orders
              </Link>
            ) : (
              <>
                <Link href="/login?next=/account/orders" className="underline underline-offset-4">
                  Sign in
                </Link>{" "}
                to see every order, message artisans and confirm delivery.
              </>
            )}
          </p>
          <p>Made-to-order pieces show “Being made” until the artisan packs them. International shipping usually adds a week or two after the piece leaves the workshop; you&apos;ll get the courier&apos;s tracking link as soon as it ships.</p>
          <p>
            Something wrong? <Link href="/contact?topic=order" className="underline underline-offset-4">Contact us</Link> with your order number.
          </p>
        </div>
      </Container>
    </>
  );
}
