// Click-through of the Pakistani Brands flows against a running dev server with
// a fresh demo database (npm run db:reset -- --demo). Writes screenshots/brands-*.png.
//
//   BASE=http://localhost:3107 node scripts/brands-walkthrough.mjs
//
// The courier and rate created in step 2 are FICTIONAL demo values typed into the
// local demo database so the domestic totals can complete; nothing is seeded.
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let n = 0;

async function session(email, width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", "wahbayaan-demo");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click('button[type="submit"]')]);
  return page;
}

async function shot(page, name, full = true) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  const file = `screenshots/brands-${String(++n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: full });
  console.log("saved", file, page.url());
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
}

// ── 1. Admin: record permission → authorise → switch on → sync from fixture → publish ──
const admin = await session("admin@wahbayaan.test");
await admin.goto(base + "/admin/brands", { waitUntil: "networkidle" });
await shot(admin, "admin-brands-before");
await admin.click("text=Sahil Menswear");
await admin.waitForURL(/\/admin\/brands\/[0-9a-f-]{36}/);
const sahilUrl = admin.url();
const sahilId = sahilUrl.split("/").pop();
await shot(admin, "admin-sahil-no-permission");
// Sync can't be switched on yet.
await admin.click('button[role="switch"]');
await settle(admin);
await shot(admin, "admin-sync-refused", false);
await admin.fill("#note", "DEMO: permission email from the (fictional) brand's e-commerce lead allowing us to list and sync their catalogue.");
await admin.click('button:has-text("Record permission")');
await settle(admin);
await admin.selectOption('select[name="partnership"]', "authorised");
await admin.click('button:has-text("Save partnership")');
await settle(admin);
await admin.check('input[name="isActive"]');
await admin.click('button:has-text("Save details")');
await settle(admin);
await admin.click('button[role="switch"]');
await settle(admin);
await admin.click('button:has-text("Sync now")');
await admin.waitForTimeout(6000);
await settle(admin);
await shot(admin, "admin-sahil-synced");
await admin.goto(`${base}/admin/brand-products?brand=${sahilId}&status=draft`, { waitUntil: "networkidle" });
await admin.check('th input[type="checkbox"]');
await admin.selectOption('select[name="op"]', "published");
await admin.click('#brand-products-bulk button[type="submit"]');
await settle(admin);
await admin.goto(`${base}/admin/brand-products?brand=${sahilId}`, { waitUntil: "networkidle" });
await shot(admin, "admin-sahil-published");

// ── 2. Admin: domestic zones + a FICTIONAL demo courier and rate ──
await admin.goto(base + "/admin/rates/domestic", { waitUntil: "networkidle" });
await admin.fill('textarea[name="zoneCities[]"] >> nth=0', "Lahore");
await admin.fill('textarea[name="zoneCities[]"] >> nth=1', "Karachi, Islamabad, Rawalpindi");
await admin.fill("#handlingDays", "3");
await admin.click('button:has-text("Save")');
await settle(admin);
await admin.goto(base + "/admin/couriers", { waitUntil: "networkidle" });
await admin.fill("#c-name", "Demo Courier (fictional)");
await admin.fill("#c-track", "https://track.example.invalid/?n={tracking}");
await admin.check('input[name="domestic"]');
await admin.check('input[name="isActive"]');
await admin.fill("#c-services", "Standard, 1, 3");
await admin.click('button:has-text("Add courier")');
await admin.waitForURL(/\/admin\/couriers\/[0-9a-f-]{36}/);
await settle(admin);
for (const zone of ["same_city", "major_cities", "other"]) {
  await admin.selectOption("#r-zone", zone);
  await admin.fill("#r-amt", zone === "same_city" ? "250" : zone === "major_cities" ? "350" : "450");
  await admin.fill("#r-max", "3000");
  await admin.fill("#r-tmin", "1");
  await admin.fill("#r-tmax", zone === "other" ? "5" : "3");
  await admin.click('button:has-text("Add rate")');
  await settle(admin);
}
await shot(admin, "admin-courier-rate-card");
await admin.goto(base + "/admin/rates/service-fee?amount=3500", { waitUntil: "networkidle" });
await shot(admin, "admin-service-fee");
await admin.goto(base + "/admin/payment-methods", { waitUntil: "networkidle" });
await shot(admin, "admin-payment-methods");

// ── 3. Buyer in Pakistan: browse → pick size → domestic checkout (PKR) → test payment ──
const pk = await session("buyer.pk@wahbayaan.test");
await pk.goto(base + "/brands", { waitUntil: "networkidle" });
await shot(pk, "pk-brands-directory");
await pk.goto(base + "/brands/sahil-menswear", { waitUntil: "networkidle" });
await shot(pk, "pk-brand-page");
await pk.goto(base + "/brands/sahil-menswear/sahil-menswear-ivory-cotton-kurta-shalwar", { waitUntil: "networkidle" });
await pk.click('button[aria-pressed]:has-text("Sand")');
await pk.click('button[aria-pressed]:has-text("L")');
await shot(pk, "pk-product-size-picked", false);
await pk.click('button:has-text("Add to bag")');
await pk.waitForSelector("text=added to your bag");
await pk.goto(base + "/brands/bag", { waitUntil: "networkidle" });
await shot(pk, "pk-bag");
await pk.click('a:has-text("Checkout")');
await pk.waitForURL(/\/brands\/checkout/);
await pk.fill("#fullName", "Demo Buyer");
await pk.fill("#line1", "House 10, Street 5, Gulberg");
await pk.fill("#city", "Lahore");
await pk.fill("#region", "Punjab");
await pk.fill("#phone", "+92 300 0000001");
await shot(pk, "pk-checkout");
await pk.click('button[type="submit"]:has-text("Place order"), button[type="submit"]:has-text("Continue to pay")');
await pk.waitForURL(/test-payment|order-placed/, { timeout: 60000 });
await shot(pk, "pk-after-checkout");
if (pk.url().includes("test-payment")) {
  await pk.click('form button:has-text("success"), form button:has-text("Success"), form button:has-text("Simulate")');
  await pk.waitForURL(/order-placed/, { timeout: 60000 });
  await shot(pk, "pk-paid");
}
const pkOrder = new URL(pk.url()).searchParams.get("order");

// ── 4. Admin fulfilment checklist on the domestic order ──
await admin.goto(`${base}/admin/orders/${pkOrder}`, { waitUntil: "networkidle" });
await admin.fill('input[name="brandOrderRef"]', "SM-DEMO-1001");
await admin.fill('input[name="purchaseCost"]', "3490");
await admin.click('button:has-text("Mark: Ordered from brand")');
await settle(admin);
await admin.click('button:has-text("Mark: Received at Wahbayaan")');
await settle(admin);
await admin.fill('input[name="notes"]', "Stitching and size label checked");
await admin.click('button:has-text("Mark: Quality checked")');
await settle(admin);
await admin.selectOption('select[name="courier"] >> nth=0', "Demo Courier (fictional)");
await admin.fill('input[name="trackingNumber"] >> nth=0', "DC123456");
await admin.click('button:has-text("Mark: Dispatched")');
await settle(admin);
await shot(admin, "admin-domestic-fulfilment");
await pk.goto(`${base}/account/orders/${pkOrder}`, { waitUntil: "networkidle" });
await shot(pk, "pk-account-order-tracking");

// ── 5. Overseas buyer (US): gift to Pakistan, paid in USD ──
const us = await session("buyer@wahbayaan.test");
await us.goto(base + "/brands/noor-lawn-house/noor-lawn-house-printed-lawn-3-piece-jasmine-garden", { waitUntil: "networkidle" });
await shot(us, "us-product", false);
await us.click('button:has-text("Add to bag")');
await us.waitForSelector("text=added to your bag");
await us.goto(base + "/brands/bag", { waitUntil: "networkidle" });
await shot(us, "us-bag-ship-home");
await us.click('button[role="radio"]:has-text("Send to someone in Pakistan")');
await settle(us);
await shot(us, "us-bag-gift-to-pakistan");
await us.click('a:has-text("Checkout")');
await us.waitForURL(/\/brands\/checkout/);
await us.fill("#fullName", "Ammi (demo recipient)");
await us.fill("#line1", "House 22, Block C");
await us.fill("#city", "Karachi");
await us.fill("#region", "Sindh");
await us.fill("#phone", "+92 321 0000000");
await us.fill("#giftMessage", "Eid Mubarak, Ammi!");
await shot(us, "us-gift-checkout");
await us.click('button[type="submit"]:has-text("Place order"), button[type="submit"]:has-text("Continue to pay")');
await us.waitForURL(/test-payment|order-placed/, { timeout: 60000 });
await shot(us, "us-gift-payment");
if (us.url().includes("test-payment")) {
  await us.click('form button:has-text("success"), form button:has-text("Success"), form button:has-text("Simulate")');
  await us.waitForURL(/order-placed/, { timeout: 60000 });
  await shot(us, "us-gift-paid");
}

// ── 6. Shop any brand by link: buyer request → staff price → quote → buyer pays ──
await us.goto(base + "/brands/request", { waitUntil: "networkidle" });
await us.fill('input[name="items.0.url"]', "https://www.some-brand.com.pk/products/embroidered-lawn-suit?variant=12#reviews");
await us.fill('input[name="items.0.productName"]', "Embroidered lawn suit — Aqua");
await us.fill('input[name="items.0.size"]', "M");
await us.fill('input[name="items.0.colour"]', "Aqua");
await us.click('button:has-text("Add another item")');
await us.fill('input[name="items.1.url"]', "another-label.pk/p/mens-kurta-white");
await us.fill('input[name="items.1.productName"]', "Men's cotton kurta");
await us.fill('input[name="items.1.brandName"]', "Another Label");
await us.fill('input[name="items.1.size"]', "L");
await us.check('input[name="shipTo"][value="PK"]');
await us.fill("#fullName", "Abbu (demo recipient)");
await us.fill("#line1", "House 5, Street 9");
await us.fill("#city", "Islamabad");
await us.fill("#phone", "+92 333 0000000");
await shot(us, "request-form");
await us.click('button:has-text("Send request")');
await us.waitForURL(/order-placed/, { timeout: 60000 });
await shot(us, "request-received");
const reqOrder = new URL(us.url()).searchParams.get("order");

await admin.goto(base + "/admin/brand-requests", { waitUntil: "networkidle" });
await shot(admin, "admin-request-queue");
await admin.goto(`${base}/admin/orders/${reqOrder}`, { waitUntil: "networkidle" });
const priceInputs = admin.locator('input[name^="price_"]');
await priceInputs.nth(0).fill("4990");
await priceInputs.nth(1).fill("2490");
const weightInputs = admin.locator('input[name^="weight_"]');
await weightInputs.nth(0).fill("900");
await weightInputs.nth(1).fill("600");
await admin.click('button:has-text("Save prices")');
await settle(admin);
await shot(admin, "admin-request-priced");
const fee = admin.locator('input[name="serviceFee"]');
if (await fee.count()) await fee.fill("2");
await admin.fill('textarea[name="note"]', "Both items are in stock at the brands.");
await admin.click('button:has-text("Send quote")');
await settle(admin);
await shot(admin, "admin-request-quote-sent");
await us.goto(`${base}/account/orders/${reqOrder}`, { waitUntil: "networkidle" });
await shot(us, "request-quote-for-buyer");
await us.click('button:has-text("Approve")');
await us.waitForURL(/test-payment/, { timeout: 60000 });
await us.click('form button:has-text("success"), form button:has-text("Success"), form button:has-text("Simulate")');
await us.waitForURL(/order-placed/, { timeout: 60000 });
await shot(us, "request-paid");

await admin.goto(base + "/admin/orders", { waitUntil: "networkidle" });
await shot(admin, "admin-orders-list");
await browser.close();
