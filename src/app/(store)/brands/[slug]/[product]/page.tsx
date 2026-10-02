import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink, Gift } from "lucide-react";
import { BuyerPrice } from "@/components/money/buyer-price";
import { BrandProductCard } from "@/components/store/brands/brand-product-card";
import { NotifyForm } from "@/components/store/brands/notify-form";
import { SizeGuideTable } from "@/components/store/brands/size-guide";
import { VariantPicker, type PickerVariant } from "@/components/store/brands/variant-picker";
import { DestinationPicker } from "@/components/store/destination-picker";
import { LandedCostBreakdown } from "@/components/store/landed-cost";
import { ProductGallery } from "@/components/store/product/gallery";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { itemPricePkr, wasPricePkr } from "@/lib/brands/catalog";
import { computeBrandQuote } from "@/lib/brands/pricing";
import { getBrandPricingContext } from "@/lib/brands/rates";
import { buyerUnitPrice } from "@/lib/commerce/landed-cost";
import { featureFlags } from "@/lib/features";
import { formatMoney, isDomestic } from "@/lib/money/currency";
import { getPublicBrandProduct, getPublicBrandProducts } from "@/lib/queries/brands";

export async function generateMetadata(props: PageProps<"/brands/[slug]/[product]">): Promise<Metadata> {
  const { slug, product } = await props.params;
  const p = await getPublicBrandProduct(slug, product);
  return p ? { title: `${p.title} — ${p.brand.name}`, description: p.description?.slice(0, 160) ?? undefined } : { title: "Not found" };
}

export default async function BrandProductPage(props: PageProps<"/brands/[slug]/[product]">) {
  if (!(await featureFlags()).pakistaniBrands) notFound();
  const { slug, product: productSlug } = await props.params;
  const [ctx, product] = await Promise.all([getBuyerContext(), getPublicBrandProduct(slug, productSlug)]);
  if (!product) notFound();
  const fx = ctx.fx;
  const money = (pkr: number) => (fx ? formatMoney(buyerUnitPrice(pkr, fx), ctx.currency, { cents: true }) : "Price on request");
  const variants: PickerVariant[] = product.variants.map((v) => {
    const was = wasPricePkr(product, v);
    return { id: v.id, size: v.size, colour: v.colour, available: v.available, stockQty: v.stockQty, priceLabel: money(itemPricePkr(product, v)), wasLabel: was ? money(was) : null };
  });

  const shipTo = isDomestic(ctx.destination) ? "PK" : ctx.destination;
  const estimate = fx
    ? computeBrandQuote({
        ...(await getBrandPricingContext(shipTo)),
        items: [{ key: product.id, title: product.title, unitPricePkr: product.priceNowPkr, qty: 1, weightG: product.weightG ?? product.brand.defaultWeightG }],
        shipTo,
        fx,
      })
    : null;
  const more = (await getPublicBrandProducts(product.brandId)).filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Pakistani Brands", href: "/brands" }, { label: product.brand.name, href: `/brands/${product.brand.slug}` }, { label: product.title }]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <ProductGallery images={product.images.map((i) => ({ url: i.url, alt: i.alt, kind: i.kind }))} title={product.title} videoUrl={null} />
        <div className="space-y-6">
          <div>
            <Link href={`/brands/${product.brand.slug}`} className="text-sm font-medium tracking-wide text-umber-500 uppercase hover:text-umber-900">
              {product.brand.name}
            </Link>
            <h1 className="mt-1 font-display text-4xl leading-tight text-umber-900">{product.title}</h1>
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <BuyerPrice pkr={product.priceNowPkr} className="text-2xl font-semibold text-umber-900" />
              {product.wasPkr ? <BuyerPrice pkr={product.wasPkr} strike /> : null}
              {product.onSale ? <span className="rounded-full bg-terracotta-600 px-2 py-0.5 text-xs font-medium text-white">Sale</span> : null}
              {product.isNew ? <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-umber-800">New</span> : null}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-sm text-umber-600">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden /> {product.brand.partnerLine}
            </p>
          </div>

          <VariantPicker variants={variants} sizes={product.sizes} colours={product.colours} />
          {!product.inStock ? <NotifyForm brandId={product.brandId} productId={product.id} kind="restock" /> : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-umber-800">Deliver to</p>
              <DestinationPicker destination={ctx.destination} />
            </div>
            {estimate ? <LandedCostBreakdown landed={estimate} title="Estimated total for one" compact pricedBy="the brand" /> : null}
            {!isDomestic(ctx.destination) ? (
              <p className="flex items-start gap-2 text-sm text-umber-600">
                <Gift className="mt-0.5 size-4 shrink-0 text-terracotta-600" aria-hidden /> Sending it to family in Pakistan? Choose that in your bag — delivered within Pakistan with no import duty, paid in {ctx.currency}.
              </p>
            ) : null}
          </div>

          {product.description ? (
            <section aria-labelledby="desc-h">
              <h2 id="desc-h" className="font-sans text-base font-semibold tracking-normal text-umber-900">
                Details
              </h2>
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-umber-700">
                {product.description.split("\n").map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {product.fabric ? (
                  <>
                    <dt className="text-umber-500">Fabric</dt>
                    <dd className="text-umber-900">{product.fabric}</dd>
                  </>
                ) : null}
                {product.collection ? (
                  <>
                    <dt className="text-umber-500">Collection</dt>
                    <dd className="text-umber-900">{product.collection}</dd>
                  </>
                ) : null}
              </dl>
            </section>
          ) : null}

          <section id="size-guide" aria-labelledby="sg-h" className="scroll-mt-24 rounded-2xl bg-sand-50 p-4 ring-1 ring-umber-200/60">
            <h2 id="sg-h" className="font-sans text-base font-semibold tracking-normal text-umber-900">
              Size guide
            </h2>
            <SizeGuideTable guide={product.brand.sizeGuide} brandName={product.brand.name} className="mt-3" />
          </section>

          {product.sourceUrl ? (
            <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-umber-700 hover:text-umber-900">
              View on {product.brand.name}&apos;s website <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      {more.length ? (
        <section className="mt-20" aria-labelledby="more-h">
          <h2 id="more-h" className="font-display text-3xl text-umber-900">
            More from {product.brand.name}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {more.map((p) => (
              <BrandProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </Container>
  );
}
