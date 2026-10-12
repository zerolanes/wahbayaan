/**
 * Real courier integrations — EXTENSION POINTS, not implementations.
 *
 * No courier API endpoint, field name or authentication scheme is assumed
 * here: each must be written against the courier's own developer documentation
 * once Wahbayaan has a contract and API credentials. Until then, book these
 * couriers with the `manual` adapter (type the tracking number).
 *
 * To add one:
 *   1. Create `./<id>.ts` exporting a `CourierAdapter` (see ./types.ts):
 *      `bookShipment` (create the consignment, return its tracking number),
 *      `getLabel` (return the courier's label file — `provider_file`),
 *      `track` (map the courier's statuses to `TrackStatus`).
 *   2. Read credentials ONLY from the env vars listed below (server-side; never
 *      in settings, never sent to the browser). Admin → Hubs shows set / not set.
 *   3. Register it in `IMPLEMENTED` in ./registry.ts and pick it for the courier
 *      in Admin → Hubs → Courier booking.
 */
export type ProviderSpec = {
  id: string;
  name: string;
  scope: "domestic" | "international";
  /** Environment variable names this integration will read. Our own naming — not the courier's. */
  env: string[];
  note: string;
};

export const COURIER_PROVIDERS: ProviderSpec[] = [
  { id: "tcs", name: "TCS", scope: "domestic", env: ["TCS_API_USERNAME", "TCS_API_PASSWORD", "TCS_ACCOUNT_NUMBER"], note: "Domestic courier. Needs a TCS corporate account and API access." },
  { id: "leopards", name: "Leopards Courier", scope: "domestic", env: ["LEOPARDS_API_KEY", "LEOPARDS_API_PASSWORD"], note: "Domestic courier. Needs a merchant account and API credentials." },
  { id: "mnp", name: "M&P (Muller & Phipps)", scope: "domestic", env: ["MNP_API_USERNAME", "MNP_API_PASSWORD", "MNP_ACCOUNT_NUMBER"], note: "Domestic courier. Needs a corporate account and API access." },
  { id: "postex", name: "PostEx", scope: "domestic", env: ["POSTEX_API_TOKEN"], note: "Domestic courier. Needs a merchant account and API token." },
  { id: "trax", name: "Trax", scope: "domestic", env: ["TRAX_API_KEY"], note: "Domestic courier. Needs a merchant account and API key." },
  { id: "dhl", name: "DHL Express", scope: "international", env: ["DHL_API_KEY", "DHL_API_SECRET", "DHL_ACCOUNT_NUMBER"], note: "International express. Needs the owner's DHL account and developer credentials." },
  { id: "fedex", name: "FedEx", scope: "international", env: ["FEDEX_CLIENT_ID", "FEDEX_CLIENT_SECRET", "FEDEX_ACCOUNT_NUMBER"], note: "International express. Needs the owner's FedEx account and developer credentials." },
  { id: "aramex", name: "Aramex", scope: "international", env: ["ARAMEX_USERNAME", "ARAMEX_PASSWORD", "ARAMEX_ACCOUNT_NUMBER", "ARAMEX_ACCOUNT_PIN"], note: "International express. Needs the owner's Aramex account and API credentials." },
];

/** Which credentials are present — names only, values are never read out. */
export function providerCredentialStatus(spec: ProviderSpec, env: Record<string, string | undefined>) {
  const vars = spec.env.map((name) => ({ name, set: !!env[name]?.trim() }));
  return { vars, allSet: vars.every((v) => v.set), anySet: vars.some((v) => v.set) };
}
