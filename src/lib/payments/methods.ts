/**
 * Payment methods offered at checkout: card, JazzCash and Easypaisa.
 *
 * Non-secret configuration (display name, merchant / store id, enabled per
 * market, sandbox or live) is a setting edited in Admin → Payment methods.
 * Secrets come only from environment variables and are never stored or shown —
 * the admin sees "set / not set":
 *
 *   card       STRIPE_SECRET_KEY (existing Stripe path; without it the labelled test mode)
 *   JazzCash   JAZZCASH_MERCHANT_ID (or the setting), JAZZCASH_PASSWORD, JAZZCASH_INTEGRITY_SALT
 *   Easypaisa  EASYPAISA_STORE_ID (or the setting), EASYPAISA_HASH_KEY
 *
 * JazzCash and Easypaisa have no live integration yet: their merchant
 * documentation arrives with the merchant account, and we don't guess at
 * undocumented APIs. Until then they read "Awaiting merchant account". With
 * credentials in sandbox mode they run through the built-in simulator, clearly
 * labelled, in development and demo only. Pure (env is passed in).
 */
export const PAYMENT_METHODS = ["card", "jazzcash", "easypaisa"] as const;
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number];
export type Market = "domestic" | "international";

export type MethodConfig = {
  displayName: string;
  enabledDomestic: boolean;
  enabledInternational: boolean;
  /** JazzCash merchant id / Easypaisa store id (not secret). */
  merchantId: string | null;
  mode: "sandbox" | "live";
};

export type PaymentMethodsSetting = Record<PaymentMethodId, MethodConfig>;

export const DEFAULT_PAYMENT_METHODS: PaymentMethodsSetting = {
  card: { displayName: "Debit / credit card", enabledDomestic: true, enabledInternational: true, merchantId: null, mode: "live" },
  jazzcash: { displayName: "JazzCash", enabledDomestic: true, enabledInternational: false, merchantId: null, mode: "sandbox" },
  easypaisa: { displayName: "Easypaisa", enabledDomestic: true, enabledInternational: false, merchantId: null, mode: "sandbox" },
};

/** Environment variables each method needs (names only — values are never read into the UI). */
export const METHOD_SECRETS: Record<PaymentMethodId, { env: string; secret: boolean; label: string }[]> = {
  card: [{ env: "STRIPE_SECRET_KEY", secret: true, label: "Stripe secret key" }],
  jazzcash: [
    { env: "JAZZCASH_MERCHANT_ID", secret: false, label: "Merchant id (or enter it below)" },
    { env: "JAZZCASH_PASSWORD", secret: true, label: "Password" },
    { env: "JAZZCASH_INTEGRITY_SALT", secret: true, label: "Integrity salt" },
  ],
  easypaisa: [
    { env: "EASYPAISA_STORE_ID", secret: false, label: "Store id (or enter it below)" },
    { env: "EASYPAISA_HASH_KEY", secret: true, label: "Hash key" },
  ],
};

export type Env = Record<string, string | undefined>;

export type MethodStatus = "live" | "test" | "sandbox" | "awaiting_merchant_account" | "disabled";

export type MethodAvailability = {
  id: PaymentMethodId;
  label: string;
  status: MethodStatus;
  available: boolean;
  /** Shown next to the option at checkout and in the admin. */
  note: string;
  /** Provider id stored on the payment record. */
  provider: string;
};

const has = (env: Env, key: string) => !!env[key]?.trim();

export function credentialsComplete(id: PaymentMethodId, config: MethodConfig, env: Env): boolean {
  if (id === "card") return has(env, "STRIPE_SECRET_KEY");
  if (id === "jazzcash") return (!!config.merchantId?.trim() || has(env, "JAZZCASH_MERCHANT_ID")) && has(env, "JAZZCASH_PASSWORD") && has(env, "JAZZCASH_INTEGRITY_SALT");
  return (!!config.merchantId?.trim() || has(env, "EASYPAISA_STORE_ID")) && has(env, "EASYPAISA_HASH_KEY");
}

export function methodAvailability(id: PaymentMethodId, config: MethodConfig, market: Market, env: Env, testPaymentsAllowed: boolean): MethodAvailability {
  const label = config.displayName || id;
  const enabled = market === "domestic" ? config.enabledDomestic : config.enabledInternational;
  if (!enabled) return { id, label, status: "disabled", available: false, note: "Not offered for this market", provider: id };

  if (id === "card") {
    const key = env.STRIPE_SECRET_KEY;
    if (key?.trim()) {
      const live = key.startsWith("sk_live");
      return { id, label, status: live ? "live" : "test", available: true, note: live ? "Card payment (Stripe)" : "Stripe test mode", provider: "stripe" };
    }
    if (testPaymentsAllowed) return { id, label, status: "test", available: true, note: "Test payment — no money moves", provider: "test" };
    return { id, label, status: "awaiting_merchant_account", available: false, note: "Awaiting merchant account", provider: "stripe" };
  }

  if (!credentialsComplete(id, config, env)) return { id, label, status: "awaiting_merchant_account", available: false, note: "Awaiting merchant account", provider: id };
  if (config.mode === "sandbox" && testPaymentsAllowed)
    return { id, label, status: "sandbox", available: true, note: `${label} sandbox — simulated, no money moves`, provider: `${id}-sandbox` };
  return {
    id,
    label,
    status: "awaiting_merchant_account",
    available: false,
    note: "Credentials set — live checkout opens once the merchant account's integration is confirmed",
    provider: id,
  };
}

export function availableMethods(setting: PaymentMethodsSetting, market: Market, env: Env, testPaymentsAllowed: boolean): MethodAvailability[] {
  return PAYMENT_METHODS.map((id) => methodAvailability(id, setting[id], market, env, testPaymentsAllowed)).filter((m) => m.status !== "disabled");
}

/** Providers whose checkout runs through the built-in labelled simulator. */
export const SIMULATED_PROVIDERS = ["test", "jazzcash-sandbox", "easypaisa-sandbox"];

export const METHOD_STATUS_LABEL: Record<MethodStatus, string> = {
  live: "Live",
  test: "Test mode",
  sandbox: "Sandbox (simulated)",
  awaiting_merchant_account: "Awaiting merchant account",
  disabled: "Off",
};
