import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { listSellerConversations } from "@/lib/seller/queries";
import { timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Messages" };

export default async function SellerMessages() {
  const user = await requireSeller();
  const convos = await listSellerConversations(user.vendorId, user.id);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyers"
        title="Messages"
        description="Questions from buyers before and after they order. Replying quickly improves the response time shown on your shop."
      />
      {convos.length ? (
        <Card className="divide-umber-200/60 divide-y">
          {convos.map((c) => (
            <Link key={c.id} href={`/seller/messages/${c.id}`} className="hover:bg-gold-50/50 flex items-center gap-4 px-5 py-4 transition">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-100 font-medium text-indigo-800">{c.buyerName.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={c.unread ? "text-umber-900 font-semibold" : "text-umber-800"}>{c.buyerName}</span>
                  <span className="text-umber-500 text-xs">{timeAgo(c.lastMessageAt)}</span>
                </span>
                <span className="text-umber-500 block truncate text-sm">
                  {c.subject} — {c.lastMessage}
                </span>
              </span>
              {c.unread ? <span className="bg-terracotta-600 rounded-full px-2 text-xs text-white">{c.unread}</span> : null}
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<MessagesSquare className="size-8" />} title="No messages yet">
          When a buyer asks about one of your pieces, the conversation appears here.
        </EmptyState>
      )}
    </div>
  );
}
