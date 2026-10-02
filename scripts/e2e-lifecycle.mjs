// End-to-end order lifecycle through the real UI, across every role.
//
//   BASE=http://localhost:3106 node scripts/e2e-lifecycle.mjs
//
// Needs a freshly seeded demo database (`npx tsx scripts/reset.ts --demo`)
// and `next dev` running at BASE. Screenshots go to screenshots/e2e-*.png.
//
// Happy path: US buyer adds a ready-to-ship piece → checkout (rates pending →
// "awaiting quote") → admin sends the shipping/duty quote → buyer approves and
// pays with the test provider (funds held) → artisan accepts, starts, marks
// ready, ships with tracking → admin marks the parcel delivered → buyer
// confirms delivery and leaves a review → funds released, payout visible to
// admin (escrow, payouts) and to the artisan in PKR.
// Unhappy paths: buyer cancels an unpaid order; buyer opens a case on a
// delivered order and admin sees the funds frozen.
import fs from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3106";
const PW = process.env.PW ?? "wahbayaan-demo";
const HEADLESS = process.env.HEADED !== "1";
const PRODUCT = process.env.PRODUCT ?? "blue-pottery-bowl"; // ready-to-ship, Multan Blue Kiln
const PRODUCT_TITLE = "Blue pottery bowl";
const ARTISAN = "multan-blue-kiln";
const SECOND_PRODUCT = process.env.PRODUCT2 ?? "tall-floral-vase";

const BUYER = "buyer@wahbayaan.test";
const ADMIN = "admin@wahbayaan.test";
const SELLER = `${ARTISAN}@artisans.wahbayaan.test`;

fs.mkdirSync("screenshots", { recursive: true });

// ── tiny assertion + reporting kit ──────────────────────────────────────────
let step = 0;
const problems = [];
function ok(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log(`   ✓ ${msg}`);
}
function section(title) {
  step += 1;
  console.log(`\n${String(step).padStart(2, "0")}. ${title}`);
}

// Currency patterns. Seller amounts are "Rs 12,345"; buyer amounts are "$12.34", "£", "CA$".
const RS = /\bRs\s?[\d,]+/;
const BUYER_MONEY = /(?:CA\$|US\$|\$|£)\s?\d/;
const ZERO_BUYER = /(?<![\d.,])(?:CA\$|\$|£)0(?:\.00)?(?![\d.,])/;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: HEADLESS });

const open = [];
async function session(email, label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  open.push([label, page]);
  page.on("dialog", (d) => d.accept()); // admin confirm() prompts
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror on ${page.url()}: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`[${label}] HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 }), page.click('button[type="submit"]')]);
  return page;
}

async function go(page, path) {
  const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120_000 });
  ok(res && res.status() < 400, `GET ${path} → ${res?.status()}`);
  await noOverlay(page);
  return res;
}

async function noOverlay(page) {
  const n = await page.locator("nextjs-portal, [data-nextjs-dialog], [data-nextjs-dialog-overlay]").count();
  if (n) {
    const txt = await page.locator("nextjs-portal").first().innerText().catch(() => "");
    // The dev indicator is also a nextjs-portal; only fail when an error dialog is open.
    const dialog = await page.locator("[data-nextjs-dialog]").count();
    if (dialog) throw new Error(`Next.js error overlay on ${page.url()}: ${txt.slice(0, 400)}`);
  }
}

async function shot(page, name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `screenshots/e2e-${String(step).padStart(2, "0")}-${name}.png`, fullPage: true });
}

const text = (page, sel = "main") => page.locator(sel).first().innerText();

/** Buyer surfaces: buyer currency only, never rupees, never $0 for a pending line. */
async function assertBuyerCurrency(page, { allowNoMoney = false } = {}) {
  const t = await text(page);
  ok(!RS.test(t), "buyer page shows no rupee amounts");
  if (!allowNoMoney) ok(BUYER_MONEY.test(t), "buyer page shows amounts in the buyer's currency");
  ok(!ZERO_BUYER.test(t), "no $0 / £0 amount is shown to the buyer");
  return t;
}

/** Seller dashboard: rupees only. */
async function assertSellerCurrency(page) {
  const t = await text(page);
  ok(!BUYER_MONEY.test(t), "seller page shows no buyer-currency amounts");
  return t;
}

/** Waits until `locator` contains `re` (polls through refresh()). */
async function waitText(page, re, sel = "main", timeout = 30_000) {
  await page.locator(sel).first().filter({ hasText: re }).waitFor({ timeout });
}

// ── 1. buyer: cart → checkout → awaiting quote ──────────────────────────────
async function buyerPlacesOrder(buyer, slug) {
  await go(buyer, `/product/${slug}`);
  await assertBuyerCurrency(buyer);
  const add = buyer.getByRole("button", { name: /add to cart/i });
  ok(await add.isEnabled(), "Add to cart is available for a ready-to-ship piece");
  await add.click();
  await buyer.getByText(/added to your cart|view cart/i).first().waitFor();
  await go(buyer, "/cart");
  const cartText = await assertBuyerCurrency(buyer);
  ok(/pending/i.test(cartText), "cart marks shipping/duty as pending rather than inventing a number");
  return cartText;
}

async function checkout(buyer) {
  await buyer.getByRole("link", { name: /checkout/i }).first().click();
  await buyer.waitForURL(/\/checkout$/);
  await noOverlay(buyer);
  const t = await assertBuyerCurrency(buyer);
  ok(/place order — confirm costs first/i.test(t), "checkout offers to place the order and confirm costs first (no charge)");
  ok(/nothing is charged now/i.test(t), "checkout says nothing is charged now");
  const newAddr = buyer.locator('input[name="addressId"][value="new"]');
  if ((await newAddr.count()) && (await newAddr.getAttribute("type")) === "radio") await newAddr.check();
  await buyer.fill("#fullName", "Ayesha Khan");
  await buyer.fill("#line1", "350 Fifth Avenue");
  await buyer.fill("#city", "New York");
  await buyer.fill("#region", "NY");
  await buyer.fill("#postalCode", "10118");
  await buyer.fill("#phone", "+1 212 555 0142");
  await buyer.fill("#buyerNotes", "E2E test order — please pack carefully.");
  const save = buyer.locator('input[name="saveAddress"]');
  if (await save.count()) await save.uncheck();
  await shot(buyer, "buyer-checkout");
  await Promise.all([buyer.waitForURL(/\/checkout\/success\?order=/, { timeout: 120_000 }), buyer.getByRole("button", { name: /place order/i }).click()]);
  await noOverlay(buyer);
  const number = new URL(buyer.url()).searchParams.get("order");
  ok(/^WB-/.test(number ?? ""), `order placed: ${number}`);
  return number;
}

async function run() {
  const buyer = await session(BUYER, "buyer");
  const admin = await session(ADMIN, "admin");
  const seller = await session(SELLER, "seller");

  // 1 ─────────────────────────────────────────────────────────────────────
  section("Buyer adds a ready-to-ship piece and places the order (rates pending → awaiting quote)");
  await buyerPlacesOrder(buyer, PRODUCT);
  await shot(buyer, "buyer-cart");
  const order = await checkout(buyer);
  let t = await assertBuyerCurrency(buyer);
  await shot(buyer, "buyer-order-placed");
  ok(/confirm|quote/i.test(t), "confirmation explains the costs are being confirmed");
  await go(buyer, `/account/orders/${order}`);
  t = await assertBuyerCurrency(buyer);
  ok(/Confirming costs/.test(t), "account order shows status “Confirming costs”");
  ok(/Being confirmed by our team/.test(t), "pending lines say they are being confirmed");
  ok((await buyer.getByRole("button", { name: /approve & pay/i }).count()) === 0, "no pay button before the quote");
  await shot(buyer, "buyer-account-awaiting-quote");

  // 2 ─────────────────────────────────────────────────────────────────────
  section("Admin sends the shipping / duty quote from /admin/quotes");
  await go(admin, "/admin/quotes");
  const card = admin.locator("div", { has: admin.getByRole("link", { name: order, exact: true }) }).filter({ has: admin.getByRole("button", { name: /send quote to buyer/i }) }).last();
  ok((await card.count()) > 0, `order ${order} is listed under “Awaiting quote”`);
  t = await card.innerText();
  ok(/USD/.test(t), "quote card says the order is priced in USD");
  await card.getByLabel(/^Shipping \(USD\)/).fill("48.50");
  await card.getByLabel(/^Import duty \(USD\)/).fill("6.20");
  await card.getByLabel(/^Import tax \(USD\)/).fill("3.10");
  await card.getByLabel(/^Handling \(USD\)/).fill("4.00");
  await card.getByLabel(/note to the buyer/i).fill("DHL Express, 1 parcel of 1.6 kg. Duty per HTS 6912.");
  t = await card.innerText();
  const quotedTotal = t.match(/Total (\$[\d,.]+)/)?.[1];
  ok(!!quotedTotal, `live total shown on the quote form: ${quotedTotal}`);
  await shot(admin, "admin-quote-form");
  await card.getByRole("button", { name: /send quote to buyer/i }).click();
  await admin.getByText(/Quote sent —/).first().waitFor();
  await noOverlay(admin);
  await shot(admin, "admin-quote-sent");
  await go(admin, `/admin/orders/${order}`);
  t = await text(admin);
  ok(/Quote ready|quote sent/i.test(t), "admin order page shows the quote was sent");
  await shot(admin, "admin-order-quoted");
  await go(admin, "/admin/emails");
  t = await text(admin);
  ok(t.includes(`Your final total for order ${order}`), "quote email is in the outbox");
  await shot(admin, "admin-email-outbox");

  // 3 ─────────────────────────────────────────────────────────────────────
  section("Buyer approves the quote and pays with the test provider");
  await go(buyer, `/account/orders/${order}`);
  t = await assertBuyerCurrency(buyer);
  ok(/Quote ready — approve to pay/.test(t), "status reads “Quote ready — approve to pay”");
  ok(t.includes(quotedTotal), `buyer sees the quoted total ${quotedTotal}`);
  ok(t.includes("DHL Express, 1 parcel"), "buyer sees the note from the team");
  ok(!/Being confirmed by our team/.test(t), "no line is still pending after the quote");
  await shot(buyer, "buyer-quote-ready");
  await Promise.all([buyer.waitForURL(/\/checkout\/test-payment/), buyer.getByRole("button", { name: /approve & pay/i }).click()]);
  await noOverlay(buyer);
  t = await assertBuyerCurrency(buyer);
  ok(t.includes(quotedTotal), "test payment page charges the quoted total");
  await shot(buyer, "buyer-test-payment");
  await Promise.all([buyer.waitForURL(/\/checkout\/success/), buyer.getByRole("button", { name: "Simulate successful payment" }).click()]);
  await noOverlay(buyer);
  t = await assertBuyerCurrency(buyer);
  await shot(buyer, "buyer-paid");
  await go(buyer, `/account/orders/${order}`);
  t = await assertBuyerCurrency(buyer);
  ok(/Paid — funds held/.test(t), "status reads “Paid — funds held”");
  ok(/held by Wahbayaan/.test(t), "funds shown as held by Wahbayaan");
  await shot(buyer, "buyer-account-paid");

  // 4 ─────────────────────────────────────────────────────────────────────
  section("Artisan accepts, makes, packs and ships the order");
  await go(seller, "/seller/orders");
  t = await assertSellerCurrency(seller);
  ok(t.includes(order), "paid order is listed under “Needs action”");
  ok(RS.test(t), "seller order list shows rupee amounts");
  await shot(seller, "seller-orders");
  await seller.getByRole("link", { name: order }).click();
  await seller.waitForURL(/\/seller\/orders\/[0-9a-f-]+$/);
  await noOverlay(seller);
  t = await assertSellerCurrency(seller);
  ok(t.includes("350 Fifth Avenue"), "artisan sees the delivery address once paid");
  await shot(seller, "seller-order-new");
  for (const [btn, after] of [
    [/accept order/i, /Accepted/i],
    [/start making/i, /In production|Being made/i],
    [/mark finished & ready to pack/i, /Ready|packed/i],
  ]) {
    await seller.getByRole("button", { name: btn }).click();
    await waitText(seller, after);
    await noOverlay(seller);
  }
  await shot(seller, "seller-order-ready");
  await seller.getByLabel("Courier").selectOption("DHL Express");
  await seller.getByLabel("Tracking number").fill("JD014600006287654321");
  await seller.getByLabel(/tracking link/i).fill("https://www.dhl.com/track?id=JD014600006287654321");
  await seller.getByLabel(/packed weight/i).fill("1.6");
  await seller.getByRole("button", { name: /mark as shipped/i }).click();
  await waitText(seller, /Shipped — delivery is confirmed/);
  t = await assertSellerCurrency(seller);
  ok(/JD014600006287654321/.test(t), "tracking number shown on the artisan's order");
  await shot(seller, "seller-order-shipped");
  await go(buyer, `/account/orders/${order}`);
  t = await assertBuyerCurrency(buyer);
  ok(/Shipped/.test(t) && /JD014600006287654321/.test(t), "buyer sees Shipped with the DHL tracking number");
  await shot(buyer, "buyer-shipped");

  // 5 ─────────────────────────────────────────────────────────────────────
  section("Admin marks the parcel delivered from /admin/shipments");
  await go(admin, "/admin/shipments");
  const row = admin.locator("tr", { hasText: order });
  ok((await row.count()) > 0, "parcel is listed in shipments");
  await shot(admin, "admin-shipments");
  await row.getByRole("button", { name: /mark delivered/i }).click();
  await admin.getByText(/Parcel status updated/).first().waitFor();
  await go(buyer, `/account/orders/${order}`);
  t = await assertBuyerCurrency(buyer);
  ok(/Delivered/.test(t), "buyer order shows Delivered");
  ok(/Has everything arrived as described\?/.test(t), "buyer is asked to confirm delivery");
  await shot(buyer, "buyer-delivered");

  // 6 ─────────────────────────────────────────────────────────────────────
  section("Buyer confirms delivery and reviews the piece");
  await buyer.getByRole("checkbox", { name: /everything arrived/i }).check();
  await Promise.all([buyer.waitForURL(/done=confirmed/), buyer.getByRole("button", { name: /confirm delivery/i }).click()]);
  await noOverlay(buyer);
  t = await assertBuyerCurrency(buyer);
  ok(/Thank you — the artisan has been paid/.test(t), "buyer sees a thank-you after confirming");
  ok(/Completed/.test(t), "order now reads Completed");
  ok(/released to the artisan/.test(t), "funds shown as released to the artisan");
  await shot(buyer, "buyer-completed");
  const review = buyer.getByRole("link", { name: /review this piece/i });
  if ((await review.count()) > 0) {
    ok(true, "“Review this piece” is offered after delivery");
    await review.first().click();
    await buyer.waitForURL(new RegExp(`/product/${PRODUCT}`));
    await noOverlay(buyer);
    await buyer.locator("#write-review").scrollIntoViewIfNeeded();
    await shot(buyer, "buyer-review-form");
    await writeReview(buyer);
    await shot(buyer, "buyer-review-sent");
  } else {
    // Re-run without a reseed: the demo buyer already reviewed this piece.
    await go(buyer, `/product/${PRODUCT}`);
    const note = await buyer.locator("#write-review").innerText();
    ok(/already reviewed|with our team/i.test(note), "piece was already reviewed by this buyer (re-run without reseed)");
  }

  // 7 ─────────────────────────────────────────────────────────────────────
  section("Escrow released → payout visible to admin and, in PKR, to the artisan");
  await go(admin, `/admin/orders/${order}`);
  t = await text(admin);
  ok(/Completed/.test(t), "admin order shows Completed");
  ok(/released/i.test(t), "admin order shows funds released");
  await shot(admin, "admin-order-completed");
  await go(admin, "/admin/escrow");
  t = await text(admin);
  await shot(admin, "admin-escrow");
  ok(/Succeeded/.test(await admin.locator("tr", { hasText: order }).first().innerText()), "escrow payments list the test payment as succeeded");
  // The panel is the nearest ancestor of its title that also holds the description and the list.
  const heldBox = admin.getByText("Held — not yet delivered", { exact: true }).locator("xpath=ancestor::*[.//ul][1]");
  ok(!(await heldBox.innerText()).includes(order), "released order is no longer listed as held");
  // Demo data has no commission rate: release creates no payout until staff set one (pending, never zero).
  await go(admin, "/admin/payouts");
  t = await text(admin);
  await shot(admin, "admin-payouts-awaiting-commission");
  ok(/waiting for a commission rate/i.test(t) && t.includes(order), "admin payouts lists the order as waiting for a commission rate");
  await go(seller, "/seller/payouts");
  t = await assertSellerCurrency(seller);
  const sellerRow = seller.locator("tr", { hasText: order });
  ok(/Released to you/.test(await sellerRow.innerText()), "artisan sees the order as released");
  ok(/pending/i.test(await sellerRow.innerText()) && !/Rs 0\b/.test(await sellerRow.innerText()), "artisan's commission shows pending, not Rs 0");
  await shot(seller, "seller-payouts-awaiting-commission");

  await go(admin, "/admin/rates/fees");
  const cform = admin.locator("form", { has: admin.getByRole("button", { name: "Save commission" }) });
  await cform.locator('select[name="mode"]').selectOption("active");
  await cform.locator('input[name="percent"]').fill("15");
  await cform.getByRole("button", { name: "Save commission" }).click();
  await admin.getByText(/Commission saved/).first().waitFor();
  await shot(admin, "admin-commission-set");
  await go(admin, "/admin/payouts");
  await admin.getByRole("button", { name: "Create payouts now" }).click();
  await admin.getByText(/Created \d+ payout/i).first().waitFor();
  await go(admin, "/admin/payouts");
  t = await text(admin);
  await shot(admin, "admin-payouts");
  ok(/Multan Blue Kiln/.test(t), "admin payouts lists Multan Blue Kiln");
  ok(t.includes("Rs 10,625"), "payout is the PKR subtotal less 15% commission (Rs 10,625)");
  ok(!BUYER_MONEY.test(t), "admin payouts show rupees only");
  await go(seller, "/seller/payouts");
  t = await assertSellerCurrency(seller);
  const row2 = await seller.locator("tr", { hasText: order }).innerText();
  ok(row2.includes("Rs 10,625"), "artisan sees Rs 10,625 for this order");
  ok(/Rs 1,875/.test(row2), "artisan sees the Rs 1,875 commission");
  await shot(seller, "seller-payouts");

  // Unhappy 1 ─────────────────────────────────────────────────────────────
  section("Unhappy path: buyer cancels an order before paying");
  await buyerPlacesOrder(buyer, SECOND_PRODUCT);
  const cancelNo = await checkout(buyer);
  await go(buyer, `/account/orders/${cancelNo}`);
  await buyer.getByText("Cancel this order", { exact: true }).click();
  await buyer.fill("#cancel-reason", "Ordered by mistake (E2E)");
  await Promise.all([buyer.waitForURL(/done=cancelled/), buyer.getByRole("button", { name: /^cancel order$/i }).click()]);
  await noOverlay(buyer);
  t = await assertBuyerCurrency(buyer);
  ok(/Cancelled\. Nothing was charged\./.test(t), "buyer is told nothing was charged");
  ok(/Cancelled/.test(t), "order reads Cancelled");
  ok((await buyer.getByRole("button", { name: /approve & pay/i }).count()) === 0, "no pay button on a cancelled order");
  await shot(buyer, "buyer-cancelled");
  await go(admin, "/admin/quotes");
  t = await text(admin);
  ok(!t.includes(cancelNo), "cancelled order is no longer waiting for a quote");

  // Unhappy 2 ─────────────────────────────────────────────────────────────
  section("Unhappy path: buyer opens a case on a delivered order → admin sees funds frozen");
  const disputed = await fullyDeliver({ buyer, admin, seller });
  await go(buyer, `/account/orders/${disputed}`);
  await buyer.getByText("Something wrong? Open a case", { exact: true }).click();
  await buyer.selectOption("#reason", "damaged");
  await buyer.fill("#description", "The bowl arrived with a hairline crack across the rim (E2E test).");
  await buyer.fill("#desiredOutcome", "A replacement");
  await Promise.all([buyer.waitForURL(/\/account\/disputes\//), buyer.getByRole("button", { name: /open a case/i }).click()]);
  await noOverlay(buyer);
  t = await assertBuyerCurrency(buyer, { allowNoMoney: true });
  const caseNo = t.match(/CASE-[A-Z0-9-]+/)?.[0];
  ok(!!caseNo, `case opened: ${caseNo}`);
  await shot(buyer, "buyer-case");
  await go(buyer, `/account/orders/${disputed}`);
  t = await assertBuyerCurrency(buyer);
  ok(/Case open/.test(t), "order reads “Case open”");
  ok(/frozen/.test(t), "buyer is told held funds are frozen");
  await shot(buyer, "buyer-order-disputed");
  await go(admin, "/admin/disputes");
  t = await text(admin);
  ok(t.includes(caseNo) || t.includes(disputed), "case is listed in /admin/disputes");
  ok(/frozen/i.test(t), "admin disputes shows the funds frozen");
  await shot(admin, "admin-disputes");
  await go(seller, "/seller/orders?status=all");
  await Promise.all([seller.waitForURL(/\/seller\/orders\/[0-9a-f-]+$/), seller.getByRole("link", { name: disputed }).click()]);
  await seller.waitForLoadState("networkidle");
  await noOverlay(seller);
  t = await assertSellerCurrency(seller);
  ok(/opened a case/.test(t), "artisan is told the buyer opened a case");
  ok(!/payout is released when the buyer confirms/.test(t), "artisan isn't told the payout will be released while a case is open");
  await shot(seller, "seller-order-disputed");

  return { order, cancelNo, disputed, caseNo };
}

async function writeReview(buyer) {
  const form = buyer.locator("#write-review");
  await form.locator('input[name="rating"][value="5"]').check({ force: true });
  await form.locator("#rv-title").fill("Beautiful glaze, packed like treasure");
  await form.locator("#rv-body").fill("The cobalt is deeper than in the photos and it arrived perfectly packed. Lovely piece. (E2E)");
  await form.getByRole("button", { name: "Submit review" }).click();
  // The form is replaced by the page's own "pending moderation" note after refresh().
  await form.getByText(/your review is with our team/i).first().waitFor();
  ok(true, "review submitted and awaiting moderation");
}

/** Takes a second order all the way to Delivered (used for the dispute path). */
async function fullyDeliver({ buyer, admin, seller }) {
  await buyerPlacesOrder(buyer, PRODUCT);
  const number = await checkout(buyer);
  await go(admin, `/admin/orders/${number}`);
  await admin.getByLabel(/^Shipping \(USD\)/).fill("40");
  await admin.getByLabel(/^Import duty \(USD\)/).fill("5");
  await admin.getByText("Not applicable").first().click();
  await admin.getByText("No handling fee").first().click();
  await admin.getByRole("button", { name: /send quote to buyer/i }).click();
  await admin.getByText(/Quote sent —/).first().waitFor();
  await go(buyer, `/account/orders/${number}`);
  await Promise.all([buyer.waitForURL(/\/checkout\/test-payment/), buyer.getByRole("button", { name: /approve & pay/i }).click()]);
  await Promise.all([buyer.waitForURL(/\/checkout\/success/), buyer.getByRole("button", { name: "Simulate successful payment" }).click()]);
  await go(seller, "/seller/orders");
  await seller.getByRole("link", { name: number }).click();
  await seller.getByRole("button", { name: /accept order/i }).click();
  await waitText(seller, /Accepted/i);
  await seller.getByLabel("Courier").selectOption("TCS International");
  await seller.getByLabel("Tracking number").fill("TCS778812345");
  await seller.getByRole("button", { name: /mark as shipped/i }).click();
  await waitText(seller, /Shipped — delivery is confirmed/);
  await go(admin, "/admin/shipments");
  await admin.locator("tr", { hasText: number }).getByRole("button", { name: /mark delivered/i }).click();
  await admin.getByText(/Parcel status updated/).first().waitFor();
  ok(true, `second order ${number} delivered`);
  return number;
}

let exit = 0;
try {
  const r = await run();
  console.log(`\nAll steps passed. Orders: ${JSON.stringify(r)}`);
} catch (e) {
  exit = 1;
  console.error(`\n✗ ${e.stack ?? e}`);
  for (const [label, page] of open) {
    await page.screenshot({ path: `screenshots/e2e-FAIL-${label}.png`, fullPage: true }).catch(() => {});
    console.error(`   (${label} was on ${page.url()} — screenshots/e2e-FAIL-${label}.png)`);
  }
}
if (problems.length) {
  exit = 1;
  console.error(`\nProblems seen while browsing:\n - ${problems.join("\n - ")}`);
}
await browser.close();
process.exit(exit);
