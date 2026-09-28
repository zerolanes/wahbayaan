import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { referralCodes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { featureFlags } from "@/lib/features";
import { REFERRAL_COOKIE } from "@/lib/order-access";

/** GET /r/CODE — remember who referred this visitor for 30 days, then go home. */
export async function GET(request: Request, ctx: RouteContext<"/r/[code]">) {
  const { code: raw } = await ctx.params;
  const code = raw.trim().toUpperCase();
  const response = NextResponse.redirect(new URL("/", request.url));
  if (!/^[A-Z0-9-]{3,40}$/.test(code) || !(await featureFlags()).referrals) return response;
  const d = await db();
  const row = await d.query.referralCodes.findFirst({ where: eq(referralCodes.code, code) });
  if (!row) return response;
  const user = await getCurrentUser();
  if (user?.id === row.userId) return response;
  await d.update(referralCodes).set({ uses: sql`${referralCodes.uses} + 1` }).where(eq(referralCodes.code, code));
  response.cookies.set(REFERRAL_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: true });
  return response;
}
