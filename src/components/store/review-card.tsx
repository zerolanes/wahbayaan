import { SHOW_QA_LABELS } from "@/lib/qa";
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
    <article className="rounded-[var(--radius-card)] bg-white p-5 shadow-[0_0_0_0.5px_rgb(34_26_19/0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StarRating average={review.rating} count={1} showCount={false} />
        <p className="text-umber-600 text-xs">{formatDate(review.createdAt)}</p>
      </div>
      {review.title ? <h4 className="font-display text-umber-900 mt-2 text-lg">{review.title}</h4> : null}
      <p className="text-umber-700 mt-1.5 text-sm leading-relaxed">{review.body}</p>
      {review.photos.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="ring-umber-200 relative block size-20 overflow-hidden rounded-xl ring-1">
              <Image
                src={p.url}
                alt={`Photo from ${review.authorName}`}
                fill
                sizes="80px"
                unoptimized={p.url.endsWith(".svg")}
                className="object-cover transition hover:scale-105"
              />
            </a>
          ))}
        </div>
      ) : null}
      <p className="text-umber-600 mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-umber-700 font-medium">{review.authorName}</span>
        {review.buyerCountry ? (
          <span>
            {FLAG[review.buyerCountry] ?? ""} {destinationName(review.buyerCountry)}
          </span>
        ) : null}
        <span className="bg-success-50 text-success-700 rounded-full px-2 py-0.5">Verified purchase</span>
        {SHOW_QA_LABELS && review.isDemo ? <span className="bg-pending-50 text-pending-600 rounded-full px-2 py-0.5">Sample review (demo)</span> : null}
      </p>
      {review.sellerReply ? (
        <div className="border-gold-400 bg-gold-50/60 text-umber-700 mt-3 rounded-xl border-l-2 px-3 py-2 text-sm">
          <p className="text-gold-800 text-xs font-semibold">Reply from {vendorName ?? "the artisan"}</p>
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
        <div key={h.stars} className="text-umber-600 flex items-center gap-2 text-xs">
          <span className="w-8 tabular-nums">{h.stars} ★</span>
          <span className="bg-umber-100 h-1.5 flex-1 overflow-hidden rounded-full">
            <span className="bg-gold-500 block h-full rounded-full" style={{ width: `${total ? (h.count / total) * 100 : 0}%` }} />
          </span>
          <span className="w-6 text-right tabular-nums">{h.count}</span>
        </div>
      ))}
    </div>
  );
}
