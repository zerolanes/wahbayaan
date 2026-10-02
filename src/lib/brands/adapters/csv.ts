/**
 * CSV / feed upload adapter — for brands that send us a product feed (or for
 * staff preparing one from a brand's price list). One row per variant; rows
 * sharing a `handle` form one product.
 *
 * Columns (header row required, order free, unknown columns ignored):
 *   handle, title, description, audience, category, collection, fabric, tags,
 *   image_urls (separated by |), size, colour, sku, price_pkr,
 *   compare_at_price_pkr, stock, available, weight_g, source_url, published_at
 */
import { AdapterError, type BrandAudienceValue, type NormalizedProduct, type ParseResult } from "../types";
import { detectAudience, parsePkr, resolveUrl, slugify, splitTags } from "./normalize";

export const CSV_COLUMNS = [
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
  "available",
  "weight_g",
  "source_url",
  "published_at",
] as const;

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new AdapterError("The CSV has an unclosed quote.");
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

const AUDIENCES: BrandAudienceValue[] = ["women", "men", "kids", "unisex"];

export function parseBrandCsv(text: string, opts: { defaultAudience: BrandAudienceValue; assetOrigin?: string }): ParseResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new AdapterError("The CSV needs a header row and at least one product row.");
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  for (const required of ["title", "price_pkr"]) if (!header.includes(required)) throw new AdapterError(`Missing required column “${required}”.`);
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };

  const groups = new Map<string, { line: number; row: string[] }[]>();
  rows.slice(1).forEach((r, i) => {
    const handle = slugify(col(r, "handle") || col(r, "title"));
    if (!handle) return;
    groups.set(handle, [...(groups.get(handle) ?? []), { line: i + 2, row: r }]);
  });

  const result: ParseResult = { products: [], failures: [] };
  for (const [handle, list] of groups) {
    const first = list[0].row;
    const title = col(first, "title");
    try {
      if (!title) throw new AdapterError(`line ${list[0].line}: missing title`);
      const variants = list.map(({ line, row }, idx) => {
        const price = parsePkr(col(row, "price_pkr"));
        if (price == null) throw new AdapterError(`line ${line}: price_pkr must be a positive amount`);
        const compare = parsePkr(col(row, "compare_at_price_pkr"));
        const stockText = col(row, "stock");
        const stock = stockText === "" ? null : Number(stockText);
        if (stock != null && (!Number.isInteger(stock) || stock < 0)) throw new AdapterError(`line ${line}: stock must be a whole number`);
        const availableText = col(row, "available").toLowerCase();
        const weight = Number(col(row, "weight_g"));
        return {
          externalId: col(row, "sku") || `${handle}:${idx}`,
          sku: col(row, "sku") || null,
          size: col(row, "size") || null,
          colour: col(row, "colour") || col(row, "color") || null,
          pricePkr: price,
          compareAtPricePkr: compare != null && compare > price ? compare : null,
          available: availableText ? !["no", "false", "0", "n"].includes(availableText) && stock !== 0 : stock !== 0,
          stockQty: stock,
          weightG: Number.isFinite(weight) && weight > 0 ? Math.round(weight) : null,
        };
      });
      const cheapest = variants.reduce((a, b) => (b.pricePkr < a.pricePkr ? b : a));
      const tags = splitTags(col(first, "tags"));
      const audienceText = col(first, "audience").toLowerCase();
      const published = col(first, "published_at");
      const weights = variants.map((v) => v.weightG).filter((w): w is number => w != null);
      const product: NormalizedProduct = {
        externalId: handle,
        handle,
        title,
        description: col(first, "description") || null,
        audience: (AUDIENCES as string[]).includes(audienceText)
          ? (audienceText as BrandAudienceValue)
          : detectAudience([...tags, col(first, "category"), title], opts.defaultAudience),
        category: col(first, "category") || null,
        collection: col(first, "collection") || null,
        fabric: col(first, "fabric") || null,
        tags,
        sourceUrl: resolveUrl(col(first, "source_url"), "") ?? null,
        images: col(first, "image_urls")
          .split("|")
          .map((u) => resolveUrl(u, opts.assetOrigin ?? ""))
          .filter((u): u is string => !!u)
          .map((url) => ({ url, alt: title })),
        variants,
        pricePkr: cheapest.pricePkr,
        compareAtPricePkr: cheapest.compareAtPricePkr,
        onSale: variants.some((v) => v.compareAtPricePkr != null),
        weightG: weights.length ? Math.max(...weights) : null,
        publishedAt: published && !Number.isNaN(Date.parse(published)) ? new Date(published) : null,
      };
      result.products.push(product);
    } catch (e) {
      result.failures.push({ ref: title || handle, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
