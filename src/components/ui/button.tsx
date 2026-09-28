import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "accent" | "gold" | "outline" | "ghost" | "link" | "danger" | "light";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-full transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-indigo-900 text-sand-50 hover:bg-indigo-800 shadow-soft hover:shadow-lift",
  accent: "bg-terracotta-600 text-white hover:bg-terracotta-700 shadow-soft hover:shadow-lift",
  gold: "bg-gradient-to-b from-gold-300 to-gold-500 text-ink hover:from-gold-200 hover:to-gold-400 shadow-glow",
  outline: "border border-umber-300/70 text-umber-900 hover:border-umber-900 hover:bg-white/60",
  ghost: "text-umber-800 hover:bg-umber-900/5",
  link: "text-terracotta-600 hover:text-terracotta-700 underline underline-offset-4 rounded-none px-0!",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
  light: "bg-white/10 text-sand-50 border border-white/25 backdrop-blur hover:bg-white/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-sm",
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
