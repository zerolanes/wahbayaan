import { isDemoMode } from "@/lib/settings";

/**
 * Sitewide notice shown whenever seeded demo content is visible, so sample
 * artisans, listings and reviews can never be mistaken for real ones.
 */
export function DemoRibbon() {
  if (!isDemoMode()) return null;
  return (
    <div className="relative z-[60] bg-[repeating-linear-gradient(135deg,#b8893b_0_12px,#a9502e_12px_24px)] px-4 py-1.5 text-center text-xs font-medium text-white">
      <span className="rounded bg-black/25 px-2 py-0.5">
        Demo content — the artisans, listings, reviews and orders on this site are fictional samples. Illustrations stand in for real photography.
      </span>
    </div>
  );
}
