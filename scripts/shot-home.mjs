// Screenshots the 3D homepage at several tour stages: node scripts/shot-home.mjs [base] [stages...]
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:3000";
const stages = (process.argv[3] ?? "-1,0,1,2,5,8").split(",").map(Number);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.error("console:", m.text().slice(0, 300)));
await page.goto(base + "/", { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(6000);
for (const s of stages) {
  await page.evaluate((stage) => {
    const el = document.querySelector('section[aria-label="A walk through the crafts"]');
    const n = document.querySelectorAll('nav[aria-label="Crafts"] button').length;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const total = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (total * (stage + 1)) / (n + 1), behavior: "instant" });
  }, s);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `screenshots/home-stage-${s}.png` });
  const active = await page.evaluate(() => document.querySelector('section[aria-label="A walk through the crafts"]').dataset.active);
  console.log("saved stage", s, "active", active);
}
await browser.close();
