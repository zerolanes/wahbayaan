import { z } from "zod";
import { parseMoneyInput, percentToBps } from "./money";

/** Zod helpers for HTML form values (everything arrives as a string or is absent). */

const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const zStr = (max = 500) => z.string().trim().min(1, "This field is required").max(max);

export const zOptStr = (max = 5000) =>
  z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null), z.string().max(max).nullable());

export const zBool = z.preprocess((v) => v === "on" || v === "true" || v === "1" || v === true, z.boolean());

export const zInt = (min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) =>
  z.preprocess(blankToUndef, z.coerce.number().int("Enter a whole number").min(min).max(max));

export const zOptInt = (min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) =>
  z.preprocess((v) => blankToUndef(v) ?? null, z.coerce.number().int("Enter a whole number").min(min).max(max).nullable());

export const zOptNum = (min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) =>
  z.preprocess((v) => blankToUndef(v) ?? null, z.coerce.number().min(min).max(max).nullable());

/** Decimal amount typed by staff → integer minor units. */
export const zMoney = z.preprocess(
  (v) => (typeof v === "string" ? parseMoneyInput(v) : v),
  z.number({ error: "Enter an amount" }).refine((n) => Number.isFinite(n), "Enter a valid amount, e.g. 1250.50").refine((n) => n >= 0, "Amount can't be negative"),
);

export const zOptMoney = z.preprocess(
  (v) => (typeof v === "string" ? parseMoneyInput(v) : v ?? null),
  z.number().refine((n) => Number.isFinite(n), "Enter a valid amount, e.g. 1250.50").refine((n) => n >= 0, "Amount can't be negative").nullable(),
);

/** Percent typed by staff ("12.5") → basis points. */
export const zOptBps = z.preprocess(
  (v) => (typeof v === "string" ? percentToBps(v) : v ?? null),
  z.number().refine((n) => Number.isFinite(n), "Enter a valid percentage").refine((n) => n >= 0 && n <= 10_000, "Use 0–100%").nullable(),
);

export const zIds = z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().uuid()));

export const zUuid = z.string().uuid("Missing or invalid id");

export const zOptDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? new Date(v) : null),
  z.date().refine((d) => !Number.isNaN(d.getTime()), "Invalid date").nullable(),
);

/** FormData → plain object. Repeated keys (and keys ending in []) become arrays; files are skipped. */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    if (!values.length) continue;
    if (key.endsWith("[]")) out[key.slice(0, -2)] = values;
    else out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Please check the form.";
  const field = issue.path.join(".");
  return field ? `${field.replace(/([A-Z])/g, " $1").toLowerCase()}: ${issue.message}` : issue.message;
}
