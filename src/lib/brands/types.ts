/**
 * The shape every brand-source adapter produces. Adapters (Shopify-style
 * products.json, CSV/feed upload, manual entry) only translate a brand's own
 * data into this; the sync engine decides what is stored.
 *
 * Money is PKR minor units (paisa). Nothing is converted on import: a source
 * that does not price in PKR is rejected.
 */
export type BrandAudienceValue = "women" | "men" | "kids" | "unisex";

export type NormalizedVariant = {
  externalId: string;
  sku: string | null;
  size: string | null;
  colour: string | null;
  pricePkr: number;
  /** The brand's original price when this variant is on sale. */
  compareAtPricePkr: number | null;
  available: boolean;
  /** Null when the brand doesn't publish stock counts. */
  stockQty: number | null;
  weightG: number | null;
};

export type NormalizedProduct = {
  externalId: string;
  handle: string;
  title: string;
  description: string | null;
  audience: BrandAudienceValue;
  category: string | null;
  collection: string | null;
  fabric: string | null;
  tags: string[];
  /** The product's page on the brand's own website. */
  sourceUrl: string | null;
  images: { url: string; alt: string | null }[];
  variants: NormalizedVariant[];
  /** Lowest variant price. */
  pricePkr: number;
  /** Original price of that variant when on sale. */
  compareAtPricePkr: number | null;
  onSale: boolean;
  weightG: number | null;
  publishedAt: Date | null;
};

export type ParseFailure = { ref: string; reason: string };

export type ParseResult = { products: NormalizedProduct[]; failures: ParseFailure[] };

export class AdapterError extends Error {}
