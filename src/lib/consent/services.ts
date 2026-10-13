import type { ConsentGroup } from "./core";

/**
 * Service registry behind the cookie banner. The banner's group list, the
 * "Show service information" cards, the superscript line under the description
 * and the privacy policy's cookie table are all generated from this list.
 * A group without services (e.g. Marketing today) is not shown.
 */
export type ServiceCookie = { name: string; duration: string; purpose: string };
export type ConsentService = {
  id: string;
  group: ConsentGroup;
  name: string;
  provider: string;
  purpose: string;
  legalBasis: string;
  processingIn: string;
  cookies: ServiceCookie[];
  retention: string;
};

export type GroupInfo = { id: ConsentGroup; name: string; description: string };

export const GROUPS: GroupInfo[] = [
  { id: "essential", name: "Essential", description: "Needed for sign-in, your bag, saved pieces, delivery country and remembering this choice." },
  { id: "statistics", name: "Statistics", description: "Counts visits and pages anonymously so we can see what works. First-party only." },
  { id: "functional", name: "Functional", description: "Loads videos from YouTube or Vimeo, which may set their own cookies." },
  { id: "marketing", name: "Marketing", description: "Advertising and remarketing." },
];

export const SERVICES: ConsentService[] = [
  {
    id: "wahbayaan",
    group: "essential",
    name: "Wahbayaan shop",
    provider: "Wahbayaan",
    purpose: "Keeps you signed in, remembers your bag, saved pieces, delivery country and currency, and stores your privacy choice.",
    legalBasis: "Strictly necessary to provide the service you ask for (GDPR Art. 6(1)(b) and (f); ePrivacy exemption)",
    processingIn: "Wahbayaan's own servers (hosting provider Railway)",
    cookies: [
      { name: "wb_session", duration: "30 days", purpose: "Keeps you signed in" },
      { name: "wb_visitor", duration: "1 year", purpose: "Guest bag and saved pieces" },
      { name: "wb_dest", duration: "1 year", purpose: "Delivery country" },
      { name: "wb_currency", duration: "1 year", purpose: "Chosen currency" },
      { name: "wb_compare", duration: "30 days", purpose: "Pieces you are comparing" },
      { name: "wb_orders", duration: "90 days", purpose: "Lets a guest reopen orders placed on this device" },
      { name: "wb_ref", duration: "30 days", purpose: "Credits the friend who referred you" },
      { name: "wb_consent", duration: "1 year", purpose: "Remembers your privacy choices" },
    ],
    retention: "Until the cookie expires or you sign out",
  },
  {
    id: "visitor-statistics",
    group: "statistics",
    name: "Visitor Statistics",
    provider: "Wahbayaan (first-party, no third parties)",
    purpose: "Counts visits, pages viewed and approximate location (city level) so we can improve the shop. Never used for advertising.",
    legalBasis: "Your consent (GDPR Art. 6(1)(a))",
    processingIn: "Wahbayaan's own servers (hosting provider Railway); city lookup by our IP-location provider",
    cookies: [{ name: "wb_visit", duration: "30 minutes, renewed while you browse", purpose: "Groups the pages of one visit" }],
    retention: "90 days, then deleted automatically",
  },
  {
    id: "media",
    group: "functional",
    name: "YouTube/Vimeo",
    provider: "Google Ireland Ltd. (YouTube), Vimeo.com Inc.",
    purpose: "Plays artisans' process and story videos embedded on product and artisan pages.",
    legalBasis: "Your consent (GDPR Art. 6(1)(a))",
    processingIn: "USA and EU (provider's servers)",
    cookies: [
      { name: "YSC, VISITOR_INFO1_LIVE, PREF", duration: "Session to 6 months", purpose: "YouTube playback and preferences (set by YouTube)" },
      { name: "vuid, __cf_bm", duration: "30 minutes to 2 years", purpose: "Vimeo playback and analytics (set by Vimeo)" },
    ],
    retention: "Set by the provider",
  },
];

/** Groups that are shown: Essential and Statistics always, others only when they have services. */
export function visibleGroups(services: ConsentService[] = SERVICES): GroupInfo[] {
  return GROUPS.filter((g) => g.id === "essential" || g.id === "statistics" || services.some((s) => s.group === g.id));
}

/**
 * The superscript line: optional services numbered by their group's position.
 * e.g. services: [{ name: "Visitor Statistics", n: 2 }], groups: [{ name: "Statistics", n: 2 }]
 */
export function serviceFootnotes(services: ConsentService[] = SERVICES) {
  const groups = visibleGroups(services);
  const num = (g: ConsentGroup) => groups.findIndex((x) => x.id === g) + 1;
  const optional = services.filter((s) => s.group !== "essential");
  const usedGroups = groups.filter((g) => g.id !== "essential" && optional.some((s) => s.group === g.id));
  return {
    services: optional.map((s) => ({ name: s.name, n: num(s.group) })),
    groups: usedGroups.map((g) => ({ name: g.name, n: num(g.id) })),
  };
}
