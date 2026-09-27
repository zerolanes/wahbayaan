import "server-only";
import { db } from "@/lib/db/client";
import { fxRates } from "@/lib/db/schema";

const TRACKED = ["USD", "GBP", "CAD"] as const;

/**
 * Fetch live exchange rates from the configured provider (default: open.er-api.com,
 * base PKR) and store them with status "live". Nothing is written unless every
 * tracked currency comes back with a sane value.
 */
export async function refreshFxFromProvider(): Promise<{ ok: true; rates: Record<string, number> } | { ok: false; error: string }> {
  const url = process.env.FX_PROVIDER_URL || "https://open.er-api.com/v6/latest/PKR";
  let json: { rates?: Record<string, number>; result?: string };
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, error: `Provider responded ${res.status}` };
    json = await res.json();
  } catch (e) {
    return { ok: false, error: `Could not reach the FX provider: ${e instanceof Error ? e.message : String(e)}` };
  }
  const out: Record<string, number> = {};
  for (const c of TRACKED) {
    const perPkr = json.rates?.[c];
    // Provider gives units of `c` per 1 PKR; we store PKR per 1 unit of `c`.
    if (!perPkr || perPkr <= 0) return { ok: false, error: `Provider returned no rate for ${c}` };
    const pkrPerUnit = 1 / perPkr;
    if (pkrPerUnit < 1 || pkrPerUnit > 10_000) return { ok: false, error: `Implausible ${c} rate from provider (${pkrPerUnit})` };
    out[c] = pkrPerUnit;
  }
  const d = await db();
  const source = `${new URL(url).hostname} · fetched ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
  for (const [currency, pkrPerUnit] of Object.entries(out)) {
    await d
      .insert(fxRates)
      .values({ currency, pkrPerUnit: pkrPerUnit.toFixed(4), source, status: "live" })
      .onConflictDoUpdate({ target: fxRates.currency, set: { pkrPerUnit: pkrPerUnit.toFixed(4), source, status: "live", updatedAt: new Date() } });
  }
  return { ok: true, rates: out };
}
