/**
 * Brand portal CSV bulk upload: template, row-level validation and the import
 * plan shown as a preview before anything is written. Pure.
 *
 * - One row per variant. Rows sharing a `handle` (or, without one, a title) form
 *   one product; product columns may be repeated on every row or given once.
 * - SKU identifies a variant within the brand. Re-uploading the same file
 *   changes nothing (idempotent): matching SKUs are updated in place, new SKUs
 *   are added, variants missing from the file are left as they are.
 * - A product whose rows have errors is skipped; the rest can still be imported.
 * - Money is PKR (the brand's own item price). Nothing is converted.
 */
import { parseCsvRows } from "@/lib/brands/adapters/csv";
import { detectAudience, parsePkr, slugify, splitTags } from "@/lib/brands/adapters/normalize";
import { AdapterError, type BrandAudienceValue } from "@/lib/brands/types";

export const BRAND_CSV_COLUMNS = [
  "handle",
  "title",
  "description",
  "audience",
  "category",
  "collection",
  "fabric",
  "tags",
  "image_urls",
  "size",
  "colour",
  "sku",
  "price_pkr",
  "compare_at_price_pkr",
  "stock",
  "weight_g",
  "status",
] as const;
export const BRAND_CSV_REQUIRED = ["title", "sku", "price_pkr"] as const;
export const BRAND_CSV_MAX_ROWS = 2000;
export const BRAND_CSV_MAX_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 10;

const PRODUCT_COLUMNS = ["title", "description", "audience", "category", "collection", "fabric", "tags", "image_urls", "status"] as const;
const AUDIENCES: BrandAudienceValue[] = ["women", "men", "kids", "unisex"];
const STATUSES = ["draft", "published", "hidden"] as const;
export type CsvStatus = (typeof STATUSES)[number];

/** A downloadable template with two example products (fictional). */
export function brandCsvTemplate(): string {
  const rows = [
    BRAND_CSV_COLUMNS.join(","),
    `rang-lawn-3pc,Rang Printed Lawn 3-Piece,"Printed lawn shirt, dyed trousers and chiffon dupatta.",women,Unstitched,Summer Lawn,Lawn,"lawn,printed",https://example.com/rang-1.jpg|https://example.com/rang-2.jpg,S,Teal,RANG-TEAL-S,6490,7990,12,900,draft`,
    `rang-lawn-3pc,,,,,,,,,M,Teal,RANG-TEAL-M,6490,7990,8,900,`,
    `rang-lawn-3pc,,,,,,,,,L,Teal,RANG-TEAL-L,6490,7990,0,900,`,
    `sahar-kurta,Sahar Cotton Kurta,Straight-cut cotton kurta with embroidered neckline.,men,Kurta,Eid Edit,Cotton,kurta,https://example.com/sahar.jpg,M,White,SAHAR-WHT-M,4200,,5,500,draft`,
  ];
  return rows.join("\r\n") + "\r\n";
}

export type RowError = { line: number; column: string | null; message: string };

export type CsvVariant = {
  line: number;
  sku: string;
  size: string | null;
  colour: string | null;
  pricePkr: number;
  compareAtPricePkr: number | null;
  stockQty: number | null;
  weightG: number | null;
};

export type CsvProduct = {
  handle: string;
  lines: number[];
  title: string;
  description: string | null;
  audience: BrandAudienceValue;
  category: string | null;
  collection: string | null;
  fabric: string | null;
  tags: string[];
  imageUrls: string[];
  /** Null = keep the current status (new products start as drafts). */
  status: CsvStatus | null;
  weightG: number | null;
  variants: CsvVariant[];
};

export type SkippedProduct = { handle: string; title: string; lines: number[] };

export type ValidatedCsv = {
  /** Header problems, unclosed quotes, too many rows: nothing can be imported. */
  fatal: string | null;
  rowCount: number;
  products: CsvProduct[];
  skipped: SkippedProduct[];
  errors: RowError[];
  warnings: RowError[];
};

const IMAGE_RE = /^(https:\/\/[^\s|]+|\/media\/[\w./-]+)$/i;

function isImageUrl(u: string) {
  return IMAGE_RE.test(u);
}

export function validateBrandCsv(text: string, opts: { defaultAudience?: BrandAudienceValue } = {}): ValidatedCsv {
  const out: ValidatedCsv = { fatal: null, rowCount: 0, products: [], skipped: [], errors: [], warnings: [] };
  let rows: { line: number; cells: string[] }[];
  try {
    rows = parseCsvRows(text);
  } catch (e) {
    out.fatal = e instanceof AdapterError ? e.message : "The file could not be read as CSV.";
    return out;
  }
  if (rows.length < 2) {
    out.fatal = "The CSV needs the header row and at least one product row. Download the template to start.";
    return out;
  }
  const header = rows[0].cells.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/^color$/, "colour"));
  const missing = BRAND_CSV_REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) {
    out.fatal = `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Use the template's header row.`;
    return out;
  }
  const unknown = header.filter((h) => h && !(BRAND_CSV_COLUMNS as readonly string[]).includes(h));
  if (unknown.length) out.warnings.push({ line: rows[0].line, column: null, message: `Ignored unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}` });
  const dupHeader = header.find((h, i) => h && header.indexOf(h) !== i);
  if (dupHeader) {
    out.fatal = `The column “${dupHeader}” appears twice in the header.`;
    return out;
  }
  const data = rows.slice(1);
  out.rowCount = data.length;
  if (data.length > BRAND_CSV_MAX_ROWS) {
    out.fatal = `The file has ${data.length} rows; upload at most ${BRAND_CSV_MAX_ROWS} at a time.`;
    return out;
  }

  const col = (cells: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (cells[i] ?? "").trim() : "";
  };

  type Group = { handle: string; rows: { line: number; cells: string[] }[]; errors: RowError[]; values: Partial<Record<(typeof PRODUCT_COLUMNS)[number], { value: string; line: number }>> };
  const groups = new Map<string, Group>();
  const skuLines = new Map<string, number>();
  const rowErrors: RowError[] = [];

  for (const r of data) {
    const handleRaw = col(r.cells, "handle");
    const handle = slugify(handleRaw || col(r.cells, "title"));
    if (!handle) {
      rowErrors.push({ line: r.line, column: handleRaw ? "handle" : "title", message: "Each row needs a title (or a handle linking it to the product above)." });
      continue;
    }
    const g = groups.get(handle) ?? { handle, rows: [], errors: [], values: {} };
    groups.set(handle, g);
    g.rows.push(r);
    for (const c of PRODUCT_COLUMNS) {
      const v = col(r.cells, c);
      if (!v) continue;
      const seen = g.values[c];
      if (!seen) g.values[c] = { value: v, line: r.line };
      else if (seen.value !== v) g.errors.push({ line: r.line, column: c, message: `Differs from row ${seen.line} for the same product (“${handle}”). Leave it blank or repeat the same value.` });
    }
  }

  for (const g of groups.values()) {
    const err = (line: number, column: string | null, message: string) => g.errors.push({ line, column, message });
    const v = (c: (typeof PRODUCT_COLUMNS)[number]) => g.values[c]?.value ?? "";
    const firstLine = g.rows[0].line;
    const title = v("title");
    if (!title) err(firstLine, "title", "The product has no title.");
    else if (title.length > 200) err(g.values.title!.line, "title", "Title is longer than 200 characters.");
    if (v("description").length > 5000) err(g.values.description!.line, "description", "Description is longer than 5,000 characters.");
    const audienceText = v("audience").toLowerCase();
    if (audienceText && !(AUDIENCES as string[]).includes(audienceText)) err(g.values.audience!.line, "audience", `Use one of: ${AUDIENCES.join(", ")}.`);
    const statusText = v("status").toLowerCase();
    if (statusText && !(STATUSES as readonly string[]).includes(statusText)) err(g.values.status!.line, "status", `Use draft, published or hidden (or leave blank).`);
    for (const c of ["category", "collection", "fabric"] as const) if (v(c).length > 120) err(g.values[c]!.line, c, `${c} is longer than 120 characters.`);
    const images = v("image_urls")
      .split("|")
      .map((u) => u.trim())
      .filter(Boolean);
    const badImage = images.find((u) => !isImageUrl(u));
    if (badImage) err(g.values.image_urls!.line, "image_urls", `“${badImage.slice(0, 80)}” is not an https:// image link (separate several with |).`);
    if (images.length > MAX_IMAGES) err(g.values.image_urls!.line, "image_urls", `At most ${MAX_IMAGES} images per product.`);

    const variants: CsvVariant[] = [];
    const combos = new Map<string, number>();
    for (const r of g.rows) {
      const sku = col(r.cells, "sku");
      if (!sku) err(r.line, "sku", "SKU is required — it identifies the variant on re-upload.");
      else if (!/^[\w.\-/ ]{1,64}$/.test(sku)) err(r.line, "sku", "SKU may use letters, numbers, spaces and - _ . / (up to 64 characters).");
      else {
        const key = sku.toUpperCase();
        const prev = skuLines.get(key);
        if (prev != null) err(r.line, "sku", `SKU “${sku}” is already used on row ${prev}.`);
        else skuLines.set(key, r.line);
      }
      const priceText = col(r.cells, "price_pkr");
      const price = parsePkr(priceText);
      if (price == null) err(r.line, "price_pkr", priceText ? `“${priceText}” is not a positive amount in rupees.` : "Price (PKR) is required.");
      const compareText = col(r.cells, "compare_at_price_pkr");
      const compare = compareText ? parsePkr(compareText) : null;
      if (compareText && compare == null) err(r.line, "compare_at_price_pkr", `“${compareText}” is not a positive amount in rupees.`);
      if (compare != null && price != null && compare <= price) out.warnings.push({ line: r.line, column: "compare_at_price_pkr", message: "Ignored: the original price must be higher than the price." });
      const stockText = col(r.cells, "stock");
      const stock = stockText === "" ? null : Number(stockText.replace(/,/g, ""));
      if (stock != null && (!Number.isInteger(stock) || stock < 0 || stock > 100_000)) err(r.line, "stock", "Stock must be a whole number (0 or more), or blank if you don't track it.");
      const weightText = col(r.cells, "weight_g");
      const weight = weightText === "" ? null : Number(weightText.replace(/,/g, ""));
      if (weight != null && (!Number.isInteger(weight) || weight <= 0 || weight > 70_000)) err(r.line, "weight_g", "Weight must be whole grams between 1 and 70000.");
      const size = col(r.cells, "size") || null;
      const colour = col(r.cells, "colour") || null;
      if ((size?.length ?? 0) > 40) err(r.line, "size", "Size is longer than 40 characters.");
      if ((colour?.length ?? 0) > 60) err(r.line, "colour", "Colour is longer than 60 characters.");
      const combo = `${(size ?? "").toLowerCase()}|${(colour ?? "").toLowerCase()}`;
      if (combos.has(combo)) err(r.line, "size", `Same size and colour as row ${combos.get(combo)} for this product.`);
      else combos.set(combo, r.line);
      if (sku && price != null)
        variants.push({
          line: r.line,
          sku,
          size,
          colour,
          pricePkr: price,
          compareAtPricePkr: compare != null && compare > price ? compare : null,
          stockQty: stock != null && Number.isInteger(stock) && stock >= 0 ? stock : null,
          weightG: weight != null && Number.isInteger(weight) && weight > 0 ? weight : null,
        });
    }

    if (g.errors.length) {
      out.errors.push(...g.errors);
      out.skipped.push({ handle: g.handle, title: title || g.handle, lines: g.rows.map((r) => r.line) });
      continue;
    }
    const tags = splitTags(v("tags")).slice(0, 30);
    const weights = variants.map((x) => x.weightG).filter((w): w is number => w != null);
    out.products.push({
      handle: g.handle,
      lines: g.rows.map((r) => r.line),
      title,
      description: v("description") || null,
      audience: audienceText ? (audienceText as BrandAudienceValue) : detectAudience([...tags, v("category"), title], opts.defaultAudience ?? "women"),
      category: v("category") || null,
      collection: v("collection") || null,
      fabric: v("fabric") || null,
      tags,
      imageUrls: images,
      status: statusText ? (statusText as CsvStatus) : null,
      weightG: weights.length ? Math.max(...weights) : null,
      variants,
    });
  }
  out.errors.unshift(...rowErrors);
  out.errors.sort((a, b) => a.line - b.line);
  out.warnings.sort((a, b) => a.line - b.line);
  return out;
}

// ── Import plan ─────────────────────────────────────────────────────────────

export type ExistingProduct = {
  id: string;
  externalId: string | null;
  title: string;
  description: string | null;
  audience: string;
  category: string | null;
  collection: string | null;
  fabric: string | null;
  tags: string[];
  weightG: number | null;
  status: string;
  imageUrls: string[];
};

export type ExistingVariant = {
  id: string;
  productId: string;
  sku: string | null;
  size: string | null;
  colour: string | null;
  pricePkr: number | null;
  compareAtPricePkr: number | null;
  stockQty: number | null;
  available: boolean;
};

export type Action = "create" | "update" | "unchanged";

export type PlannedVariant = { csv: CsvVariant; action: Action; variantId: string | null; changes: string[] };
export type PlannedProduct = {
  csv: CsvProduct;
  action: Action;
  productId: string | null;
  changes: string[];
  variants: PlannedVariant[];
  /** The product fields the import writes (status already adjusted). */
  patch: ReturnType<typeof productPatch>;
  notes: string[];
};

export type ImportPlan = {
  products: PlannedProduct[];
  counts: {
    productsCreate: number;
    productsUpdate: number;
    productsUnchanged: number;
    variantsCreate: number;
    variantsUpdate: number;
    variantsUnchanged: number;
    skipped: number;
  };
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Values a CSV product would write onto an existing product (only fields the CSV controls). */
export function productPatch(p: CsvProduct, existing: ExistingProduct | null) {
  return {
    title: p.title,
    description: p.description ?? existing?.description ?? null,
    audience: p.audience,
    category: p.category ?? existing?.category ?? null,
    collection: p.collection ?? existing?.collection ?? null,
    fabric: p.fabric ?? existing?.fabric ?? null,
    tags: p.tags.length ? p.tags : (existing?.tags ?? []),
    weightG: p.weightG ?? existing?.weightG ?? null,
    status: p.status ?? existing?.status ?? "draft",
    imageUrls: p.imageUrls.length ? p.imageUrls : (existing?.imageUrls ?? []),
  };
}

export function variantPatch(v: CsvVariant) {
  return { sku: v.sku, size: v.size, colour: v.colour, pricePkr: v.pricePkr, compareAtPricePkr: v.compareAtPricePkr, stockQty: v.stockQty, available: v.stockQty !== 0 };
}

/**
 * Match each CSV product and variant to what the brand already has. Products
 * match on handle, then on any of their SKUs; variants match on SKU
 * (case-insensitive) anywhere in the brand.
 */
export function planBrandImport(v: ValidatedCsv, existing: { products: ExistingProduct[]; variants: ExistingVariant[] }): ImportPlan {
  const bySku = new Map(existing.variants.filter((x) => x.sku).map((x) => [x.sku!.toUpperCase(), x]));
  const byHandle = new Map(existing.products.filter((p) => p.externalId).map((p) => [p.externalId!, p]));
  const byId = new Map(existing.products.map((p) => [p.id, p]));
  const plan: ImportPlan = { products: [], counts: { productsCreate: 0, productsUpdate: 0, productsUnchanged: 0, variantsCreate: 0, variantsUpdate: 0, variantsUnchanged: 0, skipped: v.skipped.length } };
  const claimed = new Set<string>();

  for (const p of v.products) {
    let match = byHandle.get(p.handle) ?? null;
    if (!match)
      for (const cv of p.variants) {
        const ev = bySku.get(cv.sku.toUpperCase());
        const owner = ev ? byId.get(ev.productId) : undefined;
        if (owner && !claimed.has(owner.id)) {
          match = owner;
          break;
        }
      }
    if (match && claimed.has(match.id)) match = null;
    if (match) claimed.add(match.id);

    const variants: PlannedVariant[] = p.variants.map((cv) => {
      const ev = bySku.get(cv.sku.toUpperCase());
      if (!ev) return { csv: cv, action: "create", variantId: null, changes: [] };
      const next = variantPatch(cv);
      const changes: string[] = (Object.keys(next) as (keyof typeof next)[]).filter((k) => !same(next[k], ev[k]));
      if (match && ev.productId !== match.id) changes.push("product");
      return { csv: cv, action: changes.length ? "update" : "unchanged", variantId: ev.id, changes };
    });

    let action: Action = "create";
    let changes: string[] = [];
    const next = productPatch(p, match);
    const notes: string[] = [];
    // Buyers only see products with a photo: a photo-less "published" row stays a draft.
    if (next.status === "published" && !next.imageUrls.length) {
      next.status = match?.status === "published" ? "draft" : (match?.status ?? "draft");
      notes.push("No photo yet — kept as a draft. Add a photo, then publish.");
    }
    if (match) {
      const current = { title: match.title, description: match.description, audience: match.audience, category: match.category, collection: match.collection, fabric: match.fabric, tags: match.tags, weightG: match.weightG, status: match.status, imageUrls: match.imageUrls };
      changes = (Object.keys(next) as (keyof typeof next)[]).filter((k) => !same(next[k], current[k]));
      if (match.externalId !== p.handle) changes.push("handle");
      action = changes.length || variants.some((x) => x.action !== "unchanged") ? "update" : "unchanged";
    }
    plan.products.push({ csv: p, action, productId: match?.id ?? null, changes, variants, patch: next, notes });
    plan.counts[action === "create" ? "productsCreate" : action === "update" ? "productsUpdate" : "productsUnchanged"]++;
    for (const x of variants) plan.counts[x.action === "create" ? "variantsCreate" : x.action === "update" ? "variantsUpdate" : "variantsUnchanged"]++;
  }
  return plan;
}
