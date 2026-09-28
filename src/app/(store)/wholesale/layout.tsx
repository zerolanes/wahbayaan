import { requireFeature } from "@/lib/features";

/** Hidden when the "wholesale" feature flag is off. */
export default async function FeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("wholesale");
  return children;
}
