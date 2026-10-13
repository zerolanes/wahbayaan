/**
 * Demo-only growth data: FICTIONAL affiliate programmes (isDemo) so the
 * partner-link cards and the display gate can be seen. One programme has a
 * DEMO terms permission recorded and is active; the other is a draft with no
 * permission, so nothing from it is shown. No real network or store is named.
 */
import { eq } from "drizzle-orm";
import type { Db } from "../src/lib/db/connect";
import * as t from "../src/lib/db/schema";

export async function seedGrowthDemo(db: Db, ids: { ownerId: string }) {
  if (await db.query.affiliateProgrammes.findFirst({ where: eq(t.affiliateProgrammes.isDemo, true) })) return;
  const [live] = await db
    .insert(t.affiliateProgrammes)
    .values({
      name: "Lahore Loom Co. (fictional demo)",
      brandName: "Lahore Loom Co.",
      network: "Demo network",
      termsUrl: "https://partner.example/terms",
      status: "active",
      notes: "Fictional programme for the demo. Not a real store or network.",
      trackingTemplate: "https://partner.example/click?ref=wahbayaan&url={url}",
      displayAllowed: true,
      displayAllowedAt: new Date(),
      displayAllowedById: ids.ownerId,
      displayAllowedNote: "DEMO record for a fictional programme — not a real agreement.",
      lastImportAt: new Date(),
      isDemo: true,
    })
    .returning();
  const items = [
    ["Block-print lawn suit", "suit/7101"],
    ["Embroidered chiffon dupatta", "suit/7102"],
    ["Khaddar kurta", "kurta/7201"],
    ["Wedding waistcoat", "waistcoat/7301"],
  ];
  await db.insert(t.affiliateProducts).values(
    items.map(([title, art], i) => ({
      programmeId: live.id,
      externalId: `demo-${i + 1}`,
      title,
      productUrl: `https://lahore-loom.example/products/demo-${i + 1}`,
      imageUrl: `/brand-art/${art}.svg`,
      category: "Women",
      lastImportedAt: new Date(),
    })),
  );
  await db.insert(t.affiliateProgrammes).values({
    name: "Karachi Kurta House (fictional demo, draft)",
    brandName: "Karachi Kurta House",
    network: "Demo network",
    status: "draft",
    notes: "Fictional. Terms not checked yet — nothing is shown.",
    isDemo: true,
  });
}
