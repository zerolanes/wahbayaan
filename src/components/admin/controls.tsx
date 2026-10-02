import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Compact form controls for the dense admin UI (the storefront kit's controls
 * are sized for buyers). Same palette and focus ring.
 */
const base =
  "w-full rounded-xl border border-umber-200 bg-white/90 px-3 text-sm text-umber-900 placeholder:text-umber-400 shadow-[inset_0_1px_2px_rgb(34_26_19/0.04)] transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none disabled:bg-sand-100 disabled:text-umber-400";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(base, "h-9", className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(base, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

export function SelectInput({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        base,
        "h-9 appearance-none bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='7'><path d='M1 1l4 4 4-4' fill='none' stroke='%2376644f' stroke-width='1.5'/></svg>\")] bg-[length:10px_7px] bg-[right_0.75rem_center] bg-no-repeat pr-8",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldRow({ label, hint, children, className, htmlFor }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      {htmlFor ? (
        <>
          <label htmlFor={htmlFor} className="block text-xs font-medium tracking-wide text-umber-600">
            {label}
          </label>
          {children}
        </>
      ) : (
        // Without an explicit id, wrapping the control is what ties the label to it for screen readers.
        <label className="block space-y-1">
          <span className="block text-xs font-medium tracking-wide text-umber-600">{label}</span>
          {children}
        </label>
      )}
      {hint ? <p className="text-xs text-umber-500">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ label, className, ...props }: ComponentProps<"input"> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm text-umber-800", className)}>
      <input type="checkbox" className="size-4 rounded border-umber-300 accent-indigo-800" {...props} />
      <span>{label}</span>
    </label>
  );
}
