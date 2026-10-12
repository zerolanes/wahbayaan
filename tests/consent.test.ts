import { describe, expect, it } from "vitest";
import {
  ALL_ALLOWED,
  ESSENTIAL_ONLY,
  decisionFor,
  isBotUserAgent,
  isCurrent,
  isTrackablePath,
  newConsentId,
  parseConsent,
  readCookie,
  serializeConsent,
  statisticsConsentId,
  type ConsentState,
} from "@/lib/consent/core";
import { DEFAULT_CONSENT_BANNER, bannerCssVars, normalizeBanner } from "@/lib/consent/banner-settings";
import { parseVideoUrl } from "@/lib/consent/embeds";
import { serviceFootnotes, visibleGroups } from "@/lib/consent/services";
import { cleanPath, cleanReferrer, clientIp, cloudflareGeo, isPrivateIp, parseUserAgent, shortenIp } from "@/lib/analytics/request-info";
import { normalizeAnalytics } from "@/lib/analytics/settings-shape";
import { csvCell, toCsv } from "@/lib/admin/csv";

const state = (over: Partial<ConsentState> = {}): ConsentState => ({ v: 1, id: "a1b2c3d4e5f6a7b8c9d0e1f2", rev: 3, ts: 1_790_000_000_000, categories: { ...ESSENTIAL_ONLY, statistics: true }, ...over });

describe("consent cookie", () => {
  it("round-trips through serialize / parse", () => {
    const s = state();
    const raw = serializeConsent(s);
    expect(raw).not.toMatch(/[;,\s"]/); // cookie-safe
    expect(parseConsent(raw)).toEqual(s);
    expect(parseConsent(decodeURIComponent(raw))).toEqual(s);
  });

  it("always keeps essential on and coerces categories to booleans", () => {
    const raw = encodeURIComponent(JSON.stringify({ v: 1, id: "abcdefgh12", rev: 1, ts: 1, categories: { essential: false, statistics: "yes", functional: true } }));
    expect(parseConsent(raw)?.categories).toEqual({ essential: true, statistics: false, functional: true, marketing: false });
  });

  it("rejects malformed values", () => {
    for (const bad of [null, "", "garbage", "%7B", JSON.stringify({ v: 2, id: "abcdefgh12", rev: 1, ts: 1 }), JSON.stringify({ v: 1, id: "x", rev: 1, ts: 1 }), JSON.stringify({ v: 1, id: "abcdefgh12", rev: 0, ts: 1 }), JSON.stringify({ v: 1, id: "bad id!!", rev: 1, ts: 1 })]) {
      expect(parseConsent(bad as string | null)).toBeNull();
    }
  });

  it("reads one cookie from a header", () => {
    expect(readCookie("a=1; wb_consent=xyz; b=2", "wb_consent")).toBe("xyz");
    expect(readCookie("wb_consent_old=1", "wb_consent")).toBeNull();
    expect(readCookie(undefined, "wb_consent")).toBeNull();
  });

  it("treats a choice for an older consent version as no choice", () => {
    expect(isCurrent(state({ rev: 2 }), 3)).toBe(false);
    expect(isCurrent(state(), 3)).toBe(true);
  });

  it("makes random 24-char hex ids", () => {
    const a = newConsentId();
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toBe(newConsentId());
  });

  it("names decisions", () => {
    expect(decisionFor(ALL_ALLOWED)).toBe("accept_all");
    expect(decisionFor(ESSENTIAL_ONLY)).toBe("essentials");
    expect(decisionFor({ ...ESSENTIAL_ONLY, functional: true })).toBe("custom");
  });
});

describe("server consent check (statistics beacon)", () => {
  it("accepts only current-version cookies that allow Statistics", () => {
    expect(statisticsConsentId(serializeConsent(state()), 3)).toBe(state().id);
    expect(statisticsConsentId(serializeConsent(state()), 4)).toBeNull(); // version bumped
    expect(statisticsConsentId(serializeConsent(state({ categories: ESSENTIAL_ONLY })), 3)).toBeNull(); // continued without consent
    expect(statisticsConsentId(serializeConsent(state({ categories: { ...ESSENTIAL_ONLY, functional: true } })), 3)).toBeNull();
    expect(statisticsConsentId(undefined, 3)).toBeNull();
    expect(statisticsConsentId("tampered", 3)).toBeNull();
  });

  it("never counts dashboards or API calls", () => {
    expect(isTrackablePath("/")).toBe(true);
    expect(isTrackablePath("/product/rug")).toBe(true);
    expect(isTrackablePath("/administrator-story")).toBe(true);
    for (const p of ["/admin", "/admin/analytics", "/seller", "/seller/orders", "/api/collect", "/_next/static/x.js", "relative"]) expect(isTrackablePath(p)).toBe(false);
  });
});

describe("bot detection", () => {
  const humans = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  ];
  const bots = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 Chrome-Lighthouse",
    "Mozilla/5.0 (compatible; Google Page Speed Insights) PageSpeed",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "WhatsApp/2.23.20.0",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "Baiduspider+(+http://www.baidu.com/search/spider.htm)",
    "SomeCrawler/1.0",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Twitterbot/1.0",
    "curl/8.5.0",
    "python-requests/2.31",
    "Mozilla/5.0 link preview",
    "",
  ];
  it("lets real browsers through", () => humans.forEach((ua) => expect(isBotUserAgent(ua), ua).toBe(false)));
  it("catches crawlers, previewers and headless browsers", () => bots.forEach((ua) => expect(isBotUserAgent(ua), ua).toBe(true)));
});

describe("IP handling", () => {
  it("zeroes the last IPv4 octet", () => {
    expect(shortenIp("203.0.113.57")).toBe("203.0.113.0");
    expect(shortenIp("::ffff:198.51.100.9")).toBe("198.51.100.0");
    expect(shortenIp("010.001.002.003")).toBe("10.1.2.0");
  });
  it("keeps the /48 of IPv6", () => {
    expect(shortenIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3::");
    expect(shortenIp("2001:db8::1")).toBe("2001:db8:0::");
    expect(shortenIp("[2a00:1450:4001:82a::200e]")).toBe("2a00:1450:4001::");
    expect(shortenIp("::1")).toBe("0:0:0::");
  });
  it("returns null for junk", () => {
    for (const bad of [null, "", "999.1.1.1", "1.2.3", "hello", "2001:db8::1::2", "1:2:3:4:5:6:7:8:9"]) expect(shortenIp(bad)).toBeNull();
  });
  it("picks the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers({ "cf-connecting-ip": "2001:db8::5", "x-forwarded-for": "10.0.0.1" }))).toBe("2001:db8::5");
    expect(clientIp(new Headers({ "x-forwarded-for": "not-an-ip" }))).toBeNull();
  });
  it("never looks up private addresses", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "192.168.1.1", "172.20.0.1", "::1", "fd00::1", "100.64.0.1"]) expect(isPrivateIp(ip)).toBe(true);
    expect(isPrivateIp("203.0.113.5")).toBe(false);
  });
  it("reads Cloudflare location headers", () => {
    const g = cloudflareGeo(new Headers({ "cf-ipcountry": "pk", "cf-ipcity": "Lahore", "cf-region": "Punjab", "cf-iplatitude": "31.55", "cf-iplongitude": "74.34" }));
    expect(g).toMatchObject({ countryCode: "PK", country: "Pakistan", city: "Lahore", region: "Punjab", latitude: 31.55, longitude: 74.34 });
    expect(cloudflareGeo(new Headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(cloudflareGeo(new Headers())).toBeNull();
  });
});

describe("request cleaning", () => {
  it("drops query strings from paths and referrers", () => {
    expect(cleanPath("/reset-password?token=secret")).toBe("/reset-password");
    expect(cleanPath("//evil.com")).toBeNull();
    expect(cleanPath("https://x.com")).toBeNull();
    expect(cleanReferrer("https://www.google.com/search?q=rugs", "wahbayaan.com")).toBe("https://www.google.com/search");
    expect(cleanReferrer("https://wahbayaan.com/shop?x=1", "wahbayaan.com")).toBe("/shop");
    expect(cleanReferrer("javascript:alert(1)", "wahbayaan.com")).toBeNull();
  });
  it("classifies user agents", () => {
    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toEqual({ device: "mobile", browser: "Safari", os: "iOS" });
    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0")).toEqual({ device: "desktop", browser: "Edge", os: "Windows" });
  });
});

describe("CSV formula safety", () => {
  it("prefixes cells a spreadsheet would evaluate", () => {
    for (const v of ["=HYPERLINK(\"x\")", "+1", "-2+3", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
    expect(csvCell("/shop")).toBe("/shop");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
  it("is used by toCsv", () => {
    expect(toCsv([{ p: "=cmd|' /C calc'!A0" }], [{ header: "Path", value: (r) => r.p }])).toContain("'=cmd");
  });
});

describe("banner settings", () => {
  it("defaults keep the spec sizes in Wahbayaan colours", () => {
    const v = bannerCssVars(DEFAULT_CONSENT_BANNER);
    expect(v["--consent-radius"]).toBe("5px");
    expect(v["--consent-button-min-height"]).toBe("50px");
    expect(v["--consent-button-font-size"]).toBe("18px");
    expect(v["--consent-button-bg"]).toBe("#171f3d"); // indigo-900
    expect(bannerCssVars({ ...DEFAULT_CONSENT_BANNER, layout: "bar-dark" })["--consent-bg"]).toBe("#0d1124");
  });
  it("normalises stored values (bad colours, layouts, URLs, sizes dropped)", () => {
    const n = normalizeBanner({ layout: "weird", light: { background: "red; x:y" }, texts: { title: "Hi", privacyUrl: "javascript:alert(1)" }, sizes: { radius: -3, gap: 12 } });
    expect(n.layout).toBe("bar");
    expect(n.light.background).toBe(DEFAULT_CONSENT_BANNER.light.background);
    expect(n.texts.title).toBe("Hi");
    expect(n.texts.privacyUrl).toBe("/privacy");
    expect(n.sizes.radius).toBe(5);
    expect(n.sizes.gap).toBe(12);
  });
  it("normalises analytics settings", () => {
    expect(normalizeAnalytics({ consentRev: 0, retentionDays: 30, geoProvider: "nope" as never })).toMatchObject({ consentRev: 1, retentionDays: 30, geoProvider: "ipapi" });
  });
});

describe("service registry", () => {
  it("shows Essential, Statistics and only groups that have services", () => {
    expect(visibleGroups().map((g) => g.id)).toEqual(["essential", "statistics", "functional"]);
  });
  it("numbers footnotes by group position", () => {
    const f = serviceFootnotes();
    expect(f.services).toEqual([
      { name: "Visitor Statistics", n: 2 },
      { name: "YouTube/Vimeo", n: 3 },
    ]);
    expect(f.groups).toEqual([
      { name: "Statistics", n: 2 },
      { name: "Functional", n: 3 },
    ]);
  });
});

describe("video embeds", () => {
  it("recognises YouTube and Vimeo links", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.id).toBe("dQw4w9WgXcQ");
    expect(parseVideoUrl("https://youtube.com/shorts/dQw4w9WgXcQ")?.provider).toBe("youtube");
    expect(parseVideoUrl("https://vimeo.com/76979871")?.embedUrl).toBe("https://player.vimeo.com/video/76979871?autoplay=1&dnt=1");
    expect(parseVideoUrl("https://www.instagram.com/reel/abc/")).toBeNull();
    expect(parseVideoUrl("/media/clip.mp4")).toBeNull();
  });
});
