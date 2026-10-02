import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Transport } from "./shopify";

/**
 * How the fetch adapter reaches a brand's site.
 *
 * - `httpTransport`: real HTTPS with a descriptive User-Agent and a timeout.
 * - `fixtureTransport`: serves recorded fixtures from `tests/fixtures/brands/`
 *   for `fixture:<name>` source URLs. Development/demo only — the sandbox this
 *   was built in cannot reach brand websites, and demo brands are fictional.
 */
export const httpTransport: Transport = async (url, { userAgent }) => {
  const res = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "application/json, text/plain;q=0.9, */*;q=0.1" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  return { status: res.status, body: await res.text(), header: (n) => res.headers.get(n) };
};

export const FIXTURE_PREFIX = "fixture:";
const FIXTURE_HOST_SUFFIX = ".fixture.invalid";

export function fixturesAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";
}

/** `fixture:sahil-menswear` → the https URL the adapter fetches (served by `fixtureTransport`). */
export function resolveSourceUrl(url: string): { url: string; fixture: boolean } {
  if (!url.startsWith(FIXTURE_PREFIX)) return { url, fixture: false };
  const name = url.slice(FIXTURE_PREFIX.length).replace(/[^a-z0-9-]/gi, "");
  return { url: `https://${name}${FIXTURE_HOST_SUFFIX}/products.json`, fixture: true };
}

function fixturesDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "tests", "fixtures", "brands");
}

export const fixtureTransport: Transport = async (url) => {
  if (!fixturesAllowed()) return { status: 403, body: "Fixture sources are disabled in production.", header: () => null };
  const u = new URL(url);
  if (!u.hostname.endsWith(FIXTURE_HOST_SUFFIX)) return { status: 404, body: "", header: () => null };
  const name = u.hostname.slice(0, -FIXTURE_HOST_SUFFIX.length).replace(/[^a-z0-9-]/gi, "");
  const read = (file: string) => {
    const p = path.join(fixturesDir(), file);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  };
  if (u.pathname === "/robots.txt") {
    const body = read(`${name}.robots.txt`);
    return { status: body == null ? 404 : 200, body: body ?? "", header: () => null };
  }
  if (u.pathname === "/products.json") {
    const page = Number(u.searchParams.get("page") ?? "1");
    const body = read(page <= 1 ? `${name}.json` : `${name}.page${page}.json`);
    if (body == null) return page <= 1 ? { status: 404, body: "", header: () => null } : { status: 200, body: '{"products":[]}', header: () => null };
    return { status: 200, body, header: () => null };
  }
  return { status: 404, body: "", header: () => null };
};
