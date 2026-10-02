import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseBrandCsv, parseCsv } from "@/lib/brands/adapters/csv";
import { detectAudience, htmlToText, parsePkr } from "@/lib/brands/adapters/normalize";
import { crawlDelay, isAllowed, parseRobots } from "@/lib/brands/adapters/robots";
import { fetchShopifyCatalog, parseShopifyProducts, type Transport } from "@/lib/brands/adapters/shopify";

// Fixtures are FICTIONAL brands written in the generic Shopify products.json
// shape (see tests/fixtures/brands/). The sandbox cannot reach real brand sites.
const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "fixtures/brands", name), "utf8");
const opts = { storefrontOrigin: "https://sahil-menswear.example", assetOrigin: "", defaultAudience: "women" as const };

describe("Shopify products.json adapter", () => {
  const result = parseShopifyProducts(JSON.parse(fixture("sahil-menswear.json")), opts);

  it("parses products with size and colour variants", () => {
    expect(result.products).toHaveLength(3);
    const kurta = result.products.find((p) => p.handle === "ivory-cotton-kurta-shalwar")!;
    expect(kurta.title).toBe("Ivory Cotton Kurta Shalwar");
    expect(kurta.audience).toBe("men");
    expect(kurta.category).toBe("Kurta Shalwar");
    expect(kurta.collection).toBe("Eid Edit 2026");
    expect(kurta.fabric).toBe("Cotton");
    expect(kurta.tags).toEqual(["Men", "new-arrival"]);
    expect(kurta.variants).toHaveLength(6);
    expect(kurta.variants[0]).toMatchObject({ size: "S", colour: "Ivory", sku: "SM-KS-IV-S", pricePkr: 349_000, available: true, weightG: 650 });
    expect(kurta.variants.find((v) => v.sku === "SM-KS-IV-L")!.available).toBe(false);
    // Lowest variant price; the XL costs more.
    expect(kurta.pricePkr).toBe(349_000);
    expect(kurta.variants.find((v) => v.size === "XL")!.pricePkr).toBe(369_000);
    expect(kurta.weightG).toBe(720);
    expect(kurta.sourceUrl).toBe("https://sahil-menswear.example/products/ivory-cotton-kurta-shalwar");
    expect(kurta.images.map((i) => i.url)).toEqual(["/brand-art/kurta/4101.svg", "/brand-art/kurta/4102.svg"]);
    expect(kurta.description).toContain("Straight-cut kurta");
    expect(kurta.description).not.toContain("<");
    expect(kurta.publishedAt?.toISOString()).toBe("2026-09-20T05:00:00.000Z");
  });

  it("reads sale prices (compare_at_price above price) and comma-separated tags", () => {
    const suit = result.products.find((p) => p.handle === "charcoal-wash-and-wear-kameez-shalwar")!;
    expect(suit.onSale).toBe(true);
    expect(suit.pricePkr).toBe(299_000);
    expect(suit.compareAtPricePkr).toBe(399_000);
    expect(suit.variants.map((v) => v.size)).toEqual(["38", "40", "42", "44"]);
    expect(suit.variants.every((v) => v.colour === null)).toBe(true);
    expect(suit.fabric).toBe("Wash & Wear");
    expect(suit.audience).toBe("men");
    const waistcoat = result.products.find((p) => p.handle === "embroidered-velvet-waistcoat")!;
    // Only the black XL is discounted; the cheapest variant is not, but the product is "on sale".
    expect(waistcoat.onSale).toBe(true);
    expect(waistcoat.compareAtPricePkr).toBeNull();
    expect(waistcoat.variants.find((v) => v.sku === "SM-WC-BL-XL")!.compareAtPricePkr).toBe(749_000);
    expect(waistcoat.variants[0].colour).toBe("Maroon");
  });

  it("reports products without a valid price instead of importing them at zero", () => {
    expect(result.failures).toEqual([{ ref: "Gift Card", reason: "no variant with a valid price" }]);
  });

  it("handles colour-only products, stock counts and untitled rows", () => {
    const r = parseShopifyProducts(JSON.parse(fixture("noor-lawn-house.json")), { ...opts, storefrontOrigin: "https://noor-lawn-house.example" });
    expect(r.products).toHaveLength(3);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].reason).toBe("missing title");
    const lawn = r.products[0];
    expect(lawn.audience).toBe("women");
    expect(lawn.variants.map((v) => [v.size, v.colour, v.stockQty])).toEqual([
      [null, "Jasmine White", 14],
      [null, "Rose Pink", 3],
    ]);
    const kurta = r.products[1];
    expect(kurta.audience).toBe("women"); // "ladies"
    expect(kurta.onSale).toBe(true);
    expect(kurta.variants.find((v) => v.size === "M")!.stockQty).toBe(0);
  });

  it("rejects documents that aren't products.json", () => {
    expect(() => parseShopifyProducts({ items: [] }, opts)).toThrow(/products/);
  });
});

describe("fetch adapter: robots.txt and rate limits", () => {
  function fakeSite(robots: string | null, pages: unknown[]) {
    const calls: string[] = [];
    const transport: Transport = async (url) => {
      calls.push(url);
      const u = new URL(url);
      if (u.pathname === "/robots.txt") return { status: robots == null ? 404 : 200, body: robots ?? "", header: () => null };
      const page = Number(u.searchParams.get("page"));
      return { status: 200, body: JSON.stringify(pages[page - 1] ?? { products: [] }), header: () => null };
    };
    return { calls, transport };
  }
  const page1 = JSON.parse(fixture("sahil-menswear.json"));

  it("checks robots.txt first, waits between requests and honours Crawl-delay", async () => {
    const site = fakeSite(fixture("sahil-menswear.robots.txt").replace("Crawl-delay: 1", "Crawl-delay: 3"), [page1]);
    const sleeps: number[] = [];
    const r = await fetchShopifyCatalog({ ...opts, url: "https://sahil-menswear.example/products.json", transport: site.transport, sleep: async (ms) => void sleeps.push(ms), rateLimitMs: 1500 });
    expect(site.calls[0]).toBe("https://sahil-menswear.example/robots.txt");
    expect(site.calls[1]).toBe("https://sahil-menswear.example/products.json?limit=250&page=1");
    expect(r.products).toHaveLength(3);
    expect(r.complete).toBe(true);
    expect(sleeps).toEqual([3000]); // Crawl-delay 3 s beats our 1.5 s
  });

  it("never goes faster than one request per second", async () => {
    const site = fakeSite(null, [page1]);
    const sleeps: number[] = [];
    await fetchShopifyCatalog({ ...opts, url: "https://x.example/products.json", transport: site.transport, sleep: async (ms) => void sleeps.push(ms), rateLimitMs: 10 });
    expect(sleeps).toEqual([1000]);
  });

  it("refuses when robots.txt disallows products.json", async () => {
    const site = fakeSite("User-agent: *\nDisallow: /products", [page1]);
    await expect(fetchShopifyCatalog({ ...opts, url: "https://x.example/products.json", transport: site.transport, sleep: async () => {} })).rejects.toThrow(/robots\.txt/);
    expect(site.calls).toHaveLength(1);
  });

  it("paginates and marks a capped crawl as incomplete", async () => {
    const full = { products: Array.from({ length: 250 }, (_, i) => ({ id: i + 1, title: `Item ${i + 1}`, handle: `item-${i + 1}`, variants: [{ id: 1000 + i, price: "1000.00" }] })) };
    const site = fakeSite(null, [full, full, full]);
    const r = await fetchShopifyCatalog({ ...opts, url: "https://x.example/products.json", transport: site.transport, sleep: async () => {}, maxPages: 2 });
    expect(r.pages).toBe(2);
    expect(r.complete).toBe(false);
  });

  it("stops on HTTP 429 and refuses plain http", async () => {
    const transport: Transport = async (url) => (url.endsWith("robots.txt") ? { status: 404, body: "", header: () => null } : { status: 429, body: "", header: (n) => (n === "retry-after" ? "120" : null) });
    await expect(fetchShopifyCatalog({ ...opts, url: "https://x.example/products.json", transport, sleep: async () => {} })).rejects.toThrow(/429.*120/);
    await expect(fetchShopifyCatalog({ ...opts, url: "http://x.example/products.json", transport, sleep: async () => {} })).rejects.toThrow(/https/);
  });
});

describe("robots.txt parsing", () => {
  const robots = parseRobots(`
User-agent: BadBot
Disallow: /

User-agent: *
Disallow: /checkout
Disallow: /*?sort_by=
Allow: /checkout/help$
Crawl-delay: 2
`);
  it("applies longest-match rules with wildcards for our agent", () => {
    expect(isAllowed(robots, "/products.json?limit=250&page=1")).toBe(true);
    expect(isAllowed(robots, "/checkout/123")).toBe(false);
    expect(isAllowed(robots, "/checkout/help")).toBe(true);
    expect(isAllowed(robots, "/collections/all?sort_by=price")).toBe(false);
    expect(isAllowed(robots, "/anything", "BadBot/2.0")).toBe(false);
    expect(crawlDelay(robots)).toBe(2);
  });
});

describe("CSV / feed adapter", () => {
  it("groups rows into products with variants and reports bad rows", () => {
    const r = parseBrandCsv(fixture("noor-lawn-house-feed.csv"), { defaultAudience: "women" });
    expect(r.products.map((p) => p.handle)).toEqual(["printed-lawn-2-piece-saffron", "straight-trouser-cambric"]);
    const lawn = r.products[0];
    expect(lawn.pricePkr).toBe(299_000); // "2,990" quoted
    expect(lawn.images).toHaveLength(2);
    expect(lawn.tags).toEqual(["2-piece", "printed"]);
    expect(lawn.publishedAt?.toISOString().slice(0, 10)).toBe("2026-09-29");
    const trouser = r.products[1];
    expect(trouser.variants.map((v) => [v.size, v.available, v.stockQty])).toEqual([
      ["S", true, 5],
      ["M", false, 0],
      ["L", false, null],
    ]);
    expect(trouser.onSale).toBe(true);
    expect(trouser.compareAtPricePkr).toBe(199_000);
    expect(r.failures).toEqual([{ ref: "Broken price row", reason: "line 6: price_pkr must be a positive amount" }]);
  });

  it("parses quoted CSV fields", () => {
    expect(parseCsv('a,b\n"x, ""y""",2\r\n')).toEqual([
      ["a", "b"],
      ['x, "y"', "2"],
    ]);
  });
});

describe("normalisation helpers", () => {
  it("parses PKR amounts and never returns zero", () => {
    expect(parsePkr("3,490.00")).toBe(349_000);
    expect(parsePkr("Rs. 1200")).toBe(120_000);
    expect(parsePkr("0.00")).toBeNull();
    expect(parsePkr("")).toBeNull();
  });
  it("detects audience without matching 'men' inside 'women'", () => {
    expect(detectAudience(["Womens", "Lawn"], "men")).toBe("women");
    expect(detectAudience(["Kurta for men"], "women")).toBe("men");
    expect(detectAudience(["Lawn"], "women")).toBe("women");
  });
  it("strips HTML and scripts", () => {
    expect(htmlToText("<p>Hello &amp; <b>welcome</b></p><script>x()</script>")).toBe("Hello & welcome");
  });
});
