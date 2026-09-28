import Link from "next/link";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db/client";
import { announcements } from "@/lib/db/schema";

/** The current site-wide announcement (managed in Admin → Content → Announcements), if any. */
export async function AnnouncementBar() {
  const d = await db();
  const now = new Date();
  const [a] = await d
    .select()
    .from(announcements)
    .where(and(eq(announcements.isActive, true), or(isNull(announcements.startsAt), lte(announcements.startsAt, now)), or(isNull(announcements.endsAt), gte(announcements.endsAt, now))))
    .orderBy(desc(announcements.createdAt))
    .limit(1);
  if (!a) return null;
  const inner = (
    <>
      {a.message}
      {a.link ? <ArrowRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" aria-hidden /> : null}
    </>
  );
  return (
    <div className="bg-indigo-950 px-4 py-2 text-center text-xs font-medium text-sand-100 sm:text-[0.8rem]" role="region" aria-label="Announcement">
      {a.link ? (
        <Link href={a.link} className="group inline-flex items-center gap-1.5 hover:text-white">
          {inner}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5">{inner}</span>
      )}
    </div>
  );
}
