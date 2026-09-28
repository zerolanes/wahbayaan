import { requireFeature } from "@/lib/features";

/** Hidden when the "journal" feature flag is off. */
export default async function FeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("journal");
  return children;
}
