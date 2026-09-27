import Image from "next/image";
import { Star } from "lucide-react";
import { replyToReview } from "@/app/actions/seller";
import { ActionForm, SubmitButton } from "@/components/seller/action-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { listSellerReviews } from "@/lib/seller/queries";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Reviews" };

export default async function SellerReviews() {
  const user = await requireSeller();
  const reviews = await listSellerReviews(user.vendorId);
  const published = reviews.filter((r) => r.status === "published");
  const avg = published.length ? published.reduce((a, r) => a + r.rating, 0) / published.length : null;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reputation" title="Reviews" description="What buyers say about your work. A short, warm reply shows future buyers you care." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Average rating" value={avg ? `${avg.toFixed(1)} ★` : "—"} hint={`${published.length} published`} />
        <Stat label="With photos" value={published.filter((r) => r.photos.length).length} />
        <Stat label="Replied" value={published.filter((r) => r.sellerReply).length} hint={`of ${published.length}`} />
      </div>
      {reviews.length ? (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-gold-600 flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="size-4" fill={i < r.rating ? "currentColor" : "none"} />
                  ))}
                  <span className="text-umber-500 ml-2 text-sm">on {r.product.title}</span>
                </p>
                <p className="text-umber-500 flex items-center gap-2 text-xs">
                  {r.status === "pending" ? <Badge tone="pending">Awaiting moderation</Badge> : null}
                  {r.isDemo ? <Badge tone="pending">Sample</Badge> : null}
                  {formatDate(r.createdAt)}
                </p>
              </div>
              {r.title ? <h3 className="font-display text-umber-900 mt-2 text-lg">{r.title}</h3> : null}
              <p className="text-umber-700 mt-1 text-sm">{r.body}</p>
              {r.photos.length ? (
                <div className="mt-3 flex gap-2">
                  {r.photos.map((p) => (
                    <span key={p.id} className="relative size-16 overflow-hidden rounded-lg">
                      <Image src={p.url} alt="" fill sizes="64px" unoptimized={p.url.endsWith(".svg")} className="object-cover" />
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="text-umber-500 mt-2 text-xs">
                — {r.authorName}
                {r.buyerCountry ? `, ${r.buyerCountry}` : ""}
              </p>
              {r.status === "published" ? (
                <div className="border-umber-200/60 mt-4 border-t pt-4">
                  <ActionForm action={replyToReview}>
                    <>
                      <input type="hidden" name="reviewId" value={r.id} />
                      <Textarea name="reply" defaultValue={r.sellerReply ?? ""} rows={2} placeholder="Reply publicly…" />
                      <SubmitButton size="sm" variant="outline">
                        {r.sellerReply ? "Update reply" : "Post reply"}
                      </SubmitButton>
                    </>
                  </ActionForm>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Star className="size-8" />} title="No reviews yet">
          Buyers can review a piece once it&apos;s delivered. Reviews with photos are the strongest thing on your shop.
        </EmptyState>
      )}
    </div>
  );
}
