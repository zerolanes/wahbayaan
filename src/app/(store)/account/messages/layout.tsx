import { requireFeature } from "@/lib/features";

/** Hidden when the "messaging" feature flag is off. */
export default async function FeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("messaging");
  return children;
}
