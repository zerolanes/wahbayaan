"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

const pillSelect =
  "h-10 appearance-none rounded-full bg-white pr-9 pl-4 text-sm font-medium text-umber-900 shadow-[inset_0_0_0_1px_rgb(34_26_19/0.16)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgb(34_26_19/0.32)] focus:ring-4 focus:ring-gold-200/50 focus:outline-none";

/** A pill <select> that submits its form on change (a noscript button covers no-JS). */
export function AutoSubmitSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative inline-flex">
      <select {...props} className={className ? `${pillSelect} ${className}` : pillSelect} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-umber-700" aria-hidden />
    </span>
  );
}

function closeDrawer(el: HTMLElement) {
  const details = el.closest("details");
  if (details) details.open = false;
}

/** Close control for the <details>-based mobile filter drawer. Works as a plain link without JS. */
export function DrawerClose({ href, children, className, icon, ...rest }: { href: string; children?: ReactNode; className?: string; icon?: boolean } & Pick<ComponentProps<"a">, "aria-hidden" | "tabIndex">) {
  return (
    <a
      href={href}
      className={className}
      {...rest}
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
