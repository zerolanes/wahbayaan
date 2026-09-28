import Link from "next/link";
import { Logo, ScallopDivider } from "@/components/brand/logo";
import { featureFlags } from "@/lib/features";
import { getPublicCategories } from "@/lib/queries/catalog";
import { NewsletterForm } from "./newsletter-form";

export async function SiteFooter() {
  const [categories, flags] = await Promise.all([getPublicCategories(), featureFlags()]);
  const col = "space-y-2.5 text-sm text-sand-200/70";
  const link = "transition hover:text-gold-200";
  return (
    <footer className="night relative mt-24">
      <ScallopDivider />
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div className="max-w-sm">
          <Logo tone="light" />
          <p className="mt-5 text-sm leading-relaxed text-sand-200/70">
            Heritage craft from verified Pakistani artisans, delivered to the US, UK and Canada — with the full landed cost shown before you pay and your
            payment held until your piece arrives.
          </p>
          <NewsletterForm />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Crafts</p>
          <ul className={`mt-4 ${col}`}>
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
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Buying</p>
          <ul className={`mt-4 ${col}`}>
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
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Wahbayaan</p>
          <ul className={`mt-4 ${col}`}>
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
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-sand-200/50 sm:px-6 lg:px-10">
          <p>© {new Date().getFullYear()} Wahbayaan. Handmade in Pakistan.</p>
          <p className="flex items-center gap-3">
            <span>Secure card payments</span>
            <span aria-hidden>·</span>
            <span>Funds held until delivery</span>
            <span aria-hidden>·</span>
            <span>Verified artisans</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
