/**
 * CSV encoding for admin exports (RFC 4180 quoting). Cells that a spreadsheet
 * would evaluate as a formula (=, +, -, @, tab, CR) are prefixed with an
 * apostrophe so an exported buyer name can never run as a formula.
 */
export type CsvColumn<T> = { header: string; value: (row: T) => unknown };

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value == null) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (Array.isArray(value)) s = value.join("; ");
  else if (typeof value === "object") s = JSON.stringify(value);
  else s = String(value);
  // Plain negative numbers are data, not formulas.
  if (FORMULA.test(s) && !(typeof value === "number")) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Minor units → plain decimal string for spreadsheets (no symbols, no grouping). */
export function csvAmount(minor: number | null | undefined): string {
  if (minor == null) return "";
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function csvResponse(filename: string, csv: string) {
  const safe = filename.replace(/[^\w.-]+/g, "-");
  return new Response("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${safe}"`,
      "cache-control": "no-store",
    },
  });
}
