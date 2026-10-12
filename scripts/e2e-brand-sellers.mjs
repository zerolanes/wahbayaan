// End-to-end check of brand self-signup, the brand portal, the brand directory
// and the site social links, against a running dev server with a demo database
// (npx tsx scripts/reset.ts --demo). Writes screenshots/brand-sellers-*.png.
//
//   BASE=http://localhost:3112 node scripts/e2e-brand-sellers.mjs
//
// Every brand created here is a FICTIONAL test label with a unique name.
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = (process.env.BASE ?? "http://localhost:3112").replace(/\/$/, "");
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath });
fs.mkdirSync("screenshots", { recursive: true });

const stamp = Date.now().toString(36);
const brandName = `Rang Rasiya ${stamp}`;
const slug = brandName.toLowerCase().replace(/\s+/g, "-");
const email = `founder-${stamp}@rangrasiya.test`;
const password = `brand-${stamp}-pass`;
const productTitle = `Rang Lawn 3-Piece ${stamp}`;
let n = 0;
let failures = 0;

function check(cond, msg) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.error(`  FAIL ${msg}`);
  }
}

async function shot(page, name, full = true) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const file = `screenshots/brand-sellers-${String(++n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: full });
  console.log(`  shot ${file}`);
}

async function newPage(width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("  pageerror:", e.message));
  page.on("dialog", (d) => d.accept());
  return page;
}

async function login(page, user, pass) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", user);
  await page.fill("#password", pass);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }), page.click('button[type="submit"]')]);
}

const csv = [
  "handle,title,description,audience,category,collection,fabric,tags,image_urls,size,colour,sku,price_pkr,compare_at_price_pkr,stock,weight_g,status",
  `rang-lawn-${stamp},${productTitle},"Printed lawn shirt, dyed trousers and a chiffon dupatta.",women,Unstitched,,Lawn,lawn,,S,Teal,RL-${stamp}-S,6490,7990,5,900,`,
  `rang-lawn-${stamp},,,,,,,,,M,Teal,RL-${stamp}-M,6490,7990,4,900,`,
  `rang-lawn-${stamp},,,,,,,,,L,Teal,RL-${stamp}-L,6490,7990,0,900,`,
  `sahar-kurta-${stamp},Sahar Cotton Kurta ${stamp},Straight-cut cotton kurta.,men,Kurta,,Cotton,,,M,White,SK-${stamp}-M,4200,,3,500,`,
  `broken-${stamp},Broken Row ${stamp},,women,,,,,,S,,BR-${stamp},not-a-price,,,,`,
].join("\n");

// ── 1. A brand applies ──────────────────────────────────────────────────────
console.log("1. Brand applies at /brands/join");
const brand = await newPage();
await brand.goto(`${base}/brands/join`, { waitUntil: "networkidle" });
await shot(brand, "join");
await brand.fill("#brandName", brandName);
await brand.fill("#city", "Lahore");
await brand.fill("#instagram", "@rangrasiya");
await brand.check('input[name="audiences"][value="women"]');
await brand.fill("#productTypes", "Lawn, pret");
await brand.fill("#about", "Small-batch printed lawn from Lahore, designed and stitched in-house since 2019.");
await brand.fill("#contactName", "Ayesha Rang");
await brand.fill("#contactRole", "Founder");
await brand.fill("#email", email);
await brand.fill("#phone", "+92 300 0000000");
await brand.fill("#password", password);
await brand.check('input[name="terms"]');
await brand.click('button:has-text("Apply to sell")');
await brand.waitForSelector("text=/Application received|application in review/", { timeout: 60_000 });
check(true, "application received");
await shot(brand, "applied", false);

// ── 2. Admin approves ───────────────────────────────────────────────────────
console.log("2. Admin approves the brand application");
const admin = await newPage();
await login(admin, "admin@wahbayaan.test", "wahbayaan-demo");
await admin.goto(`${base}/admin/applications?type=brand`, { waitUntil: "networkidle" });
await shot(admin, "admin-brand-applications", false);
await admin.click(`a:has-text("${brandName}")`);
await admin.waitForURL(/\/admin\/applications\/brand\//);
check(await admin.isVisible("text=Valid as permission"), "terms acceptance shown as the permission record");
await shot(admin, "admin-brand-application");
await admin.click('button:has-text("Approve brand")');
await admin.waitForSelector("text=Open the brand", { timeout: 60_000 });
check(true, "approved — brand authorised from the terms acceptance");
await shot(admin, "admin-approved", false);

// ── 3. Brand logs in, uploads a CSV ─────────────────────────────────────────
console.log("3. Brand logs in and uploads a CSV");
const portal = await newPage();
await login(portal, email, password);
await portal.waitForURL(/\/brand-portal/, { timeout: 60_000 });
check(portal.url().includes("/brand-portal"), "brand lands in its portal");
await shot(portal, "portal-overview");
await portal.goto(`${base}/brand-portal/import`, { waitUntil: "networkidle" });
const tpl = await portal.request.get(`${base}/brand-portal/import/template`);
check(tpl.ok() && (await tpl.text()).startsWith("handle,title"), "CSV template downloads");
await portal.setInputFiles('input[name="file"]', { name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
await portal.click('button:has-text("Check file")');
await portal.waitForSelector("text=Preview:", { timeout: 60_000 });
const errorsText = await portal.textContent('[data-testid="row-errors"]');
check(/Row 6/.test(errorsText ?? "") && /price_pkr/.test(errorsText ?? ""), "row-level error shown for the broken row (row 6, price_pkr)");
await shot(portal, "portal-csv-preview");
await portal.click('button:has-text("Import 2 products")');
await portal.waitForSelector("text=Import finished", { timeout: 60_000 });
check(true, "CSV imported");
// Re-upload: idempotent by SKU — nothing to change.
await portal.setInputFiles('input[name="file"]', { name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
await portal.click('button:has-text("Check file")');
await portal.waitForSelector("text=Everything in this file is already up to date", { timeout: 60_000 });
check(true, "re-uploading the same file changes nothing");

// ── 4. Edit a product and publish ───────────────────────────────────────────
console.log("4. Brand edits a product and publishes it");
const art = await portal.context().newPage();
await art.setContent('<body style="margin:0"><div style="width:600px;height:750px;background:linear-gradient(135deg,#1f7a5a,#f4ecdc 60%,#b8893b)"></div></body>');
const photo = await art.screenshot({ clip: { x: 0, y: 0, width: 600, height: 750 } });
await art.close();
await portal.goto(`${base}/brand-portal/products`, { waitUntil: "networkidle" });
await shot(portal, "portal-products");
await portal.click(`a:has-text("${productTitle}")`);
await portal.waitForURL(/\/brand-portal\/products\/[0-9a-f-]{36}/);
await portal.fill('input[name="v.1.price"]', "5990");
await portal.setInputFiles('input[name="images"]', { name: "rang-lawn.png", mimeType: "image/png", buffer: photo });
await portal.selectOption("#status", "published");
await portal.click('button:has-text("Save product")');
await portal.waitForSelector("text=live on your brand page", { timeout: 60_000 });
check(true, "product saved and published");
await portal.reload({ waitUntil: "networkidle" });
check(await portal.isVisible('input[name="v.1.price"][value="5990"]'), "edited variant price kept");
await shot(portal, "portal-product-edit");

// ── 5. Visible on /brands/<slug> with variants → add to bag ─────────────────
console.log("5. Product is live on the brand page; add to bag");
const guest = await newPage();
await guest.goto(`${base}/brands`, { waitUntil: "networkidle" });
check(await guest.isVisible(`a[href="/brands/${slug}"]`), "self-signup brand listed under Shop by brand");
await guest.goto(`${base}/brands/${slug}`, { waitUntil: "networkidle" });
check(await guest.isVisible(`text=${productTitle}`), `product visible on /brands/${slug}`);
check(await guest.isVisible('a[aria-label="' + brandName + ' on Instagram (opens in a new tab)"]'), "brand page shows the brand's own Instagram link");
await shot(guest, "brand-page");
await guest.click(`text=${productTitle}`);
await guest.waitForURL(new RegExp(`/brands/${slug}/`));
for (const s of ["S", "M", "L"]) check(await guest.isVisible(`button[aria-pressed]:text-is("${s}")`), `size ${s} offered`);
await guest.click('button[aria-pressed]:text-is("M")');
await shot(guest, "brand-product");
await guest.click('button:has-text("Add to bag")');
await guest.waitForSelector("text=added to your bag", { timeout: 60_000 });
await guest.goto(`${base}/brands/bag`, { waitUntil: "networkidle" });
check(await guest.isVisible(`text=${productTitle}`), "product in the brand bag");
await shot(guest, "brand-bag");

// ── 6. Directory → "Shop with Wahbayaan" pre-fills the link form ────────────
console.log("6. Directory pre-fills shop-by-link");
await guest.goto(`${base}/brands/directory`, { waitUntil: "networkidle" });
const pageText = await guest.innerText("main");
check(!/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(pageText), "no email addresses on the directory");
check(!/\+92|0800-|\(021\)/.test(pageText), "no phone numbers on the directory");
const site = guest.locator('[data-directory-entry="khaadi"] a[aria-label^="Khaadi website"]');
check((await site.getAttribute("rel"))?.includes("nofollow") && (await site.getAttribute("rel"))?.includes("noopener") && (await site.getAttribute("target")) === "_blank", "outbound link is nofollow noopener, new tab");
check((await guest.locator("main img").count()) === 0, "directory has no images");
await shot(guest, "directory");
await guest.click('a[aria-label="Shop Khaadi with Wahbayaan"]');
await guest.waitForURL(/\/brands\/request\?brand=Khaadi/);
check((await guest.inputValue('input[name="items.0.brandName"]')) === "Khaadi", "link form pre-filled with Khaadi");
await shot(guest, "request-prefilled", false);

// ── 7. Social icons after admin sets them ───────────────────────────────────
console.log("7. Social icons in the footer and mobile menu");
await admin.goto(`${base}/admin/settings#social`, { waitUntil: "networkidle" });
await admin.fill("#social-instagram", "https://instagram.com/wahbayaan");
await admin.fill("#social-tiktok", "https://www.tiktok.com/@wahbayaan");
await admin.fill("#social-whatsapp", "+92 300 1234567");
await admin.click('button:has-text("Save social links")');
await admin.waitForSelector("text=/Social links saved|No changes to save/", { timeout: 60_000 });
await shot(admin, "admin-social-links", false);
await guest.goto(`${base}/`, { waitUntil: "networkidle" });
const footer = guest.locator("footer");
check((await footer.locator('a[aria-label="Wahbayaan on Instagram (opens in a new tab)"]').count()) === 1, "footer: Instagram icon");
check((await footer.locator('a[aria-label="Wahbayaan on TikTok (opens in a new tab)"]').count()) === 1, "footer: TikTok icon");
check((await footer.locator('a[aria-label="Wahbayaan on WhatsApp (opens in a new tab)"]').getAttribute("href")) === "https://wa.me/923001234567", "footer: WhatsApp links to wa.me");
check((await footer.locator('a[aria-label^="Wahbayaan on Facebook"]').count()) === 0, "footer: no Facebook icon (not set)");
await footer.scrollIntoViewIfNeeded();
await guest.screenshot({ path: `screenshots/brand-sellers-${String(++n).padStart(2, "0")}-footer-social.png`, clip: await footer.boundingBox() });
const phone = await newPage(390);
await phone.goto(`${base}/brands/directory`, { waitUntil: "networkidle" });
await phone.click('button[aria-label="Open menu"]');
await phone.waitForSelector('dialog a[aria-label="Wahbayaan on Instagram (opens in a new tab)"]', { timeout: 30_000 });
check(true, "mobile menu: social icons");
await shot(phone, "mobile-menu-social", false);

await browser.close();
if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll brand-seller checks passed.");
