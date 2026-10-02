import { and, eq, inArray, sql } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { AccountNav } from "@/components/store/account-nav";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { conversations, customRequests, disputes, messages, orders } from "@/lib/db/schema";
import { logout } from "@/app/actions/auth";

/** Buyer account shell. Each page calls `requireUser()` itself so sign-in returns to the right place. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return children;
  const d = await db();
  const [[needsAction], [openCases], [quotes], [unread]] = await Promise.all([
    d.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.userId, user.id), inArray(orders.status, ["quote_sent", "delivered"]))),
    d.select({ n: sql<number>`count(*)::int` }).from(disputes).where(and(eq(disputes.userId, user.id), sql`${disputes.status} not in ('resolved','closed')`)),
    d.select({ n: sql<number>`count(*)::int` }).from(customRequests).where(and(eq(customRequests.userId, user.id), eq(customRequests.status, "quoted"))),
    d
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(and(eq(conversations.buyerId, user.id), sql`${messages.readAt} is null`, sql`${messages.senderUserId} is distinct from ${user.id}`)),
  ]);
  return (
    <Container className="py-10 md:py-14">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-5 hidden lg:block">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold-600 uppercase">Your account</p>
            <p className="mt-1 truncate font-display text-xl text-umber-900">{user.name}</p>
            <p className="truncate text-xs text-umber-500">{user.email}</p>
          </div>
          <AccountNav
            badges={{
              "/account/orders": needsAction?.n,
              "/account/disputes": openCases?.n,
              "/account/requests": quotes?.n,
              "/account/messages": unread?.n,
            }}
          />
          <form action={logout} className="mt-4 hidden lg:block">
            <button className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-umber-500 transition hover:bg-umber-900/5 hover:text-umber-900">
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </form>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
