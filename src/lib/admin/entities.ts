import type { Permission } from "@/lib/auth/permissions";

/**
 * Entities that carry admin notes and audit trails, with the permission needed
 * to annotate them and a link builder for the audit log.
 */
export const NOTE_ENTITIES: Record<string, { label: string; permission: Permission }> = {
  order: { label: "Order", permission: "orders.view" },
  vendor: { label: "Artisan", permission: "vendors.view" },
  customer: { label: "Customer", permission: "customers.view" },
  product: { label: "Listing", permission: "products.view" },
  dispute: { label: "Dispute", permission: "disputes.view" },
  application: { label: "Application", permission: "vendors.view" },
  request: { label: "Custom request", permission: "requests.manage" },
  wholesale: { label: "Wholesale lead", permission: "requests.manage" },
  conversation: { label: "Conversation", permission: "support.manage" },
  conversation_flag: { label: "Conversation flag", permission: "support.manage" },
  ticket: { label: "Support message", permission: "support.manage" },
  payout: { label: "Payout", permission: "payouts.view" },
};

/** Where an audited entity lives in the admin (by entity name + id). */
export function entityHref(entity: string, id: string | null | undefined, extra?: { number?: string | null }): string | null {
  if (!id && !extra?.number) return null;
  switch (entity) {
    case "order":
      return extra?.number ? `/admin/orders/${extra.number}` : null;
    case "dispute":
      return extra?.number ? `/admin/disputes/${extra.number}` : null;
    case "vendor":
      return `/admin/artisans/${id}`;
    case "product":
      return `/admin/listings/${id}`;
    case "application":
      return `/admin/applications/${id}`;
    case "customer":
    case "user":
      return `/admin/customers/${id}`;
    case "category":
      return `/admin/categories#${id}`;
    case "journal":
      return `/admin/content/journal/${id}`;
    case "collection":
      return `/admin/collections/${id}`;
    case "staff":
      return `/admin/staff`;
    case "role":
      return `/admin/staff#roles`;
    case "setting":
      return `/admin/settings`;
    case "coupon":
      return id ? `/admin/coupons/${id}` : `/admin/coupons`;
    case "ticket":
      return `/admin/inbox/${id}`;
    case "conversation":
      return `/admin/conversations/${id}`;
    case "request":
      return `/admin/requests/${id}`;
    case "wholesale":
      return `/admin/wholesale#${id}`;
    case "page":
      return `/admin/content/pages/${id}`;
    case "announcement":
      return `/admin/content/announcements`;
    case "newsletter":
      return `/admin/newsletter`;
    case "waitlist":
      return `/admin/waitlists?product=${id}`;
    case "payout":
      return `/admin/payouts`;
    case "fx_rate":
      return `/admin/rates/fx`;
    case "shipping_rate":
      return `/admin/rates/shipping`;
    case "duty_rate":
      return `/admin/rates/duty`;
    case "import_rule":
      return `/admin/rates/rules`;
    default:
      return null;
  }
}
