import { listListings } from "@/lib/admin/listings";
import { csvAmount, csvResponse, toCsv } from "@/lib/admin/csv";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("products.view");
  if ("error" in auth) return auth.error;
  const { rows } = await listListings(paramsOf(req), 1, 20_000);
  return csvResponse(
    `wahbayaan-listings-${stamp()}.csv`,
    toCsv(rows, [
      { header: "ID", value: (r) => r.p.id },
      { header: "Title", value: (r) => r.p.title },
      { header: "Slug", value: (r) => r.p.slug },
      { header: "Artisan", value: (r) => r.vendorName },
      { header: "Category", value: (r) => r.category },
      { header: "Status", value: (r) => r.p.status },
      { header: "Price PKR", value: (r) => csvAmount(r.p.pricePkr) },
      { header: "Compare-at PKR", value: (r) => csvAmount(r.p.compareAtPricePkr) },
      { header: "Availability", value: (r) => r.p.availability },
      { header: "Stock", value: (r) => r.p.stockQty },
      { header: "Weight g", value: (r) => r.p.weightG },
      { header: "W×H×D cm", value: (r) => [r.p.widthCm, r.p.heightCm, r.p.depthCm].map((x) => x ?? "?").join("×") },
      { header: "HS code", value: (r) => r.p.hsCodeOverride ?? r.categoryHs },
      { header: "Images", value: (r) => r.imageCount },
      { header: "Illustrations", value: (r) => r.illusCount },
      { header: "Featured", value: (r) => (r.p.isFeatured ? "yes" : "no") },
      { header: "Wholesale", value: (r) => (r.p.wholesaleEnabled ? "yes" : "no") },
      { header: "Views", value: (r) => r.p.viewCount },
      { header: "Guard issues", value: (r) => r.issues.map((i) => i.message) },
      { header: "Demo", value: (r) => (r.p.isDemo ? "yes" : "no") },
    ]),
  );
}
