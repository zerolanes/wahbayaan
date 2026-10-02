import {
  Activity, BadgePercent, BarChart3, BookOpen, Boxes, CircleDollarSign, ClipboardCheck, CreditCard, FileText, Flag, Gauge, Gift, Globe2, MapPinned,
  HandCoins, Home, Image as ImageIcon, Inbox, Landmark, Layers, LayoutDashboard, Mail, Megaphone, MessagesSquare, Package,
  PackageSearch, Palette, Receipt, Scale, ScrollText, Settings, Shield, ShieldAlert, Ship, Sparkles, Star, Store, Tags,
  Truck, UserCheck, Users, Wallet, Waypoints, Wrench,
} from "lucide-react";
import type { NavGroup } from "@/components/dashboard/nav-types";

export type AdminCounts = {
  awaitingQuote: number;
  openDisputes: number;
  pendingApplications: number;
  pendingListings: number;
  pendingReviews: number;
  newMessages: number;
  newRequests: number;
  brandQueue: number;
};

/** Company admin navigation. Items are hidden when the staff role lacks the permission. */
export function adminNav(c: AdminCounts): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", icon: <LayoutDashboard />, exact: true, permission: "dashboard.view" },
        { href: "/admin/readiness", label: "Launch readiness", icon: <ClipboardCheck />, permission: "dashboard.view" },
        { href: "/admin/activity", label: "Live activity", icon: <Activity />, permission: "dashboard.view" },
      ],
    },
    {
      label: "Orders & money",
      items: [
        { href: "/admin/orders", label: "Orders", icon: <Package />, permission: "orders.view" },
        { href: "/admin/quotes", label: "Quotes to send", icon: <Receipt />, permission: "orders.manage", badge: c.awaitingQuote },
        { href: "/admin/escrow", label: "Escrow & payments", icon: <Landmark />, permission: "escrow.release" },
        { href: "/admin/disputes", label: "Disputes", icon: <ShieldAlert />, permission: "disputes.view", badge: c.openDisputes },
        { href: "/admin/refunds", label: "Refunds", icon: <HandCoins />, permission: "orders.refund" },
        { href: "/admin/payouts", label: "Artisan payouts", icon: <Wallet />, permission: "payouts.view" },
        { href: "/admin/shipments", label: "Shipments", icon: <Truck />, permission: "orders.view" },
      ],
    },
    {
      label: "Marketplace",
      items: [
        { href: "/admin/artisans", label: "Artisans", icon: <Store />, permission: "vendors.view" },
        { href: "/admin/applications", label: "Applications", icon: <UserCheck />, permission: "vendors.view", badge: c.pendingApplications },
        { href: "/admin/listings", label: "Listings", icon: <Boxes />, permission: "products.view", badge: c.pendingListings },
        { href: "/admin/categories", label: "Categories", icon: <Layers />, permission: "categories.manage" },
        { href: "/admin/reviews", label: "Reviews", icon: <Star />, permission: "reviews.moderate", badge: c.pendingReviews },
        { href: "/admin/collections", label: "Collections & bundles", icon: <Sparkles />, permission: "content.manage" },
        { href: "/admin/certificates", label: "Certificates", icon: <ScrollText />, permission: "products.view" },
      ],
    },
    {
      label: "Pakistani Brands",
      items: [
        { href: "/admin/brands", label: "Brands", icon: <Tags />, permission: "brands.view" },
        { href: "/admin/brand-products", label: "Brand products", icon: <Boxes />, permission: "brands.view" },
        { href: "/admin/brand-requests", label: "Brand orders & requests", icon: <PackageSearch />, permission: "orders.view", badge: c.brandQueue },
        { href: "/admin/rates/service-fee", label: "Service fee", icon: <BadgePercent />, permission: "rates.view" },
      ],
    },
    {
      label: "Delivery & payments",
      items: [
        { href: "/admin/couriers", label: "Couriers & rate cards", icon: <Truck />, permission: "couriers.manage" },
        { href: "/admin/rates/domestic", label: "Domestic zones", icon: <MapPinned />, permission: "couriers.manage" },
        { href: "/admin/payment-methods", label: "Payment methods", icon: <CreditCard />, permission: "payments.manage" },
      ],
    },
    {
      label: "Cross-border",
      items: [
        { href: "/admin/rates/fx", label: "Exchange rates", icon: <CircleDollarSign />, permission: "rates.view" },
        { href: "/admin/rates/shipping", label: "Shipping rates", icon: <Ship />, permission: "rates.view" },
        { href: "/admin/rates/duty", label: "Duty & import tax", icon: <Scale />, permission: "rates.view" },
        { href: "/admin/rates/rules", label: "Import rules", icon: <Globe2 />, permission: "rates.view" },
        { href: "/admin/rates/fees", label: "Fees & commission", icon: <BadgePercent />, permission: "rates.view" },
      ],
    },
    {
      label: "Customers",
      items: [
        { href: "/admin/customers", label: "Customers", icon: <Users />, permission: "customers.view" },
        { href: "/admin/requests", label: "Custom requests", icon: <Wrench />, permission: "requests.manage", badge: c.newRequests },
        { href: "/admin/wholesale", label: "Wholesale", icon: <Tags />, permission: "requests.manage" },
        { href: "/admin/inbox", label: "Support inbox", icon: <Inbox />, permission: "support.manage", badge: c.newMessages },
        { href: "/admin/conversations", label: "Conversations", icon: <MessagesSquare />, permission: "support.manage" },
        { href: "/admin/waitlists", label: "Waitlists", icon: <PackageSearch />, permission: "requests.manage" },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/content/home", label: "Homepage", icon: <Home />, permission: "content.manage" },
        { href: "/admin/content/journal", label: "Journal", icon: <BookOpen />, permission: "content.manage" },
        { href: "/admin/content/pages", label: "Pages & FAQ", icon: <FileText />, permission: "content.manage" },
        { href: "/admin/content/announcements", label: "Announcements", icon: <Megaphone />, permission: "marketing.manage" },
        { href: "/admin/media", label: "Media library", icon: <ImageIcon />, permission: "media.manage" },
        { href: "/admin/redirects", label: "Redirects", icon: <Waypoints />, permission: "settings.manage" },
      ],
    },
    {
      label: "Growth",
      items: [
        { href: "/admin/coupons", label: "Coupons", icon: <Gift />, permission: "marketing.manage" },
        { href: "/admin/referrals", label: "Referrals & loyalty", icon: <Palette />, permission: "marketing.manage" },
        { href: "/admin/newsletter", label: "Newsletter", icon: <Mail />, permission: "marketing.manage" },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/admin/reports", label: "Reports", icon: <BarChart3 />, permission: "reports.view" },
        { href: "/admin/health", label: "System health", icon: <Gauge />, permission: "settings.manage" },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/staff", label: "Staff & roles", icon: <Shield />, permission: "staff.manage" },
        { href: "/admin/settings", label: "Settings", icon: <Settings />, permission: "settings.manage" },
        { href: "/admin/flags", label: "Feature flags", icon: <Flag />, permission: "settings.manage" },
        { href: "/admin/emails", label: "Email outbox", icon: <Mail />, permission: "settings.manage" },
        { href: "/admin/audit", label: "Audit log", icon: <ScrollText />, permission: "audit.view" },
      ],
    },
  ];
}
