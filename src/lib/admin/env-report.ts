/**
 * Environment overview for System health. Secrets are only ever reported as
 * "set" / "not set" — their values never leave this function. Only a short
 * allow-list of non-sensitive settings shows a value.
 */
export type EnvItem = { name: string; group: string; kind: "secret" | "config"; set: boolean; value: string | null; note: string; tone: "ok" | "warn" | "info" };

type Spec = { name: string; group: string; kind: "secret" | "config"; note: string; show?: (v: string) => string; warnIfMissing?: boolean; warnIf?: (v: string | undefined, env: Record<string, string | undefined>) => boolean };

const SPECS: Spec[] = [
  { name: "NODE_ENV", group: "Runtime", kind: "config", note: "Build mode", show: (v) => v },
  { name: "DEMO_MODE", group: "Runtime", kind: "config", note: "Shows seeded demo rows with a ribbon. Must be off for launch.", show: (v) => v, warnIf: (v) => v === "true" },
  { name: "APP_URL", group: "Runtime", kind: "config", note: "Public base URL used in emails", show: (v) => v, warnIfMissing: true },
  { name: "DATABASE_URL", group: "Database", kind: "secret", note: "Empty = embedded PGlite (development only)", warnIf: (v, env) => !v && env.NODE_ENV === "production" },
  { name: "PGLITE_DIR", group: "Database", kind: "config", note: "Embedded database directory", show: (v) => v },
  { name: "AUTO_MIGRATE", group: "Database", kind: "config", note: "Run migrations on start (default on)", show: (v) => v },
  { name: "STRIPE_SECRET_KEY", group: "Payments", kind: "secret", note: "Without it checkout uses the labelled test simulator", warnIfMissing: true },
  { name: "STRIPE_WEBHOOK_SECRET", group: "Payments", kind: "secret", note: "Needed to confirm paid orders", warnIf: (v, env) => !!env.STRIPE_SECRET_KEY && !v },
  { name: "ALLOW_TEST_PAYMENTS", group: "Payments", kind: "config", note: "Permit the payment simulator", show: (v) => v, warnIf: (v, env) => v === "true" && env.NODE_ENV === "production" },
  { name: "RESEND_API_KEY", group: "Email", kind: "secret", note: "Without it emails are only logged to the outbox", warnIfMissing: true },
  { name: "EMAIL_FROM", group: "Email", kind: "config", note: "Sender address", show: (v) => v },
  { name: "CRON_SECRET", group: "Scheduled jobs", kind: "secret", note: "Protects /api/cron/*; jobs can't run without it", warnIfMissing: true },
  { name: "FX_PROVIDER_URL", group: "Exchange rates", kind: "config", note: "Live FX source", show: (v) => { try { return new URL(v).host; } catch { return "custom"; } } },
  { name: "UPLOAD_DIR", group: "Storage", kind: "config", note: "Local upload directory", show: (v) => v },
  { name: "ADMIN_EMAIL", group: "Bootstrap", kind: "config", note: "Owner account created on seed", show: () => "set" },
  { name: "ADMIN_PASSWORD", group: "Bootstrap", kind: "secret", note: "Owner bootstrap password — remove after first sign-in" },
];

export function envReport(env: Record<string, string | undefined>): EnvItem[] {
  return SPECS.map((s) => {
    const raw = env[s.name];
    const set = raw != null && raw !== "";
    const warn = s.warnIf ? s.warnIf(set ? raw : undefined, env) : !!s.warnIfMissing && !set;
    return {
      name: s.name,
      group: s.group,
      kind: s.kind,
      set,
      value: s.kind === "config" && set && s.show ? s.show(raw!) : null,
      note: s.note,
      tone: warn ? "warn" : set ? "ok" : "info",
    };
  });
}
