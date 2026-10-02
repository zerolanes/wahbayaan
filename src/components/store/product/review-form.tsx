"use client";

import { useActionState, useState } from "react";
import { Camera, CheckCircle2, Star } from "lucide-react";
import { submitReview } from "@/app/actions/product";
import { cn } from "@/lib/utils/cn";

/** Review with photo uploads, for buyers whose piece has been delivered. Reviews are moderated. */
export function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(submitReview, null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [files, setFiles] = useState<string[]>([]);

  if (state?.ok)
    return (
      <div className="flex gap-3 rounded-2xl bg-success-50 p-5 text-success-700" role="status">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-sm">{state.message}</p>
      </div>
    );

  const field = "w-full rounded-xl border border-umber-200 bg-white/90 px-3.5 py-2.5 text-[0.95rem] text-umber-900 placeholder:text-umber-500 focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="text-sm font-medium text-umber-800">Your rating</legend>
        <div className="mt-1.5 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} className="peer sr-only" required checked={rating === n} onChange={() => setRating(n)} />
              <Star
                className={cn("size-8 transition peer-focus-visible:outline-2 peer-focus-visible:outline-gold-500", (hover || rating) >= n ? "text-gold-500" : "text-umber-200")}
                fill="currentColor"
                strokeWidth={0}
              />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <label htmlFor="rv-title" className="text-sm font-medium text-umber-800">
          Headline <span className="font-normal text-umber-600">(optional)</span>
        </label>
        <input id="rv-title" name="title" maxLength={120} className={cn(field, "h-11")} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="rv-body" className="text-sm font-medium text-umber-800">
          Your review
        </label>
        <textarea id="rv-body" name="body" required minLength={20} maxLength={4000} rows={5} placeholder="How did it arrive? Does it match the listing? How does it look at home?" className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="rv-photos" className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-umber-300 bg-sand-50/70 px-4 py-3 text-sm text-umber-700 transition hover:border-umber-500">
          <Camera className="size-5 text-gold-600" aria-hidden />
          <span className="flex-1">{files.length ? files.join(", ") : "Add photos of your piece at home (up to 6 — JPG, PNG or WebP)"}</span>
        </label>
        <input
          id="rv-photos"
          name="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))}
        />
      </div>
      {state?.error ? <p className="rounded-xl bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{state.error}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-full bg-indigo-900 px-6 text-sm font-medium text-sand-50 shadow-soft transition hover:bg-indigo-800 disabled:opacity-60">
          {pending ? "Sending…" : "Submit review"}
        </button>
        <p className="text-xs text-umber-500">Every review is checked by our team before it&apos;s published.</p>
      </div>
    </form>
  );
}
