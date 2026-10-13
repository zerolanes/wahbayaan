// Screenshots of the admin visitor map (fixture demo page) into screenshots/vm-*.png.
//   BASE=http://localhost:3110 node scripts/shots-visitor-map.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3110";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const login = await browser.newContext();
{
  const page = await login.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 120000 });
  await page.fill("#email", "admin@wahbayaan.test");
  await page.fill("#password", "wahbayaan-demo");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 }), page.click('button[type="submit"]')]);
}
const state = await login.storageState();
await login.close();

async function open({
  width = 1440,
  height = 900,
  hooks = { startDelayMs: 1e9 },
  query = "",
  style = "dark",
  labels = false,
  mode = "places",
  mobile = false,
} = {}) {
  const ctx = await browser.newContext({
    storageState: state,
    viewport: { width, height },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await page.addInitScript(
    ([h, s]) => {
      window.__VM_TEST__ = h;
      // Pre-seed this admin's saved map settings (any user id key works: the map reads its own).
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) {
        if (typeof k === "string" && k.startsWith("wb:visitor-map:") && orig.call(this, k) == null) return JSON.stringify(s);
        return orig.call(this, k);
      };
    },
    [hooks, { style, labels, mode }],
  );
  await page.goto(BASE + "/admin/visitor-map" + query, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(() => Number(document.querySelector("[data-visitor-map]")?.dataset.markers) > 0, null, { timeout: 60000, polling: 100 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const settle = (page) =>
  page.waitForFunction(() => document.querySelector("[data-visitor-map]")?.dataset.animating === "0", null, { timeout: 30000, polling: 50 });
const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });
  console.log("saved", `${OUT}/${name}.png`);
};
const markers = (page) => page.evaluate(() => window.__VM_TEST__.api.markers());

// 1. Dark, desktop, whole world with the demo table floating over the map.
{
  const { ctx, page } = await open();
  await shot(page, "vm-dark-desktop");
  await ctx.close();
}
// 2. Light, desktop, with the settings panel open.
{
  const { ctx, page } = await open({ style: "light" });
  await shot(page, "vm-light-desktop");
  await page.click(".vm-more > summary");
  await page.click('[data-control="settings"]');
  await page.waitForTimeout(300);
  await shot(page, "vm-light-settings");
  await ctx.close();
}
// 3. Clusters: fly into the UK cluster with labels on; then hover a cross for the tooltip.
{
  const { ctx, page } = await open({ query: "?table=0", labels: true });
  await shot(page, "vm-clusters-world");
  // Click into UK clusters: each click flies in until the cross splits.
  for (let i = 0; i < 4; i++) {
    const group = (await markers(page)).filter((m) => m.count > 1 && m.memberIds.some((id) => id.startsWith("gb:"))).sort((a, b) => b.count - a.count)[0];
    if (!group) break;
    await page.mouse.click(group.x, group.y);
    await page.waitForTimeout(400);
    await settle(page);
    if (i === 0) {
      await page.waitForTimeout(600);
      await shot(page, "vm-clusters-split");
    }
  }
  await page.waitForTimeout(600);
  await shot(page, "vm-clusters-uk");
  const single = (await markers(page))
    .filter((m) => m.count === 1 && m.memberIds[0].startsWith("gb:") && m.y > 200 && m.y < 620 && m.x > 300 && m.x < 1080)
    .sort((a, b) => Math.hypot(a.x - 840, a.y - 450) - Math.hypot(b.x - 840, b.y - 450))[0];
  await page.mouse.move(single.x, single.y);
  await page.waitForSelector("[data-vm-tooltip]");
  await page.waitForTimeout(300);
  await shot(page, "vm-tooltip");
  await ctx.close();
}
// 4. New visit card: the opening flight to the latest visit.
{
  const { ctx, page } = await open({ hooks: { startDelayMs: 200, flyMs: 1500, holdMs: 60000 }, query: "?table=0" });
  await page.waitForFunction(() => document.querySelector("[data-visitor-map]")?.dataset.flyPhase === "hold", null, { timeout: 30000, polling: 50 });
  await page.waitForTimeout(800);
  await shot(page, "vm-new-visit");
  await ctx.close();
}
// 5. Top 10 with labels, light; Countries mode, dark.
{
  const { ctx, page } = await open({ style: "light", mode: "top10", labels: true, query: "?table=0" });
  await shot(page, "vm-light-top10");
  await ctx.close();
}
{
  const { ctx, page } = await open({ mode: "countries", query: "?table=0" });
  await shot(page, "vm-dark-countries");
  await ctx.close();
}
// 6. Card mode.
{
  const { ctx, page } = await open({ query: "?view=card" });
  await shot(page, "vm-card");
  await ctx.close();
}
// 7. Phone, 390 px: controls start collapsed.
for (const style of ["dark", "light"]) {
  const { ctx, page } = await open({ width: 390, height: 844, style, mobile: true });
  await shot(page, `vm-${style}-phone`);
  if (style === "dark") {
    await page.click('[data-control="collapse"]');
    await page.waitForTimeout(300);
    await shot(page, "vm-dark-phone-controls");
  }
  await ctx.close();
}
await browser.close();
