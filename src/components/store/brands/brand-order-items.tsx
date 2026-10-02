import Image from "next/image";
import { isSvg } from "@/components/store/illustration-tag";
import { formatMoney, type Currency } from "@/lib/money/currency";

type Item = {
  id: string;
  brandName: string;
  title: string;
  size: string | null;
  colour: string | null;
  qty: number;
  imageUrl: string | null;
  requestedDomain: string | null;
  buyerNote: string | null;
  staffNote: string | null;
  unavailable: boolean;
  unitPrice: number | null;
};

/** Items of a brand order. Link-request items show only the link's domain — never the brand's images. */
export function BrandOrderItems({ items, currency }: { items: Item[]; currency: string }) {
  return (
    <ul className="divide-y divide-umber-200/60 rounded-2xl bg-sand-50 ring-1 ring-umber-200/60">
      {items.map((i) => (
        <li key={i.id} className={i.unavailable ? "flex gap-4 p-4 opacity-60" : "flex gap-4 p-4"}>
          {i.imageUrl ? (
            <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-sand-200">
              <Image src={i.imageUrl} alt="" fill sizes="64px" unoptimized={isSvg(i.imageUrl) || /^https?:/.test(i.imageUrl)} className="object-cover" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-wide text-umber-500 uppercase">
              {i.brandName}
              {i.requestedDomain ? ` · ${i.requestedDomain}` : ""}
            </p>
            <p className="font-medium text-umber-900">
              {i.qty} × {i.title}
            </p>
            <p className="text-sm text-umber-600">{[i.size && `Size ${i.size}`, i.colour].filter(Boolean).join(" · ")}</p>
            {i.buyerNote ? <p className="text-xs text-umber-500">Your note: {i.buyerNote}</p> : null}
            {i.unavailable ? <p className="text-sm text-danger-700">Not available — not included in the total{i.staffNote ? ` (${i.staffNote})` : ""}</p> : i.staffNote ? <p className="text-xs text-umber-500">From our team: {i.staffNote}</p> : null}
          </div>
          <span className="text-sm font-medium whitespace-nowrap text-umber-900 tabular-nums">
            {i.unavailable ? "—" : i.unitPrice != null ? formatMoney(i.unitPrice * i.qty, currency as Currency, { cents: true }) : <span className="text-pending-600">Being priced</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const STEPS = [
  { key: "ordered_from_brand", label: "Bought from the brand" },
  { key: "received_at_wahbayaan", label: "Received at Wahbayaan" },
  { key: "quality_checked", label: "Quality checked" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
] as const;

/** Buyer view of the per-brand fulfilment checklist. */
export function BrandFulfilmentProgress({ fulfilments, trackingLinks }: { fulfilments: { id: string; brandLabel: string; status: string; courier: string | null; trackingNumber: string | null }[]; trackingLinks: Record<string, string | null> }) {
  return (
    <div className="space-y-4">
      {fulfilments.map((f) => {
        const reached = STEPS.findIndex((s) => s.key === f.status);
        return (
          <div key={f.id} className="rounded-2xl bg-sand-50 p-4 ring-1 ring-umber-200/60">
            <p className="text-sm font-semibold text-umber-900">{f.brandLabel}</p>
            {f.status === "cancelled" ? (
              <p className="mt-1 text-sm text-umber-500">Cancelled</p>
            ) : (
              <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-5">
                {STEPS.map((s, i) => (
                  <li key={s.key} className={i <= reached ? "font-medium text-success-700" : "text-umber-400"}>
                    {i <= reached ? "✓ " : ""}
                    {s.label}
                  </li>
                ))}
              </ol>
            )}
            {f.trackingNumber ? (
              <p className="mt-2 text-sm text-umber-700">
                {f.courier} · tracking{" "}
                {trackingLinks[f.id] ? (
                  <a href={trackingLinks[f.id]!} target="_blank" rel="noopener noreferrer" className="text-terracotta-600 underline">
                    {f.trackingNumber}
                  </a>
                ) : (
                  f.trackingNumber
                )}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
