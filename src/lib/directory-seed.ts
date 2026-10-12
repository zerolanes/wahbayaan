/**
 * Text-only brand directory seed from docs/outreach/pakistani-brands.csv.
 * Only the brand name, category and website are read (parseDirectorySeed);
 * the file's emails, phone numbers and notes are never stored or published.
 * Runs once: skipped when the directory already has entries or the file is absent.
 */
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "./db/connect";
import * as t from "./db/schema";
import { parseDirectorySeed } from "./directory";

export const DIRECTORY_SEED_FILE = path.join("docs", "outreach", "pakistani-brands.csv");

export async function seedDirectory(db: Db, file = path.join(process.cwd(), DIRECTORY_SEED_FILE)) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.brandDirectoryEntries);
  if (n || !fs.existsSync(file)) return 0;
  const entries = parseDirectorySeed(fs.readFileSync(file, "utf8"));
  for (const [i, e] of entries.entries())
    await db
      .insert(t.brandDirectoryEntries)
      .values({ slug: e.slug, name: e.name, category: e.category, description: e.description, websiteUrl: e.websiteUrl, sort: i, source: "seed" })
      .onConflictDoNothing({ target: t.brandDirectoryEntries.slug });
  return entries.length;
}
