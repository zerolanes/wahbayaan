import Link from "next/link";
import { ArrowRight } from "lucide-react";
import content from "@/content/home.json";
import { getActiveAnnouncement } from "@/lib/queries/storefront";
import { PhoolStrip } from "./truck-art";

/**
 * Promo strip above the header, with a thin phool-patti edge. Shows the banner
 * managed in Admin → Content → Announcements (one at a time, inside its date
 * window); with none active it shows the default line from `src/content/home.json`.
 */
export async function AnnouncementBar() {
  const a = await getActiveAnnouncement();
  const text = a ? a.message : content.promo.text;
  const link = a ? (a.link ? { label: "Details", href: a.link } : null) : content.promo.link;
  const cls = "group inline-flex items-center gap-1 font-semibold text-[var(--wb-magenta-ink)] underline-offset-4 hover:underline";
  const inner = link ? (
    <>
      {link.label}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </>
  ) : null;
  return (
    <div role="region" aria-label="Announcement" className="bg-white">
      <p className="mx-auto flex max-w-[1400px] items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[0.8rem] font-medium text-[var(--wb-ink)] max-sm:flex-col sm:py-2.5">
        <span>{text}</span>
        {link ? (
          link.href.startsWith("/") ? (
            <Link href={link.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <a href={link.href} className={cls} rel="noopener">
              {inner}
            </a>
          )
        ) : null}
      </p>
      <PhoolStrip thin />
    </div>
  );
}
