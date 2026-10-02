"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Floating glass toast. Sits above the mobile tab bar, bottom-right on desktop.
 * Rendered only while visible; enters with the shared spring fade-up (which
 * becomes an instant appearance under reduced motion).
 */
export function Toast({ icon, children, action, onDismiss, className }: { icon?: ReactNode; children: ReactNode; action?: ReactNode; onDismiss?: () => void; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "glass-dark fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md animate-fade-up items-center gap-3 rounded-[1.25rem] p-3 pl-4 md:right-6 md:bottom-6 md:left-auto md:mx-0",
        className,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1 text-sm text-sand-50">{children}</div>
      {action}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="pressable grid size-9 shrink-0 place-items-center rounded-full text-sand-100 hover:bg-white/10" aria-label="Dismiss">
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
