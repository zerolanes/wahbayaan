import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock, PenTool } from "lucide-react";
import { BuyerPrice } from "@/components/money/buyer-price";
import { isSvg } from "@/components/store/illustration-tag";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, type Tone } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { destinationName, formatMoney, isBuyerCurrency } from "@/lib/money/currency";
import { getBuyerRequests } from "@/lib/queries/account";
import { formatDate } from "@/lib/utils/format";
import { respondToQuoteAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "Your commissions", robots: { index: false } };

const STATUS: Record<string, { label: string; tone: Tone }> = {
  new: { label: "With the artisan", tone: "indigo" },
  quoted: { label: "Quote ready", tone: "gold" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  converted: { label: "Ordered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export default async function RequestsPage() {
  const user = await requireUser("/account/requests");
  const requests = await getBuyerRequests(user.id);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Commissions"
        title="Your requests"
        description="Pieces made just for you. When an artisan quotes, you'll see the price in your currency and the making time here."
        actions={<ButtonLink href="/custom">New request</ButtonLink>}
      />
      {requests.length ? (
        <ul className="space-y-5">
          {requests.map((r) => {
            const s = STATUS[r.status] ?? { label: r.status, tone: "neutral" as Tone };
            return (
              <li key={r.id} className="overflow-hidden rounded-[var(--radius-card)] bg-sand-50 ring-1 ring-umber-200/60">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-umber-200/60 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="relative size-10 overflow-hidden rounded-full bg-sand-200">
                      {r.vendor?.profilePhotoUrl ? <Image src={r.vendor.profilePhotoUrl} alt="" fill sizes="40px" unoptimized={isSvg(r.vendor.profilePhotoUrl)} className="object-cover" /> : <PenTool className="m-2.5 size-5 text-umber-600" aria-hidden />}
                    </span>
                    <div>
                      <p className="font-semibold text-umber-900">
                        {r.number} ·{" "}
                        {r.vendor ? (
                          <Link href={`/artisans/${r.vendor.slug}`} className="hover:text-terracotta-700">
                            {r.vendor.displayName}
                          </Link>
                        ) : (
                          "Matching you with an artisan"
                        )}
                      </p>
                      <p className="text-xs text-umber-500">
                        {r.category?.name ?? "Commission"} · sent {formatDate(r.createdAt)} · to {destinationName(r.destinationCountry)}
                      </p>
                    </div>
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <div className="grid gap-6 px-6 py-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <div className="space-y-2 text-sm">
                    <p className="text-umber-800">{r.details}</p>
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-umber-600">
                      {r.customText ? (
                        <div>
                          <dt className="inline text-umber-600">Text: </dt>
                          <dd className="inline">{r.customText}</dd>
                        </div>
                      ) : null}
                      {r.sizeNotes ? (
                        <div>
                          <dt className="inline text-umber-600">Size: </dt>
                          <dd className="inline">{r.sizeNotes}</dd>
                        </div>
                      ) : null}
                      {r.colorNotes ? (
                        <div>
                          <dt className="inline text-umber-600">Colours: </dt>
                          <dd className="inline">{r.colorNotes}</dd>
                        </div>
                      ) : null}
                      {r.budget != null && r.budgetCurrency && isBuyerCurrency(r.budgetCurrency) ? (
                        <div>
                          <dt className="inline text-umber-600">Your budget: </dt>
                          <dd className="inline">{formatMoney(r.budget, r.budgetCurrency)}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {r.referenceImageUrls.length ? (
                      <div className="flex gap-2 pt-1">
                        {r.referenceImageUrls.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" className="relative size-14 overflow-hidden rounded-lg bg-sand-200">
                            <Image src={u} alt="Reference" fill sizes="56px" unoptimized={isSvg(u)} className="object-cover" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    {r.status === "quoted" && r.quotePkr != null ? (
                      <div className="rounded-2xl bg-gold-50 p-5 ring-1 ring-gold-300/60">
                        <p className="text-xs font-semibold tracking-wider text-gold-800 uppercase">The artisan&apos;s quote</p>
                        <BuyerPrice pkr={r.quotePkr} className="mt-1 block font-display text-3xl text-umber-900" />
                        {r.quoteDays ? (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-umber-700">
                            <Clock className="size-4 text-gold-700" aria-hidden /> About {r.quoteDays} days to make
                          </p>
                        ) : null}
                        {r.quoteMessage ? <p className="mt-3 text-sm text-umber-700 italic">“{r.quoteMessage}”</p> : null}
                        <p className="mt-3 text-xs text-umber-500">Item price only. Shipping and import costs to {destinationName(r.destinationCountry)} are quoted separately, before you pay.</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <form action={respondToQuoteAction}>
                            <input type="hidden" name="request" value={r.number} />
                            <input type="hidden" name="decision" value="accept" />
                            <button className="h-10 rounded-full bg-indigo-900 px-5 text-sm font-medium text-sand-50 transition hover:bg-indigo-800">Accept quote</button>
                          </form>
                          <form action={respondToQuoteAction}>
                            <input type="hidden" name="request" value={r.number} />
                            <input type="hidden" name="decision" value="decline" />
                            <button className="h-10 rounded-full border border-umber-300/70 px-5 text-sm font-medium text-umber-800 transition hover:border-umber-900">Decline</button>
                          </form>
                        </div>
                      </div>
                    ) : r.status === "accepted" ? (
                      <div className="rounded-2xl bg-success-50 p-5 text-sm text-success-700 ring-1 ring-success-600/20">
                        <p className="font-semibold">You accepted this quote.</p>
                        <p className="mt-1">
                          {r.vendor?.displayName ?? "The artisan"} will list the piece privately for you; we&apos;ll email you a link to order it with the confirmed shipping and import costs. Nothing has been charged yet.
                        </p>
                      </div>
                    ) : r.status === "new" ? (
                      <p className="rounded-2xl bg-indigo-50 p-5 text-sm text-indigo-900">We&apos;ll email you as soon as there&apos;s a quote. The artisan may message you first with questions.</p>
                    ) : (
                      <p className="rounded-2xl bg-umber-100/60 p-5 text-sm text-umber-600">This request is closed.</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<PenTool className="size-10" aria-hidden />} title="No commissions yet" action={<ButtonLink href="/custom">Commission a piece</ButtonLink>}>
          Ask an artisan to make something that doesn&apos;t exist yet — your family name in Nastaliq, a rug in your room&apos;s exact size.
        </EmptyState>
      )}
    </div>
  );
}
