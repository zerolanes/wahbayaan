import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getActiveAnnouncement } from "@/lib/queries/storefront";

/** Sitewide banner managed in Admin → Content → Announcements (one at a time, inside its date window). */
export async function AnnouncementBar() {
  const a = await getActiveAnnouncement();
  if (!a) return null;
  const inner = (
    <>
      {a.message}
      {a.link ? <ArrowRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" aria-hidden /> : null}
    </>
  );
  const cls = "group inline-flex items-center gap-1.5 hover:text-white";
  return (
    <div className="bg-indigo-950 px-4 py-2 text-center text-xs font-medium text-sand-100 sm:text-[0.8rem]" role="region" aria-label="Announcement">
      {a.link ? (
        a.link.startsWith("/") ? (
          <Link href={a.link} className={cls}>
            {inner}
          </Link>
        ) : (
          <a href={a.link} className={cls} rel="noopener">
            {inner}
          </a>
        )
      ) : (
        <span className="inline-flex items-center gap-1.5">{inner}</span>
      )}
    </div>
  );
}
