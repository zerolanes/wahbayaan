import { artisansWithStats } from "@/lib/admin/artisans";
import { csvAmount, csvResponse, toCsv } from "@/lib/admin/csv";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("vendors.view");
  if ("error" in auth) return auth.error;
  const { filtered } = await artisansWithStats(paramsOf(req));
  return csvResponse(
    `wahbayaan-artisans-${stamp()}.csv`,
    toCsv(filtered, [
      { header: "Name", value: (v) => v.displayName },
      { header: "Slug", value: (v) => v.slug },
      { header: "Craft", value: (v) => v.craft },
      { header: "City", value: (v) => v.workshopCity },
      { header: "Region", value: (v) => v.workshopRegion },
      { header: "Status", value: (v) => v.status },
      { header: "Verified at", value: (v) => v.verifiedAt },
      { header: "Location verified", value: (v) => (v.locationVerified ? "yes" : "no") },
      { header: "Featured", value: (v) => (v.isFeatured ? "yes" : "no") },
      { header: "Commission override %", value: (v) => (v.commissionBps == null ? "" : v.commissionBps / 100) },
      { header: "Listings (active/total)", value: (v) => `${v.activeListings}/${v.listings}` },
      { header: "Sales PKR", value: (v) => csvAmount(v.salesPkr) },
      { header: "Rating", value: (v) => v.rating },
      { header: "Reviews", value: (v) => v.reviews },
      { header: "Public", value: (v) => (v.issues.length ? "no" : "yes") },
      { header: "Issues", value: (v) => v.issues.map((i) => i.message) },
      { header: "Demo", value: (v) => (v.isDemo ? "yes" : "no") },
      { header: "Joined", value: (v) => v.createdAt },
    ]),
  );
}
