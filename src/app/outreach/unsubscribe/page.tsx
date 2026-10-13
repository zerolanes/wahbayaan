import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeByToken } from "@/lib/outreach/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribed", robots: { index: false, follow: false } };

/**
 * One-click opt-out from a brand outreach email. Only flips the contact to
 * do-not-contact (and suppresses the address); shows nothing about who it was.
 */
export default async function OutreachUnsubscribePage(props: PageProps<"/outreach/unsubscribe">) {
  const { t } = await props.searchParams;
  const ok = await unsubscribeByToken(typeof t === "string" ? t : null);
  return (
    <main className="paper grid min-h-dvh place-items-center px-4 py-16">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-umber-200 bg-white p-8 text-center shadow-soft">
        <p className="font-serif text-2xl text-umber-900">Wahbayaan</p>
        {ok ? (
          <>
            <h1 className="mt-6 font-display text-xl text-umber-900">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-sm leading-relaxed text-umber-700">We won&apos;t email this address about listing your brand again.</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-xl text-umber-900">This link isn&apos;t complete</h1>
            <p className="mt-2 text-sm leading-relaxed text-umber-700">Please open the full link from the email, or reply to it with “unsubscribe” and we&apos;ll remove you by hand.</p>
          </>
        )}
        <Link href="/" className="mt-6 inline-block text-sm text-umber-600 underline">
          Visit Wahbayaan
        </Link>
      </div>
    </main>
  );
}
