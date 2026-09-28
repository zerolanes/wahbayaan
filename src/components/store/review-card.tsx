import Image from "next/image";
import { destinationName } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";
import { StarRating } from "./trust";

export type ReviewView = {
  id: string;
  authorName: string;
  buyerCountry: string | null;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
  sellerReply: string | null;
  isDemo: boolean;
  photos: { id: string; url: string }[];
};

const FLAG: Record<string, string> = { US: "🇺🇸", GB: "🇬🇧", CA: "🇨🇦" };

/** A buyer review with photos — the strongest trust signal for a piece bought from afar. */
export function ReviewCard({ review, vendorName }: { review: ReviewView; vendorName?: string }) {
  return (
    <article className="rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StarRating average={review.rating} count={1} showCount={false} />
        <p className="text-xs text-umber-500">{formatDate(review.createdAt)}</p>
      </div>
      {review.title ? <h4 className="mt-2 font-display text-lg text-umber-900">{review.title}</h4> : null}
      <p className="mt-1.5 text-sm leading-relaxed text-umber-700">{review.body}</p>
      {review.photos.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative block size-20 overflow-hidden rounded-xl ring-1 ring-umber-200">
              <Image src={p.url} alt={`Photo from ${review.authorName}`} fill sizes="80px" unoptimized={p.url.endsWith(".svg")} className="object-cover transition hover:scale-105" />
            </a>
          ))}
        </div>
      ) : null}
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-umber-500">
        <span className="font-medium text-umber-700">{review.authorName}</span>
        {review.buyerCountry ? (
          <span>
            {FLAG[review.buyerCountry] ?? ""} {destinationName(review.buyerCountry)}
          </span>
        ) : null}
        <span className="rounded-full bg-success-50 px-2 py-0.5 text-success-700">Verified purchase</span>
        {review.isDemo ? <span className="rounded-full bg-pending-50 px-2 py-0.5 text-pending-600">Sample review (demo)</span> : null}
      </p>
      {review.sellerReply ? (
        <div className="mt-3 rounded-xl border-l-2 border-gold-400 bg-gold-50/60 px-3 py-2 text-sm text-umber-700">
          <p className="text-xs font-semibold text-gold-800">Reply from {vendorName ?? "the artisan"}</p>
          <p className="mt-0.5">{review.sellerReply}</p>
        </div>
      ) : null}
    </article>
  );
}

export function RatingHistogram({ histogram, total }: { histogram: { stars: number; count: number }[]; total: number }) {
  return (
    <div className="space-y-1.5">
      {histogram.map((h) => (
        <div key={h.stars} className="flex items-center gap-2 text-xs text-umber-600">
          <span className="w-8 tabular-nums">{h.stars} ★</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-umber-100">
            <span className="block h-full rounded-full bg-gold-500" style={{ width: `${total ? (h.count / total) * 100 : 0}%` }} />
          </span>
          <span className="w-6 text-right tabular-nums">{h.count}</span>
        </div>
      ))}
    </div>
  );
}
