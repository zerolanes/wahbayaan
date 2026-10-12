import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getBrandMembership } from "@/lib/brand-portal/access";
import { brandCsvTemplate } from "@/lib/brand-portal/csv";

/** CSV template for the brand portal bulk upload (two fictional example products). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await getBrandMembership(user.id))) return new NextResponse("Sign in to your brand portal first.", { status: 401 });
  return new NextResponse(brandCsvTemplate(), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="wahbayaan-brand-products-template.csv"', "cache-control": "no-store" },
  });
}
