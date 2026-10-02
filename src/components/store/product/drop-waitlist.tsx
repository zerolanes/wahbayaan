"use client";

import { useActionState, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { joinWaitlist } from "@/app/actions/product";
import { countdownParts } from "@/lib/countdown";
import { cn } from "@/lib/utils/cn";

/** Live countdown to a drop. Renders the server time first, then ticks. */
export function Countdown({ target, tone = "light", size = "md", className }: { target: string; tone?: "light" | "dark"; size?: "sm" | "md"; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const parts = countdownParts(target, now ?? new Date(target).getTime() - 1);
  const dark = tone === "dark";
  const units = [
    { label: "days", value: parts.days },
    { label: "hrs", value: parts.hours },
    { label: "min", value: parts.minutes },
    { label: "sec", value: parts.seconds },
  ];
  if (now != null && parts.done) return <p className={cn("font-semibold", dark ? "text-gold-200" : "text-success-700", className)}>Open now — refresh to buy</p>;
  return (
    <div className={cn("flex gap-2", className)} role="timer" aria-label={`Opens in ${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes`}>
      {units.map((u) => (
        <div
          key={u.label}
          className={cn(
            "flex flex-col items-center rounded-xl",
            size === "sm" ? "min-w-12 px-2 py-1.5" : "min-w-16 px-3 py-2.5",
            dark ? "bg-white/10 text-sand-50 ring-1 ring-white/10" : "bg-indigo-950 text-sand-50",
          )}
        >
          <span className={cn("font-display tabular-nums", size === "sm" ? "text-xl" : "text-3xl")} suppressHydrationWarning>
            {now == null ? "–" : String(u.value).padStart(2, "0")}
          </span>
          <span className="text-[10px] tracking-widest text-gold-300 uppercase">{u.label}</span>
        </div>
      ))}
    </div>
  );
}

export function WaitlistForm({ productId, defaultEmail, tone = "light" }: { productId: string; defaultEmail?: string | null; tone?: "light" | "dark" }) {
  const [state, action, pending] = useActionState(joinWaitlist, null);
  const dark = tone === "dark";
  if (state?.ok)
    return (
      <p className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm", dark ? "bg-white/10 text-gold-100" : "bg-success-50 text-success-700")} role="status">
        <BellRing className="size-4" aria-hidden /> {state.message}
      </p>
    );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <label htmlFor={`wl-${productId}`} className={cn("text-sm font-medium", dark ? "text-sand-100" : "text-umber-800")}>
        Get an email when it opens
      </label>
      <div className={cn("flex overflow-hidden rounded-full border focus-within:border-gold-400", dark ? "border-white/20 bg-white/5" : "border-umber-300/70 bg-white/80")}>
        <input
          id={`wl-${productId}`}
          name="email"
          type="email"
          required
          defaultValue={defaultEmail ?? ""}
          placeholder="you@example.com"
          className={cn("min-w-0 flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none", dark ? "text-sand-50 placeholder:text-sand-200/40" : "text-umber-900 placeholder:text-umber-500")}
        />
        <button disabled={pending} className="bg-gold-400 px-5 text-sm font-medium text-ink transition hover:bg-gold-300 disabled:opacity-60">
          {pending ? "…" : "Join waitlist"}
        </button>
      </div>
      {state?.error ? <p className="text-sm text-danger-600">{state.error}</p> : null}
    </form>
  );
}
