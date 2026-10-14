import { cn } from "@/lib/utils/cn";

/**
 * Hero centrepiece: the "Wahbayaan" wordmark as real text (Fraunces) in solid
 * deep navy with a stepped, darker ink extrusion (`.wordmark-static` in
 * globals.css). Pure CSS — no WebGL, no JavaScript — so it paints with the
 * page, stays vector-crisp at every size and looks the same at every motion
 * setting. Depth steps never drop below 1px, so small phones stay sharp.
 */
export function HeroWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto aspect-[2.3/1] w-full max-w-5xl sm:aspect-[3/1]", className)}>
      <h1 className="wordmark-static absolute inset-0 grid place-items-center">Wahbayaan</h1>
    </div>
  );
}
