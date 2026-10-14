import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { FileSpreadsheet, Globe2, PackageCheck, Store } from "lucide-react";
import { BrandJoinForm } from "@/components/store/brands/brand-join-form";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, Notice } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getBrandMembership } from "@/lib/brand-portal/access";
import { BRAND_SELLER_TERMS_VERSION } from "@/lib/brand-portal/terms";
import { db } from "@/lib/db/client";
import { brandSellerApplications } from "@/lib/db/schema";
import { featureFlags } from "@/lib/features";

export const metadata: Metadata = {
  alternates: { canonical: "/brands/join" },
  title: "Sell your brand on Wahbayaan",
  description: "For Pakistani labels, designers and Instagram boutiques: list your collection, we sell it in Pakistan and abroad.",
};

const POINTS = [
  { icon: Store, t: "Your own brand page", d: "Logo, banner, story, size guide and social links." },
  { icon: FileSpreadsheet, t: "Upload in bulk", d: "Sizes, colours, stock and PKR prices — by form or CSV." },
  { icon: Globe2, t: "Buyers here and abroad", d: "Prices shown in each buyer's currency. You price in rupees." },
  { icon: PackageCheck, t: "We handle the rest", d: "Payment, delivery and customer care. You mark orders ready." },
];

export default async function BrandJoinPage() {
  if (!(await featureFlags()).pakistaniBrands) notFound();
  const user = await getCurrentUser();
  const membership = user ? await getBrandMembership(user.id) : null;
  const d = await db();
  const open = user
    ? await d.query.brandSellerApplications.findFirst({ where: eq(brandSellerApplications.userId, user.id), orderBy: desc(brandSellerApplications.createdAt) })
    : null;

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: "Sell your brand" }]} />
      <div className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-gold-700 uppercase">For Pakistani brands</p>
          <h1 className="mt-3 font-display text-5xl leading-[1.05] text-umber-900">Sell your brand on Wahbayaan</h1>
          <p className="mt-4 text-lg text-umber-600">For small labels, designers and Instagram boutiques. Free to apply.</p>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, t, d: text }) => (
              <li key={t} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-terracotta-600" aria-hidden />
                <span>
                  <span className="block font-semibold text-umber-900">{t}</span>
                  <span className="block text-sm text-umber-600">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-8 space-y-3 rounded-[var(--radius-card)] bg-sand-50 p-5 text-sm ring-1 ring-umber-200/60">
            <div>
              <dt className="font-medium text-umber-900">Your price</dt>
              <dd className="text-umber-600">Stays yours. Our service fee is a separate line for the buyer.</dd>
            </div>
            <div>
              <dt className="font-medium text-umber-900">Approval</dt>
              <dd className="text-umber-600">We review each brand by hand, usually within a few working days.</dd>
            </div>
            <div>
              <dt className="font-medium text-umber-900">Terms</dt>
              <dd className="text-umber-600">
                <Link href="/brands/join/terms" className="underline">Brand seller terms</Link> (version {BRAND_SELLER_TERMS_VERSION}).
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-umber-500">
            Handmade craft instead? <Link href="/become-a-seller" className="underline">Apply as an artisan</Link>.
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70 sm:p-10">
          {membership ? (
            <Notice tone="success" title={`You manage ${membership.brand.name}`}>
              <ButtonLink href="/brand-portal" size="sm" className="mt-3">
                Open your brand portal
              </ButtonLink>
            </Notice>
          ) : user?.role === "staff" ? (
            <Notice tone="indigo" title="Signed in as staff">
              Brands apply with their own account. Review applications in Admin → Brand applications.
            </Notice>
          ) : open && ["submitted", "in_review", "more_info"].includes(open.status) ? (
            <Notice tone="indigo" title={`${open.brandName}: application ${open.status === "more_info" ? "waiting on you" : "in review"}`}>
              {open.status === "more_info" ? "We emailed you with a question — just reply to that email." : "We'll email you once it's reviewed."}
            </Notice>
          ) : (
            <>
              <h2 className="font-display text-3xl text-umber-900">Apply</h2>
              <p className="mt-2 mb-8 text-umber-600">About five minutes.</p>
              {open?.status === "rejected" ? (
                <Notice tone="pending" className="mb-6" title="Your previous application wasn't approved">
                  You&apos;re welcome to apply again with more detail.
                </Notice>
              ) : null}
              <BrandJoinForm signedIn={!!user} defaults={{ name: user?.name ?? "", email: user?.email ?? "" }} termsVersion={BRAND_SELLER_TERMS_VERSION} />
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
