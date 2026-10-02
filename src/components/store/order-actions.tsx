"use client";

import { useActionState, useState } from "react";
import { Camera, CheckCircle2, PackageCheck } from "lucide-react";
import { addCaseMessageAction, cancelOrderAction, confirmDeliveryAction, openCaseAction, sendMessageAction } from "@/app/actions/account";
import { cn } from "@/lib/utils/cn";

const field =
  "w-full rounded-xl border border-umber-200 bg-white/90 px-3.5 py-2.5 text-[0.95rem] text-umber-900 placeholder:text-umber-500 transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none";

function Result({ state }: { state: { ok?: boolean; error?: string; message?: string } | null }) {
  if (state?.error)
    return (
      <p className="rounded-xl bg-danger-50 px-4 py-2.5 text-sm text-danger-700" role="alert">
        {state.error}
      </p>
    );
  if (state?.ok && state.message)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success-700" role="status">
        <CheckCircle2 className="size-4" aria-hidden /> {state.message}
      </p>
    );
  return null;
}

export function ConfirmDeliveryForm({ orderNumber, artisans }: { orderNumber: string; artisans: string }) {
  const [state, action, pending] = useActionState(confirmDeliveryAction, null);
  const [checked, setChecked] = useState(false);
  if (state?.ok) return <Result state={state} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order" value={orderNumber} />
      <label className="flex cursor-pointer items-start gap-3 text-sm text-umber-800">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-4 accent-indigo-800" required />
        <span>
          Everything arrived and matches the listing. I understand this releases the held payment to {artisans}, and I can no longer open a case for this order.
        </span>
      </label>
      <button
        disabled={!checked || pending}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-success-600 px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-success-700 disabled:opacity-50"
      >
        <PackageCheck className="size-4" aria-hidden /> {pending ? "Confirming…" : "Confirm delivery"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function OpenCaseForm({ orderNumber, parcels }: { orderNumber: string; parcels: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(openCaseAction, null);
  const [files, setFiles] = useState<string[]>([]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order" value={orderNumber} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="reason" className="text-sm font-medium text-umber-800">
            What went wrong?
          </label>
          <select id="reason" name="reason" required defaultValue="" className={cn(field, "h-11")}>
            <option value="" disabled>
              Choose…
            </option>
            <option value="damaged">It arrived damaged</option>
            <option value="not_as_described">It isn&apos;t as described</option>
            <option value="not_received">It never arrived</option>
            <option value="wrong_item">I received the wrong item</option>
            <option value="other">Something else</option>
          </select>
        </div>
        {parcels.length > 1 ? (
          <div className="space-y-1.5">
            <label htmlFor="vendorOrderId" className="text-sm font-medium text-umber-800">
              Which parcel?
            </label>
            <select id="vendorOrderId" name="vendorOrderId" defaultValue="" className={cn(field, "h-11")}>
              <option value="">The whole order</option>
              {parcels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium text-umber-800">
          Tell us what happened
        </label>
        <textarea id="description" name="description" required minLength={20} rows={4} className={field} placeholder="What's wrong, and when did you notice? The more detail, the faster we can help." />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="desiredOutcome" className="text-sm font-medium text-umber-800">
          What would put it right? <span className="font-normal text-umber-600">(optional)</span>
        </label>
        <input id="desiredOutcome" name="desiredOutcome" maxLength={200} className={cn(field, "h-11")} placeholder="A repair, a replacement, a refund…" />
      </div>
      <div>
        <label htmlFor="evidence" className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-umber-300 bg-sand-50/70 px-4 py-3 text-sm text-umber-700 transition hover:border-umber-500">
          <Camera className="size-5 text-gold-600" aria-hidden />
          <span className="flex-1">{files.length ? files.join(", ") : "Add photos of the piece and the packaging (up to 8)"}</span>
        </label>
        <input id="evidence" name="evidence" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))} />
      </div>
      <Result state={state} />
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className="inline-flex h-11 items-center rounded-full bg-danger-600 px-5 text-sm font-semibold text-white transition hover:bg-danger-700 disabled:opacity-50">
          {pending ? "Opening case…" : "Open a case"}
        </button>
        <p className="text-xs text-umber-500">Held funds are frozen as soon as you open a case.</p>
      </div>
    </form>
  );
}

export function CancelOrderForm({ orderNumber, paid }: { orderNumber: string; paid: boolean }) {
  const [state, action, pending] = useActionState(cancelOrderAction, null);
  if (state?.ok) return <Result state={state} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order" value={orderNumber} />
      <label htmlFor="cancel-reason" className="text-sm font-medium text-umber-800">
        Reason <span className="font-normal text-umber-600">(optional)</span>
      </label>
      <input id="cancel-reason" name="reason" maxLength={300} className={cn(field, "h-11")} placeholder="Changed my mind, ordered by mistake…" />
      <Result state={state} />
      <button disabled={pending} className="inline-flex h-10 items-center rounded-full border border-danger-600/40 px-5 text-sm font-semibold text-danger-700 transition hover:bg-danger-50 disabled:opacity-50">
        {pending ? "Cancelling…" : paid ? "Cancel and refund" : "Cancel order"}
      </button>
    </form>
  );
}

export function ThreadReplyForm({ kind, id, placeholder, allowPhotos }: { kind: "case" | "conversation"; id: string; placeholder: string; allowPhotos?: boolean }) {
  const [state, action, pending] = useActionState(kind === "case" ? addCaseMessageAction : sendMessageAction, null);
  const [files, setFiles] = useState<string[]>([]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name={kind === "case" ? "case" : "conversationId"} value={id} />
      <label htmlFor="reply" className="sr-only">
        Your message
      </label>
      <textarea id="reply" name="body" rows={3} required={!allowPhotos} maxLength={4000} className={field} placeholder={placeholder} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="inline-flex h-10 items-center rounded-full bg-indigo-900 px-5 text-sm font-medium text-sand-50 transition hover:bg-indigo-800 disabled:opacity-50">
          {pending ? "Sending…" : "Send"}
        </button>
        {allowPhotos ? (
          <>
            <label htmlFor="reply-photos" className="inline-flex cursor-pointer items-center gap-2 text-sm text-umber-600 hover:text-umber-900">
              <Camera className="size-4" aria-hidden /> {files.length ? `${files.length} photo${files.length > 1 ? "s" : ""}` : "Add photos"}
            </label>
            <input id="reply-photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))} />
          </>
        ) : null}
      </div>
      {state?.error ? <p className="text-sm text-danger-600">{state.error}</p> : null}
    </form>
  );
}
