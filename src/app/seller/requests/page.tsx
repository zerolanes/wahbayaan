import { Wrench } from "lucide-react";
import { declineCustomRequest, quoteCustomRequest } from "@/app/actions/seller";
import { SellerPrice } from "@/components/money/seller-price";
import { ActionForm, SubmitButton } from "@/components/seller/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { listSellerRequests } from "@/lib/seller/queries";
import { destinationName } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Custom requests" };

const TONE = {
  new: "terracotta",
  quoted: "gold",
  accepted: "success",
  declined: "neutral",
  expired: "neutral",
  converted: "success",
  cancelled: "neutral",
} as const;

export default async function SellerRequests() {
  const user = await requireSeller();
  const requests = await listSellerRequests(user.vendorId);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commissions"
        title="Custom requests"
        description="Buyers asking you to make something for them. Quote in rupees and days — the buyer sees your quote in their own currency."
      />
      {requests.length ? (
        <div className="space-y-5">
          {requests.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-umber-500 text-xs">
                    {r.number} · {formatDate(r.createdAt)} · for delivery to {destinationName(r.destinationCountry)}
                  </p>
                  <h3 className="font-display text-umber-900 mt-1 text-xl">
                    {r.category?.name ?? "Custom piece"}
                    {r.product ? ` — based on “${r.product.title}”` : ""}
                  </h3>
                </div>
                <Badge tone={TONE[r.status]}>{r.status}</Badge>
              </div>
              <p className="text-umber-700 mt-3">{r.details}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                {r.customText ? (
                  <div>
                    <dt className="text-umber-500 text-xs">Text to write</dt>
                    <dd className="font-medium">{r.customText}</dd>
                  </div>
                ) : null}
                {r.sizeNotes ? (
                  <div>
                    <dt className="text-umber-500 text-xs">Size</dt>
                    <dd>{r.sizeNotes}</dd>
                  </div>
                ) : null}
                {r.colorNotes ? (
                  <div>
                    <dt className="text-umber-500 text-xs">Colours</dt>
                    <dd>{r.colorNotes}</dd>
                  </div>
                ) : null}
              </dl>
              {r.status === "quoted" && r.quotePkr ? (
                <p className="bg-gold-50 text-gold-900 mt-4 rounded-xl px-4 py-3 text-sm">
                  Your quote: <SellerPrice pkr={r.quotePkr} className="font-semibold" /> · {r.quoteDays} days{r.quoteMessage ? ` — “${r.quoteMessage}”` : ""}.
                  Waiting for the buyer.
                </p>
              ) : null}
              {r.status === "new" || r.status === "quoted" ? (
                <div className="border-umber-200/60 mt-5 grid gap-4 border-t pt-5 md:grid-cols-[1fr_auto]">
                  <ActionForm action={quoteCustomRequest} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end sm:space-y-0">
                    <>
                      <input type="hidden" name="requestId" value={r.id} />
                      <Field label="Your price (Rs)" htmlFor={`q-${r.id}`}>
                        <Input id={`q-${r.id}`} name="quotePkr" inputMode="numeric" defaultValue={r.quotePkr ? r.quotePkr / 100 : ""} required />
                      </Field>
                      <Field label="Days to make" htmlFor={`d-${r.id}`}>
                        <Input id={`d-${r.id}`} name="quoteDays" type="number" min={1} defaultValue={r.quoteDays ?? ""} required />
                      </Field>
                      <Field label="Message (optional)" htmlFor={`m-${r.id}`}>
                        <Input id={`m-${r.id}`} name="quoteMessage" defaultValue={r.quoteMessage ?? ""} placeholder="I'll send two sketches first…" />
                      </Field>
                      <SubmitButton>{r.status === "quoted" ? "Update quote" : "Send quote"}</SubmitButton>
                    </>
                  </ActionForm>
                  <form action={declineCustomRequest} className="flex items-end gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <Textarea name="reason" placeholder="Reason (optional)" className="min-h-11 w-44" rows={1} />
                    <Button type="submit" variant="ghost">
                      Decline
                    </Button>
                  </form>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Wrench className="size-8" />} title="No commission requests yet">
          Buyers can ask you for custom work from your shop page while “Accept custom orders” is on in your storefront settings.
        </EmptyState>
      )}
    </div>
  );
}
