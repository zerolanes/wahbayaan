import type { ReactNode } from "react";
import { activeSocialLinks, type SocialLinks, type SocialNetwork } from "@/lib/social";
import { cn } from "@/lib/utils/cn";

/**
 * Monochrome social icons as inline SVG (currentColor). Plain outbound links:
 * no third-party scripts, embeds or trackers. Renders nothing when no link is set.
 * Works in server and client components.
 */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const GLYPHS: Record<SocialNetwork, ReactNode> = {
  instagram: (
    <g {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </g>
  ),
  facebook: <path fill="currentColor" d="M14 8.1h3V4.2h-3.1c-2.9 0-4.4 1.8-4.4 4.6V11H7v3.8h2.5V22h4v-7.2h3l.5-3.8h-3.5V9c0-.6.3-.9.5-.9z" />,
  tiktok: <path fill="currentColor" d="M16.2 3c.3 2.3 1.8 3.9 4 4.1v3.4c-1.5 0-2.9-.5-4-1.3v6.3a5.6 5.6 0 1 1-5.6-5.6h.4v3.5a2.2 2.2 0 1 0 1.8 2.1V3h3.4z" />,
  youtube: (
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15.1V8.9l5.3 3.1L10 15.1z"
    />
  ),
  x: <path fill="currentColor" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />,
  pinterest: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.2 20.3l2-8.3" />
      <path d="M9.3 9.3c.4-1.8 1.9-3 3.8-3 2.1 0 3.6 1.5 3.6 3.6 0 2.6-1.6 4.6-3.7 4.6-1.1 0-1.9-.7-1.7-1.8" />
    </g>
  ),
  whatsapp: (
    <g {...stroke}>
      <path d="M3.6 20.4l1.3-4.1A8.5 8.5 0 1 1 8 19.2l-4.4 1.2z" />
      <path d="M9.2 8.4c-.4.9 0 2.6 1.4 4.1 1.5 1.5 3.2 2 4.1 1.5l.8-1.2-1.8-1-.9.7c-.8-.4-1.6-1.2-2-2l.7-.9-1-1.8-1.3.6z" strokeWidth="1.3" />
    </g>
  ),
  linkedin: (
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15A1.5 1.5 0 0 1 4.5 3zm3 7.5V18H10v-7.5H7.5zm1.3-4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM12 10.5V18h2.5v-4c0-1.1.5-1.7 1.4-1.7.8 0 1.1.6 1.1 1.7v4h2.5v-4.6c0-2.2-1.2-3.1-2.8-3.1-1 0-1.8.5-2.2 1.1v-.9H12z"
    />
  ),
};

export function SocialIcon({ network, className }: { network: SocialNetwork; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden focusable="false" className={className} data-social-icon={network}>
      {GLYPHS[network]}
    </svg>
  );
}

/**
 * A row of icon links. `owner` names whose profiles they are, for the accessible
 * label ("Wahbayaan on Instagram"). Only networks with a URL are rendered.
 */
export function SocialLinksList({ links, owner, className, linkClassName, label }: { links: SocialLinks | null | undefined; owner: string; className?: string; linkClassName?: string; label?: string }) {
  const items = activeSocialLinks(links);
  if (!items.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-1", className)} aria-label={label ?? `${owner} on social media`}>
      {items.map((s) => (
        <li key={s.key}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${owner} on ${s.label} (opens in a new tab)`}
            title={s.label}
            className={cn("pressable grid size-10 place-items-center rounded-full transition-colors", linkClassName)}
          >
            <SocialIcon network={s.key} className="size-[18px]" />
          </a>
        </li>
      ))}
    </ul>
  );
}
