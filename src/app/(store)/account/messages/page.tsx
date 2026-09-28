import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { isSvg } from "@/components/store/illustration-tag";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { getBuyerConversations } from "@/lib/queries/account";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default async function MessagesPage() {
  const user = await requireUser("/account/messages");
  const conversations = await getBuyerConversations(user.id);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Your account" title="Messages" description="Conversations with artisans — ask about colour in daylight, sizes, or how a commission is coming along." />
      {conversations.length ? (
        <ul className="divide-y divide-umber-200/60 overflow-hidden rounded-[var(--radius-card)] bg-sand-50 ring-1 ring-umber-200/60">
          {conversations.map((c) => {
            const last = c.messages[0];
            const fromMe = last?.senderUserId === user.id;
            return (
              <li key={c.id}>
                <Link href={`/account/messages/${c.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-gold-50/50">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-sand-200">
                    {c.vendor.profilePhotoUrl ? <Image src={c.vendor.profilePhotoUrl} alt="" fill sizes="48px" unoptimized={isSvg(c.vendor.profilePhotoUrl)} className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={cn("truncate text-umber-900", c.unread ? "font-semibold" : "font-medium")}>{c.vendor.displayName}</span>
                      <span className="shrink-0 text-xs text-umber-400">{timeAgo(c.lastMessageAt)}</span>
                    </span>
                    <span className="block truncate text-sm text-umber-600">{c.subject}</span>
                    {last ? (
                      <span className={cn("block truncate text-sm", c.unread ? "text-umber-900" : "text-umber-500")}>
                        {fromMe ? "You: " : ""}
                        {last.body}
                      </span>
                    ) : null}
                  </span>
                  {c.unread ? <span className="grid min-w-6 place-items-center rounded-full bg-terracotta-600 px-1.5 text-xs font-semibold text-white">{c.unread}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<MessageCircle className="size-10" aria-hidden />} title="No messages yet" action={<ButtonLink href="/artisans">Meet the artisans</ButtonLink>}>
          Use “Message the artisan” on any piece or profile to ask a question before you buy.
        </EmptyState>
      )}
    </div>
  );
}
