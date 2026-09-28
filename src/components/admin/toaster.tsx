"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, KeyRound, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Toast = { id: number; kind: "success" | "error" | "info"; message: string; data?: Record<string, string> };
const EVENT = "admin:toast";

/**
 * Show a toast from any client component. Toasts that carry `data` (e.g. a
 * generated password shown once) stay until dismissed.
 */
export function toast(kind: Toast["kind"], message: string, data?: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { kind, message, data } }));
}

/** Toast stack for the admin panel (mounted once in the admin layout). */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const { kind, message, data } = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++seq;
      setToasts((t) => [...t.slice(-3), { id, kind, message, data }]);
      if (!data) setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(92vw,400px)] flex-col gap-2 print:hidden">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          data-toast={t.kind}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lift backdrop-blur animate-fade-up",
            t.kind === "error" ? "border-danger-600/30 bg-danger-50/95 text-danger-700" : t.data ? "border-gold-300 bg-gold-50/95 text-gold-900" : "border-umber-200 bg-sand-50/95 text-umber-800",
          )}
        >
          {t.kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : t.data ? <KeyRound className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" />}
          <div className="flex-1">
            <p>{t.message}</p>
            {t.data
              ? Object.entries(t.data).map(([k, v]) => (
                  <p key={k} className="mt-2">
                    <span className="block text-xs text-gold-800">{k}</span>
                    <code className="font-mono text-base font-semibold select-all">{v}</code>
                    <button type="button" className="ml-2 rounded-full border border-gold-400 px-2 text-xs hover:bg-gold-100" onClick={() => navigator.clipboard?.writeText(v)}>
                      Copy
                    </button>
                  </p>
                ))
              : null}
          </div>
          <button type="button" aria-label="Dismiss" className="text-umber-400 hover:text-umber-800" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
