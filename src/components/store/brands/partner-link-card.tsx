import { ArrowUpRight } from "lucide-react";
import { PARTNER_LINK_LABEL } from "@/lib/affiliate";
import type { PartnerLinkCard as Card } from "@/lib/queries/affiliates";

/**
 * Outbound affiliate card: opens the partner store through the programme's
 * tracking link. Clearly labelled "Partner link"; never added to the Wahbayaan
 * bag, and no Wahbayaan price — price and delivery are set by the store.
 */
export function PartnerLinkCard({ card }: { card: Card }) {
  return (
    <a
      href={card.href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className="group block"
      aria-label={`${card.title} — shop at ${card.brandName} (partner link, opens in a new tab)`}
      data-partner-link
    >
      <span className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand-100">
        {/* External partner image: shown only when the programme's terms allow it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition duration-700 group-hover:scale-105" />
        <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-umber-800 shadow-soft">{PARTNER_LINK_LABEL}</span>
      </span>
      <span className="mt-3 line-clamp-2 block text-sm font-medium text-umber-900 group-hover:text-terracotta-700">{card.title}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-sm text-terracotta-700">
        Shop at {card.brandName} <ArrowUpRight className="size-3.5" aria-hidden />
      </span>
    </a>
  );
}
