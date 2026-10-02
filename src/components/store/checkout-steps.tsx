import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STEPS = [
  { id: "bag", label: "Bag", href: "/cart" },
  { id: "details", label: "Delivery", href: "/checkout" },
  { id: "payment", label: "Payment" },
  { id: "done", label: "Confirmation" },
] as const;

export type CheckoutStep = (typeof STEPS)[number]["id"];

/** Calm progress line for the buying flow: bag → delivery → payment → confirmation. */
export function CheckoutSteps({ current, className }: { current: CheckoutStep; className?: string }) {
  const at = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Checkout progress" className={cn("max-w-full overflow-x-auto scrollbar-none", className)}>
      <ol className="flex items-center gap-1.5 text-sm sm:gap-2">
        {STEPS.map((s, i) => {
          const done = i < at;
          const here = i === at;
          const inner = (
            <>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                  done ? "bg-success-600 text-white" : here ? "bg-indigo-900 text-sand-50" : "bg-umber-900/[0.07] text-umber-700",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("whitespace-nowrap", here ? "font-semibold text-umber-900" : done ? "text-umber-800" : "text-umber-700", !here && "max-sm:sr-only")}>
                {s.label}
                {done ? <span className="sr-only"> (done)</span> : null}
              </span>
            </>
          );
          return (
            <li key={s.id} className="flex items-center gap-1.5 sm:gap-2" aria-current={here ? "step" : undefined}>
              {i > 0 ? <span aria-hidden className={cn("h-px w-5 sm:w-8", i <= at ? "bg-success-600/60" : "bg-umber-900/15")} /> : null}
              {done && "href" in s ? (
                <Link href={s.href} className="pressable flex items-center gap-2 rounded-full py-1 pr-2 hover:bg-umber-900/[0.05]">
                  {inner}
                </Link>
              ) : (
                <span className="flex items-center gap-2 py-1 pr-2">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
