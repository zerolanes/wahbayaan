/** Typed `analytics` setting (no secrets here; keys live in `analytics_secrets`). */
export const GEO_PROVIDERS = ["ipapi", "ipinfo", "ip2location", "off"] as const;
export type GeoProvider = (typeof GEO_PROVIDERS)[number];
export const GEO_PROVIDER_LABELS: Record<GeoProvider, string> = {
  ipapi: "ipapi.co (no key, default)",
  ipinfo: "ipinfo.io (token)",
  ip2location: "IP2Location.io (API key)",
  off: "Off — no location lookups",
};

export type AnalyticsSetting = {
  /** Consent version. Raising it re-asks every visitor. */
  consentRev: number;
  geoProvider: GeoProvider;
  /** Visits and page views older than this are deleted by the daily cleanup. */
  retentionDays: number;
  /** Upper bound on stored page views; the oldest are removed first. */
  maxPageViews: number;
  /** Proof-of-consent records are kept separately, longer. */
  consentRetentionDays: number;
};

export const DEFAULT_ANALYTICS: AnalyticsSetting = {
  consentRev: 1,
  geoProvider: "ipapi",
  retentionDays: 90,
  maxPageViews: 500_000,
  consentRetentionDays: 365 * 3,
};

export function normalizeAnalytics(v: Partial<AnalyticsSetting> | null | undefined): AnalyticsSetting {
  const d = DEFAULT_ANALYTICS;
  const o = v ?? {};
  const int = (x: unknown, min: number, max: number, def: number) => {
    const n = Number(x);
    return Number.isInteger(n) && n >= min && n <= max ? n : def;
  };
  return {
    consentRev: int(o.consentRev, 1, 1_000_000, d.consentRev),
    geoProvider: (GEO_PROVIDERS as readonly string[]).includes(o.geoProvider as string) ? (o.geoProvider as GeoProvider) : d.geoProvider,
    retentionDays: int(o.retentionDays, 1, 3650, d.retentionDays),
    maxPageViews: int(o.maxPageViews, 1000, 100_000_000, d.maxPageViews),
    consentRetentionDays: int(o.consentRetentionDays, 30, 3650 * 2, d.consentRetentionDays),
  };
}
