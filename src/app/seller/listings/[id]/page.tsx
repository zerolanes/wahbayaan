import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Box, ExternalLink, Trash2 } from "lucide-react";
import { deleteListingImage, moveListingImage } from "@/app/actions/seller";
import { GuidedPricing } from "@/components/seller/guided-pricing";
import { ListingForm } from "@/components/seller/listing-form";
import { ListingBadge } from "@/components/seller/status";
import { Badge, Breadcrumbs, Card, CardHeader, Notice, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { getSellerProduct, listCategoriesForSeller } from "@/lib/seller/queries";

export const metadata = { title: "Edit listing" };

export default async function EditListing(props: PageProps<"/seller/listings/[id]">) {
  const user = await requireSeller();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [product, categories] = await Promise.all([getSellerProduct(user.vendorId, id), listCategoriesForSeller()]);
  if (!product) notFound();
  const checklist = [
    { ok: product.images.length >= 3, label: "At least 3 photos (whole piece, detail, in a room)" },
    { ok: !!product.weightG, label: "Packed weight — needed for courier quotes" },
    { ok: !!product.widthCm && !!product.heightCm, label: "Dimensions" },
    { ok: (product.description?.length ?? 0) >= 150, label: "A description of 150+ characters" },
    { ok: product.materials.length > 0, label: "Materials" },
    { ok: !!product.story, label: "The story behind the piece" },
    { ok: !!product.videoUrl, label: "A process video (buyers love seeing the hands at work)" },
  ];
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Listings", href: "/seller/listings" }, { label: product.title }]} />
      <PageHeader
        eyebrow={product.category.name}
        title={product.title}
        actions={
          <>
            <ListingBadge status={product.status} />
            {product.status === "active" ? (
              <Link href={`/product/${product.slug}`} className="text-terracotta-600 inline-flex items-center gap-1 text-sm hover:underline">
                View on the store <ExternalLink className="size-3.5" />
              </Link>
            ) : null}
          </>
        }
      />
      {sp.saved ? <Notice tone="success">Saved. Add more photos or submit it for review when you&apos;re ready.</Notice> : null}
      {product.status === "rejected" && product.rejectionReason ? (
        <Notice tone="danger" title="Our team asked for changes">
          {product.rejectionReason}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Photos" description="The first photo is the one buyers see first." />
            {product.images.length ? (
              <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
                {product.images.map((img, i) => (
                  <li key={img.id} className="group relative">
                    <div className="bg-sand-200 relative aspect-[4/5] overflow-hidden rounded-xl">
                      <Image src={img.url} alt={img.alt ?? ""} fill sizes="200px" unoptimized={img.url.endsWith(".svg")} className="object-cover" />
                      {i === 0 ? <span className="absolute top-2 left-2 rounded-full bg-indigo-950/80 px-2 py-0.5 text-[10px] text-white">Main</span> : null}
                      {img.kind === "illustration" ? (
                        <span className="absolute right-2 bottom-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white">Illustration</span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex justify-center gap-1">
                      {[
                        ["up", ArrowUp, "Move earlier"],
                        ["down", ArrowDown, "Move later"],
                      ].map(([dir, Icon, label]) => (
                        <form key={dir as string} action={moveListingImage}>
                          <input type="hidden" name="imageId" value={img.id} />
                          <input type="hidden" name="dir" value={dir as string} />
                          <button className="hover:bg-umber-900/5 grid size-8 place-items-center rounded-full" aria-label={label as string}>
                            <Icon className="size-4" />
                          </button>
                        </form>
                      ))}
                      <form action={deleteListingImage}>
                        <input type="hidden" name="imageId" value={img.id} />
                        <button
                          className="text-umber-500 hover:bg-danger-50 hover:text-danger-600 grid size-8 place-items-center rounded-full"
                          aria-label="Delete photo"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-umber-500 p-5 text-sm">No photos yet — add them below.</p>
            )}
          </Card>
          <ListingForm
            categories={categories}
            defaults={{
              ...product,
              categoryId: product.categoryId,
              materials: product.materials,
              techniques: product.techniques,
            }}
          />
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Pricing guide" description="All in rupees" />
            <div className="p-5">
              <GuidedPricing product={product} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Listing checklist" />
            <ul className="space-y-2 p-5 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span className={c.ok ? "text-success-600" : "text-umber-300"}>{c.ok ? "✓" : "○"}</span>
                  <span className={c.ok ? "text-umber-700" : "text-umber-500"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="3D view" />
            <div className="text-umber-600 space-y-2 p-5 text-sm">
              <p className="flex items-center gap-2">
                <Box className="text-gold-600 size-4" />
                {product.model3d?.source === "scan" ? (
                  <Badge tone="success">3D scan uploaded</Badge>
                ) : product.model3d ? (
                  <Badge>Illustrative model</Badge>
                ) : (
                  <Badge>None</Badge>
                )}
              </p>
              <p className="text-xs">Upload a .glb scan of this exact piece to let buyers rotate it in 3D. Phone apps like Polycam or Luma can create one.</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
