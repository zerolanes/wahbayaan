import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/** `scrollLabel` makes the scroll wrapper keyboard-focusable (for tables likely to scroll sideways). */
export function Table({ className, scrollLabel, ...props }: ComponentProps<"table"> & { scrollLabel?: string }) {
  return (
    <div className="overflow-x-auto" {...(scrollLabel ? { tabIndex: 0, role: "region", "aria-label": scrollLabel } : {})}>
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-umber-200 text-left text-xs tracking-wider text-umber-500 uppercase", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("px-4 py-3 font-medium whitespace-nowrap", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-umber-200/60", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition hover:bg-gold-50/50", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle text-umber-800", className)} {...props} />;
}
