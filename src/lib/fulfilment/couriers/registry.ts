import { manualAdapter } from "./manual";
import { COURIER_PROVIDERS } from "./providers";
import { sandboxAdapter } from "./sandbox";
import { CourierAdapterError, type CourierAdapter } from "./types";

/** Adapters with working code. Real providers are added here once written (see ./providers.ts). */
const IMPLEMENTED: Record<string, CourierAdapter> = {
  manual: manualAdapter,
  sandbox: sandboxAdapter,
};

export type AdapterChoice = { id: string; label: string; implemented: boolean };

/** Every adapter staff can pick for a courier in Admin → Hubs. */
export function adapterChoices(): AdapterChoice[] {
  return [
    { id: "manual", label: manualAdapter.label, implemented: true },
    { id: "sandbox", label: sandboxAdapter.label, implemented: true },
    ...COURIER_PROVIDERS.map((p) => ({ id: p.id, label: `${p.name} API (not integrated yet)`, implemented: !!IMPLEMENTED[p.id] })),
  ];
}

/** The adapter for an id; unknown or unimplemented ids fall back to manual entry. */
export function getAdapter(id: string | null | undefined): CourierAdapter {
  return (id && IMPLEMENTED[id]) || manualAdapter;
}

/** Strict lookup used by the booking service: refuses unimplemented or unavailable adapters. */
export function requireAdapter(id: string, env: Record<string, string | undefined> = process.env): CourierAdapter {
  const a = IMPLEMENTED[id];
  if (!a) throw new CourierAdapterError(`The ${id} integration isn't built yet — book with the courier and enter the tracking number instead.`);
  const ok = a.available(env);
  if (!ok.ok) throw new CourierAdapterError(ok.reason);
  return a;
}

export { CourierAdapterError };
