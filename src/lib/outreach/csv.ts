/**
 * Outreach contact CSV: parse and plan an idempotent import. Pure.
 *
 * Columns (header row required, order free, unknown columns ignored):
 *   brand, category, website, email, email_type, phone, instagram, city,
 *   ships_internationally, source_url, notes
 *
 * Rows match existing contacts on the normalised brand name. A contact staff
 * have never edited is refreshed from the file (non-empty values only — a blank
 * cell never wipes data). A contact staff edited only gets its blank fields
 * filled, so hand-made corrections are never clobbered.
 */
import { parseCsvRows } from "@/lib/brands/adapters/csv";
import { slugify } from "@/lib/brands/adapters/normalize";

export const OUTREACH_CSV_COLUMNS = ["brand", "category", "website", "email", "email_type", "phone", "instagram", "city", "ships_internationally", "source_url", "notes"] as const;

const COLUMN_FIELD = {
  category: "category",
  website: "websiteUrl",
  email: "email",
  email_type: "emailType",
  phone: "phone",
  instagram: "instagram",
  city: "city",
  ships_internationally: "shipsInternationally",
  source_url: "sourceUrl",
  notes: "notes",
} as const;
export type ImportField = (typeof COLUMN_FIELD)[keyof typeof COLUMN_FIELD];
export const IMPORT_FIELDS = Object.values(COLUMN_FIELD) as ImportField[];

const MAX: Record<ImportField, number> = {
  category: 60,
  websiteUrl: 300,
  email: 200,
  emailType: 80,
  phone: 200,
  instagram: 120,
  city: 160,
  shipsInternationally: 200,
  sourceUrl: 500,
  notes: 4000,
};

export type OutreachImportRow = { line: number; brandName: string; nameKey: string; fields: Partial<Record<ImportField, string>> };
export type CsvIssue = { line: number; message: string };

export function contactNameKey(name: string) {
  return slugify(name.trim().replace(/\s+/g, " "));
}

export function parseOutreachCsv(text: string): { rows: OutreachImportRow[]; issues: CsvIssue[]; error?: string } {
  const records = parseCsvRows(text);
  if (!records.length) return { rows: [], issues: [], error: "The file is empty." };
  const header = records[0].cells.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const brandIdx = header.findIndex((h) => h === "brand" || h === "brand_name" || h === "name");
  if (brandIdx < 0) return { rows: [], issues: [], error: `Missing the “brand” column. Expected columns: ${OUTREACH_CSV_COLUMNS.join(", ")}.` };
  const idx = Object.fromEntries(Object.keys(COLUMN_FIELD).map((c) => [c, header.indexOf(c)])) as Record<keyof typeof COLUMN_FIELD, number>;
  const rows: OutreachImportRow[] = [];
  const issues: CsvIssue[] = [];
  const seen = new Map<string, number>();
  for (const r of records.slice(1)) {
    const brandName = (r.cells[brandIdx] ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
    const nameKey = contactNameKey(brandName);
    if (!brandName || !nameKey) {
      issues.push({ line: r.line, message: "No brand name — row skipped" });
      continue;
    }
    if (seen.has(nameKey)) {
      issues.push({ line: r.line, message: `${brandName}: same brand as line ${seen.get(nameKey)} — row skipped` });
      continue;
    }
    seen.set(nameKey, r.line);
    const fields: Partial<Record<ImportField, string>> = {};
    for (const [col, field] of Object.entries(COLUMN_FIELD) as [keyof typeof COLUMN_FIELD, ImportField][]) {
      const i = idx[col];
      if (i < 0) continue;
      let v = (r.cells[i] ?? "").trim();
      if (field === "email") v = v.toLowerCase();
      if (field === "websiteUrl" && v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
      if (v) fields[field] = v.slice(0, MAX[field]);
    }
    rows.push({ line: r.line, brandName, nameKey, fields });
  }
  return { rows, issues };
}

export type ExistingContact = { id: string; nameKey: string; staffEditedAt: Date | null } & Partial<Record<ImportField, string | null>>;

export type ImportPlan = {
  creates: OutreachImportRow[];
  updates: { id: string; brandName: string; patch: Partial<Record<ImportField, string>> }[];
  unchanged: number;
  /** Staff-edited contacts where the file differed and the edit was kept. */
  kept: { id: string; brandName: string; fields: ImportField[] }[];
};

export function planOutreachImport(existing: ExistingContact[], rows: OutreachImportRow[]): ImportPlan {
  const byKey = new Map(existing.map((e) => [e.nameKey, e]));
  const plan: ImportPlan = { creates: [], updates: [], unchanged: 0, kept: [] };
  for (const row of rows) {
    const cur = byKey.get(row.nameKey);
    if (!cur) {
      plan.creates.push(row);
      continue;
    }
    const patch: Partial<Record<ImportField, string>> = {};
    const keptFields: ImportField[] = [];
    for (const field of IMPORT_FIELDS) {
      const next = row.fields[field];
      if (!next) continue;
      const now = (cur[field] ?? "").trim();
      if (now === next) continue;
      if (!now || !cur.staffEditedAt) patch[field] = next;
      else keptFields.push(field);
    }
    if (Object.keys(patch).length) plan.updates.push({ id: cur.id, brandName: row.brandName, patch });
    else if (!keptFields.length) plan.unchanged++;
    if (keptFields.length) plan.kept.push({ id: cur.id, brandName: row.brandName, fields: keptFields });
  }
  return plan;
}

export function describeImport(plan: ImportPlan, issues: CsvIssue[]) {
  const parts = [`${plan.creates.length} added`, `${plan.updates.length} updated`, `${plan.unchanged} unchanged`];
  if (plan.kept.length) parts.push(`${plan.kept.length} kept as edited by staff`);
  if (issues.length) parts.push(`${issues.length} row${issues.length === 1 ? "" : "s"} skipped`);
  return parts.join(" · ");
}
