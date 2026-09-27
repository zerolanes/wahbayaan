import { BadgeCheck, CircleDashed, XCircle } from "lucide-react";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { getSellerVendor } from "@/lib/seller/queries";
import { getSetting } from "@/lib/settings";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Verification" };

const STEPS = [
  { kind: "identity", title: "Identity", text: "Your CNIC checked against a selfie on a short call." },
  { kind: "workshop", title: "Workshop", text: "Photos or a video walk-through of where you work." },
  { kind: "samples", title: "Sample work", text: "Recent pieces reviewed by our artisan-relations team." },
  { kind: "video_call", title: "Video call", text: "A 15-minute call to meet you and see the work in progress." },
  { kind: "address", title: "Location", text: "Your workshop's city confirmed — shown to buyers as a verified location." },
] as const;

export default async function SellerVerification() {
  const user = await requireSeller();
  const [{ vendor }, site] = await Promise.all([getSellerVendor(user.vendorId), getSetting("site")]);
  const status = vendor.status;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your shop"
        title="Verification"
        description="The Verified Artisan badge tells buyers abroad that we have met you and seen your work. It's the reason they trust a stranger with a large purchase."
      />
      {status === "verified" ? (
        <Notice tone="success" title="You're a Verified Artisan" icon={<BadgeCheck className="size-4" />}>
          Verified on {formatDate(vendor.verifiedAt)}. The badge appears on your shop and every listing.
        </Notice>
      ) : status === "suspended" ? (
        <Notice tone="danger" title="Your shop is suspended">
          Please contact {site.supportEmail}.
        </Notice>
      ) : (
        <Notice tone="pending" title="Verification in progress">
          Our team will contact you to arrange the remaining checks. You can prepare listings in the meantime.
        </Notice>
      )}
      <Card>
        <CardHeader title="Checks" />
        <ul className="divide-umber-200/60 divide-y">
          {STEPS.map((s) => {
            const check = vendor.checks.find((c) => c.kind === s.kind);
            const st = check?.status ?? "not_started";
            return (
              <li key={s.kind} className="flex items-start gap-4 px-5 py-4">
                {st === "passed" ? (
                  <BadgeCheck className="text-success-600 size-5" />
                ) : st === "failed" ? (
                  <XCircle className="text-danger-600 size-5" />
                ) : (
                  <CircleDashed className="text-umber-400 size-5" />
                )}
                <div className="flex-1">
                  <p className="text-umber-900 font-medium">{s.title}</p>
                  <p className="text-umber-600 text-sm">{s.text}</p>
                  {check?.notes && st !== "passed" ? <p className="text-umber-500 mt-1 text-sm">Note from our team: {check.notes}</p> : null}
                </div>
                <Badge tone={st === "passed" ? "success" : st === "failed" ? "danger" : "neutral"}>{st === "not_started" ? "Not started" : st}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="text-umber-500 text-sm">
        Questions? Write to {site.supportEmail}
        {site.whatsapp ? ` or WhatsApp ${site.whatsapp}` : ""}.
      </p>
    </div>
  );
}
