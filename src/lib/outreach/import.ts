/**
 * Writes for brand outreach that also run from scripts (seed) and tests:
 * the idempotent CSV import and the default templates. Admin-only data —
 * nothing here is reachable from a public route.
 */
import fs from "node:fs";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/connect";
import * as t from "@/lib/db/schema";
import { DEFAULT_OUTREACH_TEMPLATES } from "./defaults";
import { describeImport, IMPORT_FIELDS, parseOutreachCsv, planOutreachImport, type CsvIssue, type ImportPlan } from "./csv";

export const OUTREACH_SEED_FILE = path.join("docs", "outreach", "pakistani-brands.csv");

export type OutreachImportResult = { plan: ImportPlan; issues: CsvIssue[]; summary: string; linked: number; error?: string };

export async function importOutreachCsv(db: Db, text: string, source: "csv_seed" | "csv_upload"): Promise<OutreachImportResult> {
  const parsed = parseOutreachCsv(text);
  const empty: ImportPlan = { creates: [], updates: [], unchanged: 0, kept: [] };
  if (parsed.error) return { plan: empty, issues: [], summary: parsed.error, linked: 0, error: parsed.error };
  const keys = parsed.rows.map((r) => r.nameKey);
  const existing = keys.length
    ? await db
        .select({ id: t.outreachContacts.id, nameKey: t.outreachContacts.nameKey, staffEditedAt: t.outreachContacts.staffEditedAt, ...pick(t.outreachContacts) })
        .from(t.outreachContacts)
        .where(inArray(t.outreachContacts.nameKey, keys))
    : [];
  const plan = planOutreachImport(existing, parsed.rows);
  for (const row of plan.creates)
    await db
      .insert(t.outreachContacts)
      .values({ brandName: row.brandName, nameKey: row.nameKey, source, ...row.fields })
      .onConflictDoNothing({ target: t.outreachContacts.nameKey });
  for (const u of plan.updates) await db.update(t.outreachContacts).set(u.patch).where(eq(t.outreachContacts.id, u.id));
  const linked = await linkContacts(db);
  return { plan, issues: parsed.issues, summary: describeImport(plan, parsed.issues), linked };
}

function pick(table: typeof t.outreachContacts) {
  return Object.fromEntries(IMPORT_FIELDS.map((f) => [f, table[f]])) as { [K in (typeof IMPORT_FIELDS)[number]]: (typeof table)[K] };
}

/**
 * Link unlinked contacts to an existing brand record (same slug or name) and to
 * the text-only directory entry (same slug). Links only — copies nothing.
 */
export async function linkContacts(db: Db) {
  const brandLinks = await db.execute(sql`
    update outreach_contacts c set brand_id = b.id
    from brands b
    where c.brand_id is null and (b.slug = c.name_key or lower(b.name) = lower(c.brand_name))`);
  const dirLinks = await db.execute(sql`
    update outreach_contacts c set directory_entry_id = e.id
    from brand_directory_entries e
    where c.directory_entry_id is null and e.slug = c.name_key`);
  return affected(brandLinks) + affected(dirLinks);
}

function affected(r: unknown) {
  const x = r as { count?: number; affectedRows?: number };
  return Number(x.count ?? x.affectedRows ?? 0);
}

export async function importOutreachSeedFile(db: Db, file = path.join(process.cwd(), OUTREACH_SEED_FILE)) {
  if (!fs.existsSync(file)) return null;
  return importOutreachCsv(db, fs.readFileSync(file, "utf8"), "csv_seed");
}

/** Insert the default templates once (by key); staff edits are never overwritten. */
export async function seedOutreachTemplates(db: Db) {
  for (const tpl of DEFAULT_OUTREACH_TEMPLATES)
    await db
      .insert(t.outreachTemplates)
      .values({ key: tpl.key, name: tpl.name, subject: tpl.subject, body: tpl.body, sort: tpl.sort })
      .onConflictDoNothing({ target: t.outreachTemplates.key });
}

