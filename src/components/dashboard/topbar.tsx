import Link from "next/link";
import { logout } from "@/app/actions/auth";

export function DashboardTopbar({ userName, context, badge }: { userName: string; context: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-umber-200/60 bg-sand-50/85 px-4 pl-16 backdrop-blur-xl lg:pl-8">
      <div className="flex min-w-0 items-center gap-3 text-sm text-umber-600">{context}</div>
      <div className="flex items-center gap-3 text-sm">
        {badge}
        <Link href="/" className="hidden text-umber-600 hover:text-umber-900 sm:inline">
          View store ↗
        </Link>
        <span className="hidden text-umber-400 sm:inline">·</span>
        <span className="hidden font-medium text-umber-800 sm:inline">{userName}</span>
        <form action={logout}>
          <button className="rounded-full border border-umber-200 px-3 py-1 text-umber-700 hover:border-umber-400">Sign out</button>
        </form>
      </div>
    </div>
  );
}
