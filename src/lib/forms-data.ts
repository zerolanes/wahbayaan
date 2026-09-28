/** Shared option lists for storefront forms (usable from client and server). */
export const CONTACT_TOPICS = [
  { id: "order", label: "A question about my order" },
  { id: "duties", label: "Shipping, duties & import costs" },
  { id: "product", label: "A question about a piece" },
  { id: "commission", label: "Commissions & custom work" },
  { id: "artisan", label: "I'm an artisan — selling on Wahbayaan" },
  { id: "wholesale", label: "Trade & wholesale" },
  { id: "press", label: "Press & partnerships" },
  { id: "other", label: "Something else" },
] as const;

export const BUSINESS_TYPES = [
  { id: "interior_designer", label: "Interior designer" },
  { id: "retailer", label: "Retailer or gallery" },
  { id: "hospitality", label: "Hotel or hospitality" },
  { id: "architect", label: "Architect" },
  { id: "corporate_gifting", label: "Corporate gifting" },
  { id: "other", label: "Something else" },
] as const;
