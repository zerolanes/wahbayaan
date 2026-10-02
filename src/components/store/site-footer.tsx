import Link from "next/link";
import { BadgeCheck, Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { featureFlags } from "@/lib/features";
import { getPublicCategories } from "@/lib/queries/catalog";
import { NewsletterForm } from "./newsletter-form";

/** Plain deep-indigo footer. `tabBarSpace` leaves room for the phone tab bar. */
export async function SiteFooter({ tabBarSpace = true }: { tabBarSpace?: boolean }) {
  const [categories, flags] = await Promise.all([getPublicCategories(), featureFlags()]);
  const col = "space-y-1 text-sm text-sand-100/85";
  const link = "inline-flex min-h-9 items-center transition-colors hover:text-gold-200 md:min-h-0 md:py-1";
  const head = "text-xs font-semibold tracking-[0.08em] text-gold-300 uppercase";
  return (
    <footer className="night relative mt-24 overflow-hidden rounded-t-[var(--radius-sheet)] md:mt-32">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 pt-14 pb-10 sm:px-6 md:gap-12 md:pt-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div className="max-w-sm">
          <Logo tone="light" />
          <p className="mt-5 text-sm leading-relaxed text-sand-100/85">
            Heritage craft from verified Pakistani artisans. Every cost shown up front; your payment protected until it arrives.
          </p>
          <NewsletterForm />
        </div>
        <div>
          <p className={head}>Crafts</p>
          <ul className={`mt-3 ${col}`}>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link className={link} href={`/category/${c.slug}`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={head}>Buying</p>
          <ul className={`mt-3 ${col}`}>
            <li><Link className={link} href="/how-importing-works">How importing works</Link></li>
            <li><Link className={link} href="/track">Track an order</Link></li>
            <li><Link className={link} href="/buyer-protection">Buyer protection</Link></li>
            <li><Link className={link} href="/faq">FAQ</Link></li>
            {flags.customRequests ? <li><Link className={link} href="/custom">Commission a piece</Link></li> : null}
            {flags.wholesale ? <li><Link className={link} href="/wholesale">Trade & wholesale</Link></li> : null}
            {flags.referrals ? <li><Link className={link} href="/account/referrals">Refer a friend</Link></li> : null}
          </ul>
        </div>
        <div>
          <p className={head}>Wahbayaan</p>
          <ul className={`mt-3 ${col}`}>
            <li><Link className={link} href="/about">About us</Link></li>
            <li><Link className={link} href="/artisans">Our artisans</Link></li>
            {flags.journal ? <li><Link className={link} href="/journal">Heritage journal</Link></li> : null}
            <li><Link className={link} href="/become-a-seller">Sell on Wahbayaan</Link></li>
            <li><Link className={link} href="/contact">Contact</Link></li>
            <li><Link className={link} href="/terms">Terms</Link> · <Link className={link} href="/privacy">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div
          className={`mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-5 pt-6 text-xs text-sand-100/80 sm:px-6 lg:px-10 ${tabBarSpace ? "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6" : "pb-6"}`}
        >
          <p>© {new Date().getFullYear()} Wahbayaan. Handmade in Pakistan.</p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <li className="inline-flex items-center gap-1.5"><Lock className="size-3.5 text-gold-300" aria-hidden /> Secure card payments</li>
            <li className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-gold-300" aria-hidden /> Funds held until delivery</li>
            <li className="inline-flex items-center gap-1.5"><BadgeCheck className="size-3.5 text-gold-300" aria-hidden /> Verified artisans</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
