import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2, Circle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, Notice, PageHeader, Stat } from "@/components/ui/misc";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { portalCounts } from "@/lib/brand-portal/queries";
import { db } from "@/lib/db/client";
import { brandProfiles } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/settings";
import { brandIssues } from "@/lib/trust/visibility";

export const metadata = { title: "Overview" };

export default async function BrandPortalHome() {
  const user = await requireBrandMember();
  const b = user.brand;
  const d = await db();
  const [counts, profile] = await Promise.all([portalCounts(b.id), d.query.brandProfiles.findFirst({ where: eq(brandProfiles.brandId, b.id) })]);
  const issues = brandIssues(b, { demoMode: isDemoMode() });
  const live = issues.length === 0;
  const steps = [
    { done: !!b.logoUrl, label: "Add your logo", href: "/brand-portal/profile" },
    { done: !!profile?.bannerUrl, label: "Add a banner photo", href: "/brand-portal/profile" },
    { done: !!b.description, label: "Write a short “about”", href: "/brand-portal/profile" },
    { done: !!b.sizeGuide, label: "Add your size guide", href: "/brand-portal/profile" },
    { done: counts.live > 0, label: "Publish your first product", href: "/brand-portal/products" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Brand portal"
        title={b.name}
        description={live ? "Your brand page is live." : "Your brand page isn't public right now."}
        actions={
          live ? (
            <ButtonLink href={`/brands/${b.slug}`} variant="outline" size="sm">
              View brand page ↗
            </ButtonLink>
          ) : null
        }
      />
      {!live ? (
        <Notice tone="pending" title="Not public">
          {issues.map((i) => i.message).join(" · ")}. Contact Wahbayaan if this looks wrong.
        </Notice>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live products" value={counts.live} />
        <Stat label="Drafts" value={counts.drafts} hint={counts.drafts ? <Link href="/brand-portal/products?status=draft" className="underline">Review and publish</Link> : null} />
        <Stat label="Hidden" value={counts.hidden} />
        <Stat label="Items to prepare" value={counts.toPrepare} hint={counts.toPrepare ? <Link href="/brand-portal/orders" className="underline">Open orders</Link> : "Nothing waiting"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Set up your page</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                {s.done ? <CheckCircle2 className="size-4 text-success-600" aria-hidden /> : <Circle className="size-4 text-umber-400" aria-hidden />}
                {s.done ? <span className="text-umber-500 line-through">{s.label}</span> : <Link href={s.href} className="underline">{s.label}</Link>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold">Add products</h2>
          <p className="mt-2 text-sm text-umber-600">One at a time, or many at once from a spreadsheet. Each size and colour is a variant with its own stock and price in rupees.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/brand-portal/products/new" size="sm">
              Add a product
            </ButtonLink>
            <ButtonLink href="/brand-portal/import" size="sm" variant="outline">
              Upload a CSV
            </ButtonLink>
          </div>
        </Card>
      </div>
      <p className="text-xs text-umber-500">
        Wahbayaan adds its service fee and delivery as separate lines for the buyer. Your listed price is what you receive for each item collected.
      </p>
    </div>
  );
}
