import type { Metadata } from "next";
import { Gift, Hourglass, Users } from "lucide-react";
import { CopyLink } from "@/components/store/account-forms";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/order-access";
import { getOrCreateReferralCode, getReferralStats } from "@/lib/queries/account";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "Refer a friend", robots: { index: false } };

export default async function ReferralsPage() {
  const user = await requireUser("/account/referrals");
  const [code, referral, origin] = await Promise.all([getOrCreateReferralCode(user.id, user.name), getSetting("referral"), requestOrigin()]);
  const stats = await getReferralStats(code.code);
  const link = `${origin}/r/${code.code}`;
  const active = referral.status === "active";

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Refer a friend" title="Share the workshops you love" description="Send friends your link. When they order, the artisan gains a new buyer — and you both earn rewards once the programme launches." />
      <section className="night rounded-[var(--radius-card)] p-6 md:p-10">
        <Gift className="size-8 text-gold-300" aria-hidden />
        <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Your code · {code.code}</p>
        <h2 className="mt-2 font-display text-3xl text-sand-50 md:text-4xl">Your personal link</h2>
        <div className="mt-6 max-w-xl">
          <CopyLink value={link} />
        </div>
        <p className="mt-4 text-sm text-sand-200/70">Anyone who opens this link and orders within 30 days is counted as your referral.</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
          <Users className="size-5 text-gold-600" aria-hidden />
          <p className="mt-3 font-display text-4xl text-umber-900 tabular-nums">{code.uses}</p>
          <p className="text-sm text-umber-600">Visits from your link</p>
        </div>
        <div className="rounded-2xl bg-sand-50 p-6 ring-1 ring-umber-200/60">
          <Gift className="size-5 text-gold-600" aria-hidden />
          <p className="mt-3 font-display text-4xl text-umber-900 tabular-nums">{stats.orders}</p>
          <p className="text-sm text-umber-600">Orders placed with your link</p>
        </div>
      </div>

      {active ? (
        <section className="rounded-2xl bg-gold-50 p-6 ring-1 ring-gold-300/60">
          <h2 className="font-display text-2xl text-umber-900">Your rewards</h2>
          <p className="mt-2 text-umber-700">
            You earn <strong>{referral.referrerPoints.toLocaleString("en-US")} points</strong> for each friend&apos;s first completed order, and they earn{" "}
            <strong>{referral.refereePoints.toLocaleString("en-US")} points</strong> too. Points are added once the order is delivered and confirmed.
          </p>
        </section>
      ) : (
        <section className="flex gap-4 rounded-2xl bg-pending-50 p-6 ring-1 ring-pending-600/20">
          <Hourglass className="mt-0.5 size-6 shrink-0 text-pending-600" aria-hidden />
          <div>
            <h2 className="font-semibold text-umber-900">Rewards launching soon — your referrals are being tracked</h2>
            <p className="mt-1 text-sm text-umber-700">
              We&apos;re finalising the reward details. Every order placed with your link is already recorded, so it will count when rewards go live. We&apos;ll email you when they do.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
