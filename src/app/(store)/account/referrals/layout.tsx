import { requireFeature } from "@/lib/features";

/** Hidden when the "referrals" feature flag is off. */
export default async function FeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("referrals");
  return children;
}
