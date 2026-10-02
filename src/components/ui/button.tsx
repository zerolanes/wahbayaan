import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "accent" | "gold" | "outline" | "ghost" | "link" | "danger" | "light" | "glass" | "tinted";
export type ButtonSize = "sm" | "md" | "lg";

/** Pill buttons with instant press feedback (`.pressable`: scale on pointer-down, spring back). */
const base =
  "pressable inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-full disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-indigo-900 text-sand-50 hover:bg-indigo-800 shadow-soft",
  accent: "bg-terracotta-600 text-white hover:bg-terracotta-700 shadow-soft",
  gold: "bg-gradient-to-b from-gold-300 to-gold-500 text-ink hover:from-gold-200 hover:to-gold-400 shadow-glow",
  outline: "bg-white/70 text-umber-900 shadow-[inset_0_0_0_1px_rgb(34_26_19/0.16)] hover:bg-white hover:shadow-[inset_0_0_0_1px_rgb(34_26_19/0.32)]",
  ghost: "text-umber-800 hover:bg-umber-900/[0.06]",
  link: "text-terracotta-600 hover:text-terracotta-700 underline underline-offset-4 rounded-none px-0!",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
  light: "bg-white/12 text-sand-50 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)] backdrop-blur-md hover:bg-white/20",
  /** Translucent control floating over imagery or content. */
  glass: "glass-thin text-umber-900 hover:[--glass-bg:var(--glass-regular)]",
  /** Quiet filled style for secondary actions (Apple "tinted"). */
  tinted: "bg-indigo-900/[0.07] text-indigo-900 hover:bg-indigo-900/[0.12]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  // `btn btn-<variant> btn-<size>` are style hooks for the admin theme (globals.css); they add no storefront styles.
  return cn("btn", `btn-${variant}`, `btn-${size}`, base, variants[variant], sizes[size], className);
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode };

export function Button({ variant, size, className, ...props }: Common & ComponentProps<"button">) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: Common & ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
