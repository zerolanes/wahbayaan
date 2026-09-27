"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Check, Columns3 } from "lucide-react";
import { toggleCompare } from "@/app/actions/compare";
import { cn } from "@/lib/utils/cn";

/** "Add to compare" toggle for product cards and the product page. */
export function CompareToggle({ productId, compared, variant = "inline", className }: { productId: string; compared: boolean; variant?: "inline" | "full"; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(compared);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      setOptimistic(!optimistic);
      const r = await toggleCompare(productId);
      if (r.error) setError(r.error);
    });
  };

  if (variant === "full") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={onClick}
          aria-pressed={optimistic}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition",
            optimistic ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-umber-300/70 hover:border-umber-900",
            pending && "opacity-70",
          )}
        >
          {optimistic ? <Check className="size-4" aria-hidden /> : <Columns3 className="size-4" aria-hidden />}
          {optimistic ? "In your comparison" : "Add to compare"}
        </button>
        {optimistic && !error ? (
          <Link href="/compare" className="mt-1.5 block text-center text-xs text-terracotta-600 hover:underline">
            Open comparison →
          </Link>
        ) : null}
        {error ? (
          <p className="mt-1.5 text-center text-xs text-danger-600" role="alert">
            {error}{" "}
            <Link href="/compare" className="underline">
              Manage
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={optimistic}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition",
          optimistic ? "bg-indigo-50 text-indigo-800" : "text-umber-500 hover:bg-umber-900/5 hover:text-umber-900",
        )}
      >
        {optimistic ? <Check className="size-3" aria-hidden /> : <Columns3 className="size-3" aria-hidden />}
        <span className="max-sm:sr-only">{optimistic ? "Comparing" : "Compare"}</span>
      </button>
      {error ? (
        <span role="alert" className="absolute right-0 bottom-full z-10 mb-1 w-48 rounded-lg bg-umber-900 px-2 py-1.5 text-[11px] text-sand-50 shadow-lift">
          {error}
        </span>
      ) : null}
    </span>
  );
}
