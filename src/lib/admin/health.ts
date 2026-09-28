import "server-only";
import fs from "node:fs";
import path from "node:path";
import { desc, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, categories, dutyRates, fxRates, importRules, shippingRates } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { DEFAULT_BUYER_CURRENCIES, DESTINATIONS } from "@/lib/money/currency";
import { STUCK_AFTER_MINUTES } from "./email-preview";
import { dutyCoverage, fxFreshness, ruleCoverage, shippingCoverage } from "./rate-coverage";
import { query } from "./sql";

export const KEY_TABLES = [
  "users",
  "vendors",
  "products",
  "product_images",
  "orders",
  "payments",
  "payouts",
  "disputes",
  "reviews",
  "media",
  "email_outbox",
  "audit_log",
  "sessions",
  "redirects",
] as const;

export const JOBS = [
  { id: "auto-release", label: "Escrow auto-release", path: "/api/cron/auto-release", actions: ["cron.auto_release"], expectEveryHours: 1 },
  { id: "fx-refresh", label: "FX refresh", path: "/api/cron/fx-refresh", actions: ["cron.fx_refresh", "fx.refresh", "fx.refresh_failed"], expectEveryHours: 24 },
] as const;

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), file), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function databaseHealth() {
  const started = performance.now();
  try {
    const [v] = await query<{ version: string }>(sql`select version() as version`);
    const latencyMs = Math.round(performance.now() - started);
    let applied: { id: number; hash: string; created_at: string | number }[] = [];
    let migrationError: string | null = null;
    try {
      applied = await query(sql`select id, hash, created_at from drizzle.__drizzle_migrations order by id`);
    } catch (e) {
      migrationError = e instanceof Error ? e.message : String(e);
    }
    const journal = readJson<{ entries: { tag: string; when: number }[] }>("drizzle/meta/_journal.json");
    const latest = applied.at(-1);
    return {
      ok: true as const,
      latencyMs,
      driver: process.env.DATABASE_URL ? "Postgres" : "PGlite (embedded)",
      version: (v?.version ?? "").split(" ").slice(0, 2).join(" "),
      migrations: {
        applied: applied.length,
        files: journal?.entries.length ?? null,
        latestTag: journal?.entries.at(-1)?.tag ?? null,
        latestAppliedAt: latest ? new Date(Number(latest.created_at)) : null,
        error: migrationError,
      },
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e), latencyMs: Math.round(performance.now() - started) };
  }
}

export async function tableCounts() {
  const parts = KEY_TABLES.map((t) => sql`select ${t}::text as t, count(*)::int as n from ${sql.identifier(t)}`);
  const rows = await query<{ t: string; n: number }>(sql.join(parts, sql` union all `));
  const demo = await query<{ t: string; n: number }>(
    sql.join(
      ["users", "vendors", "products", "orders", "reviews"].map((t) => sql`select ${t}::text as t, count(*)::int as n from ${sql.identifier(t)} where is_demo`),
      sql` union all `,
    ),
  );
  return KEY_TABLES.map((t) => ({ table: t, rows: Number(rows.find((r) => r.t === t)?.n ?? 0), demo: demo.find((r) => r.t === t)?.n ?? null }));
}

export async function emailHealth() {
  const [r] = await query<{ queued: number; stuck: number; failed7: number; logged: number; sent7: number; last_sent: string | null; last_failed: string | null }>(sql`
    select
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'queued' and created_at < now() - make_interval(mins => ${STUCK_AFTER_MINUTES}))::int as stuck,
      count(*) filter (where status = 'failed' and created_at > now() - interval '7 days')::int as failed7,
      count(*) filter (where status = 'logged')::int as logged,
      count(*) filter (where status = 'sent' and created_at > now() - interval '7 days')::int as sent7,
      max(sent_at) as last_sent,
      max(created_at) filter (where status = 'failed') as last_failed
    from email_outbox`);
  return { ...r, configured: !!process.env.RESEND_API_KEY };
}

export async function rateHealth(now = new Date()) {
  const d = await db();
  const [fx, ship, duty, rules, cats, s] = await Promise.all([
    d.select().from(fxRates),
    d.select().from(shippingRates),
    d.select().from(dutyRates),
    d.select().from(importRules),
    d.select({ id: categories.id }).from(categories),
    getSettings(["handling_fee", "commission", "gift_wrap", "escrow", "buyer_protection"]),
  ]);
  const dests = DESTINATIONS.map((x) => x.code);
  return {
    fx: DEFAULT_BUYER_CURRENCIES.map((c) => {
      const row = fx.find((r) => r.currency === c);
      return { currency: c, ...fxFreshness(row, now), kind: row?.status ?? null };
    }),
    shipping: shippingCoverage(ship, dests),
    duty: dutyCoverage(duty, dests, cats.map((c) => c.id)),
    rules: ruleCoverage(rules, dests, cats.map((c) => c.id)),
    fees: [
      { label: "Handling fee", pending: s.handling_fee.status === "pending", href: "/admin/rates/fees" },
      { label: "Commission", pending: s.commission.status === "pending", href: "/admin/rates/fees" },
      { label: "Gift wrap", pending: s.gift_wrap.status === "pending", href: "/admin/rates/fees" },
      { label: "Escrow period", pending: s.escrow.status === "pending", href: "/admin/settings#protection" },
      { label: "Return window", pending: s.buyer_protection.status === "pending", href: "/admin/settings#protection" },
    ],
  };
}

export async function jobHealth(now = new Date()) {
  const d = await db();
  const actions = JOBS.flatMap((j) => [...j.actions]);
  const runs = await d.select({ action: auditLog.action, summary: auditLog.summary, createdAt: auditLog.createdAt }).from(auditLog).where(inArray(auditLog.action, actions)).orderBy(desc(auditLog.createdAt)).limit(200);
  const [overdue] = await query<{ n: number }>(sql`select count(*)::int as n from orders where status = 'delivered' and funds_state = 'held' and auto_release_at < now()`);
  const schedule = readJson<{ crons?: { path: string; schedule: string }[] }>("vercel.json")?.crons ?? [];
  return {
    secretSet: !!process.env.CRON_SECRET,
    overdueReleases: Number(overdue?.n ?? 0),
    jobs: JOBS.map((j) => {
      const last = runs.find((r) => (j.actions as readonly string[]).includes(r.action));
      const failed = last ? /fail/i.test(last.action) || /fail/i.test(last.summary) : false;
      const ageHours = last ? (now.getTime() - last.createdAt.getTime()) / 3_600_000 : null;
      return { ...j, schedule: schedule.find((c) => c.path === j.path)?.schedule ?? null, last, failed, late: ageHours == null || ageHours > j.expectEveryHours * 2 };
    }),
  };
}
