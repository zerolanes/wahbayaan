import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Ban, Info, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { ImportNotice } from "@/lib/commerce/rates";
import { destinationName } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";
import { isSvg } from "./illustration-tag";
import { StarRating } from "./trust";

/** Buyer protection summary — shown on every listing, in the cart and at checkout. */
export function BuyerProtectionBox({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("night relative overflow-hidden rounded-2xl p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-400/15 ring-1 ring-gold-300/30">
          <ShieldCheck className="size-5 text-gold-300" aria-hidden />
        </span>
        <div>
          <p className="font-display text-lg text-sand-50">Wahbayaan Buyer Protection</p>
          <p className="mt-1 text-sm text-sand-200/75">Your payment is held by us — not sent to the artisan — until your piece arrives as described.</p>
        </div>
      </div>
      {!compact ? (
        <ul className="mt-4 grid gap-2 text-sm text-sand-100/85">
          <li className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-300" aria-hidden /> Damaged in transit, not as described or never arrived — open a case and held funds are frozen while we resolve it.
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-300" aria-hidden /> Every artisan is identity- and workshop-verified before they can list.
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-300" aria-hidden /> Shipping and import costs are itemised before you pay.
          </li>
        </ul>
      ) : null}
      <Link href="/buyer-protection" className="mt-4 inline-block text-sm font-medium text-gold-200 underline-offset-4 hover:underline">
        How buyer protection works →
      </Link>
    </div>
  );
}

const NOTICE_STYLE: Record<ImportNotice["level"], { icon: typeof Info; tone: string; label: string }> = {
  info: { icon: Info, tone: "bg-indigo-50 text-indigo-900 ring-indigo-200", label: "Import note" },
  warning: { icon: AlertTriangle, tone: "bg-warning-50 text-warning-700 ring-warning-600/20", label: "Check before buying" },
  restricted: { icon: AlertTriangle, tone: "bg-danger-50 text-danger-700 ring-danger-600/20", label: "Restricted import" },
  prohibited: { icon: Ban, tone: "bg-danger-50 text-danger-700 ring-danger-600/30", label: "Can't be imported" },
  not_reviewed: { icon: ShieldQuestion, tone: "bg-pending-50 text-umber-800 ring-pending-600/20", label: "Import rules pending review" },
};

export function ImportNotices({ notices, destination, className }: { notices: ImportNotice[]; destination: string; className?: string }) {
  if (!notices.length) return null;
  return (
    <ul className={cn("space-y-2", className)} aria-label={`Import rules for ${destinationName(destination)}`}>
      {notices.map((n, i) => {
        const s = NOTICE_STYLE[n.level];
        return (
          <li key={i} className={cn("flex gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset", s.tone)}>
            <s.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                {s.label} · {destinationName(destination)}
              </p>
              <p className="mt-0.5 opacity-90">{n.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type WallPhoto = { url: string; reviewId: string; authorName: string; country: string | null; rating: number };

/** Buyer photos from reviews — pieces in real homes. */
export function ReviewPhotoWall({ photos, className }: { photos: WallPhoto[]; className?: string }) {
  if (!photos.length) return null;
  return (
    <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6", className)}>
      {photos.map((p, i) => (
        <li key={p.url + i} className={cn("group relative overflow-hidden rounded-xl bg-sand-200", i === 0 && photos.length > 4 ? "col-span-2 row-span-2" : "aspect-square")}>
          <a href={p.url} target="_blank" rel="noreferrer" className="block h-full w-full">
            <Image src={p.url} alt={`Photo from a buyer (${p.authorName})`} fill sizes="(min-width:1024px) 16vw, 33vw" unoptimized={isSvg(p.url)} className="object-cover transition duration-700 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-2 pt-6 pb-1.5 opacity-0 transition group-hover:opacity-100">
              <StarRating average={p.rating} count={1} showCount={false} tone="light" />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
