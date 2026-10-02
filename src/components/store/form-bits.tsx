import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Presentational pieces shared by the storefront's client forms. */
export const fieldClass = (error?: string, extra?: string) =>
  cn(
    "w-full rounded-xl border bg-white/90 px-3.5 py-2.5 text-[0.95rem] text-umber-900 placeholder:text-umber-500 transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none",
    error ? "border-danger-600" : "border-umber-200",
    extra,
  );

export function FormRow({ id, label, error, hint, optional, children, className }: { id: string; label: ReactNode; error?: string; hint?: ReactNode; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-umber-800">
        {label}
        {optional ? <span className="font-normal text-umber-600"> (optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger-600" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-umber-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
      {message}
    </p>
  );
}

export function SuccessPanel({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-card)] bg-sand-50 p-8 text-center shadow-soft ring-1 ring-umber-200/60", className)} role="status">
      <CheckCircle2 className="mx-auto size-10 text-success-600" aria-hidden />
      <h2 className="mt-4 font-display text-3xl text-umber-900">{title}</h2>
      {children ? <div className="mx-auto mt-3 max-w-md text-umber-600">{children}</div> : null}
    </div>
  );
}

export function SubmitButton({ pending, children, pendingLabel = "Sending…", className }: { pending: boolean; children: ReactNode; pendingLabel?: string; className?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-13 items-center justify-center gap-2 rounded-full bg-indigo-900 px-7 text-base font-medium text-sand-50 shadow-soft transition hover:bg-indigo-800 hover:shadow-lift disabled:opacity-60",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
