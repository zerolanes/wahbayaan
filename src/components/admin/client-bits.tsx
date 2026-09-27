"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "./toaster";

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={cn("inline-flex items-center gap-1 rounded-full border border-umber-200 px-2 py-0.5 text-xs text-umber-700 hover:border-umber-400", className)}
      onClick={async () => {
        const text = value.startsWith("/") ? window.location.origin + value : value;
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast("success", "Copied to clipboard");
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast("error", "Couldn't access the clipboard");
        }
      }}
    >
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
      {label}
    </button>
  );
}

export function PrintButton({ children = "Print" }: { children?: ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-full bg-indigo-900 px-4 text-sm font-medium text-sand-50 hover:bg-indigo-800 print:hidden">
      <Printer className="size-4" />
      {children}
    </button>
  );
}

/** Select that submits its GET form on change (for filter bars). */
export function AutoSubmitSelect({ name, value, options, label }: { name: string; value: string; options: { value: string; label: string }[]; label: string }) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="h-9 rounded-full border border-umber-200 bg-white/90 px-3 pr-7 text-sm text-umber-900 focus:border-gold-500 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** File input with local previews before upload. */
export function ImageInput({ name, multiple, accept = "image/jpeg,image/png,image/webp,image/avif", label = "Choose image" }: { name: string; multiple?: boolean; accept?: string; label?: string }) {
  const [previews, setPreviews] = useState<string[]>([]);
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-umber-300 bg-white/60 px-3 py-2.5 text-sm text-umber-700 hover:border-gold-500">
        <span className="rounded-full bg-umber-100 px-2.5 py-0.5 text-xs font-medium">{label}</span>
        <span className="truncate text-umber-500">{previews.length ? `${previews.length} file(s) selected` : "JPG, PNG, WebP or AVIF · up to 10 MB"}</span>
        <input
          type="file"
          name={name}
          multiple={multiple}
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            previews.forEach((p) => URL.revokeObjectURL(p));
            setPreviews([...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f)));
          }}
        />
      </label>
      {previews.length ? (
        <div className="flex flex-wrap gap-2">
          {previews.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={p} alt="Selected upload preview" className="size-16 rounded-lg object-cover ring-1 ring-umber-200" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
