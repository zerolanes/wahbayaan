import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageSquareQuote, PenTool, ShieldCheck } from "lucide-react";
import { CustomRequestForm } from "@/components/store/custom-request-form";
import { isSvg } from "@/components/store/illustration-tag";
import { PageHero } from "@/components/store/page-hero";
import { StarRating, VerifiedBadge } from "@/components/store/trust";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { DESTINATIONS } from "@/lib/money/currency";
import { getProductDetail, getPublicCategories, getPublicVendors } from "@/lib/queries/catalog";

export const metadata: Metadata = {
  title: "Commission a piece",
  description: "Ask a verified Pakistani artisan to make something just for you — your name in Nastaliq, a rug in your room's exact size, a carving for a gift. Free quotes; nothing charged until you accept.",
};

const STEPS = [
  { icon: PenTool, title: "Tell us what you'd love", text: "Words, size, colours, a photo of the room. Choose an artisan or let us match you." },
  { icon: MessageSquareQuote, title: "Get a quote", text: "The artisan replies with a price and making time. Shipping and import costs for your country are shown separately." },
  { icon: ShieldCheck, title: "Approve — payment held", text: "Accept and it's listed privately for you. Your payment is held until the finished piece arrives." },
];

export default async function CustomPage(props: PageProps<"/custom">) {
  const sp = await props.searchParams;
  const artisanSlug = typeof sp.artisan === "string" ? sp.artisan : undefined;
  const productSlug = typeof sp.product === "string" ? sp.product : undefined;
  const [ctx, user, categories, vendors, product] = await Promise.all([
    getBuyerContext(),
    getCurrentUser(),
    getPublicCategories(),
    getPublicVendors(),
    productSlug ? getProductDetail(productSlug) : Promise.resolve(null),
  ]);
  const takingCommissions = vendors.filter((v) => v.acceptsCustomOrders && !v.vacationMode);
  const artisan = takingCommissions.find((v) => v.slug === (artisanSlug ?? product?.vendor.slug));
  const defaultCategory = product?.categoryId ?? artisan?.primaryCategoryId ?? undefined;

  return (
    <>
      <PageHero
        eyebrow="Commissions"
        title={
          <>
            Commission a piece <span className="gold-text italic">made for you</span>
          </>
        }
        description="Describe it; an artisan quotes. Nothing is charged until you say yes."
        aside={
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-400/15 ring-1 ring-gold-300/30">
                  <s.icon className="size-5 text-gold-300" aria-hidden />
                </span>
                <span>
                  <span className="text-xs font-semibold tracking-widest text-gold-300">STEP {i + 1}</span>
                  <span className="block font-display text-xl text-sand-50">{s.title}</span>
                  <span className="mt-1 block text-sm text-sand-200/75">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        }
      />

      <Container className="grid gap-12 py-16 md:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-20">
        <div>
          {artisan || product ? (
            <div className="mb-10 flex flex-wrap gap-4">
              {artisan ? (
                <Link href={`/artisans/${artisan.slug}`} className="flex items-center gap-4 rounded-2xl bg-sand-50 p-4 pr-6 ring-1 ring-umber-200/60 transition hover:shadow-soft">
                  <span className="relative size-14 overflow-hidden rounded-full bg-sand-200">
                    {artisan.profilePhotoUrl ? <Image src={artisan.profilePhotoUrl} alt="" fill sizes="56px" unoptimized={isSvg(artisan.profilePhotoUrl)} className="object-cover" /> : null}
                  </span>
                  <span>
                    <span className="text-xs text-umber-500">Your request goes to</span>
                    <span className="block font-display text-lg text-umber-900">{artisan.displayName}</span>
                    <span className="flex items-center gap-2">
                      <VerifiedBadge size="xs" />
                      <StarRating average={artisan.rating.average} count={artisan.rating.count} emptyLabel="New artisan" />
                    </span>
                  </span>
                </Link>
              ) : null}
              {product ? (
                <Link href={`/product/${product.slug}`} className="flex items-center gap-4 rounded-2xl bg-sand-50 p-4 pr-6 ring-1 ring-umber-200/60 transition hover:shadow-soft">
                  <span className="relative size-14 overflow-hidden rounded-xl bg-sand-200">
                    {product.images[0] ? <Image src={product.images[0].url} alt="" fill sizes="56px" unoptimized={isSvg(product.images[0].url)} className="object-cover" /> : null}
                  </span>
                  <span>
                    <span className="text-xs text-umber-500">Inspired by</span>
                    <span className="block max-w-xs truncate font-display text-lg text-umber-900">{product.title}</span>
                  </span>
                </Link>
              ) : null}
            </div>
          ) : null}
          <CustomRequestForm
            categories={categories.map((c) => ({ id: c.id, label: c.name }))}
            artisans={takingCommissions.map((v) => ({ id: v.slug, label: `${v.displayName} — ${v.craft}`, categoryId: v.primaryCategoryId }))}
            defaults={{
              categoryId: defaultCategory,
              vendorSlug: artisan?.slug,
              productSlug: product?.slug,
              name: user?.name ?? "",
              email: user?.email ?? "",
              destination: ctx.destination,
              details: product ? `Something like “${product.title}”, but…` : undefined,
            }}
            currency={ctx.currency}
            destinations={DESTINATIONS.map((d) => ({ code: d.code, name: d.name }))}
          />
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-card)] bg-sand-50 p-6 ring-1 ring-umber-200/60">
            <h2 className="font-display text-xl text-umber-900">Good to know</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-umber-900">How long for a quote?</dt>
                <dd className="mt-0.5 text-umber-600">Usually a few days — each artisan&apos;s typical reply time is on their profile. You&apos;ll get an email when it&apos;s ready.</dd>
              </div>
              <div>
                <dt className="font-semibold text-umber-900">Do I pay anything now?</dt>
                <dd className="mt-0.5 text-umber-600">No. Requests and quotes are free. You only pay if you accept, and then the payment is held until delivery.</dd>
              </div>
              <div>
                <dt className="font-semibold text-umber-900">What about shipping and duty?</dt>
                <dd className="mt-0.5 text-umber-600">They&apos;re quoted for your country as separate lines, exactly like a listed piece — never hidden in the price.</dd>
              </div>
              <div>
                <dt className="font-semibold text-umber-900">Can I see progress?</dt>
                <dd className="mt-0.5 text-umber-600">Message the artisan any time from your account. Many send sketches or a photo from the loom or the bench.</dd>
              </div>
            </dl>
          </div>
          {!user ? (
            <p className="rounded-2xl bg-indigo-50 p-5 text-sm text-indigo-900">
              <Link href="/login?next=/custom" className="font-semibold underline">
                Sign in
              </Link>{" "}
              to track your request and its quote in your account — or just leave your email.
            </p>
          ) : null}
        </aside>
      </Container>
    </>
  );
}
