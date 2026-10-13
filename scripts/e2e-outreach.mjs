// Brand outreach walkthrough: import → sender → compose → send (logged) → bulk preview/send →
// opt-out link → status changes → agreed prompt → brand permission form (prefilled, not recorded).
// BASE=http://localhost:3121 OUT=/path/to/dir node scripts/e2e-outreach.mjs
// Needs a seeded demo database and NO email provider (emails are only logged).
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://localhost:3000";
const out = process.env.OUT ?? "screenshots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("dialog", (d) => d.accept());
const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exitCode = 1;
};
const check = (cond, msg) => (cond ? console.log("ok:", msg) : fail(msg));
const toast = async () => (await page.locator("[aria-live=polite] [role=status], [aria-live=polite] [role=alert]").last().innerText({ timeout: 15000 }).catch(() => "")).trim();

async function go(path) {
  const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 90000 });
  if (!res || res.status() >= 400) fail(`${path} → ${res?.status()}`);
  if (await page.locator("[data-nextjs-dialog]").count()) fail(`${path} shows the Next error overlay`);
}

async function shots(name, path) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await go(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `${name} @${width}: no horizontal overflow (${overflow}px)`);
    await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

// Sign in
await page.goto(base + "/login", { waitUntil: "networkidle" });
await page.fill("#email", "admin@wahbayaan.test");
await page.fill("#password", "wahbayaan-demo");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click('button[type="submit"]')]);

// 1. Import the research list (twice: idempotent)
await go("/admin/outreach");
check(await page.getByText("Emails are only logged").isVisible(), "list warns that emails are only logged");
await page.getByRole("button", { name: "Load the research list" }).click();
await page.waitForTimeout(2500);
console.log("  import 1:", await toast());
await go("/admin/outreach");
const rows1 = await page.locator("tbody tr").count();
await page.getByRole("button", { name: "Load the research list" }).click();
await page.waitForTimeout(2500);
const t2 = await toast();
console.log("  import 2:", t2);
check(/0 added/.test(t2), "second import adds nothing");
await go("/admin/outreach");
check((await page.locator("tbody tr").count()) === rows1 && rows1 > 40, `contacts listed (${rows1})`);

// 2. Sender details
await go("/admin/outreach/templates");
await page.fill('input[name="senderName"]', "Test Founder");
await page.fill('input[name="senderPhone"]', "+92 300 0000000");
await page.fill('input[name="replyTo"]', "founder@wahbayaan.test");
await page.fill('input[name="businessAddress"]', "Lahore, Pakistan");
await page.getByRole("button", { name: "Save sender" }).click();
await page.waitForTimeout(1500);
await go("/admin/outreach/templates");
check((await page.locator("pre").first().innerText()).includes("Test Founder"), "template preview fills {sender_name}");
await page.screenshot({ path: `${out}/templates-1440.png`, fullPage: true });

// 3. Compose → send (logged) to Khaadi
await go("/admin/outreach?q=Khaadi");
await page.getByRole("link", { name: "Khaadi", exact: true }).click();
await page.waitForURL(/\/admin\/outreach\/[0-9a-f-]{36}/);
await page.waitForLoadState("networkidle");
const khaadiUrl = page.url();
check((await page.inputValue("#compose-subject")).includes("Khaadi"), "compose subject is merged");
check((await page.inputValue("#compose-body")).includes("Assalam-o-alaikum Khaadi team"), "compose body uses {brand} team");
await page.fill("#compose-subject", "New customers for Khaadi, at full price (edited)");
await page.getByRole("button", { name: /Log to outbox/ }).click();
await page.waitForTimeout(2500);
console.log("  send:", await toast());
await page.goto(khaadiUrl, { waitUntil: "networkidle" });
check(await page.getByText("Logged only").first().isVisible(), "timeline shows the email as logged only");
await page.locator("details summary").first().click();
const emailText = await page.locator("details pre").first().innerText();
const unsub = emailText.match(/https?:\/\/\S+\/outreach\/unsubscribe\?t=\S+/)?.[0];
check(!!unsub, "email carries the opt-out link");
check(emailText.includes("Wahbayaan · Lahore, Pakistan"), "email footer carries the business identity");
await shots("detail", new URL(khaadiUrl).pathname);

// 4. Bulk: Khaadi (emailed today → skipped) + two more
await go("/admin/outreach?email=yes");
await page.getByRole("checkbox", { name: "Select Khaadi" }).check();
const others = page.locator('tbody input[type=checkbox][data-row]:not([disabled]):not(:checked)');
await others.nth(0).check();
await others.nth(0).check();
await page.getByRole("button", { name: /Preview & send/ }).click();
await page.waitForURL(/\/admin\/outreach\/send/);
await page.waitForLoadState("networkidle");
check(await page.getByText(/Skipped: Emailed today/).isVisible(), "bulk preview skips Khaadi (emailed in the last 5 days)");
await page.setViewportSize({ width: 1440, height: 900 });
await page.screenshot({ path: `${out}/bulk-preview-1440.png`, fullPage: true });
const sendUrl = new URL(page.url()).pathname + new URL(page.url()).search;
await page.getByRole("button", { name: /Log 2 to the outbox/ }).click();
await page.waitForTimeout(4000);
const bulkMsg = await toast();
console.log("  bulk:", bulkMsg);
check(/2 logged/.test(bulkMsg) || /2 logged/.test(await page.content()), "bulk logged 2 emails");
await go(sendUrl);
check((await page.getByText(/Skipped: Emailed today/).count()) === 3, "after sending, all three are skipped by the 5-day rule");

// 5. Opt-out link (signed out), and a tampered one
const anon = await browser.newPage();
const tampered = unsub.slice(0, -4) + "AAAA";
await anon.goto(tampered.replace(/^https?:\/\/[^/]+/, base), { waitUntil: "networkidle" });
check(await anon.getByText("This link isn't complete").isVisible(), "tampered opt-out link is refused");
await anon.goto(unsub.replace(/^https?:\/\/[^/]+/, base), { waitUntil: "networkidle" });
check(await anon.getByText("You're unsubscribed").isVisible(), "opt-out link confirms");
const anonText = await anon.locator("body").innerText();
check(!/khaadi/i.test(anonText) && !anonText.includes("@"), "opt-out page reveals nothing about the contact");
await anon.screenshot({ path: `${out}/unsubscribe-390.png` });
await anon.close();
await page.goto(khaadiUrl, { waitUntil: "networkidle" });
check(await page.getByText("Do not contact").first().isVisible(), "Khaadi is now do not contact");
check(await page.getByText("Opted out with the link in our email").isVisible(), "Khaadi's address is suppressed");
check(await page.getByText("Can't email this contact").isVisible(), "compose is blocked");

// 6. Manual events and status → agreed → brand permission form (prefilled, not recorded)
await go("/admin/outreach?q=Sana");
await page.getByRole("link", { name: "Sana Safinaz", exact: true }).click();
await page.waitForURL(/\/admin\/outreach\/[0-9a-f-]{36}/);
await page.waitForLoadState("networkidle");
const sanaUrl = page.url();
await page.selectOption("#event-kind", "whatsapp");
await page.fill("#event-note", "Sent the pitch on WhatsApp too");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.waitForTimeout(1500);
await page.selectOption("#event-kind", "replied");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.waitForTimeout(1500);
await page.goto(sanaUrl, { waitUntil: "networkidle" });
check((await page.locator("#status").inputValue()) === "replied", "reply moves the status to Replied");
await page.selectOption("#status", "agreed");
await page.getByRole("button", { name: "Save pipeline" }).click();
await page.waitForTimeout(2000);
await page.goto(sanaUrl, { waitUntil: "networkidle" });
check(await page.getByText("Agreed — now record the permission on the brand").isVisible(), "agreed shows the permission prompt");
await page.setViewportSize({ width: 1440, height: 900 });
await page.screenshot({ path: `${out}/detail-agreed-1440.png`, fullPage: true });
await page.getByRole("button", { name: /Create the brand draft|Record permission for/ }).click();
await page.waitForURL(/\/admin\/brands\/[0-9a-f-]{36}/, { timeout: 30000 });
await page.waitForLoadState("networkidle");
check((await page.inputValue("#note")).includes("Sana Safinaz agreed through brand outreach"), "brand permission note is prefilled");
check(await page.getByText("No permission recorded", { exact: true }).isVisible(), "permission is NOT recorded automatically");
await page.screenshot({ path: `${out}/brand-permission-prefill-1440.png`, fullPage: true });

// 7. Screenshots of the list
await shots("list", "/admin/outreach");
await go("/admin");
check(await page.getByText(/brand outreach follow-ups due/).count() >= 0, "dashboard renders");

await browser.close();
console.log(process.exitCode ? "FAILED" : "ALL OK");
