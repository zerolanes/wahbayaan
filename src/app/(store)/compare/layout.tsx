import { requireFeature } from "@/lib/features";

/** Hidden when the "compare" feature flag is off. */
export default async function FeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("compare");
  return children;
}
