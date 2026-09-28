import { describe, expect, it } from "vitest";
import { emailBlocks, redactEmailBody } from "@/lib/admin/email-preview";
import { envReport } from "@/lib/admin/env-report";

describe("envReport", () => {
  const env = {
    NODE_ENV: "production",
    DEMO_MODE: "true",
    DATABASE_URL: "postgres://user:hunter2@db/prod",
    STRIPE_SECRET_KEY: "sk_live_supersecret",
    RESEND_API_KEY: "re_secret",
    CRON_SECRET: "cron-secret-value",
    ADMIN_PASSWORD: "owner-pass",
    FX_PROVIDER_URL: "https://open.er-api.com/v6/latest/PKR?key=abc",
  };
  const report = envReport(env);

  it("never exposes a secret value", () => {
    const text = JSON.stringify(report);
    for (const secret of ["hunter2", "sk_live_supersecret", "re_secret", "cron-secret-value", "owner-pass", "key=abc"]) expect(text).not.toContain(secret);
    expect(report.find((r) => r.name === "DATABASE_URL")).toMatchObject({ set: true, value: null, kind: "secret" });
  });
  it("shows safe config values and flags risky ones", () => {
    expect(report.find((r) => r.name === "DEMO_MODE")).toMatchObject({ value: "true", tone: "warn" });
    expect(report.find((r) => r.name === "FX_PROVIDER_URL")?.value).toBe("open.er-api.com");
    expect(report.find((r) => r.name === "STRIPE_WEBHOOK_SECRET")?.tone).toBe("warn"); // Stripe on, webhook secret missing
    expect(report.find((r) => r.name === "APP_URL")?.tone).toBe("warn");
  });
});

describe("email preview", () => {
  it("masks passwords and tokens but keeps the rest", () => {
    const { text, redactions } = redactEmailBody("Hello Ayesha,\n\nEmail: a@b.pk\nTemporary password: abcd-efgh-2345\nReset: https://x.test/reset?token=zzz&x=1");
    expect(text).toContain("Temporary password: ••••••••");
    expect(text).not.toContain("abcd-efgh-2345");
    expect(text).toContain("?token=••••&x=1");
    expect(text).toContain("Email: a@b.pk");
    expect(redactions).toBe(2);
  });
  it("splits plain text into paragraphs", () => {
    expect(emailBlocks("a\nb\n\n\nc\r\n\r\n  ")).toEqual([
      { kind: "p", lines: ["a", "b"] },
      { kind: "p", lines: ["c"] },
    ]);
  });
});
