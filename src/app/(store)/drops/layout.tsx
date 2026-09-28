import { requireFeature } from "@/lib/features";

/** Hidden when the "limitedDrops" feature flag is off. */
export default async function FeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("limitedDrops");
  return children;
}
