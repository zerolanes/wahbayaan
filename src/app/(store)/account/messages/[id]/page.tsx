import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull, ne } from "drizzle-orm";
import { isSvg } from "@/components/store/illustration-tag";
import { ThreadReplyForm } from "@/components/store/order-actions";
import { Breadcrumbs } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { messages } from "@/lib/db/schema";
import { getBuyerConversation } from "@/lib/queries/account";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };

export default async function ConversationPage(props: PageProps<"/account/messages/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/account/messages/${id}`);
  const conv = await getBuyerConversation(user.id, id);
  if (!conv) notFound();
  // Read receipts for the artisan's messages.
  const d = await db();
  await d.update(messages).set({ readAt: new Date() }).where(and(eq(messages.conversationId, conv.id), isNull(messages.readAt), ne(messages.senderUserId, user.id)));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Account", href: "/account" }, { label: "Messages", href: "/account/messages" }, { label: conv.vendor.displayName }]} />
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-sand-50 ring-1 ring-umber-200/60">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-umber-200/60 px-5 py-4">
          <Link href={`/artisans/${conv.vendor.slug}`} className="flex items-center gap-3">
            <span className="relative size-12 overflow-hidden rounded-full bg-sand-200">
              {conv.vendor.profilePhotoUrl ? <Image src={conv.vendor.profilePhotoUrl} alt="" fill sizes="48px" unoptimized={isSvg(conv.vendor.profilePhotoUrl)} className="object-cover" /> : null}
            </span>
            <span>
              <span className="block font-display text-xl text-umber-900">{conv.vendor.displayName}</span>
              <span className="text-xs text-umber-500">
                {conv.vendor.craft} · {conv.vendor.workshopCity}
                {conv.vendor.responseTimeHours ? ` · usually replies within ${conv.vendor.responseTimeHours} hours` : ""}
              </span>
            </span>
          </Link>
          {conv.product ? (
            <Link href={`/product/${conv.product.slug}`} className="rounded-full bg-sand-100 px-3 py-1 text-xs text-umber-700 hover:text-umber-900">
              About: {conv.product.title}
            </Link>
          ) : null}
        </header>
        <ol className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-6">
          {conv.messages.length ? (
            conv.messages.map((m) => {
              const mine = m.senderUserId === user.id;
              return (
                <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5", mine ? "rounded-br-md bg-indigo-900 text-sand-50" : "rounded-bl-md bg-sand-100 text-umber-900 ring-1 ring-umber-200/60")}>
                    <p className="text-sm whitespace-pre-line">{m.body}</p>
                    <p className={cn("mt-1 text-[11px]", mine ? "text-sand-200/60" : "text-umber-400")}>{formatDateTime(m.createdAt)}</p>
                  </div>
                </li>
              );
            })
          ) : (
            <li className="py-8 text-center text-sm text-umber-500">
              Say hello — ask about sizes, colours in daylight, or anything the listing doesn&apos;t cover. Please keep payments on Wahbayaan so you stay protected.
            </li>
          )}
        </ol>
        <div className="border-t border-umber-200/60 bg-sand-100/40 p-5">
          <ThreadReplyForm kind="conversation" id={conv.id} placeholder={`Write to ${conv.vendor.displayName.split(" ")[0]}…`} />
          <p className="mt-2 text-xs text-umber-500">For your protection, always pay through Wahbayaan — never directly to an artisan.</p>
        </div>
      </div>
    </div>
  );
}
