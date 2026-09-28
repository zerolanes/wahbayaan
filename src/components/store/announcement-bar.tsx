import Link from "next/link";
import { getActiveAnnouncement } from "@/lib/queries/storefront";

/** Sitewide banner managed in Admin → Content → Announcements (one at a time, inside its date window). */
export async function AnnouncementBar() {
  const a = await getActiveAnnouncement();
  if (!a) return null;
  const inner = (
    <>
      {a.message}
      {a.link ? <span aria-hidden> →</span> : null}
    </>
  );
  return (
    <div className="bg-indigo-950 px-4 py-2 text-center text-sm text-sand-50">
      {a.link ? (
        a.link.startsWith("/") ? (
          <Link href={a.link} className="hover:underline">
            {inner}
          </Link>
        ) : (
          <a href={a.link} className="hover:underline" rel="noopener">
            {inner}
          </a>
        )
      ) : (
        inner
      )}
    </div>
  );
}
