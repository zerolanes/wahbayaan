import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { logout } from "@/app/actions/auth";

export function DashboardTopbar({ userName, context, badge }: { userName: string; context: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[#e5e5e5] bg-white/90 px-4 pl-16 backdrop-blur lg:pl-8">
      <div className="flex min-w-0 items-center gap-3 text-sm text-[#737373]">{context}</div>
      <div className="flex items-center gap-3 text-sm">
        {badge}
        <Link href="/" className="hidden items-center gap-1 text-[#525252] hover:text-[#0a0a0a] sm:inline-flex">
          View store <ArrowUpRight className="size-3.5" />
        </Link>
        <span className="hidden h-4 w-px bg-[#e5e5e5] sm:inline-block" aria-hidden />
        <span className="hidden font-medium text-[#0a0a0a] sm:inline">{userName}</span>
        <form action={logout}>
          <button className="h-8 rounded-md border border-[#e5e5e5] bg-white px-3 text-[13px] font-medium text-[#0a0a0a] hover:bg-[#fafafa]">Sign out</button>
        </form>
      </div>
    </div>
  );
}
