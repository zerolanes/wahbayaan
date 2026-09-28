"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils/cn";

/** Submit button drawn as an on/off switch. Put it inside an ActionForm that flips the value. */
export function SwitchSubmit({ on, label, confirm }: { on: boolean; label: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60",
        on ? "bg-umber-900" : "bg-umber-300",
      )}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition", on ? "translate-x-[22px]" : "translate-x-0.5", pending && "animate-pulse")} />
    </button>
  );
}
