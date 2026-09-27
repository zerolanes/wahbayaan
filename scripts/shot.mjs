// Usage: node scripts/shot.mjs <url-or-file> <out.png> [width] [height] [fullPage] [cookie=value;...]
import { chromium } from "@playwright/test";
const [, , target, out, w = "1440", h = "900", full = "false", cookieStr = ""] = process.argv;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
if (cookieStr) {
  const url = new URL(target);
  await context.addCookies(cookieStr.split(";").filter(Boolean).map((c) => { const [name, ...v] = c.split("="); return { name: name.trim(), value: v.join("="), domain: url.hostname, path: "/" }; }));
}
const page = await context.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
const url = /^https?:/.test(target) ? target : "file://" + new URL(target, "file://" + process.cwd() + "/").pathname;
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
if (full === "true") {
  // Scroll through so lazy images load.
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState("networkidle");
}
await page.waitForTimeout(1000);
await page.screenshot({ path: out, fullPage: full === "true" });
await browser.close();
console.log("saved", out);
