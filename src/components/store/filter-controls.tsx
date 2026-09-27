"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

const pillSelect =
  "h-10 appearance-none rounded-full border border-umber-300/70 bg-sand-50/70 pr-9 pl-4 text-sm font-medium text-umber-900 transition hover:border-umber-500 focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none";

/** A pill <select> that submits its form on change (a noscript button covers no-JS). */
export function AutoSubmitSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative inline-flex">
      <select {...props} className={className ? `${pillSelect} ${className}` : pillSelect} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-umber-500" aria-hidden />
    </span>
  );
}

function closeDrawer(el: HTMLElement) {
  const details = el.closest("details");
  if (details) details.open = false;
}

/** Close control for the <details>-based mobile filter drawer. Works as a plain link without JS. */
export function DrawerClose({ href, children, className, icon }: { href: string; children?: ReactNode; className?: string; icon?: boolean }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        closeDrawer(e.currentTarget);
      }}
    >
      {icon ? <X className="size-4" aria-hidden /> : null}
      {children}
    </a>
  );
}

/** Locks page scroll while the surrounding <details> drawer is open. */
export function DrawerScrollReset() {
  return (
    <span
      hidden
      ref={(el) => {
        if (!el) return;
        const details = el.closest("details");
        const onToggle = () => {
          document.documentElement.style.overflow = details?.open ? "hidden" : "";
        };
        details?.addEventListener("toggle", onToggle);
        return () => {
          details?.removeEventListener("toggle", onToggle);
          document.documentElement.style.overflow = "";
        };
      }}
    />
  );
}
