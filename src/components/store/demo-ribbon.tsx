import { isDemoMode } from "@/lib/settings";

/**
 * Sitewide notice shown whenever seeded demo content is visible, so sample
 * artisans, listings and reviews can never be mistaken for real ones.
 */
export function DemoRibbon({ variant = "bar" }: { variant?: "bar" | "pill" }) {
  if (!isDemoMode()) return null;
  if (variant === "pill") {
    // Full-bleed pages (the 3D homepage) keep the label visible as a fixed pill.
    return (
      <div className="fixed bottom-4 left-4 z-[60] max-w-[calc(100vw-2rem)] rounded-full bg-[repeating-linear-gradient(135deg,#b8893b_0_10px,#a9502e_10px_20px)] p-[3px] shadow-lift">
        <p className="rounded-full bg-indigo-950/90 px-3 py-1.5 text-[11px] font-medium text-sand-50" title="The artisans, listings, reviews and orders on this site are fictional samples. Illustrations stand in for real photography.">
          Demo content — sample artisans &amp; illustrations
        </p>
      </div>
    );
  }
  return (
    <div className="relative z-[60] bg-[repeating-linear-gradient(135deg,#b8893b_0_12px,#a9502e_12px_24px)] px-4 py-1.5 text-center text-xs font-medium text-white">
      <span className="rounded bg-black/25 px-2 py-0.5">
        Demo content — the artisans, listings, reviews and orders on this site are fictional samples. Illustrations stand in for real photography.
      </span>
    </div>
  );
}
