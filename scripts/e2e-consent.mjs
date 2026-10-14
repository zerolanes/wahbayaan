// Cookie consent + visitor statistics, end to end against a running server.
//
//   BASE=http://localhost:3000 AXE_PATH=/path/to/axe-core/axe.min.js node scripts/e2e-consent.mjs
//
// Needs demo data (admin@wahbayaan.test / wahbayaan-demo). axe-core is not a
// project dependency: install it anywhere outside the repo
// (`npm i axe-core --prefix /tmp/axe`) and point AXE_PATH at axe.min.js.
// Screenshots go to SHOTS (default ./screenshots/consent). Note: the run raises
// the consent version once and leaves the banner on the default bar preset.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "screenshots/consent";
const AXE_PATH = process.env.AXE_PATH ?? "/tmp/axe/node_modules/axe-core/axe.min.js";
const CHROME = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const LAYOUTS = ["bar", "dialog", "corner", "top", "bar-dark", "dialog-dark"];
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let failed = 0;
function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
// Reduced motion: no slide-in animation and no hero autoplay, which keeps runs stable on a busy machine.
const visitor = (width = 1440, ua = UA) => browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, userAgent: ua, reducedMotion: "reduce" });

// ── Staff session (for settings and checking what was stored) ───────────────
const staffCtx = await visitor(1440);
const staff = await staffCtx.newPage();
staff.on("dialog", (d) => d.accept());
await staff.goto(`${BASE}/login`, { waitUntil: "networkidle" });
if (await staff.locator("[data-consent-action=continue]").count()) await staff.click("[data-consent-action=continue]");
await staff.fill("#email", "admin@wahbayaan.test");
await staff.fill("#password", "wahbayaan-demo");
await Promise.all([staff.waitForURL((u) => !u.pathname.startsWith("/login")), staff.click('button[type="submit"]')]);

async function csvRows(type, q) {
  const res = await staff.request.get(`${BASE}/admin/export/analytics?type=${type}&q=${encodeURIComponent(q)}`);
  const text = (await res.text()).replace(/^﻿/, "").trim();
  return text.split(/\r\n/).slice(1).filter(Boolean);
}
async function waitForRows(type, q, min, tries = 20) {
  let rows = [];
  for (let i = 0; i < tries; i++) {
    rows = await csvRows(type, q);
    if (rows.length >= min) return rows;
    await sleep(500);
  }
  return rows;
}
async function setBanner(layout, floatingButton = false) {
  await staff.goto(`${BASE}/admin/analytics/settings`, { waitUntil: "networkidle" });
  const form = staff.locator("form:has(select[name=layout])");
  await form.locator("select[name=layout]").selectOption(layout);
  const box = form.locator("input[name=floatingButton]");
  if ((await box.isChecked()) !== floatingButton) await box.click();
  await form.locator("button[type=submit]").click();
  await staff.waitForTimeout(1200);
}
const consentOf = async (ctx) => {
  const c = (await ctx.cookies()).find((x) => x.name === "wb_consent");
  return c ? JSON.parse(decodeURIComponent(c.value)) : null;
};

async function axe(page, label) {
  if (!fs.existsSync(AXE_PATH)) return check(`axe ${label}`, false, `axe-core not found at ${AXE_PATH}`);
  await page.addScriptTag({ path: AXE_PATH });
  const r = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const res = await axe.run({ include: ["[data-consent-banner]"] }, { runOnly: ["wcag2a", "wcag2aa"] });
    return res.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target}`);
  });
  check(`axe WCAG 2 AA ${label}`, r.length === 0, r.join("; "));
}

try {
  // ── 1. Screenshots + axe for every layout preset ─────────────────────────
  for (const layout of LAYOUTS) {
    await setBanner(layout);
    for (const width of layout === "bar" ? [390, 768, 1440] : [390, 1440]) {
      const ctx = await visitor(width);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const shown = await p.locator("[data-consent-banner]").isVisible();
      check(`banner visible (${layout}, ${width}px)`, shown);
      await p.screenshot({ path: path.join(SHOTS, `${layout}-${width}-main.png`) });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      check(`no horizontal scroll (${layout}, ${width}px)`, !overflow);
      if (width === 1440 || width === 390) await axe(p, `${layout} ${width}px main view`);
      await p.click("[data-consent-action=individual]");
      await p.locator(".wbc-more").first().click();
      await p.screenshot({ path: path.join(SHOTS, `${layout}-${width}-settings.png`) });
      if (width === 1440 || width === 390) await axe(p, `${layout} ${width}px settings view`);
      await ctx.close();
    }
  }
  await setBanner("bar");

  // ── 2. Keyboard: focus moves into the banner; dialog traps Tab ──────────
  {
    const ctx = await visitor(1440);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const inBanner = await p.evaluate(() => !!document.activeElement?.closest("[data-consent-banner]"));
    check("focus moves into the banner", inBanner);
    await ctx.close();
    await setBanner("dialog");
    const ctx2 = await visitor(1440);
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/`, { waitUntil: "networkidle" });
    let escaped = false;
    for (let i = 0; i < 12; i++) {
      await p2.keyboard.press("Tab");
      if (!(await p2.evaluate(() => !!document.activeElement?.closest("[data-consent-banner]")))) escaped = true;
    }
    check("dialog layout traps Tab", !escaped);
    await ctx2.close();
    await setBanner("bar");
  }

  // ── 3. Accept all → visit + page views stored (client navigation counts) ──
  let acceptedId;
  {
    const ctx = await visitor(1440);
    const p = await ctx.newPage();
    const collects = [];
    p.on("request", (r) => r.url().includes("/api/collect") && collects.push(r.postDataJSON()));
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    check("no beacon before a choice", collects.length === 0);
    await p.click("[data-consent-action=accept]");
    await p.waitForTimeout(600);
    check("banner closes after Accept all", !(await p.locator("[data-consent-banner]").count()));
    acceptedId = (await consentOf(ctx))?.id;
    check("consent cookie saved", !!acceptedId && (await consentOf(ctx)).categories.statistics === true);
    await p.click('header a[href="/shop"], a[href="/shop"]');
    await p.waitForURL(`${BASE}/shop`);
    await p.waitForTimeout(1500);
    const pvs = await waitForRows("pageviews", acceptedId, 2);
    check("Accept → page views stored (incl. client navigation)", pvs.length >= 2 && pvs.some((r) => r.includes("/shop")), `${pvs.length} rows`);
    const visits = await csvRows("visits", acceptedId);
    check("Accept → one visit stored", visits.length === 1, `${visits.length} visits`);
    const consent = await waitForRows("consent", acceptedId, 1);
    check("Accept → proof-of-consent record (accept_all, shortened IP)", consent.some((r) => r.includes("accept_all")), consent[0] ?? "");
    check("window.Consent API", await p.evaluate(() => typeof window.Consent?.whenAllowed === "function" && window.Consent.has("statistics") === true));

    // #cookie-settings reopens; individual settings save
    await p.click('footer a[href="#cookie-settings"]');
    await p.waitForSelector(".wbc-panel[data-view=settings]");
    check("#cookie-settings reopens the individual settings", true);
    await p.locator("[data-consent-group=statistics]").uncheck();
    await p.locator("[data-consent-group=functional]").check();
    await p.click("[data-consent-action=save]");
    await p.waitForTimeout(600);
    const after = await consentOf(ctx);
    check("individual settings saved", after?.categories.statistics === false && after?.categories.functional === true && after?.id === acceptedId);
    const custom = await waitForRows("consent", acceptedId, 2);
    check("custom decision recorded", custom.some((r) => r.includes(",custom,")));
    const before = (await csvRows("pageviews", acceptedId)).length;
    await p.goto(`${BASE}/artisans`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    check("no page views after Statistics was switched off", (await csvRows("pageviews", acceptedId)).length === before);
    await ctx.close();
  }

  // ── 4. Continue without consent → nothing stored, no notice ─────────────
  {
    const ctx = await visitor(390);
    const p = await ctx.newPage();
    const collects = [];
    p.on("request", (r) => r.url().includes("/api/collect") && collects.push(r.url()));
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await p.click("[data-consent-action=continue]");
    await p.waitForTimeout(500);
    const id = (await consentOf(ctx))?.id;
    await p.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1000);
    const text = (await p.locator("body").innerText()).toLowerCase();
    check("Continue without consent → no beacon sent", collects.length === 0, `${collects.length} requests`);
    check("Continue without consent → no notice", !/not tracking|without consent/.test(text) && !(await p.locator("[data-consent-banner]").count()));
    check("Continue without consent → nothing stored", (await csvRows("visits", id)).length === 0 && (await csvRows("pageviews", id)).length === 0);
    const rec = await waitForRows("consent", id, 1);
    check("Continue without consent → essentials proof record", rec.some((r) => r.includes("essentials")));
    await ctx.close();
  }

  // ── 5. Bots and the privacy page ─────────────────────────────────────────
  {
    const html = await (await fetch(`${BASE}/`, { headers: { "user-agent": BOT_UA } })).text();
    check("bot UA gets no banner markup", !html.includes("data-consent-banner"));
    const ctx = await visitor(1440, BOT_UA);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    check("bot browser sees no banner", !(await p.locator("[data-consent-banner]").count()));
    await ctx.close();
    const human = await (await fetch(`${BASE}/`, { headers: { "user-agent": UA } })).text();
    check("human gets the banner in the first HTML", human.includes("data-consent-banner"));
    const ctx2 = await visitor(1440);
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/privacy`, { waitUntil: "networkidle" });
    await p2.waitForTimeout(500);
    check("/privacy shows no banner", !(await p2.locator("[data-consent-banner]").count()));
    check("privacy policy names the cookies", (await p2.locator("main").innerText()).includes("wb_consent"));
    await p2.click('main a[href="#cookie-settings"]');
    check("privacy page link opens the settings", await p2.locator(".wbc-panel[data-view=settings]").isVisible());
    await ctx2.close();
  }

  // ── 6. Floating button: revoke reloads and asks again ───────────────────
  {
    await setBanner("bar", true);
    const ctx = await visitor(390);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await p.click("[data-consent-action=accept]");
    const id = (await consentOf(ctx))?.id;
    await p.click(".wbc-fab-button");
    check("floating menu shows the consent id", (await p.locator(".wbc-fab-menu").innerText()).includes(id));
    const fabBox = await p.locator(".wbc-fab-button").boundingBox();
    const tabBox = await p.locator("[data-tab-bar]").boundingBox();
    check("floating button sits above the phone tab bar", !!fabBox && !!tabBox && fabBox.y + fabBox.height <= tabBox.y + 4);
    await p.screenshot({ path: path.join(SHOTS, "floating-menu-390.png") });
    await Promise.all([p.waitForEvent("load"), p.click("text=Revoke consents")]);
    await p.waitForTimeout(800);
    check("revoke reloads and shows the banner again", await p.locator("[data-consent-banner]").isVisible());
    check("revoke recorded", (await waitForRows("consent", id, 2)).some((r) => r.includes("revoke")));
    await ctx.close();
    await setBanner("bar", false);
  }

  // ── 7. Raising the consent version re-asks ──────────────────────────────
  {
    const ctx = await visitor(1440);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await p.click("[data-consent-action=accept]");
    await p.reload({ waitUntil: "networkidle" });
    check("choice remembered across reloads", !(await p.locator("[data-consent-banner]").count()));
    await staff.goto(`${BASE}/admin/analytics/settings`, { waitUntil: "networkidle" });
    await staff.locator("form button:has-text('Raise to version')").click();
    await staff.waitForTimeout(1200);
    await p.reload({ waitUntil: "networkidle" });
    check("consent version bump re-asks", await p.locator("[data-consent-banner]").isVisible());
    await ctx.close();
  }

  // ── 7b. ConsentEmbed: no third-party request before consent ─────────────
  {
    const setStoryVideo = async (url) => {
      await staff.goto(`${BASE}/admin/artisans?q=Noor`, { waitUntil: "networkidle" });
      await staff.locator('main a[href^="/admin/artisans/"]').first().click();
      await staff.waitForSelector("input[name=storyVideoUrl]");
      const form = staff.locator("form:has(input[name=storyVideoUrl])");
      await form.locator("input[name=storyVideoUrl]").fill(url);
      await form.locator("button[type=submit]").last().click();
      await staff.waitForTimeout(1500);
    };
    await setStoryVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const ctx = await visitor(1440);
    const p = await ctx.newPage();
    const thirdParty = [];
    p.on("request", (r) => /youtube|ytimg|vimeo/.test(new URL(r.url()).hostname) && thirdParty.push(r.url()));
    await p.goto(`${BASE}/artisans/noor-calligraphy-atelier`, { waitUntil: "networkidle" });
    await p.click("[data-consent-action=continue]");
    const embed = p.locator("[data-consent-embed=youtube]");
    await embed.scrollIntoViewIfNeeded();
    check("embed shows a click-to-load placeholder", (await embed.innerText()).includes("hosted by a third-party service"));
    check("no YouTube request before consent", thirdParty.length === 0, thirdParty.join(", "));
    await p.screenshot({ path: path.join(SHOTS, "embed-placeholder.png") });
    await embed.locator("button:has-text('Load video')").click();
    check("“Load video” loads the iframe once", (await embed.locator("iframe").count()) === 1 && (await consentOf(ctx))?.categories.functional === false);
    await p.reload({ waitUntil: "networkidle" });
    await embed.locator("button:has-text('Always allow media')").click();
    await p.waitForTimeout(300);
    check("“Always allow media” grants Functional", (await consentOf(ctx))?.categories.functional === true && (await embed.locator("iframe").count()) === 1);
    await ctx.close();
    await setStoryVideo("");
  }

  // ── 8. Admin screens render ─────────────────────────────────────────────
  for (const [name, url] of [
    ["statistics", "/admin/analytics?period=today"],
    ["live", "/admin/analytics/live"],
    ["journeys", "/admin/analytics/visits"],
    ["consent-log", "/admin/analytics/consent"],
    ["settings", "/admin/analytics/settings"],
    ["banner-editor", "/admin/privacy/banner"],
  ]) {
    const r = await staff.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    check(`admin ${name} renders`, r?.status() === 200);
    await staff.screenshot({ path: path.join(SHOTS, `admin-${name}.png`), fullPage: true });
  }
  for (const url of ["/admin/analytics", "/admin/analytics/live"]) {
    await staff.goto(`${BASE}${url}`);
    // Background mode: the root takes no space (its layers are fixed behind the page), so wait for it to be attached and loaded, not "visible".
    const mounted = await staff.locator('[data-visitor-map][data-loaded="1"]').first().waitFor({ state: "attached", timeout: 30000 }).then(() => true, () => false);
    check(`visitor map mounted on ${url}`, mounted);
  }
  const map = await staff.request.get(`${BASE}/admin/api/analytics/map?range=24h&live=1`);
  const mapJson = await map.json();
  check("map API returns the contract", map.status() === 200 && Array.isArray(mapJson.places) && Array.isArray(mapJson.countries) && "latest" in mapJson);
  const anon = await fetch(`${BASE}/admin/api/analytics/map`);
  check("map API is staff-only", anon.status === 401);
} catch (err) {
  check("script error", false, err instanceof Error ? err.stack : String(err));
} finally {
  await browser.close();
}

console.log(results.join("\n"));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
