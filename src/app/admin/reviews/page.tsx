import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { bulkReviewsAction, moderateReviewAction, removeReviewPhotoAction, removeSellerReplyAction } from "@/app/actions/admin/reviews";
import { ActionButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { DemoBadge, Empty, FilterBar, FilterSelect, StatusBadge, TableCard } from "@/components/admin/ui";
import { PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { products, reviewPhotos, reviews, vendors } from "@/lib/db/schema";
import { hrefWith, pageCount, pageOf, str } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { destinationName } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Reviews" };
const SIZE = 15;

export default async function ReviewsPage(props: PageProps<"/admin/reviews">) {
  await requireStaff("reviews.moderate");
  const params = await props.searchParams;
  const page = pageOf(params);
  const status = str(params, "status");
  const d = await db();
  const base: SQL[] = [];
  const q = str(params, "q");
  if (q) base.push(or(ilike(reviews.body, likeTerm(q)), ilike(reviews.title, likeTerm(q)), ilike(products.title, likeTerm(q)), ilike(reviews.authorName, likeTerm(q)))!);
  if (str(params, "rating")) base.push(eq(reviews.rating, Number(str(params, "rating"))));
  if (str(params, "low") === "1") base.push(sql`${reviews.rating} <= 3`);
  if (str(params, "artisan")) base.push(eq(reviews.vendorId, str(params, "artisan")));
  if (str(params, "photos") === "1") base.push(sql`exists (select 1 from review_photos p where p.review_id = ${reviews.id})`);
  if (str(params, "reply") === "1") base.push(sql`${reviews.sellerReply} is not null`);
  const where = and(...base, ...(status ? [sql`${reviews.status} = ${status}`] : []));
  const [rows, [{ n }], counts, artisans] = await Promise.all([
    d
      .select({ r: reviews, product: products.title, productId: products.id, vendor: vendors.displayName })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .innerJoin(vendors, eq(vendors.id, reviews.vendorId))
      .where(where)
      .orderBy(status === "pending" ? asc(reviews.createdAt) : desc(reviews.createdAt))
      .limit(SIZE)
      .offset((page - 1) * SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(reviews).innerJoin(products, eq(products.id, reviews.productId)).where(where),
    d.select({ s: reviews.status, n: sql<number>`count(*)::int` }).from(reviews).innerJoin(products, eq(products.id, reviews.productId)).where(and(...base)).groupBy(reviews.status),
    d.select({ id: vendors.id, name: vendors.displayName }).from(vendors).orderBy(asc(vendors.displayName)),
  ]);
  const photos = rows.length ? await d.select().from(reviewPhotos).where(inArray(reviewPhotos.reviewId, rows.map((r) => r.r.id))) : [];
  const c = Object.fromEntries(counts.map((x) => [x.s, Number(x.n)])) as Record<string, number>;
  const tabs = [
    { v: "pending", l: "Awaiting moderation" },
    { v: "published", l: "Published" },
    { v: "hidden", l: "Hidden" },
    { v: "", l: "All" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Marketplace" title="Reviews" description="Buyer reviews wait here before appearing on listings. Hide anything abusive or off-topic — never edit a buyer's words." />
      <Tabs items={tabs.map((t) => ({ label: t.l, href: hrefWith("/admin/reviews", params, { status: t.v || null }), active: status === t.v, count: t.v ? (c[t.v] ?? 0) : Object.values(c).reduce((a, b) => a + b, 0) }))} />
      <FilterBar action="/admin/reviews" q={q} placeholder="Words in the review, listing or author">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <FilterSelect name="rating" label="Rating" value={str(params, "rating")} options={[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r}★` }))} />
        <FilterSelect name="low" label="Low" value={str(params, "low")} options={[{ value: "1", label: "3★ and below" }]} />
        <FilterSelect name="artisan" label="Artisan" value={str(params, "artisan")} options={artisans.map((a) => ({ value: a.id, label: a.name }))} />
        <FilterSelect name="photos" label="Photos" value={str(params, "photos")} options={[{ value: "1", label: "With photos" }]} />
        <FilterSelect name="reply" label="Reply" value={str(params, "reply")} options={[{ value: "1", label: "Artisan replied" }]} />
      </FilterBar>
      <TableCard
        toolbar={
          <>
            <label className="flex items-center gap-2 text-sm text-umber-600">
              <SelectAll formId="reviews-bulk" /> {Number(n)} review{Number(n) === 1 ? "" : "s"}
            </label>
            <BulkBar
              formId="reviews-bulk"
              action={bulkReviewsAction}
              options={[
                { value: "published", label: "Publish" },
                { value: "hidden", label: "Hide" },
                { value: "pending", label: "Back to queue" },
              ]}
            />
          </>
        }
        footer={<Pagination page={page} pageCount={pageCount(Number(n), SIZE)} hrefFor={(p) => hrefWith("/admin/reviews", params, { page: p })} />}
      >
        {rows.length ? (
          <ul className="divide-y divide-umber-200/60">
            {rows.map(({ r, product, productId, vendor }) => {
              const ph = photos.filter((x) => x.reviewId === r.id);
              return (
                <li key={r.id} className="flex gap-4 px-5 py-4">
                  <div className="pt-1">
                    <RowCheck formId="reviews-bulk" value={r.id} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gold-500" aria-label={`${r.rating} out of 5`}>
                        {"★".repeat(r.rating)}
                        <span className="text-umber-200">{"★".repeat(5 - r.rating)}</span>
                      </span>
                      <p className="font-medium text-umber-900">{r.title ?? "Untitled"}</p>
                      <StatusBadge kind="review" status={r.status} />
                      <DemoBadge show={r.isDemo} />
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-umber-800">{r.body}</p>
                    {ph.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ph.map((p) => (
                          <div key={p.id} className="group relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt="Buyer photo" className="size-20 rounded-lg object-cover ring-1 ring-umber-200" />
                            <div className="absolute -top-2 -right-2 hidden group-hover:block">
                              <ActionButton action={removeReviewPhotoAction} fields={{ photoId: p.id }} variant="danger" confirm="Remove this photo from the review?" className="[&_button]:h-6 [&_button]:px-2 [&_button]:text-xs">
                                ×
                              </ActionButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {r.sellerReply ? (
                      <div className="mt-2 flex items-start justify-between gap-3 rounded-xl bg-terracotta-50 px-3 py-2 text-sm">
                        <p className="text-terracotta-900">
                          <span className="text-xs font-semibold tracking-wide uppercase">Artisan reply</span> · {r.sellerReply}
                        </p>
                        <ActionButton action={removeSellerReplyAction} fields={{ reviewId: r.id }} variant="ghost" confirm="Remove the artisan's reply from public view?">
                          Remove reply
                        </ActionButton>
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-umber-500">
                      {r.authorName}
                      {r.buyerCountry ? ` · ${destinationName(r.buyerCountry)}` : ""} · {formatDate(r.createdAt)} ·{" "}
                      <Link href={`/admin/listings/${productId}`} className="hover:underline">
                        {product}
                      </Link>{" "}
                      by {vendor} {r.orderItemId ? "· verified purchase" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {r.status !== "published" ? (
                      <ActionButton action={moderateReviewAction} fields={{ reviewId: r.id, status: "published" }} variant="primary">
                        Publish
                      </ActionButton>
                    ) : null}
                    {r.status !== "hidden" ? (
                      <ActionButton action={moderateReviewAction} fields={{ reviewId: r.id, status: "hidden" }}>
                        Hide
                      </ActionButton>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No reviews here.</Empty>
        )}
      </TableCard>
    </div>
  );
}
