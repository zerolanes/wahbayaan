import type { ReactNode } from "react";

/** `icon` is a rendered element (e.g. <Package />) so client code never imports the whole icon set. */
export type NavItem = { href: string; label: string; icon: ReactNode; permission?: string; badge?: number | null; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };
