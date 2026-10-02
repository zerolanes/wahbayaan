// Acceptance check from the redesign brief, run against a local dev server.
// Usage: node scripts/acceptance.mjs (with `npm run dev` running and demo data seeded)
import { chromium } from "@playwright/test";
const base = "http://localhost:3000";
const get = async (p) => { const r = await fetch(base + p); return { status: r.status, html: await r.text() }; };
const out = [];
// 1. Homepage images all load (no gray placeholder tiles)
const home = await get("/");
const srcs = [...new Set([...home.html.matchAll(/(?:src|srcSet)="([^"]+)"/g)].map((m) => m[1].split(" ")[0]).filter((s) => s.startsWith("/")))];
const decoded = srcs.map((s) => (s.startsWith("/_next/image") ? decodeURIComponent(new URL(base + s).searchParams.get("url") ?? "") : s.replace(/&amp;/g, "&")));
let broken = [];
for (const s of decoded) { if (!s) continue; const r = await fetch(base + s); if (r.status !== 200) broken.push(`${r.status} ${s}`); }
out.push(`1. Homepage: ${decoded.length} images, broken: ${broken.length ? broken.join(", ") : "none"}`);
// 3. Every product page shows a landed-cost breakdown
const shop1 = (await get("/shop")).html + (await get("/shop?page=2")).html;
const slugs = [...new Set([...shop1.matchAll(/href="\/product\/([^"?#]+)"/g)].map((m) => m[1]))];
const noLc = [];
for (const s of slugs) { const { status, html } = await get("/product/" + s); if (status !== 200 || !/Landed cost/i.test(html)) noLc.push(`${status} ${s}`); }
out.push(`3. Product pages: ${slugs.length} checked, missing landed cost: ${noLc.length ? noLc.join(", ") : "none"}`);
// 2. Seller profiles: unique banners and copy
const art = (await get("/artisans")).html;
const vslugs = [...new Set([...art.matchAll(/href="\/artisans\/([^"?#]+)"/g)].map((m) => m[1]))];
const banners = new Map(), stories = new Map();
for (const v of vslugs) {
  const { html } = await get("/artisans/" + v);
  const b = html.match(/\/art\/banner\/[^"&]+/)?.[0] ?? "none";
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const tagline = text.match(/“([^”]{5,})”/)?.[1] ?? "";
  const story = text.match(/STORY (.{80})/i)?.[1] ?? "";
  if (!tagline || !story) out.push(`   (could not read copy for ${v})`);
  stories.set(tagline + "|" + story, [...(stories.get(tagline + "|" + story) ?? []), v]);
  banners.set(b, [...(banners.get(b) ?? []), v]);
}
const dupB = [...banners].filter(([k, v]) => k !== "none" && v.length > 1), dupS = [...stories].filter(([k, v]) => k && v.length > 1);
out.push(`2. Artisan profiles: ${vslugs.length}, shared banners: ${dupB.length ? JSON.stringify(dupB) : "none"}, shared story: ${dupS.length ? JSON.stringify(dupS.map(([,v])=>v)) : "none"}`);
// 4. Seller dashboard never shows buyer currencies
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext(); const p = await ctx.newPage();
await p.goto(base + "/login", { waitUntil: "networkidle" });
await p.fill("#email", "qila-rug-workshop@artisans.wahbayaan.test"); await p.fill("#password", "wahbayaan-demo");
await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.click('button[type="submit"]')]);
const mixed = [];
for (const path of ["/seller", "/seller/orders", "/seller/listings", "/seller/payouts", "/seller/reviews"]) {
  await p.goto(base + path, { waitUntil: "networkidle" });
  const text = await p.locator("main").innerText();
  const hits = text.match(/(US\$|C\$|£|\$\s?\d|\bUSD\b|\bGBP\b|\bCAD\b)/g);
  if (hits) mixed.push(`${path}: ${[...new Set(hits)].join(" ")}`);
}
out.push(`4. Artisan dashboard buyer-currency mentions: ${mixed.length ? mixed.join(" | ") : "none"}`);
await b.close();
console.log(out.join("\n"));
