// node scripts/shots-as.mjs <email> <prefix> <path1> <path2> ...  → screenshots/<prefix>-<slug>.png (full page)
import { chromium } from "@playwright/test";
const [, , email, prefix, ...paths] = process.argv;
const base = process.env.BASE ?? "http://localhost:3000";
const width = Number(process.env.W ?? 1440);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto(base + "/login", { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", process.env.PW ?? "wahbayaan-demo");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click('button[type="submit"]')]);
for (const p of paths) {
  const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 90000 });
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 700) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(80); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const overlay = await page.locator("[data-nextjs-dialog], [data-nextjs-dialog-overlay]").count();
  const slug = p.replace(/^\//, "").replace(/[/?=&]/g, "_") || "root";
  await page.screenshot({ path: `screenshots/${prefix}-${slug}.png`, fullPage: true });
  console.log(res?.status(), p, overlay ? "(ERROR OVERLAY)" : "");
}
await browser.close();
