"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { loyaltyLedger, referralRedemptions, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zInt, zOptInt, zStr, zUuid } from "@/lib/admin/zod";

async function balanceOf(userId: string) {
  const d = await db();
  const [row] = await d.select({ n: sql<number>`coalesce(sum(${loyaltyLedger.points}), 0)::int` }).from(loyaltyLedger).where(eq(loyaltyLedger.userId, userId));
  return Number(row?.n ?? 0);
}

/** Manual loyalty adjustment (goodwill credit, correction). Always audited with the reason. */
export const adjustLoyaltyAction = adminAction(
  "marketing.manage",
  z.object({ who: zStr(200), points: zInt(-1_000_000, 1_000_000).refine((n) => n !== 0, "Enter a non-zero number of points"), reason: zStr(300) }),
  async ({ data, audit }) => {
    const d = await db();
    const who = data.who.trim();
    const u = /^[0-9a-f-]{36}$/i.test(who)
      ? await d.query.users.findFirst({ where: eq(users.id, who) })
      : await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, who.toLowerCase()) });
    if (!u) throw new AdminError(`No account found for “${who}”.`);
    const before = await balanceOf(u.id);
    if (before + data.points < 0) throw new AdminError(`That would take ${u.name}'s balance below zero (current balance ${before} points).`);
    await d.insert(loyaltyLedger).values({ userId: u.id, points: data.points, reason: `Adjustment: ${data.reason}` });
    await audit({
      action: "loyalty.adjust",
      entity: "customer",
      entityId: u.id,
      summary: `${data.points > 0 ? "Credited" : "Debited"} ${Math.abs(data.points)} loyalty points ${data.points > 0 ? "to" : "from"} ${u.email} (${before} → ${before + data.points}): ${data.reason}`,
      data: { points: data.points, before, after: before + data.points },
    });
    return { message: `Balance is now ${before + data.points} points` };
  },
);

export const setRedemptionStatusAction = adminAction(
  "marketing.manage",
  z.object({ id: zUuid, status: z.enum(["awarded", "void"]), points: zOptInt(1, 1_000_000) }),
  async ({ data, audit }) => {
    const d = await db();
    const r = await d.query.referralRedemptions.findFirst({ where: eq(referralRedemptions.id, data.id) });
    if (!r) throw new AdminError("Redemption not found");
    if (r.status !== "pending") throw new AdminError(`This redemption is already ${r.status}.`);
    let points = 0;
    if (data.status === "awarded") {
      if (!r.referrerUserId) throw new AdminError("The referrer's account no longer exists.");
      const program = await getSetting("referral");
      points = data.points ?? (program.status === "active" ? program.referrerPoints : 0);
      if (!points) throw new AdminError("The referral reward is still pending in Settings — enter the points to award.");
      await d.insert(loyaltyLedger).values({ userId: r.referrerUserId, points, reason: `Referral reward: ${r.code}`, orderId: r.orderId });
    }
    await d.update(referralRedemptions).set({ status: data.status }).where(eq(referralRedemptions.id, r.id));
    await audit({
      action: `referral.${data.status}`,
      entity: "customer",
      entityId: r.referrerUserId,
      summary: data.status === "awarded" ? `Awarded ${points} points for referral ${r.code}` : `Voided referral redemption ${r.code}`,
      data: { redemptionId: r.id, points },
    });
    return { message: data.status === "awarded" ? `Awarded ${points} points` : "Redemption voided" };
  },
);
