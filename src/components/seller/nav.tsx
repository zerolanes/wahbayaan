import { BadgeCheck, BookOpen, Boxes, LayoutDashboard, MessagesSquare, Package, PlusCircle, Settings, Star, Store, Wallet, Wrench } from "lucide-react";
import type { NavGroup } from "@/components/dashboard/nav-types";

export function sellerNav(c: { newOrders: number; newRequests: number; unreadMessages: number }): NavGroup[] {
  return [
    {
      label: "Workshop",
      items: [
        { href: "/seller", label: "Overview", icon: <LayoutDashboard />, exact: true },
        { href: "/seller/orders", label: "Orders", icon: <Package />, badge: c.newOrders },
        { href: "/seller/listings", label: "Listings", icon: <Boxes />, exact: true },
        { href: "/seller/listings/new", label: "Add a listing", icon: <PlusCircle /> },
        { href: "/seller/requests", label: "Custom requests", icon: <Wrench />, badge: c.newRequests },
        { href: "/seller/messages", label: "Messages", icon: <MessagesSquare />, badge: c.unreadMessages },
        { href: "/seller/reviews", label: "Reviews", icon: <Star /> },
      ],
    },
    {
      label: "Money",
      items: [{ href: "/seller/payouts", label: "Payouts (PKR)", icon: <Wallet /> }],
    },
    {
      label: "Your shop",
      items: [
        { href: "/seller/storefront", label: "Storefront profile", icon: <Store /> },
        { href: "/seller/verification", label: "Verification", icon: <BadgeCheck /> },
        { href: "/seller/guide", label: "International orders guide", icon: <BookOpen /> },
        { href: "/seller/settings", label: "Settings", icon: <Settings /> },
      ],
    },
  ];
}
