"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "@/app/actions/newsletter";
import { cn } from "@/lib/utils/cn";

export function NewsletterForm({ source = "footer", tone = "dark" }: { source?: string; tone?: "dark" | "light" }) {
  const light = tone === "light";
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  return (
    <form action={action} className={light ? "" : "mt-6"}>
      <input type="hidden" name="source" value={source} />
      <label htmlFor={`nl-${source}`} className={cn("text-xs font-semibold tracking-[0.08em] uppercase", light ? "sr-only" : "text-gold-300")}>
        Stories from the workshops
      </label>
      <div className={cn("flex items-center gap-1 rounded-full p-1 transition-shadow", light ? "bg-white shadow-[inset_0_0_0_1px_rgb(34_26_19/0.16)] focus-within:shadow-[inset_0_0_0_2px_var(--color-gold-500)]" : "mt-3 bg-white/[0.07] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] focus-within:shadow-[inset_0_0_0_2px_var(--color-gold-400)]")}>
        <input
          id={`nl-${source}`}
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className={cn("h-10 min-w-0 flex-1 bg-transparent pl-3 text-base focus:outline-none sm:text-sm", light ? "text-umber-900 placeholder:text-umber-500" : "text-sand-50 placeholder:text-sand-200/60")}
        />
        <button disabled={pending} className={cn("pressable h-10 shrink-0 rounded-full px-5 text-sm font-medium disabled:opacity-60", light ? "bg-indigo-900 text-sand-50 hover:bg-indigo-800" : "bg-gold-400 text-ink hover:bg-gold-300")}>
          {pending ? "…" : "Join"}
        </button>
      </div>
      {state ? <p className={cn("mt-2 text-xs", state.ok ? (light ? "text-success-700" : "text-gold-200") : light ? "text-danger-600" : "text-terracotta-300")}>{state.message}</p> : null}
    </form>
  );
}
