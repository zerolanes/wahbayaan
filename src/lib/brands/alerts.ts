import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandAlerts, brandProducts, brandProductVariants, brands } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { catalogueDisplayGate } from "./permission";

/**
 * "Notify me" delivery: after a sync (or a staff change), queue one email per
 * waiting subscription whose condition is now met — a restock for a product,
 * or any published sale item for a brand. Emails go through sendEmail, which
 * writes to the outbox when no email provider is configured. Only live
 * (authorised) brands notify.
 */
export async function queueBrandAlerts(brandId: string, appUrl = process.env.APP_URL ?? "") {
  const d = await db();
  const brand = await d.query.brands.findFirst({ where: eq(brands.id, brandId) });
  if (!brand || !brand.isActive || !catalogueDisplayGate(brand).ok) return 0;
  const waiting = await d.select().from(brandAlerts).where(and(eq(brandAlerts.brandId, brandId), isNull(brandAlerts.notifiedAt)));
  if (!waiting.length) return 0;
  const products = await d.select().from(brandProducts).where(and(eq(brandProducts.brandId, brandId), eq(brandProducts.status, "published")));
  const variants = products.length ? await d.select().from(brandProductVariants).where(inArray(brandProductVariants.productId, products.map((p) => p.id))) : [];
  const inStock = (productId: string) => variants.some((v) => v.productId === productId && v.available && v.stockQty !== 0);
  const onSale = products.filter((p) => p.compareAtPricePkr != null || variants.some((v) => v.productId === p.id && v.compareAtPricePkr != null));

  let sent = 0;
  for (const a of waiting) {
    const product = a.productId ? products.find((p) => p.id === a.productId) : null;
    let subject: string | null = null;
    let body = "";
    if (a.kind === "restock" && product && inStock(product.id)) {
      subject = `Back in stock: ${product.title}`;
      body = `${product.title} from ${brand.name} is available again on Wahbayaan.\n\n${appUrl}/brands/${brand.slug}/${product.slug}`;
    } else if (a.kind === "sale" && onSale.length) {
      subject = `${brand.name} sale on Wahbayaan`;
      body = `${onSale.length} ${brand.name} piece${onSale.length === 1 ? " is" : "s are"} on sale.\n\n${appUrl}/brands/${brand.slug}?sale=1`;
    }
    if (!subject) continue;
    await sendEmail({ to: a.email, subject, template: `brand_alert_${a.kind}`, body: `${body}\n\nYou asked us to tell you. This is a one-off message.` });
    await d.update(brandAlerts).set({ notifiedAt: new Date() }).where(eq(brandAlerts.id, a.id));
    sent++;
  }
  return sent;
}
