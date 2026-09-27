import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LifeBuoy } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS_LABEL } from "@/lib/commerce/order-view";
import { getBuyerDisputes } from "@/lib/queries/account";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Your cases", robots: { index: false } };

export default async function DisputesPage() {
  const user = await requireUser("/account/disputes");
  const cases = await getBuyerDisputes(user.id);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Buyer protection"
        title="Cases"
        description="If a piece arrives damaged, isn't as described or never arrives, open a case from the order. Held funds are frozen until it's resolved."
      />
      {cases.length ? (
        <ul className="space-y-3">
          {cases.map((c) => {
            const closed = ["resolved", "closed"].includes(c.status);
            return (
              <li key={c.id}>
                <Link href={`/account/disputes/${c.number}`} className="group flex items-center gap-4 rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60 transition hover:shadow-soft">
                  <span className={closed ? "grid size-11 place-items-center rounded-full bg-umber-100 text-umber-500" : "grid size-11 place-items-center rounded-full bg-danger-50 text-danger-600"}>
                    <LifeBuoy className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-umber-900">{c.number}</span>
                      <Badge tone={closed ? "success" : "danger"}>{DISPUTE_STATUS_LABEL[c.status] ?? c.status}</Badge>
                    </span>
                    <span className="block text-sm text-umber-600">
                      {DISPUTE_REASON_LABEL[c.reason]} · order {c.order.number} · opened {formatDate(c.createdAt)}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-umber-300 group-hover:text-umber-600" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<LifeBuoy className="size-10" aria-hidden />} title="No cases — good news">
          You haven&apos;t needed to open a case. If you ever do, start it from the order page — we&apos;ll freeze the held payment while we sort it out with you and the artisan.
        </EmptyState>
      )}
    </div>
  );
}
