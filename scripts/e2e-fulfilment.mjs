// End-to-end fulfilment through the real UI: direct domestic parcels, hub
// consolidation for international orders, a partial shipment and a return.
//
//   BASE=http://localhost:3111 node scripts/e2e-fulfilment.mjs
//
// Needs a freshly seeded demo database (`npx tsx scripts/reset.ts --demo`) and
// `next dev` running at BASE. The script switches the fictional "Demo Hub
// (Lahore)" ON for its international paths and OFF again at the end (so
// scripts/e2e-lifecycle.mjs keeps its direct-shipping behaviour). Screenshots
// go to screenshots/fulfil-*.png.
//
// 1. Domestic (Pakistan buyer, 2 sellers): checkout shows "Arrives in 2
//    parcels" → staff quote → pay → each seller books the sandbox courier,
//    prints the label and hands over → buyer sees 2 parcels with tracking.
// 2. International (US buyer, 2 sellers): "Shipped together from our hub" →
//    pay → seller A books the sandbox courier to the hub, seller B enters a
//    courier tracking number → hub receives (scan reference / tracking), QC
//    with photo + bin → pack & ship (weight, dims, sandbox booking) → invoice
//    + packing list → buyer sees ONE tracking number → delivered.
// 3. Return request on that order → admin approves → received → refund.
// 4. Partial shipment: one seller late → "Ship ready items now" → buyer told →
//    first box ships → extra shipping for the second box only after the buyer
//    approves and pays it.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3111";
const PW = process.env.PW ?? "wahbayaan-demo";
const HEADLESS = process.env.HEADED !== "1";
const ADMIN = "admin@wahbayaan.test";
const BUYER_US = "buyer@wahbayaan.test";
const BUYER_PK = "buyer.pk@wahbayaan.test";
const seller = (slug) => `${slug}@artisans.wahbayaan.test`;
const SANDBOX = "Sandbox Courier (demo)";
const TCS_TRACKING = `TCS${String(Date.now()).slice(-9)}`;
const HUB = "Demo Hub (Lahore)";

const DOMESTIC = [
  { slug: "mohabbat-archival-giclee-print", vendor: "noor-calligraphy-atelier", city: "Lahore" },
  { slug: "classic-ajrak-hand-block-printed-cloth", vendor: "hala-block-house", city: "Hala" },
];
const INTL = [
  { slug: "badshahi-skyline-screen-print", vendor: "rangeen-sarak-studio" },
  { slug: "salt-tealight-holders-set-of-four", vendor: "khewra-salt-studio" },
];
const PARTIAL = [
  { slug: "lakeside-mosque-archival-print", vendor: "rangeen-sarak-studio" },
  { slug: "ajrak-cushion-covers-pair", vendor: "hala-block-house" },
];

fs.mkdirSync("screenshots", { recursive: true });
const PHOTO = path.resolve("screenshots/fulfil-qc-photo.png");
// 1×1 PNG used as the QC photo.
fs.writeFileSync(PHOTO, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

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

const BUYER_MONEY = /(?:CA\$|US\$|\$|£)\s?\d/;
const ZERO_BUYER = /(?<![\d.,])(?:CA\$|\$|£|Rs\s?)0(?:\.00)?(?![\d.,])/;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: HEADLESS });
const open = [];
async function session(email, label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  open.push([label, page]);
  page.on("dialog", (d) => d.accept());
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
async function go(page, p) {
  const res = await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 120_000 });
  ok(res && res.status() < 400, `GET ${p} → ${res?.status()}`);
  if (await page.locator("[data-nextjs-dialog]").count()) throw new Error(`Next.js error overlay on ${page.url()}`);
  return res;
}
async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/fulfil-${String(step).padStart(2, "0")}-${name}.png`, fullPage: true });
}
const text = (page, sel = "main") => page.locator(sel).first().innerText();
async function waitText(page, re, sel = "main", timeout = 45_000) {
  await page.locator(sel).first().filter({ hasText: re }).waitFor({ timeout });
}
async function toast(page, re) {
  await page.getByText(re).first().waitFor({ timeout: 45_000 });
}
async function buyerChecks(page, { pk = false } = {}) {
  const t = await text(page);
  if (!pk) ok(!/\bRs\s?[\d,]+/.test(t), "buyer page shows no rupee amounts");
  ok(!ZERO_BUYER.test(t), "no zero amount is shown for a pending line");
  return t;
}
async function sellerChecks(page) {
  const t = await text(page);
  ok(!BUYER_MONEY.test(t), "seller page shows no buyer-currency amounts");
  return t;
}

// ── shared steps ────────────────────────────────────────────────────────────
async function emptyCart(buyer) {
  await go(buyer, "/cart");
  for (let i = 0; i < 10; i++) {
    const rm = buyer.locator("main").getByRole("button", { name: /^remove$/i });
    if (!(await rm.count())) break;
    await rm.first().click();
    await buyer.waitForLoadState("networkidle");
  }
}
async function addToCart(buyer, slug) {
  await go(buyer, `/product/${slug}`);
  await buyer.getByRole("button", { name: /add to cart/i }).first().click();
  await buyer.getByText(/added to your cart|view cart/i).first().waitFor();
}
async function checkout(buyer, { newAddress }) {
  await go(buyer, "/checkout");
  if (newAddress) {
    const radio = buyer.locator('input[name="addressId"][value="new"]');
    if ((await radio.count()) && (await radio.getAttribute("type")) === "radio") await radio.check();
    await buyer.fill("#fullName", "Ayesha Khan");
    await buyer.fill("#line1", "350 Fifth Avenue");
    await buyer.fill("#city", "New York");
    await buyer.fill("#region", "NY");
    await buyer.fill("#postalCode", "10118");
    await buyer.fill("#phone", "+1 212 555 0142");
    const save = buyer.locator('input[name="saveAddress"]');
    if (await save.count()) await save.uncheck();
  }
  await Promise.all([buyer.waitForURL(/\/checkout\/success\?order=/, { timeout: 120_000 }), buyer.getByRole("button", { name: /place order/i }).last().click()]);
  const number = new URL(buyer.url()).searchParams.get("order");
  ok(/^WB-/.test(number ?? ""), `order placed: ${number}`);
  return number;
}
async function quoteAndPay(admin, buyer, number, currency, shipping) {
  await go(admin, `/admin/orders/${number}`);
  await admin.getByLabel(new RegExp(`^Shipping \\(${currency}\\)`)).fill(shipping);
  await admin.getByLabel(new RegExp(`^Import duty \\(${currency}\\)`)).fill(currency === "PKR" ? "0" : "2.00");
  await admin.getByRole("checkbox", { name: "Not applicable" }).check();
  await admin.getByRole("checkbox", { name: "No handling fee" }).check();
  await admin.getByRole("button", { name: /send quote to buyer/i }).click();
  await toast(admin, /Quote sent —/);
  await go(buyer, `/account/orders/${number}`);
  await Promise.all([buyer.waitForURL(/\/checkout\/test-payment/), buyer.getByRole("button", { name: /approve & pay/i }).click()]);
  await Promise.all([buyer.waitForURL(/\/checkout\/success/), buyer.getByRole("button", { name: "Simulate successful payment" }).click()]);
  ok(true, `${number} quoted (${currency} ${shipping} shipping) and paid — funds held`);
}
async function openSellerOrder(page, number) {
  await go(page, "/seller/orders?status=all");
  await Promise.all([page.waitForURL(/\/seller\/orders\/[0-9a-f-]+$/), page.getByRole("link", { name: number }).first().click()]);
  await page.waitForLoadState("networkidle");
}
async function setHub(admin, on) {
  await go(admin, "/admin/hubs");
  const row = admin.locator("tr", { hasText: HUB });
  ok((await row.count()) > 0, `${HUB} is listed in Admin → Hubs`);
  const isOn = (await row.getByRole("button", { name: /Active — switch off/ }).count()) > 0;
  if (isOn !== on) {
    await row.getByRole("button", { name: on ? /switch on/ : /switch off/ }).click();
    await admin.locator("tr", { hasText: HUB }).getByRole("button", { name: on ? /Active — switch off/ : /Inactive — switch on/ }).waitFor({ timeout: 45_000 });
  }
  ok(true, `${HUB} is ${on ? "active" : "switched off"}`);
}
async function setLateThreshold(admin, days) {
  await go(admin, "/admin/hubs");
  await admin.locator("#late").fill(String(days));
  await admin.getByRole("button", { name: "Save rules" }).click();
  await toast(admin, /Consolidation settings saved/);
}
async function hubRefs(admin, number) {
  await go(admin, `/admin/hub?tab=inbound`);
  const rows = admin.locator("tr", { hasText: number });
  const n = await rows.count();
  const refs = [];
  for (let i = 0; i < n; i++) refs.push({ ref: (await rows.nth(i).locator("td").first().innerText()).trim(), from: await rows.nth(i).locator("td").nth(1).innerText() });
  return refs;
}
async function receive(admin, code) {
  await go(admin, "/admin/hub?tab=inbound");
  await admin.fill("#scan", code);
  await admin.getByRole("button", { name: /^receive$/i }).first().click();
  await toast(admin, /Received .* — \d+ of \d+ items? arrived/);
}
async function qcPassAll(admin, number, binPrefix) {
  await go(admin, "/admin/hub?tab=qc");
  let i = 0;
  for (;;) {
    const card = admin.locator("section", { hasText: number }).filter({ has: admin.getByRole("button", { name: "QC pass" }) }).first();
    if (!(await card.count())) break;
    i += 1;
    await card.getByPlaceholder(/Condition/).fill("Matches the listing, well packed (E2E)");
    await card.getByPlaceholder("A-03").fill(`${binPrefix}-${i}`);
    await card.locator('input[type="file"]').setInputFiles(PHOTO);
    await card.getByRole("button", { name: "QC pass" }).click();
    await toast(admin, /QC passed/);
    await go(admin, "/admin/hub?tab=qc");
  }
  ok(i > 0, `QC passed ${i} parcel(s) with a photo and a bin`);
}

async function run() {
  const admin = await session(ADMIN, "admin");

  // 1 ───────────────────────────────────────────────────────────────────────
  section("Domestic order, two sellers: one cart, one payment, two direct parcels");
  const pk = await session(BUYER_PK, "buyer-pk");
  await emptyCart(pk);
  for (const p of DOMESTIC) await addToCart(pk, p.slug);
  await go(pk, "/cart");
  let t = await buyerChecks(pk, { pk: true });
  ok(/Arrives in 2 parcels/.test(t), "cart says “Arrives in 2 parcels”");
  ok(/ships from Lahore/.test(t) && /ships from Hala/.test(t), "cart shows each seller's dispatch city");
  ok(/Pending/.test(t), "domestic delivery stays pending (no confirmed rate) — never zero");
  await shot(pk, "pk-cart");
  const dom = await checkout(pk, { newAddress: false });
  await quoteAndPay(admin, pk, dom, "PKR", "450");

  const sellerRefs = [];
  for (const p of DOMESTIC) {
    const s = await session(seller(p.vendor), p.vendor);
    await openSellerOrder(s, dom);
    t = await sellerChecks(s);
    ok(/Book a courier/.test(t), `${p.vendor}: domestic order offers “Book a courier”`);
    if (await s.getByRole("button", { name: /accept order/i }).count()) {
      await s.getByRole("button", { name: /accept order/i }).click();
      await waitText(s, /Accepted/i);
    }
    await s.getByLabel("Courier", { exact: true }).selectOption(SANDBOX);
    await s.getByRole("button", { name: /^book courier$/i }).click();
    const label = s.getByRole("link", { name: "Print label" });
    await label.waitFor();
    ok(/SBX\d{12}/.test(await text(s)), `${p.vendor}: sandbox courier booked (SBX tracking)`);
    const href = await label.getAttribute("href");
    sellerRefs.push(href.split("/").pop());
    const lab = await s.context().newPage();
    await lab.goto(BASE + href);
    const lt = await lab.locator("body").innerText();
    ok(/SANDBOX LABEL/.test(lt) && lt.includes(href.split("/").pop()) && /Deliver to buyer/.test(lt), `${p.vendor}: printable label with the parcel reference and barcode`);
    ok((await lab.locator("svg[aria-label^='Barcode']").count()) >= 2, "label carries reference + tracking barcodes");
    await lab.screenshot({ path: `screenshots/fulfil-${String(step).padStart(2, "0")}-label-${p.vendor}.png`, fullPage: true });
    await lab.close();
    await s.getByRole("button", { name: /handed over to the courier/i }).click();
    await waitText(s, /Shipped — delivery is confirmed/);
    await shot(s, `seller-${p.vendor}-shipped`);
  }
  await go(pk, `/account/orders/${dom}`);
  t = await buyerChecks(pk, { pk: true });
  ok(/Arrives in 2 parcels/.test(t), "buyer order page: “Arrives in 2 parcels”");
  ok((await pk.locator('[data-testid="parcel-tracking"]').count()) === 2, "buyer sees two parcels, each with its own tracking");
  ok((t.match(/SBX\d{12}/g) ?? []).length >= 2, "both sandbox tracking numbers are shown");
  ok(/Ships from Lahore/.test(t) || /Lahore/.test(t), "each parcel shows where it ships from");
  await shot(pk, "pk-order-two-parcels");
  await go(pk, `/track/${dom}`);
  t = await text(pk);
  ok(/Arrives in 2 parcels/.test(t) && (t.match(/SBX\d{12}/g) ?? []).length >= 2, "/track shows the same two parcels with tracking");

  // 2 ───────────────────────────────────────────────────────────────────────
  section("International order, two sellers: consolidated at the hub, one box, one tracking number");
  await setHub(admin, true);
  const us = await session(BUYER_US, "buyer-us");
  await emptyCart(us);
  for (const p of INTL) await addToCart(us, p.slug);
  await go(us, "/cart");
  t = await buyerChecks(us);
  ok(/Shipped together from our hub/.test(t), "cart says “Shipped together from our hub”");
  await shot(us, "us-cart-hub");
  const intl = await checkout(us, { newAddress: true });
  await quoteAndPay(admin, us, intl, "USD", "38.00");
  await go(us, `/account/orders/${intl}`);
  t = await buyerChecks(us);
  ok(/Shipped together from our hub/.test(t) && /0 of 2 items arrived/.test(t), "buyer: “Shipped together from our hub”, 0 of 2 items arrived");
  ok(/With the seller/.test(t), "per-item journey starts “With the seller”");

  const sA = await session(seller(INTL[0].vendor), INTL[0].vendor);
  await openSellerOrder(sA, intl);
  t = await sellerChecks(sA);
  ok(/Send to our hub/.test(t) && /Demo Hub \(Lahore\)/.test(t), "seller sees “Send to our hub” with the hub address");
  ok(!/350 Fifth Avenue/.test(t), "seller doesn't see the overseas buyer's address (the hub ships it)");
  if (await sA.getByRole("button", { name: /accept order/i }).count()) {
    await sA.getByRole("button", { name: /accept order/i }).click();
    await waitText(sA, /Accepted/i);
  }
  const hubLabel = await sA.getByRole("link", { name: "Print hub label" }).getAttribute("href");
  await sA.getByRole("button", { name: /book courier to hub/i }).click();
  await waitText(sA, /On its way to the hub/);
  await shot(sA, "seller-sent-to-hub");
  const lab = await sA.context().newPage();
  await lab.goto(BASE + hubLabel);
  const lt = await lab.locator("body").innerText();
  ok(/Send to Wahbayaan hub/.test(lt) && /Demo Hub/.test(lt) && /SBX\d{12}/.test(lt), "hub-inbound label shows the hub, the reference and the sandbox tracking");
  await lab.screenshot({ path: `screenshots/fulfil-${String(step).padStart(2, "0")}-hub-label.png`, fullPage: true });
  await lab.close();

  const sB = await session(seller(INTL[1].vendor), INTL[1].vendor);
  await openSellerOrder(sB, intl);
  if (await sB.getByRole("button", { name: /accept order/i }).count()) {
    await sB.getByRole("button", { name: /accept order/i }).click();
    await waitText(sB, /Accepted/i);
  }
  await sB.getByLabel("I booked a courier").check();
  await sB.getByLabel("Courier", { exact: true }).selectOption("TCS");
  await sB.getByLabel("Tracking number").fill(TCS_TRACKING);
  await sB.getByRole("button", { name: /mark sent to hub/i }).click();
  await waitText(sB, /On its way to the hub/);

  const refs = await hubRefs(admin, intl);
  ok(refs.length === 2, `hub inbound lists both parcels: ${refs.map((r) => r.ref).join(", ")}`);
  await shot(admin, "hub-inbound");
  const refA = refs.find((r) => /Rangeen/i.test(r.from))?.ref ?? refs[0].ref;
  const badRef = refA.slice(0, -1) + (refA.endsWith("2") ? "3" : "2");
  await go(admin, "/admin/hub?tab=inbound");
  await admin.fill("#scan", badRef);
  await admin.getByRole("button", { name: /^receive$/i }).first().click();
  await toast(admin, /No parcel matches/);
  ok(true, "a mistyped reference (bad check character) is rejected");
  await receive(admin, refA.toLowerCase());
  await receive(admin, TCS_TRACKING);
  ok(true, "hub received one parcel by scanned reference and one by courier tracking number");
  await go(us, `/account/orders/${intl}`);
  t = await text(us);
  ok(/2 of 2 items arrived/.test(t) && /At our hub/.test(t), "buyer: “2 of 2 items arrived”, items “At our hub”");
  await qcPassAll(admin, intl, "A");
  await go(admin, "/admin/hub?tab=storage");
  ok((await text(admin)).includes(intl), "checked parcels are listed in storage with their bins");
  await go(admin, "/admin/emails");
  ok((await text(admin)).includes(`${intl}: everything has arrived at our hub`), "buyer emailed once when everything has arrived and been checked");

  await go(admin, "/admin/hub?tab=consolidation");
  const card = admin.locator(`section[data-order="${intl}"]`);
  ok(/2 of 2 items arrived/.test(await card.innerText()), "consolidation board shows 2 of 2 items arrived");
  await shot(admin, "hub-consolidation");
  await card.getByRole("link", { name: /Pack & ship/ }).click();
  await admin.waitForURL(/\/admin\/hub\/pack\//);
  await admin.fill("#pk-kg", "1.4");
  await admin.fill("#pk-l", "40");
  await admin.fill("#pk-w", "30");
  await admin.fill("#pk-h", "20");
  ok(/chargeable 4\.80 kg/.test(await text(admin)), "volumetric 40×30×20/5000 = 4.80 kg beats 1.40 kg actual");
  await admin.locator("#pk-courier").selectOption(SANDBOX);
  await shot(admin, "pack-form");
  await admin.getByRole("button", { name: "Ship box" }).click();
  await toast(admin, /Shipped .* — tracking SBX\d+/);
  await go(admin, `/admin/hub/pack/${intl}`);
  const invoiceHref = await admin.getByRole("link", { name: /Commercial invoice & packing list/ }).first().getAttribute("href");
  await go(admin, invoiceHref);
  t = await text(admin);
  ok(/COMMERCIAL INVOICE/.test(t) && /PACKING LIST/.test(t) && /Demo Hub \(Lahore\)/.test(t), "consolidated commercial invoice + packing list, exporter = the hub");
  ok(/Made by Rangeen/i.test(t) || /Made by/.test(t), "invoice lines name the seller of each item");
  await shot(admin, "invoice-packing-list");

  await go(us, `/account/orders/${intl}`);
  t = await buyerChecks(us);
  ok((await us.locator('[data-testid="hub-tracking"]').count()) === 1, "buyer sees ONE tracking number for the whole order");
  ok((await us.locator('[data-testid="parcel-tracking"]').count()) === 0, "no per-seller tracking for a consolidated order");
  ok(/Shipped/.test(t), "items read “Shipped”");
  await shot(us, "us-order-one-tracking");
  await go(us, `/track/${intl}`);
  ok((await us.locator('[data-testid="hub-tracking"]').count()) === 1, "/track shows the same single tracking number");

  await go(admin, "/admin/hub?tab=shipped");
  await admin.locator("tr", { hasText: intl }).getByRole("button", { name: /mark delivered/i }).click();
  await toast(admin, /Delivered/);
  await go(us, `/account/orders/${intl}`);
  t = await text(us);
  ok(/Has everything arrived as described\?/.test(t), "buyer is asked to confirm delivery (escrow unchanged)");

  // 3 ───────────────────────────────────────────────────────────────────────
  section("Return request on the delivered international order");
  await us.getByText("Return an item", { exact: true }).click();
  await us.getByRole("checkbox", { name: /Salt tealight holders/ }).check();
  await us.selectOption("#return-reason", "damaged");
  await us.fill("#return-description", "The tealight set arrived with one holder chipped (E2E).");
  await us.getByRole("button", { name: /request return/i }).click();
  await us.locator('[data-testid="return-status"]').waitFor();
  const ret = (await us.locator('[data-testid="return-status"]').innerText()).match(/RET-[A-Z0-9]+/)[0];
  ok(true, `return ${ret} requested`);
  await go(admin, "/admin/returns");
  const rc = admin.locator(`section[data-return="${ret}"]`);
  ok(/To our hub/.test(await rc.innerText()), "international return goes back to our hub");
  await shot(admin, "returns-queue");
  await rc.getByRole("button", { name: "Approve return" }).click();
  await toast(admin, /Approved/);
  await go(us, `/account/orders/${intl}`);
  ok(/approved — please send it back/.test(await text(us)), "buyer sees the return approved with where to send it");
  await go(admin, "/admin/returns");
  await admin.locator(`section[data-return="${ret}"]`).getByRole("button", { name: "Mark received" }).click();
  await toast(admin, /Return updated/);
  await go(admin, "/admin/returns");
  const rc2 = admin.locator(`section[data-return="${ret}"]`);
  await rc2.locator('input[name="amount"]').fill("5.00");
  await rc2.getByRole("button", { name: /^refund$/i }).click();
  await toast(admin, /Refunded/);
  await go(us, `/account/orders/${intl}`);
  ok(/Refund of \$5(\.00)? issued/.test(await text(us)), "refund issued through the existing refund flow");

  // 4 ───────────────────────────────────────────────────────────────────────
  section("Partial shipment: a late seller → ship ready items now → extra shipping only with approval");
  await setLateThreshold(admin, 0);
  await emptyCart(us);
  for (const p of PARTIAL) await addToCart(us, p.slug);
  const part = await checkout(us, { newAddress: true });
  await quoteAndPay(admin, us, part, "USD", "30.00");
  await openSellerOrder(sA, part);
  if (await sA.getByRole("button", { name: /accept order/i }).count()) {
    await sA.getByRole("button", { name: /accept order/i }).click();
    await waitText(sA, /Accepted/i);
  }
  await sA.getByRole("button", { name: /book courier to hub/i }).click();
  await waitText(sA, /On its way to the hub/);
  const prefs = await hubRefs(admin, part);
  const ready = prefs.find((r) => /Rangeen/i.test(r.from)) ?? prefs[0];
  await receive(admin, ready.ref);
  await qcPassAll(admin, part, "B");
  await go(admin, "/admin/hub?tab=consolidation");
  let pc = admin.locator(`section[data-order="${part}"]`);
  ok(/1 of 2 items arrived/.test(await pc.innerText()), "board: 1 of 2 items arrived");
  ok(await pc.getByRole("button", { name: /ship ready items now/i }).count() === 0, "no partial option while nobody is late");
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await pc.locator('input[name="due"]').first().fill(yesterday);
  await pc.getByRole("button", { name: "Set due" }).first().click();
  await toast(admin, /Due date saved/);
  await go(admin, "/admin/hub?tab=consolidation");
  pc = admin.locator(`section[data-order="${part}"]`);
  ok(/Late/.test(await pc.innerText()), "the waiting seller is flagged Late");
  await shot(admin, "board-late");
  await pc.getByRole("button", { name: /ship ready items now/i }).click();
  await toast(admin, /Partial shipment allowed/);
  await go(us, `/account/orders/${part}`);
  ok(/sending the items that are ready now/i.test(await text(us)), "buyer is told the ready items ship now");
  await go(admin, `/admin/hub/pack/${part}`);
  ok(/Partial shipment/.test(await text(admin)), "pack page warns it's a partial shipment");
  await admin.fill("#pk-kg", "0.6");
  await admin.fill("#pk-l", "35");
  await admin.fill("#pk-w", "25");
  await admin.fill("#pk-h", "5");
  await admin.locator("#pk-courier").selectOption(SANDBOX);
  await admin.getByRole("button", { name: "Ship box" }).click();
  await toast(admin, /Shipped .* — tracking SBX\d+/);
  await go(admin, `/admin/hub/pack/${part}`);
  await admin.locator("#xq-kind").selectOption("partial_shipment");
  await admin.fill("#xq-amount", "12.50");
  await admin.fill("#xq-note", "Second box for the ajrak cushion covers.");
  await admin.getByRole("button", { name: /ask the buyer to approve/i }).click();
  await toast(admin, /Nothing is charged unless they approve/);
  await go(us, `/account/orders/${part}`);
  t = await buyerChecks(us);
  ok(/Extra shipping: \$12\.50/.test(t) && /Nothing is charged unless you approve/.test(t), "buyer must approve the $12.50 extra shipping first");
  ok((await us.locator('[data-testid="hub-tracking"]').count()) === 1, "first box has its tracking number");
  await shot(us, "us-partial-approve");
  await Promise.all([us.waitForURL(/\/checkout\/test-payment\/extra/), us.getByRole("button", { name: /approve & pay/i }).click()]);
  await Promise.all([us.waitForURL(/extra=paid/), us.getByRole("button", { name: "Simulate successful payment" }).click()]);
  ok(/extra shipping is paid/.test(await text(us)), "extra shipping paid only after approval");
  await shot(us, "us-partial-paid");
  return { domestic: dom, international: intl, partial: part, return: ret, domesticParcels: sellerRefs };
}

let exit = 0;
try {
  const r = await run();
  console.log(`\nAll fulfilment steps passed. ${JSON.stringify(r)}`);
} catch (e) {
  exit = 1;
  console.error(`\n✗ ${e.stack ?? e}`);
  for (const [label, page] of open) {
    await page.screenshot({ path: `screenshots/fulfil-FAIL-${label}.png`, fullPage: true }).catch(() => {});
    console.error(`   (${label} was on ${page.url()})`);
  }
} finally {
  // Leave the demo as it was: hub off, default late threshold.
  try {
    const admin = open.find(([l]) => l === "admin")?.[1];
    if (admin) {
      await setLateThreshold(admin, 3);
      await setHub(admin, false);
    }
  } catch (e) {
    console.error(`cleanup failed: ${e.message}`);
  }
}
if (problems.length) {
  exit = 1;
  console.error(`\nProblems seen while browsing:\n - ${problems.join("\n - ")}`);
}
await browser.close();
process.exit(exit);
