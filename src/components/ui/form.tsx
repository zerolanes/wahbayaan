import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** `ui-control` is a style hook for the admin theme (globals.css). */
const control =
  "ui-control w-full rounded-[var(--radius-control)] border border-umber-200 bg-white px-3.5 py-2.5 text-base text-umber-900 placeholder:text-umber-500 shadow-[inset_0_1px_2px_rgb(34_26_19/0.04)] transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none disabled:bg-sand-100 sm:text-[0.95rem]";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        control,
        "h-11 appearance-none bg-[url(data:image/svg+xml;utf8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2712%27%20height=%278%27%3E%3Cpath%20d=%27M1%201l5%205%205-5%27%20fill=%27none%27%20stroke=%27%2376644f%27%20stroke-width=%271.6%27/%3E%3C/svg%3E)] bg-[length:12px_8px] bg-[right_0.9rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-medium text-umber-800", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  required,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-terracotta-600"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-sm text-danger-600">{error}</p> : hint ? <p className="text-sm text-umber-500">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-umber-800", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-umber-300 accent-indigo-800" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Radio({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-umber-800", className)}>
      <input type="radio" className="mt-0.5 size-4 shrink-0 accent-indigo-800" {...props} />
      <span>{label}</span>
    </label>
  );
}
