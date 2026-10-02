import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";
import { isSvg } from "./illustration-tag";
import { OrderStatusBadge } from "./order-view";

export type OrderCardData = {
  number: string;
  status: string;
  currency: string;
  total: number;
  totalComplete: boolean;
  createdAt: Date;
  items: { id: string; title: string; imageUrl: string | null; qty: number }[];
};

const NEXT_STEP: Record<string, string> = {
  awaiting_quote: "We're confirming shipping & import costs",
  quote_sent: "Your quote is ready — approve to pay",
  awaiting_payment: "Waiting for payment",
  paid: "Paid — the artisan is starting",
  in_fulfilment: "Being made or packed",
  shipped: "On its way to you",
  delivered: "Delivered — please confirm",
  disputed: "Case open — funds frozen",
};

export function OrderCard({ order }: { order: OrderCardData }) {
  const first = order.items[0];
  return (
    <Link
      href={`/account/orders/${order.number}`}
      className="group flex items-center gap-4 rounded-2xl bg-sand-50 p-4 ring-1 ring-umber-200/60 transition hover:shadow-soft hover:ring-umber-300 sm:gap-5 sm:p-5"
    >
      <span className="flex shrink-0 -space-x-6">
        {order.items.slice(0, 3).map((i) => (
          <span key={i.id} className="relative size-16 overflow-hidden rounded-xl bg-sand-200 ring-2 ring-sand-50 sm:size-20">
            {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="80px" unoptimized={isSvg(i.imageUrl)} className="object-cover" /> : null}
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-umber-900">{order.number}</span>
          <OrderStatusBadge status={order.status} />
        </span>
        <span className="mt-1 block truncate text-sm text-umber-700">
          {first?.title}
          {order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}
        </span>
        <span className="mt-0.5 block text-xs text-umber-500">
          {formatDate(order.createdAt)}
          {NEXT_STEP[order.status] ? ` · ${NEXT_STEP[order.status]}` : ""}
        </span>
      </span>
      <span className="hidden text-right sm:block">
        <span className="block font-display text-xl text-umber-900 tabular-nums">
          {formatMoney(order.total, order.currency as Currency, { cents: true })}
          {!order.totalComplete ? <span className="text-sm text-umber-600"> +</span> : null}
        </span>
        <span className="text-xs text-umber-500">{order.totalComplete ? order.currency : "pending lines"}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-umber-300 transition group-hover:translate-x-0.5 group-hover:text-umber-600" aria-hidden />
    </Link>
  );
}
