import { requireFeature } from "@/lib/features";

/** Hidden when the "customRequests" feature flag is off. */
export default async function FeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("customRequests");
  return children;
}
