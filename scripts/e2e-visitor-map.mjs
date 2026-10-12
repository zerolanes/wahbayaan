// End-to-end checks for the admin visitor map, on the fixture demo page.
//
//   BASE=http://localhost:3110 node scripts/e2e-visitor-map.mjs
//
// Needs `next dev` (the fixture route is off in production) and the demo data
// (admin@wahbayaan.test / wahbayaan-demo). The map exposes its state on the
// root element — data-zoom, data-center, data-markers, data-clusters,
// data-fly-phase, data-animating, data-pinned — and a recorder below logs every
// change, so assertions don't depend on the machine's frame rate. Timings are
// shortened through window.__VM_TEST__.
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3110";
const PAGE = "/admin/visitor-map";
const EMAIL = process.env.EMAIL ?? "admin@wahbayaan.test";
const PASSWORD = process.env.PW ?? "wahbayaan-demo";
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, "i") : null;

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

let failures = 0;
const results = [];
async function test(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t0 = Date.now();
  try {
    await fn();
    results.push(`✓ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    failures++;
    results.push(`✗ ${name}: ${e.message.split("\n")[0]}`);
  }
  console.log(results[results.length - 1]);
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const close = (a, b, tol) => Math.abs(a - b) <= tol;

async function storageState() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 120000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 }), page.click('button[type="submit"]')]);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}
const state = await storageState();

/** Records every attribute change on the map root: { t, zoom, center, phase, anim, clusters, markers }. */
function recorder() {
  window.__VM_REC__ = [];
  const snap = (el) => ({
    t: performance.now(),
    zoom: Number(el.dataset.zoom),
    center: el.dataset.center,
    phase: el.dataset.flyPhase,
    anim: el.dataset.animating,
    clusters: Number(el.dataset.clusters),
    markers: Number(el.dataset.markers),
  });
  const attach = () => {
    const el = document.querySelector("[data-visitor-map]");
    if (!el) return setTimeout(attach, 30);
    window.__VM_REC__.push(snap(el));
    new MutationObserver(() => window.__VM_REC__.push(snap(el))).observe(el, { attributes: true });
  };
  attach();
}

/** Open the demo page with test hooks. By default the opening flight is pushed far into the future. */
async function open({ hooks = { startDelayMs: 1e9 }, reducedMotion = "no-preference", hasTouch = false, viewport = { width: 1440, height: 900 }, query = "?table=0" } = {}) {
  const ctx = await browser.newContext({ storageState: state, viewport, reducedMotion, hasTouch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((h) => {
    window.__VM_TEST__ = h;
  }, hooks);
  await page.addInitScript(recorder);
  await page.goto(BASE + PAGE + query, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('[data-visitor-map][data-loaded="1"]') && Number(document.querySelector("[data-visitor-map]").dataset.markers) > 0, null, { timeout: 60000, polling: 50 });
  return { ctx, page, errors };
}
const attr = (page, name) => page.evaluate((n) => document.querySelector("[data-visitor-map]")?.getAttribute(n), name);
const zoom = async (page) => Number(await attr(page, "data-zoom"));
const mark = (page) => page.evaluate(() => window.__VM_REC__.length);
const since = (page, i) => page.evaluate((n) => window.__VM_REC__.slice(n), i);
/** Wait until a predicate over the root's dataset holds. */
const until = (page, pred, timeout = 15000) => page.waitForFunction(new Function(`const d = document.querySelector("[data-visitor-map]").dataset; return (${pred})(d);`), null, { timeout, polling: 25 });
const settled = (page, timeout = 15000) => until(page, `(d) => d.animating === "0"`, timeout);

/** A point over open map, away from page cards and crosses. */
async function emptyPoint(page) {
  return page.evaluate(() => {
    const markers = window.__VM_TEST__.api.markers();
    for (let x = 900; x < 1400; x += 20)
      for (let y = 220; y < 600; y += 20) {
        const el = document.elementFromPoint(x, y);
        if (el?.tagName !== "CANVAS") continue;
        if (markers.some((m) => Math.hypot(m.x - x, m.y - y) < 40)) continue;
        return { x, y };
      }
    return { x: 1000, y: 420 };
  });
}

await test("wheel does nothing before the map is clicked, zooms after", async () => {
  const { ctx, page } = await open();
  const p = await emptyPoint(page);
  const z0 = await zoom(page);
  assert(close(z0, 1, 0.001), `starts at the whole world (zoom ${z0})`);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, -300);
  await page.waitForSelector(".vm-hint", { timeout: 5000 });
  const hint = await page.locator(".vm-hint").textContent();
  assert(/Click the map, then scroll to zoom \((or Ctrl|or ⌘) \+ scroll\)/.test(hint ?? ""), `hint shown (${hint})`);
  await page.waitForTimeout(300);
  assert(close(await zoom(page), z0, 0.001), "plain wheel must not zoom before a click");
  await page.mouse.click(p.x, p.y);
  await until(page, `(d) => d.wheelActive === "1"`, 5000);
  await page.mouse.wheel(0, -300);
  // One event of −300 px: e^(300·0.0022) = 1.93, capped per event at e^0.5 = 1.65.
  await until(page, `(d) => Math.abs(Number(d.zoom) - Math.exp(0.5)) < 0.02`, 8000).catch(() => {});
  await settled(page);
  const z1 = await zoom(page);
  assert(close(z1, Math.exp(0.5), 0.02), `zoomed by the capped exponential factor (zoom ${z1})`);
  // Clicking outside turns plain wheel off again; Ctrl + wheel still zooms.
  await page.mouse.click(400, 160);
  await until(page, `(d) => d.wheelActive === "0"`, 5000);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(300);
  assert(close(await zoom(page), z1, 0.001), "deactivated after clicking outside");
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 100);
  await page.keyboard.up("Control");
  const want = z1 * Math.exp(-0.22);
  await until(page, `(d) => Math.abs(Number(d.zoom) - ${want}) < 0.02`, 8000).catch(() => {});
  assert(close(await zoom(page), want, 0.02), `ctrl+wheel zooms out by e^(−100·0.0022) (zoom ${await zoom(page)})`);
  await ctx.close();
});

await test("+ and − buttons zoom 1.6× around the centre (animated); Home resets; keyboard", async () => {
  // Durations ×5 so the in-between frames are observable even on a loaded CI machine.
  const { ctx, page } = await open({ hooks: { startDelayMs: 1e9, animScale: 5 } });
  const centre0 = await attr(page, "data-center");
  await page.click(".vm-more > summary");
  let m = await mark(page);
  await page.click('[data-control="zoom-in"]');
  await until(page, `(d) => d.animating === "0" && Math.abs(Number(d.zoom) - 1.6) < 0.005`, 15000);
  const frames = (await since(page, m)).map((r) => r.zoom);
  assert(frames.some((z) => z > 1.001 && z < 1.599) || (await since(page, m)).some((r) => r.anim === "1"), `zoom animated through intermediate values (${frames.join(", ")})`);
  assert((await attr(page, "data-center")) === centre0, "centre unchanged");
  await page.click('[data-control="zoom-in"]');
  await until(page, `(d) => d.animating === "0" && Math.abs(Number(d.zoom) - 2.56) < 0.01`, 8000);
  await page.click('[data-control="zoom-out"]');
  await until(page, `(d) => d.animating === "0" && Math.abs(Number(d.zoom) - 1.6) < 0.005`, 8000);
  // Keyboard: focus the map, + zooms, arrows pan, Home resets.
  await page.focus(".vm-map-area");
  await page.keyboard.press("+");
  await until(page, `(d) => d.animating === "0" && Math.abs(Number(d.zoom) - 2.56) < 0.01`, 8000);
  await page.keyboard.press("ArrowLeft");
  await until(page, `(d) => d.center !== ${JSON.stringify(centre0)}`, 5000);
  await page.keyboard.press("Home");
  await until(page, `(d) => d.animating === "0" && Math.abs(Number(d.zoom) - 1) < 0.005`, 8000);
  assert((await attr(page, "data-center")) === centre0, `Home key returns to the start view (${await attr(page, "data-center")})`);
  await page.click('[data-control="zoom-in"]');
  await settled(page);
  m = await mark(page);
  await page.click('[data-control="home"]');
  await until(page, `(d) => d.animating === "0" && Math.abs(Number(d.zoom) - 1) < 0.005`, 8000);
  assert((await attr(page, "data-center")) === centre0, "Home button returns to the start view");
  await ctx.close();
});

await test("two-finger pinch zooms around the fingers (CDP touch events)", async () => {
  const { ctx, page } = await open({ hasTouch: true });
  const p = await emptyPoint(page);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  const z0 = await zoom(page);
  await touch("touchStart", [
    [p.x - 30, p.y],
    [p.x + 30, p.y],
  ]);
  for (let i = 1; i <= 10; i++) {
    await touch("touchMove", [
      [p.x - 30 - i * 9, p.y],
      [p.x + 30 + i * 9, p.y],
    ]);
  }
  await touch("touchEnd", []);
  // Fingers went from 60 px to 240 px apart → 4×.
  await until(page, `(d) => Number(d.zoom) > 3.5`, 8000).catch(() => {});
  const z1 = await zoom(page);
  assert(close(z1, 4 * z0, 0.25), `pinch zoomed ~4× (zoom ${z1})`);
  await ctx.close();
});

await test("crosses merge into clusters at world view and split as you zoom in; clicking a cluster flies in", async () => {
  const { ctx, page } = await open({ hooks: { startDelayMs: 1e9, animScale: 4 } });
  const clusters0 = Number(await attr(page, "data-clusters"));
  assert(clusters0 > 0, `clusters at world view (${clusters0})`);
  const before = await page.evaluate(() => window.__VM_TEST__.api.markers());
  const karachi = before.find((m) => m.memberIds.includes("pk:sindh:clifton"));
  assert(karachi?.memberIds.includes("pk:sindh:defence"), "places 2 km apart are merged at world view");
  const uk = before.find((m) => m.memberIds.includes("gb:england:london"));
  assert(uk && uk.count >= 3, `London is in a cluster at world view (${uk?.count})`);
  const m = await mark(page);
  await page.mouse.click(uk.x, uk.y);
  await until(page, `(d) => Number(d.zoom) > 2`, 8000);
  await settled(page);
  const rec = await since(page, m);
  assert(rec.length > 2, "flew in over several frames");
  const after = await page.evaluate(() => window.__VM_TEST__.api.markers());
  const london = after.find((x) => x.memberIds.includes("gb:england:london"));
  assert(london && london.count < uk.count, `London's cluster split (${uk.count} → ${london?.count})`);
  const ukIds = new Set(uk.memberIds);
  const ukMarkers = after.filter((x) => x.memberIds.some((id) => ukIds.has(id)));
  assert(ukMarkers.length > 1, `the UK places are now ${ukMarkers.length} crosses`);
  await ctx.close();
});

await test("hover shows a tooltip with flag; click pins and filters the table; Esc unpins", async () => {
  const { ctx, page } = await open();
  const uk = (await page.evaluate(() => window.__VM_TEST__.api.markers())).find((m) => m.memberIds.includes("gb:england:london"));
  await page.mouse.click(uk.x, uk.y);
  await until(page, `(d) => Number(d.zoom) > 2`, 8000);
  await settled(page);
  const singles = (await page.evaluate(() => window.__VM_TEST__.api.markers())).filter((m) => m.count === 1 && m.memberIds[0].startsWith("gb:"));
  const single = singles.find((m) => m.x > 880 && m.x < 1400 && m.y > 120 && m.y < 620) ?? singles[0];
  assert(single, `a single UK cross is visible (${singles.length})`);
  await page.mouse.move(single.x, single.y);
  await page.waitForSelector("[data-vm-tooltip]", { timeout: 5000 });
  const tip = await page.locator("[data-vm-tooltip]").textContent();
  assert(/Visits/.test(tip) && /Unique visitors/.test(tip) && /Last seen/.test(tip), `tooltip content (${tip})`);
  assert((await page.locator("[data-vm-tooltip] svg[data-flag='GB']").count()) === 1, "tooltip has the GB flag");
  await page.mouse.click(single.x, single.y);
  await page.waitForFunction(() => new URL(location.href).searchParams.get("place")?.startsWith("GB:"), null, { timeout: 8000, polling: 50 });
  const place = await page.evaluate(() => new URL(location.href).searchParams.get("place"));
  assert((await attr(page, "data-pinned")) === place, `pinned ${place}`);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !new URL(location.href).searchParams.get("place"), null, { timeout: 8000, polling: 50 });
  assert((await attr(page, "data-pinned")) === "", "Esc unpinned");
  // The host page reads the param: the demo table filters to the pinned place.
  await page.goto(`${BASE}${PAGE}?place=${encodeURIComponent(place)}`, { waitUntil: "networkidle" });
  const text = await page.locator("main").textContent();
  assert(text.includes(`Filtered to ${place.replace(":", " · ")}`), "the table filtered to the pinned place");
  await ctx.close();
});

await test("opening flies to the latest visit (zoom level 5), shows the visit card, holds, then flies home", async () => {
  const { ctx, page, errors } = await open({ hooks: { startDelayMs: 300, flyMs: 900, holdMs: 1200, homeMs: 900 } });
  await until(page, `(d) => d.flyPhase === "hold"`, 15000);
  const z = await zoom(page);
  assert(close(z, 16, 0.01), `zoom level 5 = 16× (got ${z})`);
  const [lng, lat] = (await attr(page, "data-center")).split(",").map(Number);
  assert(close(lng, -74.006, 0.05) && close(lat, 40.713, 0.05), `centred on the latest visit, New York (${lng},${lat})`);
  const card = await page.locator("[data-vm-new-visit]").textContent();
  assert(/New York/.test(card), `visit card shows the city (${card})`);
  assert((await page.locator("[data-vm-new-visit] svg[data-flag='US']").count()) === 1, "visit card has the US flag (SVG)");
  await until(page, `(d) => d.flyPhase === "idle"`, 15000);
  const rec = await since(page, 0);
  const phases = rec.map((r) => r.phase).filter((p, i, a) => p !== a[i - 1]);
  assert(phases.join(">").includes("to>hold>back>idle"), `phase order (${phases.join(" > ")})`);
  assert(rec.filter((r) => r.phase === "to").length > 2, "the flight was animated");
  assert(close(await zoom(page), 1, 0.005), "back home at the whole world");
  assert(!errors.length, errors.join("; "));
  await ctx.close();
});

await test("a new visit (latest changes on poll) flies again; a drag cancels the flight", async () => {
  const { ctx, page } = await open({ hooks: { startDelayMs: 1e9, pollMs: 500, flyMs: 6000, holdMs: 500, homeMs: 400 }, query: "?table=0&rotate=10" });
  await page.waitForFunction(() => document.querySelector("[data-vm-new-visit]")?.textContent.includes("New visit"), null, { timeout: 20000, polling: 50 });
  await until(page, `(d) => d.flyPhase === "to"`, 5000);
  const p = await emptyPoint(page);
  const m = await mark(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 40, p.y + 10, { steps: 4 });
  await page.mouse.up();
  // Under heavy load the next rotation can start a new flight soon after, so check the log:
  // the drag's pointer-down must have dropped the flight to idle.
  await until(page, `(d) => true`);
  const phases = (await since(page, m)).map((r) => r.phase);
  assert(phases.includes("idle"), `drag cancelled the flight (${phases.join(",")})`);
  await ctx.close();
});

await test("prefers-reduced-motion: jumps instead of flying or gliding", async () => {
  const { ctx, page } = await open({ hooks: { startDelayMs: 300, holdMs: 1e9 }, reducedMotion: "reduce" });
  assert((await attr(page, "data-reduced-motion")) === "1", "reduced motion detected");
  await until(page, `(d) => d.flyPhase === "hold"`, 10000);
  assert(close(await zoom(page), 16, 0.01), "at the visit");
  const zooms = (await since(page, 0)).map((r) => r.zoom);
  assert(!zooms.some((z) => z > 1.001 && z < 15.99), `jumped straight to the visit, no in-between frames (${[...new Set(zooms)].join(", ")})`);
  await page.click(".vm-more > summary");
  let m = await mark(page);
  await page.click('[data-control="home"]');
  await until(page, `(d) => Math.abs(Number(d.zoom) - 1) < 0.005`, 8000);
  assert(!(await since(page, m)).some((r) => r.zoom > 1.001 && r.zoom < 15.99), "Home jumps");
  m = await mark(page);
  await page.click('[data-control="zoom-in"]');
  await until(page, `(d) => Math.abs(Number(d.zoom) - 1.6) < 0.005`, 8000);
  assert(!(await since(page, m)).some((r) => r.zoom > 1.001 && r.zoom < 1.599), "+ jumps");
  assert(!(await since(page, 0)).some((r) => r.anim === "1"), "nothing ever animated");
  // A quick flick: the map follows the pointer exactly and doesn't glide on.
  const p = await emptyPoint(page);
  const before = (await page.evaluate(() => window.__VM_TEST__.api.markers())).filter((m) => m.x > 700 && m.x < 1400)[0];
  const cdp = await ctx.newCDPSession(page);
  const t0 = Date.now() / 1000;
  const ev = (type, x, i, buttons = 1) => cdp.send("Input.dispatchMouseEvent", { type, x, y: p.y, button: "left", buttons, clickCount: 1, timestamp: t0 + i * 0.012 });
  const burst = [ev("mouseMoved", p.x, 0, 0), ev("mousePressed", p.x, 0)];
  for (let i = 1; i <= 10; i++) burst.push(ev("mouseMoved", p.x - i * 12, i));
  burst.push(ev("mouseReleased", p.x - 120, 11, 0));
  await Promise.all(burst);
  await page.waitForTimeout(1000);
  const after = (await page.evaluate(() => window.__VM_TEST__.api.markers())).find((x) => x.id === before.id);
  assert(close(before.x - after.x, 120, 1.5), `moved exactly the drag distance, no glide (${(before.x - after.x).toFixed(1)} px)`);
  await ctx.close();
});

await test("drag pans; release keeps gliding briefly (inertia, ~300 ms)", async () => {
  const { ctx, page } = await open();
  const p = await emptyPoint(page);
  // Track one cross: it moves with the map, so its shift = drag + glide.
  const pick = (ms) => ms.filter((m) => m.x > 900 && m.x < 1400).sort((a, b) => b.x - a.x)[0];
  const before = pick(await page.evaluate(() => window.__VM_TEST__.api.markers()));
  // Send the whole flick in one burst, with event timestamps 12 ms apart (~2 px/ms),
  // released while still moving. Awaiting each step would add a round trip that reads
  // as "stopped, then let go".
  const cdp = await ctx.newCDPSession(page);
  const t0 = Date.now() / 1000;
  const ev = (type, x, i, buttons = 1) => cdp.send("Input.dispatchMouseEvent", { type, x, y: p.y, button: "left", buttons, clickCount: 1, timestamp: t0 + i * 0.012 });
  const burst = [ev("mouseMoved", p.x, 0, 0), ev("mousePressed", p.x, 0)];
  for (let i = 1; i <= 10; i++) burst.push(ev("mouseMoved", p.x - i * 25, i));
  burst.push(ev("mouseReleased", p.x - 250, 11, 0));
  const m = await mark(page);
  await Promise.all(burst);
  await page.waitForTimeout(1500);
  await settled(page);
  const after = (await page.evaluate(() => window.__VM_TEST__.api.markers())).find((x) => x.id === before.id);
  const shift = before.x - after.x;
  assert(shift > 250 + 100, `kept gliding after release: cross moved ${Math.round(shift)} px for a 250 px drag`);
  // Expected glide = v*tau = 2 px/ms x 100 ms = 200 px (~95% of it within 300 ms).
  assert(shift < 250 + 260, `glide decayed (${Math.round(shift)} px)`);
  const rec = await since(page, m);
  const anim = rec.filter((r) => r.anim === "1");
  if (anim.length > 1) assert(anim[anim.length - 1].t - anim[0].t < 900, "glide finished quickly");
  await ctx.close();
});

await browser.close();
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
