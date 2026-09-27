import Link from "next/link";
import { notFound } from "next/navigation";
import { markConversationRead, sellerReply } from "@/app/actions/seller";
import { ActionForm, SubmitButton } from "@/components/seller/action-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Breadcrumbs, Card, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { getSellerConversation } from "@/lib/seller/queries";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Conversation" };

export default async function SellerConversation(props: PageProps<"/seller/messages/[id]">) {
  const user = await requireSeller();
  const { id } = await props.params;
  const convo = await getSellerConversation(user.vendorId, id);
  if (!convo) notFound();
  await markConversationRead(id);
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Messages", href: "/seller/messages" }, { label: convo.buyer.name }]} />
      <PageHeader
        eyebrow={convo.buyer.name}
        title={convo.subject}
        description={
          convo.product ? (
            <>
              About{" "}
              <Link href={`/product/${convo.product.slug}`} className="underline">
                {convo.product.title}
              </Link>
            </>
          ) : undefined
        }
      />
      <Card className="p-5">
        <ol className="space-y-4">
          {convo.messages.map((m) => {
            const mine = m.senderUserId === user.id;
            return (
              <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm", mine ? "text-sand-50 bg-indigo-900" : "bg-sand-100 text-umber-800")}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cn("mt-1 text-[11px]", mine ? "text-sand-200/60" : "text-umber-500")}>{formatDateTime(m.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="border-umber-200/60 mt-6 border-t pt-5">
          <ActionForm action={sellerReply}>
            <>
              <input type="hidden" name="conversationId" value={convo.id} />
              <Textarea name="body" placeholder="Write a reply…" rows={3} required />
              <div className="flex items-center justify-between gap-3">
                <p className="text-umber-500 text-xs">Keep conversations on Wahbayaan — it protects both you and the buyer.</p>
                <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
              </div>
            </>
          </ActionForm>
        </div>
      </Card>
    </div>
  );
}
