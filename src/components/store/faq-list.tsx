import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Accessible accordion built on <details> — works without JavaScript. */
export function FaqList({ items, className, tone = "light" }: { items: { id: string; question: string; answer: string }[]; className?: string; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div className={cn("divide-y border-y", dark ? "divide-white/10 border-white/10" : "divide-umber-200/70 border-umber-200/70", className)}>
      {items.map((f) => (
        <details key={f.id} className="group">
          <summary className={cn("flex cursor-pointer list-none items-start justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden", dark ? "text-sand-50" : "text-umber-900")}>
            <span className="font-display text-lg md:text-xl">{f.question}</span>
            <span
              aria-hidden
              className={cn(
                "mt-1 grid size-7 shrink-0 place-items-center rounded-full ring-1 transition duration-300 group-open:rotate-45",
                dark ? "text-gold-300 ring-white/20" : "text-gold-700 ring-umber-300/70 group-open:bg-indigo-900 group-open:text-sand-50 group-open:ring-indigo-900",
              )}
            >
              <Plus className="size-4" />
            </span>
          </summary>
          <p className={cn("max-w-3xl pb-6 leading-relaxed", dark ? "text-sand-200/80" : "text-umber-700")}>{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
