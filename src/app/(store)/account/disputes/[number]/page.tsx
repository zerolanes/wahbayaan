import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { isSvg } from "@/components/store/illustration-tag";
import { ThreadReplyForm } from "@/components/store/order-actions";
import { Badge, Breadcrumbs } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS_LABEL, DISPUTE_STEPS, disputeStep } from "@/lib/commerce/order-view";
import { getBuyerDispute } from "@/lib/queries/account";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export async function generateMetadata(props: PageProps<"/account/disputes/[number]">): Promise<Metadata> {
  const { number } = await props.params;
  return { title: `Case ${number}`, robots: { index: false } };
}

const RESOLUTION: Record<string, string> = {
  refund: "Full refund",
  partial_refund: "Partial refund",
  replacement: "Replacement",
  no_action: "Closed without changes",
};

const ROLE: Record<string, { label: string; tone: string }> = {
  buyer: { label: "You", tone: "bg-indigo-900 text-sand-50" },
  seller: { label: "Artisan", tone: "bg-sand-50 text-umber-800 ring-1 ring-umber-200" },
  staff: { label: "Wahbayaan team", tone: "bg-gold-50 text-umber-900 ring-1 ring-gold-300/60" },
};

export default async function DisputePage(props: PageProps<"/account/disputes/[number]">) {
  const { number } = await props.params;
  const user = await requireUser(`/account/disputes/${number}`);
  const c = await getBuyerDispute(user.id, number);
  if (!c) notFound();
  const step = disputeStep(c.status);
  const closed = ["resolved", "closed"].includes(c.status);
  const thread = [...c.messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs items={[{ label: "Account", href: "/account" }, { label: "Cases", href: "/account/disputes" }, { label: c.number }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-umber-900 md:text-5xl">Case {c.number}</h1>
            <p className="mt-1 text-sm text-umber-500">
              {DISPUTE_REASON_LABEL[c.reason]} · order{" "}
              <Link href={`/account/orders/${c.order.number}`} className="text-terracotta-600 hover:underline">
                {c.order.number}
              </Link>
              {c.vendorOrder ? ` · parcel from ${c.vendorOrder.vendor.displayName}` : ""} · opened {formatDate(c.createdAt)}
            </p>
          </div>
          <Badge tone={closed ? "success" : "danger"}>{DISPUTE_STATUS_LABEL[c.status] ?? c.status}</Badge>
        </div>
      </div>

      <ol className="grid grid-cols-4 gap-2" aria-label="Case progress">
        {DISPUTE_STEPS.map((s, i) => (
          <li key={s.key}>
            <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-gold-500" : "bg-umber-200")} />
            <span className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium sm:text-sm", i <= step ? "text-umber-900" : "text-umber-400")}>
              {i < step || closed ? <Check className="size-3.5 text-gold-600" aria-hidden /> : null}
              {s.label}
              {i === step && !closed ? <span className="sr-only">(current)</span> : null}
            </span>
          </li>
        ))}
      </ol>

      {closed ? (
        <div className="rounded-2xl bg-success-50 p-5 text-success-700 ring-1 ring-success-600/20">
          <p className="font-semibold">Resolved{c.resolution ? `: ${RESOLUTION[c.resolution]}` : ""}</p>
          {c.resolutionNote ? <p className="mt-1 text-sm">{c.resolutionNote}</p> : null}
          {c.resolvedAt ? <p className="mt-1 text-xs opacity-80">{formatDate(c.resolvedAt)}</p> : null}
        </div>
      ) : (
        <div className="flex gap-3 rounded-2xl bg-indigo-50 p-5 text-indigo-900 ring-1 ring-indigo-200">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm">
            The payment for this order is <strong>frozen</strong> — it can&apos;t reach the artisan while the case is open. Our team reviews the photos and messages from both of you
            and decides on a repair, replacement or refund.
          </p>
        </div>
      )}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <section aria-labelledby="thread-h">
          <h2 id="thread-h" className="font-display text-2xl text-umber-900">
            Conversation
          </h2>
          <ol className="mt-5 space-y-4">
            {thread.map((m) => {
              const role = ROLE[m.authorRole] ?? ROLE.staff;
              const mine = m.authorRole === "buyer";
              const lines = m.body.split("\n");
              const photos = lines.filter((l) => l.startsWith("Photo: ")).map((l) => l.slice(7));
              const text = lines.filter((l) => !l.startsWith("Photo: ")).join("\n");
              return (
                <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", role.tone, mine ? "rounded-br-md" : "rounded-bl-md")}>
                    <p className={cn("text-xs font-semibold", mine ? "text-gold-200" : "text-umber-500")}>
                      {role.label} · {formatDateTime(m.createdAt)}
                    </p>
                    {text ? <p className="mt-1 text-sm whitespace-pre-line">{text}</p> : null}
                    {photos.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {photos.map((p) => (
                          <a key={p} href={p} target="_blank" rel="noreferrer" className="relative block size-20 overflow-hidden rounded-lg">
                            <Image src={p} alt="Photo attached to the case" fill sizes="80px" unoptimized={isSvg(p)} className="object-cover" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {!closed ? (
            <div className="mt-6 rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
              <ThreadReplyForm kind="case" id={c.number} placeholder="Add details or answer a question from our team…" allowPhotos />
            </div>
          ) : null}
        </section>
        <aside className="space-y-5">
          <div className="rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
            <p className="text-xs font-semibold tracking-wider text-umber-500 uppercase">What you asked for</p>
            <p className="mt-2 text-sm text-umber-800">{c.desiredOutcome || "No preference given"}</p>
          </div>
          {c.evidenceUrls.length ? (
            <div className="rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
              <p className="text-xs font-semibold tracking-wider text-umber-500 uppercase">Your photos</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {c.evidenceUrls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-lg bg-sand-200">
                    <Image src={u} alt="Evidence photo" fill sizes="100px" unoptimized={isSvg(u)} className="object-cover" />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
            <p className="text-xs font-semibold tracking-wider text-umber-500 uppercase">Pieces in this order</p>
            <ul className="mt-3 space-y-2">
              {c.order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 text-sm text-umber-800">
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-sand-200">
                    {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="40px" unoptimized={isSvg(i.imageUrl)} className="object-cover" /> : null}
                  </span>
                  {i.title}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
