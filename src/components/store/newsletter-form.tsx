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
      <label htmlFor={`nl-${source}`} className={cn("text-xs font-semibold tracking-[0.2em] uppercase", light ? "sr-only" : "text-gold-300")}>
        Stories from the workshops
      </label>
      <div className={cn("flex overflow-hidden rounded-full border", light ? "border-umber-300/70 bg-white focus-within:border-umber-900" : "mt-3 border-white/15 bg-white/5 focus-within:border-gold-400")}>
        <input
          id={`nl-${source}`}
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className={cn("min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm focus:outline-none", light ? "text-umber-900 placeholder:text-umber-400" : "text-sand-50 placeholder:text-sand-200/40")}
        />
        <button disabled={pending} className={cn("px-5 text-sm font-medium transition disabled:opacity-60", light ? "bg-indigo-900 text-sand-50 hover:bg-indigo-800" : "bg-gold-400 text-ink hover:bg-gold-300")}>
          {pending ? "…" : "Join"}
        </button>
      </div>
      {state ? <p className={cn("mt-2 text-xs", state.ok ? (light ? "text-success-700" : "text-gold-200") : light ? "text-danger-600" : "text-terracotta-300")}>{state.message}</p> : null}
    </form>
  );
}
