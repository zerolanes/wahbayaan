import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Brand outreach holds researched emails, phone numbers and notes. They must
// never reach a storefront page, a public API or a public query module. Like
// tests/currency-surfaces.test.ts, this scans source files for a pattern: every
// file that touches the outreach tables or modules must be an admin file, the
// outreach library itself, or the one opt-out page.

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(tsx?|jsx?|mjs)$/.test(e.name) ? [p] : [];
  });
}

const root = path.resolve(__dirname, "..");
const rel = (f: string) => path.relative(root, f).split(path.sep).join("/");
const all = files(path.join(root, "src"));
const OUTREACH = /outreach(Contacts|Templates|Messages|Suppressions)\b|outreach_(contacts|templates|messages|suppressions)\b|@\/lib\/outreach\/|["']\.\/outreach\//;

const ALLOWED_PREFIXES = ["src/app/admin/", "src/app/actions/admin/", "src/components/admin/", "src/lib/outreach/"];
const ALLOWED_FILES = new Set([
  "src/lib/db/schema.ts", // table definitions
  "src/lib/admin/dashboard.ts", // staff dashboard "follow-ups due" count
  "src/app/outreach/unsubscribe/page.tsx", // the public opt-out link (checked below)
]);

const publicSurfaces = [
  "src/app/(store)",
  "src/app/(home)",
  "src/app/api",
  "src/app/brand-portal",
  "src/app/seller",
  "src/components/store",
  "src/lib/queries",
  "src/lib/trust",
];

describe("brand outreach never leaks to public routes", () => {
  it("only admin files, the outreach library and the opt-out page touch outreach data", () => {
    const offenders = all.filter((f) => OUTREACH.test(fs.readFileSync(f, "utf8"))).map(rel).filter((f) => !ALLOWED_FILES.has(f) && !ALLOWED_PREFIXES.some((p) => f.startsWith(p)));
    expect(offenders).toEqual([]);
  });

  it("storefront, public API, portals and public query modules never import it", () => {
    const scanned = publicSurfaces.flatMap((d) => files(path.join(root, d)));
    expect(scanned.length).toBeGreaterThan(50);
    expect(scanned.filter((f) => OUTREACH.test(fs.readFileSync(f, "utf8"))).map(rel)).toEqual([]);
  });

  it("the public directory reads only name, category and website", () => {
    for (const f of ["src/lib/directory.ts", "src/lib/directory-seed.ts", "src/lib/queries/brands.ts"]) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      expect(OUTREACH.test(src), f).toBe(false);
    }
  });

  it("the opt-out page only calls unsubscribeByToken, which returns a boolean", () => {
    const page = fs.readFileSync(path.join(root, "src/app/outreach/unsubscribe/page.tsx"), "utf8");
    const imports = [...page.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["@/lib/outreach/unsubscribe", "next", "next/link"]);
    const lib = fs.readFileSync(path.join(root, "src/lib/outreach/unsubscribe.ts"), "utf8");
    expect(lib).toMatch(/export async function unsubscribeByToken\([^)]*\): Promise<boolean>/);
    expect(lib.match(/^export /gm)).toHaveLength(1);
  });

  it("admin outreach modules are server-only", () => {
    for (const f of ["src/lib/outreach/server.ts", "src/lib/outreach/unsubscribe.ts"]) expect(fs.readFileSync(path.join(root, f), "utf8")).toMatch(/^import "server-only";/);
  });
});
