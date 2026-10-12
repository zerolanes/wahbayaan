import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandDirectoryEntries } from "@/lib/db/schema";
import { excludeListedBrands, toPublicEntry, type PublicDirectoryEntry } from "@/lib/directory";
import { getPublicBrands } from "./brands";

/**
 * Public brand directory: visible entries, minus brands that already have a
 * public page on Wahbayaan. Rows are reduced to the whitelisted public fields
 * (name, category, one line, website) before they leave this module.
 */
export const getPublicDirectory = cache(async (): Promise<PublicDirectoryEntry[]> => {
  const d = await db();
  const [rows, listed] = await Promise.all([
    d
      .select({ slug: brandDirectoryEntries.slug, name: brandDirectoryEntries.name, category: brandDirectoryEntries.category, description: brandDirectoryEntries.description, websiteUrl: brandDirectoryEntries.websiteUrl })
      .from(brandDirectoryEntries)
      .where(eq(brandDirectoryEntries.isHidden, false))
      .orderBy(asc(brandDirectoryEntries.sort), asc(brandDirectoryEntries.name)),
    getPublicBrands(),
  ]);
  return excludeListedBrands(rows, listed).map(toPublicEntry);
});
