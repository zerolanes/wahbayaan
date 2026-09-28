import type { SettingsShape } from "@/lib/settings";

export type FlagKey = keyof SettingsShape["feature_flags"];

/**
 * What each feature flag controls. `surfaces` lists where the feature appears
 * so staff know what switching it off hides.
 */
export const FLAG_META: Record<FlagKey, { label: string; description: string; surfaces: string[] }> = {
  customRequests: {
    label: "Custom requests",
    description: "Buyers can ask an artisan for a commissioned piece (size, colours, calligraphy text) and receive a quote.",
    surfaces: ["Product and artisan pages", "Account → Requests", "Admin → Custom requests"],
  },
  wholesale: {
    label: "Wholesale & trade",
    description: "Interior designers and stores can apply for trade pricing and minimum-quantity orders.",
    surfaces: ["Trade page", "Wholesale prices on listings", "Admin → Wholesale"],
  },
  limitedDrops: {
    label: "Limited drops",
    description: "Numbered editions with a countdown and a waitlist before release.",
    surfaces: ["Drops page", "Countdown on product pages", "Waitlists"],
  },
  referrals: {
    label: "Referrals",
    description: "Buyers share a code; both sides earn points once the first order is delivered. Point values are set in Settings.",
    surfaces: ["Account → Referrals", "Checkout referral field"],
  },
  gifting: {
    label: "Gifting",
    description: "Gift orders with a message and hidden prices on the packing slip; gift wrap when its price is set.",
    surfaces: ["Cart and checkout gift options"],
  },
  journal: {
    label: "Journal",
    description: "Editorial stories about crafts, regions and artisans.",
    surfaces: ["Journal pages", "Journal links in navigation and footer"],
  },
  compare: {
    label: "Compare",
    description: "Side-by-side comparison of up to four pieces.",
    surfaces: ["Compare toggle on product cards", "Compare page"],
  },
  messaging: {
    label: "Buyer–artisan messaging",
    description: "Buyers can message an artisan about a piece. Conversations are moderated in Admin → Conversations.",
    surfaces: ["“Ask the artisan” on product pages", "Account → Messages", "Seller inbox"],
  },
};

export const FLAG_KEYS = Object.keys(FLAG_META) as FlagKey[];
