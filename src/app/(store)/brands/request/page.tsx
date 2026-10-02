import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardCheck, Link2, PackageCheck } from "lucide-react";
import { BrandRequestForm } from "@/components/store/brands/request-form";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { resolveShipTo } from "@/lib/brands/bag";
import { SHOP_BY_LINK_LINE } from "@/lib/brands/permission";
import { MAX_REQUEST_ITEMS } from "@/lib/brands/requests";
import { featureFlags } from "@/lib/features";
import { destinationName } from "@/lib/money/currency";
import { paymentOptionsFor } from "@/lib/payments/options";

export const metadata: Metadata = { title: "Shop any brand by link", description: "Paste product links from any Pakistani brand. We'll buy it for you and deliver." };

export default async function BrandRequestPage(props: PageProps<"/brands/request">) {
  if (!(await featureFlags()).brandRequests) notFound();
  const sp = await props.searchParams;
  const [ctx, user] = await Promise.all([getBuyerContext(), getCurrentUser()]);
  const route = resolveShipTo(ctx, null);
  const payment = await paymentOptionsFor(ctx.currency);
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: "Shop by link" }]} />
      <div className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <h1 className="font-display text-5xl text-umber-900">Shop any brand by link</h1>
          <p className="mt-3 max-w-xl text-lg text-umber-600">Found something on a Pakistani brand&apos;s website? Paste the link. {SHOP_BY_LINK_LINE}</p>
          <div className="mt-10">
            <BrandRequestForm
              home={{ code: ctx.destination, name: destinationName(ctx.destination) }}
              canChoose={route.canChoose}
              defaults={{ email: user?.email ?? "", name: user?.name ?? "" }}
              payment={payment}
              maxItems={MAX_REQUEST_ITEMS}
              prefillBrand={typeof sp.brand === "string" ? sp.brand.slice(0, 80) : undefined}
            />
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {[
            { icon: <Link2 className="size-5" />, t: "1. Paste your links", d: "Several items, different brands — one request, one box." },
            { icon: <ClipboardCheck className="size-5" />, t: "2. Get a quote", d: "We check each item and its price, then email an itemised quote: items, delivery and our service fee. Nothing is charged yet." },
            { icon: <PackageCheck className="size-5" />, t: "3. Approve, pay, receive", d: "We buy from the brand, check everything at Wahbayaan and dispatch with tracking." },
          ].map((s) => (
            <div key={s.t} className="rounded-[var(--radius-card)] bg-sand-50 p-5 ring-1 ring-umber-200/60">
              <span className="text-gold-600">{s.icon}</span>
              <p className="mt-2 font-semibold text-umber-900">{s.t}</p>
              <p className="mt-1 text-sm text-umber-600">{s.d}</p>
            </div>
          ))}
        </aside>
      </div>
    </Container>
  );
}
