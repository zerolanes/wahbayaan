import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LEGACY_REDIRECTS, legacyRedirectRules, normalizePath } from "@/lib/legacy-redirects";
import { CATEGORIES, DEMO_JOURNAL, DEMO_VENDORS, POLICY_PAGES } from "../scripts/seed-data";

// The old WordPress site's URLs (theme-source/LAYOUT.md §7) must each land on a
// page that exists in this app. The list is read as plain text; nothing from
// theme-source is executed.

const root = path.resolve(__dirname, "..");

/** Old paths from the §7 table (column 3). */
function oldPaths(): string[] {
  const md = fs.readFileSync(path.join(root, "theme-source/LAYOUT.md"), "utf8");
  const section = md.slice(md.indexOf("## 7. Old URLs"));
  const rows = section.split("\n").filter((l) => /^\| (page|product|blog|portfolio|footer|vendor|feeds)/.test(l));
  expect(rows).toHaveLength(112);
  return rows.flatMap((row) =>
    row
      .split("|")[3]
      .replace(/\(.*?\)/g, "")
      .split(",")
      .map((p) => p.trim().replace(/<store-slug>/, ":slug").replace(/<login>/, ":login"))
      .filter(Boolean),
  );
}

/** App routes as regexes, built from the file system (route groups dropped, [param] → one segment). */
function appRoutes(): { pattern: RegExp; file: string }[] {
  const out: { pattern: RegExp; file: string }[] = [];
  const walk = (dir: string, segs: string[]) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), /^\(.*\)$/.test(e.name) ? segs : [...segs, e.name]);
      else if (/^(page|route)\.tsx?$/.test(e.name)) {
        const re = segs.map((s) => (/^\[\.\.\..+\]$/.test(s) ? "/.+" : /^\[.+\]$/.test(s) ? "/[^/]+" : `/${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).join("");
        out.push({ pattern: new RegExp(`^${re || "/"}$`), file: path.join(dir, e.name) });
      }
    }
  };
  walk(path.join(root, "src/app"), []);
  return out;
}

const routes = appRoutes();
const resolve = (p: string) => routes.find((r) => r.pattern.test(p.replace(/:\w+/g, "x")))?.file ?? null;
const staticRoute = (p: string) => routes.find((r) => !r.pattern.source.includes("[^/]+") && r.pattern.test(p));

describe("legacy WordPress redirects", () => {
  it("covers every old URL in LAYOUT.md §7", () => {
    const covered = new Set(LEGACY_REDIRECTS.map((r) => normalizePath(r.from)));
    const missing = oldPaths()
      .filter((p) => p !== "/?s=") // WordPress search: the query rule below
      .map(normalizePath)
      .filter((p) => !covered.has(p));
    expect(missing).toEqual([]);
    expect(legacyRedirectRules().some((r) => r.source === "/" && r.has?.[0]?.key === "s" && r.destination.startsWith("/search"))).toBe(true);
  });

  it("sends every old URL to a route that exists", () => {
    const broken = LEGACY_REDIRECTS.filter((r) => !resolve(r.to.split("?")[0]));
    expect(broken).toEqual([]);
  });

  it("never points at the homepage except for the old homepage", () => {
    expect(LEGACY_REDIRECTS.filter((r) => r.to === "/" && r.from !== "/")).toEqual([]);
  });

  it("is permanent (301) and never shadows a page that exists today", () => {
    const rules = legacyRedirectRules();
    expect(rules.every((r) => r.statusCode === 301)).toBe(true);
    // A redirect runs before the file system, so its source must not be a live page.
    expect(rules.filter((r) => r.source !== "/" && staticRoute(r.source)).map((r) => r.source)).toEqual([]);
    const live = new Set([
      ...CATEGORIES.map((c) => `/category/${c.slug}`),
      ...DEMO_VENDORS.map((v) => `/artisans/${v.slug}`),
      ...DEMO_JOURNAL.map((j) => `/journal/${j.slug}`),
      ...POLICY_PAGES.map((p) => `/${p.slug}`),
    ]);
    expect(rules.filter((r) => live.has(r.source)).map((r) => r.source)).toEqual([]);
  });

  it("has no duplicate sources", () => {
    const sources = LEGACY_REDIRECTS.map((r) => normalizePath(r.from));
    expect(sources.length).toBe(new Set(sources).size);
  });
});
