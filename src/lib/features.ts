import "server-only";
import { notFound } from "next/navigation";
import { getSetting, type SettingsShape } from "@/lib/settings";

export type FeatureFlag = keyof SettingsShape["feature_flags"];

/** 404s a storefront route whose feature is switched off in Admin → Feature flags. */
export async function requireFeature(flag: FeatureFlag) {
  const flags = await getSetting("feature_flags");
  if (!flags[flag]) notFound();
}

export async function featureFlags() {
  return getSetting("feature_flags");
}
