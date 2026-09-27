import { Card, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "International orders guide" };

export default async function SellerGuide() {
  await requireSeller();
  const s = await getSettings(["commission", "escrow"]);
  const sections = [
    {
      title: "1. Pricing",
      body: [
        "List your price in rupees — the amount you want for the piece.",
        "Buyers see it converted into dollars, pounds or Canadian dollars. They separately pay international shipping, their country's import duty and any taxes, so never add those to your price.",
        s.commission.status === "active"
          ? `Wahbayaan's commission is ${s.commission.defaultBps / 100}% of your price, deducted when you're paid.`
          : "Wahbayaan's commission rate is being finalised; it will be shown on every order before any payout.",
      ],
    },
    {
      title: "2. When an order arrives",
      body: [
        "You only see orders the buyer has already paid for — the money is held safely by Wahbayaan.",
        "Accept the order promptly. For made-to-order pieces, tap “Start making” so the buyer can follow along.",
        "Read any customisation carefully (names, sizes, colours). If anything is unclear, message the buyer from the order.",
      ],
    },
    {
      title: "3. Packing for export",
      body: [
        "Parcels travel thousands of kilometres and change hands several times. Double-box fragile pieces with at least 5 cm of padding on every side.",
        "Roll rugs pile-side in around a tube, wrap in plastic against moisture, then a strong outer bag.",
        "Keep calligraphy and paintings flat with corner protectors; pack glass separately or use acrylic.",
        "Photograph the piece and the sealed box before you hand it over.",
      ],
    },
    {
      title: "4. Courier & customs",
      body: [
        "Wahbayaan prepares the commercial invoice (the customs form) from the order — description, HS code, declared value and your workshop as the shipper.",
        "Hand the parcel to the courier Wahbayaan confirms, then enter the courier and tracking number on the order.",
        "Customs duties are paid by the buyer in their country. You never pay import charges.",
      ],
    },
    {
      title: "5. Getting paid",
      body: [
        "When the buyer confirms delivery, or " +
          s.escrow.autoReleaseDaysAfterDelivery +
          " days after delivery if they don't respond, the money is released to you.",
        "Payouts are sent to your bank in PKR. You'll see every order's earnings on the Payouts page.",
        "If a buyer reports damage, the money stays held while our team works it out with you and the buyer — good packing photos protect you.",
      ],
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guide"
        title="How international orders & payouts work"
        description="Everything you need to sell abroad — without becoming an export expert."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map((sec) => (
          <Card key={sec.title} className="p-6">
            <h2 className="font-display text-umber-900 text-2xl">{sec.title}</h2>
            <ul className="text-umber-700 mt-3 list-disc space-y-2 pl-5 text-sm">
              {sec.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
